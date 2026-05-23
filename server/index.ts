import './loadEnv.js';
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';
import { Resend } from 'resend';
import multer from 'multer';
import { signUserToken, signAdminJwt } from './auth/jwt.js';
import { resolveUserId } from './auth/resolveUser.js';
import { registerForexRoutes } from './forex/forexRoutes.js';
import { registerMemberApiRoutes } from './routes/memberApi.js';
import { registerEadAndTrialRoutes } from './routes/eadAndTrial.js';
import { registerAdminForexRoutes } from './routes/adminForex.js';
import { startScheduledJobs } from './jobs/scheduler.js';
import { userHasMemberAccess } from './lib/userAccess.js';
import { hashMemberPassword, verifyUserPassword } from './lib/verifyUserPassword.js';
import { adminAuthMiddleware } from './middleware/adminAuth.js';
import { validateAdminCredentials } from './lib/adminPassword.js';
import { ensureDevTestAccount } from './lib/ensureDevTestAccount.js';
import { MEMBER_THEME_DEFAULTS, MEMBER_THEME_KEYS } from '../shared/memberTheme.js';

const DEFAULT_PASSWORD = 'Mudar123@';

const DEFAULT_APP_URL = 'https://app.readlyme.com';
function getAppUrl() {
  const raw = (process.env.APP_URL || DEFAULT_APP_URL).trim();
  return raw.endsWith('/') ? raw.slice(0, -1) : raw;
}

// Spanish-speaking country ISO codes
const ES_COUNTRIES = ['AR','BO','CL','CO','CR','CU','DO','EC','SV','GQ','GT','HN','MX','NI','PA','PY','PE','ES','UY','VE'];

// ==========================================
// EMAIL HELPER (RESEND)
// ==========================================
async function getSetting(prismaClient: PrismaClient, key: string): Promise<string | null> {
  const s = await prismaClient.setting.findUnique({ where: { key } });
  return s?.value || null;
}

async function sendEmail(prismaClient: PrismaClient, to: string, subject: string, html: string) {
  try {
    const apiKey = await getSetting(prismaClient, 'resend_api_key');
    if (!apiKey) { console.log('[Email] No Resend API key configured. Skipping.'); return; }

    const senderName = (await getSetting(prismaClient, 'sender_name')) || 'EbookPro';
    const senderEmail = (await getSetting(prismaClient, 'sender_email')) || 'noreply@example.com';

    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: `${senderName} <${senderEmail}>`,
      to: [to],
      subject,
      html
    });
    if (error) console.error('[Email] Resend error:', error);
    else console.log(`[Email] ✅ Sent to ${to}: ${subject}`);
  } catch (err) {
    console.error('[Email] Failed to send:', err);
  }
}

function detectLang(country: string | null | undefined): 'es' | 'pt' {
  if (!country) return 'pt';
  return ES_COUNTRIES.includes(country.toUpperCase()) ? 'es' : 'pt';
}

function normalizeShortLinkSlug(raw: string): string {
  return String(raw || '')
    .trim()
    .replace(/^\/+/, '')
    .replace(/\/+$/, '')
    .replace(/\/+/g, '/')
    .toLowerCase();
}

function detectDeviceType(userAgentRaw: string | undefined): 'mobile' | 'desktop' {
  const ua = String(userAgentRaw || '').toLowerCase();
  return /android|iphone|ipad|ipod|mobile|windows phone|opera mini/.test(ua) ? 'mobile' : 'desktop';
}

function getCountryCodeFromHeaders(req: express.Request): string {
  const v = String(
    req.headers['cf-ipcountry'] ||
      req.headers['x-vercel-ip-country'] ||
      req.headers['cloudfront-viewer-country'] ||
      ''
  )
    .trim()
    .toUpperCase();
  return /^[A-Z]{2}$/.test(v) ? v : '';
}

function getRegionCodeFromHeaders(req: express.Request): string {
  const v = String(
    req.headers['x-vercel-ip-country-region'] ||
      req.headers['cloudfront-viewer-country-region'] ||
      req.headers['cf-region-code'] ||
      ''
  )
    .trim()
    .toUpperCase();
  return v.replace(/[^A-Z0-9_-]/g, '').slice(0, 10);
}

function getClientIp(req: express.Request): string {
  const xff = String(req.headers['x-forwarded-for'] || '').trim();
  if (xff) return xff.split(',')[0].trim().slice(0, 45);
  const ip = String(req.ip || req.socket?.remoteAddress || '').trim();
  return ip.slice(0, 45);
}

function appendTrackingParams(targetUrl: string, utmParamsJson: string | null): string {
  if (!utmParamsJson) return targetUrl;
  try {
    const parsed = JSON.parse(utmParamsJson) as Record<string, unknown>;
    const entries = Object.entries(parsed).filter(([, v]) => String(v || '').trim().length > 0);
    if (!entries.length) return targetUrl;
    const url = new URL(targetUrl);
    for (const [k, v] of entries) url.searchParams.set(k, String(v));
    return url.toString();
  } catch {
    return targetUrl;
  }
}

function applySmartRouting(
  targetUrl: string,
  smartRulesJson: string | null,
  countryCode: string,
  regionCode: string,
  deviceType: 'mobile' | 'desktop'
): string {
  if (!smartRulesJson) return targetUrl;
  try {
    const rules = JSON.parse(smartRulesJson) as Array<{
      type?: string;
      value?: string;
      region?: string;
      target?: string;
    }>;
    if (!Array.isArray(rules)) return targetUrl;
    for (const rule of rules) {
      const type = String(rule?.type || '').toLowerCase();
      const value = String(rule?.value || '').trim();
      const target = String(rule?.target || '').trim();
      if (!type || !value || !target) continue;
      if (type === 'device' && value.toLowerCase() === deviceType) return target;
      if (type === 'geo' && countryCode) {
        const countries = value
          .toUpperCase()
          .split(',')
          .map((x) => x.trim())
          .filter(Boolean);
        if (!countries.includes(countryCode)) continue;
        const requiredRegion = String(rule?.region || '').trim().toUpperCase();
        if (requiredRegion && requiredRegion !== regionCode) continue;
        return target;
      }
    }
    return targetUrl;
  } catch {
    return targetUrl;
  }
}

async function sendWelcomeEmail(prismaClient: PrismaClient, email: string, name: string | null, password: string, country: string | null) {
  const lang = detectLang(country);
  const templateKey = lang === 'es' ? 'welcome_template_es' : 'welcome_template_pt';
  let template = await getSetting(prismaClient, templateKey);

  // Fallback default template
  if (!template) {
    template = lang === 'es'
      ? `<div style="font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:600px;margin:20px auto;padding:40px;border-radius:16px;background-color:#ffffff;box-shadow:0 4px 20px rgba(0,0,0,0.05);border:1px solid #f0f0f0;">
          <div style="text-align:center;margin-bottom:30px;">
            <img src="https://readlyme.com/logo.png" alt="Readlyme" style="width:180px;">
          </div>
          <h1 style="color:#1a1a1a;font-size:24px;text-align:center;margin-bottom:20px;">¡Bienvenido(a), {{name}}!</h1>
          <p style="color:#444;font-size:16px;line-height:1.6;margin-bottom:25px;">Estamos felices de tenerte con nosotros. Tu acceso a la biblioteca premium de <strong>Readlyme</strong> ya está activo.</p>
          <div style="background-color:#f9f9f9;padding:20px;border-radius:12px;margin-bottom:30px;">
            <p style="margin:0 0 10px 0;color:#666;font-size:14px;">Tus datos de acceso:</p>
            <p style="margin:0;color:#1a1a1a;font-size:16px;"><strong>E-mail:</strong> {{email}}</p>
            <p style="margin:5px 0 0 0;color:#1a1a1a;font-size:16px;"><strong>Contraseña temporal:</strong> <code style="background:#eee;padding:2px 6px;border-radius:4px;">{{password}}</code></p>
          </div>
          <div style="text-align:center;">
            <a href="{{app_url}}" style="display:inline-block;background-color:#3b82f6;color:#ffffff;padding:16px 32px;text-decoration:none;border-radius:12px;font-weight:bold;font-size:16px;">Entrar a la Biblioteca</a>
          </div>
          <p style="color:#888;font-size:13px;text-align:center;margin-top:30px;">Recomendamos que cambies tu contraseña después de tu primer inicio de sesión.</p>
        </div>`
      : `<div style="font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:600px;margin:20px auto;padding:40px;border-radius:16px;background-color:#ffffff;box-shadow:0 4px 20px rgba(0,0,0,0.05);border:1px solid #f0f0f0;">
          <div style="text-align:center;margin-bottom:30px;">
            <img src="https://readlyme.com/logo.png" alt="Readlyme" style="width:180px;">
          </div>
          <h1 style="color:#1a1a1a;font-size:24px;text-align:center;margin-bottom:20px;">Bem-vindo(a), {{name}}!</h1>
          <p style="color:#444;font-size:16px;line-height:1.6;margin-bottom:25px;">Ficamos felizes em ter você conosco. Seu acesso à biblioteca premium da <strong>Readlyme</strong> já está liberado.</p>
          <div style="background-color:#f9f9f9;padding:20px;border-radius:12px;margin-bottom:30px;">
            <p style="margin:0 0 10px 0;color:#666;font-size:14px;">Seus dados de acesso:</p>
            <p style="margin:0;color:#1a1a1a;font-size:16px;"><strong>E-mail:</strong> {{email}}</p>
            <p style="margin:5px 0 0 0;color:#1a1a1a;font-size:16px;"><strong>Senha temporária:</strong> <code style="background:#eee;padding:2px 6px;border-radius:4px;">{{password}}</code></p>
          </div>
          <div style="text-align:center;">
            <a href="{{app_url}}" style="display:inline-block;background-color:#3b82f6;color:#ffffff;padding:16px 32px;text-decoration:none;border-radius:12px;font-weight:bold;font-size:16px;">Acessar Biblioteca</a>
          </div>
          <p style="color:#888;font-size:13px;text-align:center;margin-top:30px;">Recomendamos que troque sua senha após o primeiro login.</p>
        </div>`;
  }

  const appUrl = getAppUrl();
  const html = template
    .replace(/\{\{name\}\}/g, name || (lang === 'es' ? 'Lector(a)' : 'Leitor(a)'))
    .replace(/\{\{email\}\}/g, email)
    .replace(/\{\{password\}\}/g, password)
    .replace(/\{\{country\}\}/g, country || '-')
    .replace(/\{\{app_url\}\}/g, appUrl);

  const subject = lang === 'es' ? '¡Bienvenido(a) a Readlyme! Tu acceso está listo' : 'Bem-vindo(a) à Readlyme! Seu acesso está pronto';
  await sendEmail(prismaClient, email, subject, html);
}

// ES Modules directory name polyfill
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

registerForexRoutes(app, prisma);
registerMemberApiRoutes(app, prisma);
registerEadAndTrialRoutes(app, prisma);
startScheduledJobs(prisma);

// ==========================================
// FILE UPLOADS (MULTER)
// ==========================================
const uploadDir = path.resolve(
  process.env.UPLOAD_DIR?.trim() || path.join(__dirname, '../uploads')
);
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    // Sanitize filename to prevent encoding issues
    const safeName = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '');
    cb(null, uniqueSuffix + '-' + safeName);
  }
});
const upload = multer({ storage });

function detectMediaKind(mimeTypeRaw: string | undefined): 'imagem' | 'video' | 'audio' | 'arquivo' {
  const mime = String(mimeTypeRaw || '').toLowerCase();
  if (mime.startsWith('image/')) return 'imagem';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  return 'arquivo';
}

function mediaAssetPublicFileUrl(id: string): string {
  return `/api/public/media/${id}/file`;
}

function resolveMediaAssetFilePath(storedName: string): string | null {
  const filePath = path.join(uploadDir, path.basename(String(storedName || '')));
  if (!filePath || !fs.existsSync(filePath)) return null;
  return filePath;
}

// Serve uploaded files publicly (quando o proxy encaminha /uploads ao Node)
app.use('/uploads', express.static(uploadDir));

// ==========================================
// PUBLIC API ROUTES
// ==========================================
app.get('/api/health', (req, res) => {
  res.json({ status: 'Platform API is active', time: new Date() });
});

app.get('/api/public/ebooks', async (req, res) => {
  try {
    const ebooks = await prisma.ebook.findMany({ 
      where: { isBonus: false },
      orderBy: { createdAt: 'desc' },
      include: { category: true }
    });
    res.json(ebooks);
  } catch (error) {
    res.status(500).json({ error: 'Failed' });
  }
});

/** Banner fixo da home (área do membro): fundo + selo opcionais via admin (Setting). */
app.get('/api/public/member-hero', async (_req, res) => {
  try {
    let backgroundUrl = (await getSetting(prisma, 'member_hero_background_url'))?.trim() || null;
    const kicker = (await getSetting(prisma, 'member_hero_kicker'))?.trim() || null;
    const supportUrl = (await getSetting(prisma, 'member_support_url'))?.trim() || null;
    if (!backgroundUrl) {
      const c = await prisma.course.findFirst({
        where: { published: true, coverUrl: { not: null } },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
        select: { coverUrl: true },
      });
      const u = c?.coverUrl?.trim();
      backgroundUrl = u && u.length > 0 ? u : null;
    }
    res.json({ backgroundUrl: backgroundUrl || null, kicker: kicker || null, supportUrl: supportUrl || null });
  } catch {
    res.status(500).json({ error: 'Failed' });
  }
});

app.get('/api/public/member-theme', async (_req, res) => {
  try {
    const payload: Record<string, string> = {};
    for (const key of MEMBER_THEME_KEYS) {
      const value = (await getSetting(prisma, key))?.trim();
      payload[key] = value || MEMBER_THEME_DEFAULTS[key];
    }
    res.json(payload);
  } catch {
    res.status(500).json({ error: 'Failed' });
  }
});

app.get('/api/public/pages/:slug', async (req, res) => {
  const normalizeSlug = (raw: string) =>
    String(raw || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9-_/]+/g, '-')
      .replace(/\/+/g, '/')
      .replace(/(^[-/]+|[-/]+$)/g, '');

  try {
    const row = await prisma.setting.findUnique({ where: { key: 'admin_page_builder_pages_json' } });
    const desired = normalizeSlug(String(req.params.slug || ''));
    if (!desired) {
      res.status(400).type('text/plain; charset=utf-8').send('Slug inválida.');
      return;
    }

    const raw = String(row?.value || '').trim();
    if (!raw) {
      res.status(404).type('text/plain; charset=utf-8').send('Página não encontrada.');
      return;
    }

    let pages: Array<{ slug?: string; html?: string; published?: boolean }> = [];
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) pages = parsed as typeof pages;
    } catch {
      pages = [];
    }

    const page = pages.find((p) => normalizeSlug(String(p?.slug || '')) === desired);
    if (!page?.html) {
      res.status(404).type('text/plain; charset=utf-8').send('Página não encontrada.');
      return;
    }

    if (page.published === false) {
      res.status(403).type('text/plain; charset=utf-8').send('Página em rascunho. Publique para liberar a URL.');
      return;
    }

    res.status(200).type('text/html; charset=utf-8').send(String(page.html));
  } catch {
    res.status(500).type('text/plain; charset=utf-8').send('Erro ao carregar página.');
  }
});

app.get('/api/public/links/resolve', async (req, res) => {
  try {
    const slug = normalizeShortLinkSlug(String(req.query?.slug || ''));
    if (!slug) return res.status(400).json({ error: 'Slug obrigatória.' });

    const link = await prisma.shortLink.findUnique({ where: { slug } });
    if (!link || !link.isActive) return res.status(404).json({ found: false });

    const countryCode = getCountryCodeFromHeaders(req);
    const regionCode = getRegionCodeFromHeaders(req);
    const deviceType = detectDeviceType(req.headers['user-agent']);
    const ipAddress = getClientIp(req);
    const referrer = String(req.headers.referer || '').trim().slice(0, 255);

    let target = String(link.targetUrl || '').trim();
    if (!target) return res.status(404).json({ found: false });

    target = applySmartRouting(target, link.smartRules, countryCode, regionCode, deviceType);
    target = appendTrackingParams(target, link.utmParams);

    await prisma.shortLinkClick
      .create({
        data: {
          linkId: link.id,
          ipAddress,
          countryCode,
          regionCode,
          deviceType,
          referrer
        }
      })
      .catch(() => {});

    const status = [301, 302, 307, 308].includes(link.redirectType) ? link.redirectType : 302;
    res.json({ found: true, targetUrl: target, status });
  } catch {
    res.status(500).json({ error: 'Falha ao resolver link.' });
  }
});

/** Exibe o arquivo no navegador (imagem/vídeo/áudio) — rota /api evita cair no SPA da home. */
app.get('/api/public/media/:id/file', async (req, res) => {
  try {
    const id = String(req.params.id || '').trim();
    if (!id) return res.status(400).json({ error: 'ID inválido.' });
    const media = await prisma.mediaAsset.findUnique({ where: { id } });
    if (!media) return res.status(404).json({ error: 'Arquivo não encontrado.' });

    const filePath = resolveMediaAssetFilePath(media.storedName);
    if (!filePath) return res.status(404).json({ error: 'Arquivo não encontrado no servidor.' });

    const mimeType = String(media.mimeType || '').trim();
    if (mimeType) res.type(mimeType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.sendFile(filePath);
  } catch {
    return res.status(500).json({ error: 'Falha ao abrir arquivo.' });
  }
});

app.get('/api/public/media/:id/download', async (req, res) => {
  try {
    const id = String(req.params.id || '').trim();
    if (!id) return res.status(400).json({ error: 'ID inválido.' });
    const media = await prisma.mediaAsset.findUnique({ where: { id } });
    if (!media) return res.status(404).json({ error: 'Arquivo não encontrado.' });

    const filePath = resolveMediaAssetFilePath(media.storedName);
    if (!filePath) return res.status(404).json({ error: 'Arquivo não encontrado no servidor.' });

    const mimeType = String(media.mimeType || '').trim();
    if (mimeType) res.type(mimeType);
    return res.download(filePath, media.originalName || media.storedName);
  } catch {
    return res.status(500).json({ error: 'Falha ao baixar arquivo.' });
  }
});

// ==========================================
// USER AUTHENTICATION & ACCESS ROUTES
// ==========================================
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    let user = await prisma.user.findUnique({ where: { email: String(email || '').toLowerCase().trim() } });
    
    // First-Time Login Logic: If user exists from Hotmart but has no password yet
    if (user && !user.password) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { password: hashMemberPassword(String(password || '')) },
      });
      const ok = await userHasMemberAccess(prisma, user.id);
      if (!ok) {
        return res.status(401).json({ error: 'Sem acesso ativo: é necessário compra ou licença ativa.' });
      }
      const token = signUserToken(user.id, user.email);
      return res.json({ id: user.id, email: user.email, name: user.name, token });
    }
    
    // Validate Existing User (texto puro legado ou hash WordPress)
    if (user && verifyUserPassword(String(password || ''), user.password)) {
      const ok = await userHasMemberAccess(prisma, user.id);
      if (!ok) {
        return res.status(401).json({ error: 'Sem acesso ativo: é necessário compra ou licença ativa.' });
      }
      const token = signUserToken(user.id, user.email);
      return res.json({ id: user.id, email: user.email, name: user.name, token });
    }
    
    return res.status(401).json({ error: 'E-mail ou senha incorretos. Acesso negado. Apenas usuários que já efetuaram uma compra podem acessar.' });
  } catch (err) {
    res.status(500).json({ error: 'Server Error' });
  }
});

// ==========================================
// FORGOT PASSWORD & RESET
// ==========================================
app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    // Always return success to prevent email enumeration
    if (!user) return res.json({ success: true });

    // Generate reset token (valid for 1 hour)
    const token = crypto.randomBytes(32).toString('hex');
    const expires = Date.now() + 3600000; // 1 hour
    await prisma.setting.upsert({
      where: { key: `reset_token_${user.id}` },
      update: { value: `${token}|${expires}` },
      create: { key: `reset_token_${user.id}`, value: `${token}|${expires}` }
    });

    // Send reset email
    const lang = detectLang(user.country);
    const templateKey = lang === 'es' ? 'reset_template_es' : 'reset_template_pt';
    let template = await getSetting(prisma, templateKey);

    const appUrl = getAppUrl();
    const resetLink = `${appUrl}?reset_token=${token}&user_id=${user.id}`;

    if (!template) {
      template = lang === 'es'
        ? `<div style="font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:600px;margin:20px auto;padding:40px;border-radius:16px;background-color:#ffffff;box-shadow:0 4px 20px rgba(0,0,0,0.05);border:1px solid #f0f0f0;">
            <div style="text-align:center;margin-bottom:30px;">
              <img src="https://readlyme.com/logo.png" alt="Readlyme" style="width:180px;">
            </div>
            <h1 style="color:#1a1a1a;font-size:24px;text-align:center;margin-bottom:20px;">Recuperación de Contraseña</h1>
            <p style="color:#444;font-size:16px;line-height:1.6;margin-bottom:25px;">Hola {{name}}, recibimos una solicitud para restablecer tu contraseña. Si no fuiste tú, puedes ignorar este correo.</p>
            <div style="text-align:center;margin:30px 0;">
              <a href="{{reset_link}}" style="display:inline-block;background-color:#3b82f6;color:#ffffff;padding:16px 32px;text-decoration:none;border-radius:12px;font-weight:bold;font-size:16px;">Cambiar mi Contraseña</a>
            </div>
            <p style="color:#888;font-size:12px;text-align:center;margin-top:30px;">Este enlace caducará en 1 hora por motivos de seguridad.</p>
          </div>`
        : `<div style="font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:600px;margin:20px auto;padding:40px;border-radius:16px;background-color:#ffffff;box-shadow:0 4px 20px rgba(0,0,0,0.05);border:1px solid #f0f0f0;">
            <div style="text-align:center;margin-bottom:30px;">
              <img src="https://readlyme.com/logo.png" alt="Readlyme" style="width:180px;">
            </div>
            <h1 style="color:#1a1a1a;font-size:24px;text-align:center;margin-bottom:20px;">Recuperação de Senha</h1>
            <p style="color:#444;font-size:16px;line-height:1.6;margin-bottom:25px;">Olá {{name}}, recebemos uma solicitação para redefinir sua senha. Se não foi você, pode ignorar este e-mail.</p>
            <div style="text-align:center;margin:30px 0;">
              <a href="{{reset_link}}" style="display:inline-block;background-color:#3b82f6;color:#ffffff;padding:16px 32px;text-decoration:none;border-radius:12px;font-weight:bold;font-size:16px;">Alterar minha Senha</a>
            </div>
            <p style="color:#888;font-size:12px;text-align:center;margin-top:30px;">Este link expirará em 1 hora por motivos de segurança.</p>
          </div>`;
    }

    const html = template
      .replace(/\{\{name\}\}/g, user.name || (lang === 'es' ? 'Usuario' : 'Usuário'))
      .replace(/\{\{email\}\}/g, user.email)
      .replace(/\{\{country\}\}/g, user.country || '-')
      .replace(/\{\{reset_link\}\}/g, resetLink);

    const subject = lang === 'es' ? 'Recuperación de Contraseña - Readlyme' : 'Recuperação de Senha - Readlyme';
    await sendEmail(prisma, user.email, subject, html);

    res.json({ success: true });
  } catch (err) {
    console.error('[Forgot Password Error]', err);
    res.status(500).json({ error: 'Server Error' });
  }
});

app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { token, userId, newPassword } = req.body;
    if (!token || !userId || !newPassword) return res.status(400).json({ error: 'Missing fields' });

    const setting = await prisma.setting.findUnique({ where: { key: `reset_token_${userId}` } });
    if (!setting) return res.status(400).json({ error: 'Token inválido ou expirado.' });

    const [savedToken, expiresStr] = setting.value.split('|');
    if (savedToken !== token || Date.now() > parseInt(expiresStr)) {
      await prisma.setting.delete({ where: { key: `reset_token_${userId}` } }).catch(() => {});
      return res.status(400).json({ error: 'Token inválido ou expirado.' });
    }

    await prisma.user.update({
      where: { id: userId },
      data: { password: hashMemberPassword(String(newPassword || '')) },
    });
    await prisma.setting.delete({ where: { key: `reset_token_${userId}` } }).catch(() => {});

    res.json({ success: true });
  } catch (err) {
    console.error('[Reset Password Error]', err);
    res.status(500).json({ error: 'Server Error' });
  }
});

app.get('/api/ebooks/my', async (req, res) => {
  try {
    const userId = resolveUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const purchases = await prisma.purchase.findMany({
      where: { userId },
      include: { ebook: true }
    });

    const myBooks = purchases.map(p => ({
      ...p.ebook,
      lastReadAt: p.lastReadAt,
      lastPage: p.lastPage
    }));
    res.json(myBooks);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch your library' });
  }
});

// PROFILE
app.get('/api/profile', async (req, res) => {
  try {
    const userId = resolveUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, name: true, country: true } });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (error) { res.status(500).json({ error: 'Failed' }); }
});

app.put('/api/profile', async (req, res) => {
  try {
    const userId = resolveUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const { name } = req.body;
    const user = await prisma.user.update({ where: { id: userId }, data: { name } });
    res.json({ id: user.id, email: user.email, name: user.name });
  } catch (error) { res.status(500).json({ error: 'Failed to update profile' }); }
});

app.put('/api/profile/password', async (req, res) => {
  try {
    const userId = resolveUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const { currentPassword, newPassword } = req.body;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !verifyUserPassword(String(currentPassword || ''), user.password)) {
      return res.status(400).json({ error: 'Senha atual incorreta.' });
    }
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashMemberPassword(String(newPassword || '')) },
    });
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: 'Failed' }); }
});

// READING PROGRESS
app.post('/api/reading-progress', async (req, res) => {
  try {
    const userId = resolveUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const { ebookId, page } = req.body;
    await prisma.purchase.updateMany({
      where: { userId, ebookId },
      data: { lastReadAt: new Date(), lastPage: page || 1 }
    });
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: 'Failed' }); }
});

// HIGHLIGHTS
app.get('/api/highlights/:ebookId', async (req, res) => {
  try {
    const userId = resolveUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const { ebookId } = req.params;
    const highlights = await prisma.highlight.findMany({
      where: { userId, ebookId },
      orderBy: { createdAt: 'asc' }
    });
    res.json(highlights);
  } catch (error) { res.status(500).json({ error: 'Failed' }); }
});

app.post('/api/highlights', async (req, res) => {
  try {
    const userId = resolveUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const { ebookId, pageNumber, text, color } = req.body;
    const highlight = await prisma.highlight.create({
      data: { userId, ebookId, pageNumber, text, color: color || 'yellow' }
    });
    res.json(highlight);
  } catch (error) { res.status(500).json({ error: 'Failed' }); }
});

app.delete('/api/highlights/:id', async (req, res) => {
  try {
    const userId = resolveUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    await prisma.highlight.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: 'Failed' }); }
});

// WISHLIST (synced across devices)
app.get('/api/wishlist', async (req, res) => {
  try {
    const userId = resolveUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const items = await prisma.wishlist.findMany({ where: { userId }, select: { ebookId: true } });
    res.json(items.map(i => i.ebookId));
  } catch (error) {
    res.status(500).json({ error: 'Failed' });
  }
});

app.post('/api/wishlist/toggle', async (req, res) => {
  try {
    const userId = resolveUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const { ebookId } = req.body;
    
    const existing = await prisma.wishlist.findUnique({ where: { userId_ebookId: { userId, ebookId } } });
    if (existing) {
      await prisma.wishlist.delete({ where: { id: existing.id } });
      return res.json({ wishlisted: false });
    } else {
      await prisma.wishlist.create({ data: { userId, ebookId } });
      return res.json({ wishlisted: true });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to toggle wishlist' });
  }
});

app.get('/api/ebooks', async (req, res) => {
  try {
    const ebooks = await prisma.ebook.findMany({ 
      orderBy: { createdAt: 'desc' },
      include: {
        category: true,
        _count: { select: { purchases: true } }
      }
    });
    res.json(ebooks);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch catalog' });
  }
});

app.post('/api/webhooks/hotmart', async (req, res) => {
  try {
    const hottok = (req.headers['x-hotmart-hottok'] || req.query.hottok) as string;
    if (process.env.HOTMART_HOTTOK && hottok !== process.env.HOTMART_HOTTOK) {
      await prisma.webhookLog.create({
        data: { event: 'AUTH_FAILED', status: 'rejected', details: 'Invalid hottok token' }
      });
      return res.status(401).json({ error: 'Invalid Hotmart Token' });
    }

    const body = req.body;
    const event = body.event || 'UNKNOWN';
    const buyerEmail = body.data?.buyer?.email?.toLowerCase()?.trim();
    const buyerName = body.data?.buyer?.name || body.data?.buyer?.first_name || null;
    const buyerCountry = body.data?.purchase?.checkout_country?.iso || body.data?.buyer?.address?.country || null;
    const productId = String(body.data?.product?.id || body.data?.product?.ucode || '').trim();
    const offerCode = String(body.data?.product?.offer_code || body.data?.purchase?.offer?.code || productId).trim();

    console.log(`[Hotmart Webhook] Event: ${event}, Buyer: ${buyerEmail}, Country: ${buyerCountry}, Product: ${productId}, Offer: ${offerCode}`);

    if (!productId && !offerCode) {
      await prisma.webhookLog.create({
        data: { event, status: 'ignored', details: 'Missing product ID and offer code' }
      });
      return res.status(200).json({ status: 'Ignored: missing product or offer info' });
    }

    // PURCHASE_APPROVED — Create user + grant access
    if (event === 'PURCHASE_APPROVED' || event === 'PURCHASE_COMPLETE') {
      if (!buyerEmail) {
        await prisma.webhookLog.create({
          data: { event, status: 'error', details: 'Missing buyer email' }
        });
        return res.status(200).json({ status: 'Error: no buyer email' });
      }

      // Find or create user with default password
      let user = await prisma.user.findUnique({ where: { email: buyerEmail } });
      let isNewUser = false;
      if (!user) {
        user = await prisma.user.create({
          data: { email: buyerEmail, name: buyerName, password: DEFAULT_PASSWORD, country: buyerCountry }
        });
        isNewUser = true;
      } else {
        // Update name and country if missing
        const updates: any = {};
        if (buyerName && !user.name) updates.name = buyerName;
        if (buyerCountry && !user.country) updates.country = buyerCountry;
        if (Object.keys(updates).length > 0) {
          user = await prisma.user.update({ where: { id: user.id }, data: updates });
        }
      }

      // Find ebooks by hotmartOffer
      const possibleEbooks = await prisma.ebook.findMany({
        where: {
          OR: [
            { hotmartOffer: { contains: offerCode } },
            { hotmartOffer: { contains: productId } }
          ]
        }
      });
      
      const ebooksToProcess = possibleEbooks.filter(e => {
        const codes = e.hotmartOffer.split(',').map(s => s.trim());
        return codes.includes(offerCode) || codes.includes(productId);
      });

      if (ebooksToProcess.length === 0) {
        await prisma.webhookLog.create({
          data: { event, buyerEmail, buyerName, buyerCountry, productId: offerCode, status: 'error', details: `No ebook found for offer: ${offerCode}` }
        });
        return res.status(200).json({ status: 'No matching ebook' });
      }

      // Grant access (idempotent, supports repurchasing/reactivation)
      for (const ebook of ebooksToProcess) {
        try {
          await prisma.purchase.create({
            data: { userId: user.id, ebookId: ebook.id }
          });
        } catch (e: any) {
          if (!e.message?.includes('Unique constraint')) {
            throw e;
          }
        }

        // Grant access to bonuses linked to this ebook
        const bonuses = await prisma.ebook.findMany({ where: { isBonus: true, parentEbookId: ebook.id } });
        if (bonuses.length > 0) {
          const newPurchases = bonuses.map(b => ({ userId: user.id, ebookId: b.id }));
          await prisma.purchase.createMany({ data: newPurchases, skipDuplicates: true });
          console.log(`[Hotmart] 🎁 Granted bonuses to ${buyerEmail}: ` + bonuses.map(b => b.title).join(', '));
        }
      }

      // Send welcome email for new users
      if (isNewUser) {
        sendWelcomeEmail(prisma, buyerEmail, buyerName, DEFAULT_PASSWORD, buyerCountry).catch(err =>
          console.error('[Email] Welcome email failed:', err)
        );
      }

      const titles = ebooksToProcess.map(e => e.title).join(', ');
      await prisma.webhookLog.create({
        data: { event, buyerEmail, buyerName, buyerCountry, productId: offerCode, status: 'success', details: `Granted access to "${titles}"${isNewUser ? ' (new user, welcome email queued)' : ''}` }
      });

      console.log(`[Hotmart] ✅ Access granted: ${buyerEmail} -> ${titles}${isNewUser ? ' (new user)' : ''}`);
      return res.status(200).json({ status: 'Access granted' });
    }

    if (event === 'PURCHASE_CANCELED' || event === 'PURCHASE_REFUNDED' || event === 'PURCHASE_CHARGEBACK' || event === 'PURCHASE_PROTEST') {
      if (buyerEmail) {
        const user = await prisma.user.findUnique({ where: { email: buyerEmail } });
        
        const possibleEbooks = await prisma.ebook.findMany({
          where: {
            OR: [
              { hotmartOffer: { contains: offerCode } },
              { hotmartOffer: { contains: productId } }
            ]
          }
        });
        
        const ebooksToProcess = possibleEbooks.filter(e => {
          const codes = e.hotmartOffer.split(',').map(s => s.trim());
          return codes.includes(offerCode) || codes.includes(productId);
        });

        if (user && ebooksToProcess.length > 0) {
          let idsToRemove: string[] = [];
          for (const eb of ebooksToProcess) {
            idsToRemove.push(eb.id);
            const linkedBonuses = await prisma.ebook.findMany({ where: { parentEbookId: eb.id } });
            idsToRemove.push(...linkedBonuses.map(b => b.id));
          }
          
          await prisma.purchase.deleteMany({ where: { userId: user.id, ebookId: { in: idsToRemove } } });
          const titles = ebooksToProcess.map(e => e.title).join(', ');
          await prisma.webhookLog.create({
            data: { event, buyerEmail, buyerName, buyerCountry, productId: offerCode, status: 'success', details: `Revoked access to "${titles}"` }
          });
          console.log(`[Hotmart] ❌ Access revoked: ${buyerEmail} -> ${titles}`);
        } else {
          await prisma.webhookLog.create({
            data: { event, buyerEmail, buyerName, buyerCountry, productId: offerCode, status: 'warning', details: 'User or ebook not found for revocation' }
          });
        }
      }
      return res.status(200).json({ status: 'Processed' });
    }

    // Other events — just log
    await prisma.webhookLog.create({
      data: { event, buyerEmail, buyerName, buyerCountry, productId: offerCode, status: 'ignored', details: `Unhandled event type: ${event}` }
    });

    return res.status(200).json({ status: 'Event logged' });
  } catch (error) {
    console.error('[Hotmart Webhook Error]', error);
    await prisma.webhookLog.create({
      data: { event: 'SYSTEM_ERROR', status: 'error', details: String(error) }
    }).catch(() => {});
    return res.status(200).json({ status: 'Internal error logged' });
  }
});

// ==========================================
// ADMIN — login por JSON (evita header bloqueado / proxy)
// ==========================================
app.post('/api/admin/login', (req, res) => {
  try {
    const email = String(req.body?.email ?? '');
    const password = String(req.body?.password ?? '');
    if (!email.trim() || !password) {
      return res.status(400).json({ error: 'Informe e-mail e senha.' });
    }
    if (!validateAdminCredentials(email, password)) {
      return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
    }
    res.json({ token: signAdminJwt() });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// ==========================================
// ADMIN DASHBOARD ROUTES
// ==========================================
registerAdminForexRoutes(app, prisma, adminAuthMiddleware);

app.get('/api/admin/categories', adminAuthMiddleware, async (req, res) => {
  try {
    const cats = await prisma.category.findMany({ orderBy: { name: 'asc' } });
    res.json(cats);
  } catch (error) {
    res.status(500).json({ error: 'Failed' });
  }
});

app.post('/api/admin/categories', adminAuthMiddleware, async (req, res) => {
  try {
    const { name } = req.body;
    const cat = await prisma.category.create({ data: { name } });
    res.json(cat);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create Category' });
  }
});

app.post('/api/admin/upload', adminAuthMiddleware, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const fileUrl = `/uploads/${req.file.filename}`;
  res.json({ url: fileUrl });
});

app.get('/api/admin/media', adminAuthMiddleware, async (_req, res) => {
  try {
    const rows = await prisma.mediaAsset.findMany({ orderBy: { createdAt: 'desc' } });
    res.json(rows);
  } catch {
    res.status(500).json({ error: 'Falha ao listar mídias.' });
  }
});

app.post('/api/admin/media', adminAuthMiddleware, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
    const created = await prisma.mediaAsset.create({
      data: {
        originalName: String(req.file.originalname || req.file.filename),
        storedName: String(req.file.filename),
        url: `/uploads/${req.file.filename}`,
        mimeType: req.file.mimetype || null,
        kind: detectMediaKind(req.file.mimetype),
        sizeBytes: Number(req.file.size || 0)
      }
    });
    const publicUrl = mediaAssetPublicFileUrl(created.id);
    const saved = await prisma.mediaAsset.update({
      where: { id: created.id },
      data: { url: publicUrl },
    });
    res.json(saved);
  } catch {
    res.status(500).json({ error: 'Falha ao salvar mídia.' });
  }
});

app.delete('/api/admin/media/:id', adminAuthMiddleware, async (req, res) => {
  try {
    const id = String(req.params.id || '').trim();
    if (!id) return res.status(400).json({ error: 'ID inválido.' });
    const row = await prisma.mediaAsset.findUnique({ where: { id } });
    if (!row) return res.status(404).json({ error: 'Mídia não encontrada.' });

    const filePath = path.join(uploadDir, path.basename(row.storedName));
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch {
        // Se não conseguir deletar no disco, seguimos removendo o registro.
      }
    }

    await prisma.mediaAsset.delete({ where: { id } });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Falha ao remover mídia.' });
  }
});

// -- USER & ACCESS MANAGEMENT --
app.get('/api/admin/users', adminAuthMiddleware, async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        purchases: { include: { ebook: true } }
      }
    });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Failed' });
  }
});

app.post('/api/admin/users', adminAuthMiddleware, async (req, res) => {
  try {
    const { email, password, name } = req.body;
    const user = await prisma.user.create({
      data: {
        email,
        password,
        name: name != null && String(name).trim() ? String(name).trim() : null
      }
    });
    res.json(user);
  } catch(error) {
    res.status(400).json({ error: 'Erro. Talvez e-mail já exista.' });
  }
});

app.post('/api/admin/purchases', adminAuthMiddleware, async (req, res) => {
  try {
    const { userId, ebookId } = req.body;
    const purchase = await prisma.purchase.create({ data: { userId, ebookId } });
    res.json(purchase);
  } catch (error) {
    res.status(400).json({ error: 'Falha ao conceder acesso ou o usuário já o possui.' });
  }
});

app.delete('/api/admin/purchases/:userId/:ebookId', adminAuthMiddleware, async (req, res) => {
  try {
    const userId = String(req.params.userId);
    const ebookId = String(req.params.ebookId);
    await prisma.purchase.deleteMany({ where: { userId, ebookId } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Falha ao revogar acesso' });
  }
});

app.delete('/api/admin/users/:id', adminAuthMiddleware, async (req, res) => {
  try {
    const id = String(req.params.id);
    const user = await prisma.user.findUnique({ where: { id }, select: { email: true } });
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado.' });

    // Cleanup user relations first
    await prisma.purchase.deleteMany({ where: { userId: id } });
    await prisma.wishlist.deleteMany({ where: { userId: id } });
    await prisma.highlight.deleteMany({ where: { userId: id } });
    await prisma.license.deleteMany({
      where: { email: String(user.email).toLowerCase().trim() },
    });

    // Delete user
    await prisma.user.delete({ where: { id } });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Failed to delete user:', error);
    res.status(500).json({ error: 'Falha ao excluir usuário. Verifique logs.' });
  }
});
// -----------------------------

// -- WEBHOOK LOGS --
app.get('/api/admin/webhook-logs', adminAuthMiddleware, async (req, res) => {
  try {
    const logs = await prisma.webhookLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50
    });
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch webhook logs' });
  }
});

app.delete('/api/admin/webhook-logs', adminAuthMiddleware, async (req, res) => {
  try {
    await prisma.webhookLog.deleteMany({});
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to clear logs' });
  }
});

// -- EMAIL SETTINGS --
app.get('/api/admin/settings', adminAuthMiddleware, async (req, res) => {
  try {
    const settings = await prisma.setting.findMany({
      where: { key: { notIn: (await prisma.setting.findMany({ where: { key: { startsWith: 'reset_token_' } } })).map(s => s.key) } }
    });
    // Mask the API key for security
    const result: Record<string, string> = {};
    for (const s of settings) {
      if (s.key === 'resend_api_key' && s.value) {
        result[s.key] = '••••••••' + s.value.slice(-4);
      } else {
        result[s.key] = s.value;
      }
    }
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

app.post('/api/admin/settings', adminAuthMiddleware, async (req, res) => {
  try {
    const entries = req.body as Record<string, string>;
    const colorPattern =
      /^(#[0-9a-fA-F]{3,8}|rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\))$/;
    for (const [key, value] of Object.entries(entries)) {
      // Skip masked values (don't overwrite with masked text)
      if (key === 'resend_api_key' && value.startsWith('••')) continue;
      if (key.startsWith('reset_token_')) continue; // Security: don't allow writing reset tokens
      if (key === 'member_hero_background_url') {
        const v = String(value ?? '').trim();
        if (v) {
          const ok = /^https?:\/\//i.test(v) || (v.startsWith('/') && !v.startsWith('//'));
          if (!ok) {
            return res.status(400).json({
              error:
                'member_hero_background_url: use URL vazia, https://…, http://… ou caminho relativo (/api/public/media/…/file ou /uploads/…).'
            });
          }
        }
      }
      if (MEMBER_THEME_KEYS.includes(key as (typeof MEMBER_THEME_KEYS)[number])) {
        const v = String(value ?? '').trim();
        if (!colorPattern.test(v)) {
          return res.status(400).json({
            error: `${key}: informe uma cor válida em HEX (#RRGGBB) ou RGBA (rgba(...)).`,
          });
        }
      }
      await prisma.setting.upsert({
        where: { key },
        update: { value },
        create: { key, value }
      });
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to save settings' });
  }
});

app.get('/api/admin/links', adminAuthMiddleware, async (_req, res) => {
  try {
    const links = await prisma.shortLink.findMany({ orderBy: { createdAt: 'desc' } });
    const grouped = await prisma.shortLinkClick.groupBy({
      by: ['linkId'],
      _count: { _all: true }
    });
    const clicksById = new Map<number, number>(grouped.map((g) => [g.linkId, g._count._all]));
    res.json(
      links.map((l) => ({
        ...l,
        clicks: clicksById.get(l.id) || 0
      }))
    );
  } catch {
    res.status(500).json({ error: 'Falha ao listar links.' });
  }
});

app.post('/api/admin/links', adminAuthMiddleware, async (req, res) => {
  try {
    const slug = normalizeShortLinkSlug(String(req.body?.slug || ''));
    const targetUrl = String(req.body?.targetUrl || '').trim();
    if (!slug) return res.status(400).json({ error: 'Slug obrigatória.' });
    if (!targetUrl) return res.status(400).json({ error: 'URL de destino obrigatória.' });
    const redirectTypeRaw = Number(req.body?.redirectType || 301);
    const redirectType = [301, 302, 307, 308].includes(redirectTypeRaw) ? redirectTypeRaw : 301;

    const created = await prisma.shortLink.create({
      data: {
        name: String(req.body?.name || '').trim(),
        slug,
        targetUrl,
        redirectType,
        smartRules: String(req.body?.smartRules || '').trim() || null,
        utmParams: String(req.body?.utmParams || '').trim() || null,
        isActive: req.body?.isActive !== false
      }
    });
    res.json(created);
  } catch (e) {
    res.status(400).json({ error: 'Falha ao criar link. Verifique slug duplicada.' });
  }
});

app.put('/api/admin/links/:id', adminAuthMiddleware, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: 'ID inválido.' });
    const slug = normalizeShortLinkSlug(String(req.body?.slug || ''));
    const targetUrl = String(req.body?.targetUrl || '').trim();
    if (!slug) return res.status(400).json({ error: 'Slug obrigatória.' });
    if (!targetUrl) return res.status(400).json({ error: 'URL de destino obrigatória.' });
    const redirectTypeRaw = Number(req.body?.redirectType || 301);
    const redirectType = [301, 302, 307, 308].includes(redirectTypeRaw) ? redirectTypeRaw : 301;

    const updated = await prisma.shortLink.update({
      where: { id },
      data: {
        name: String(req.body?.name || '').trim(),
        slug,
        targetUrl,
        redirectType,
        smartRules: String(req.body?.smartRules || '').trim() || null,
        utmParams: String(req.body?.utmParams || '').trim() || null,
        isActive: req.body?.isActive !== false
      }
    });
    res.json(updated);
  } catch {
    res.status(400).json({ error: 'Falha ao atualizar link.' });
  }
});

app.delete('/api/admin/links/:id', adminAuthMiddleware, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: 'ID inválido.' });
    await prisma.shortLink.delete({ where: { id } });
    res.json({ success: true });
  } catch {
    res.status(400).json({ error: 'Falha ao remover link.' });
  }
});

app.get('/api/admin/ebooks', adminAuthMiddleware, async (req, res) => {
  try {
    const ebooks = await prisma.ebook.findMany({ 
      orderBy: { createdAt: 'desc' },
      include: { category: true }
    });
    res.json(ebooks);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch eBooks' });
  }
});

app.post('/api/admin/ebooks', adminAuthMiddleware, async (req, res) => {
  try {
    const { title, author, description, coverUrl, pdfUrl, htmlUrl, externalUrl, redirectUrl, salesUrl, hotmartOffer, licenseSystemId, categoryId, featuredList, isBonus, parentEbookId, language } = req.body;
    
    // Auto-generate hotmartOffer if it's a bonus and not provided
    const finalOffer = isBonus && !hotmartOffer ? `bonus_${crypto.randomUUID()}` : hotmartOffer;

    const newEbook = await prisma.ebook.create({
      data: { 
        title, 
        author: author || null, 
        description: description || null, 
        coverUrl, 
        pdfUrl: pdfUrl || null, 
        htmlUrl: htmlUrl || null, 
        externalUrl: externalUrl || null,
        redirectUrl: redirectUrl || null,
        salesUrl, 
        hotmartOffer: finalOffer,
        categoryId: categoryId || null, 
        featuredList: featuredList || null,
        isBonus: isBonus || false,
        parentEbookId: (isBonus && parentEbookId) ? String(parentEbookId) : null,
        language: language || 'pt',
        licenseSystemId: licenseSystemId ? String(licenseSystemId).trim() : null
      }
    });

    // Retroactive logic: If it's a bonus, distribute access to all existing buyers of the parent ebook
    if (newEbook.isBonus && newEbook.parentEbookId) {
      const parentPurchases = await prisma.purchase.findMany({ where: { ebookId: newEbook.parentEbookId } });
      if (parentPurchases.length > 0) {
        const newPurchases = parentPurchases.map(p => ({ userId: p.userId, ebookId: newEbook.id }));
        await prisma.purchase.createMany({ data: newPurchases, skipDuplicates: true });
        console.log(`[Bônus] ✅ Distribuído bônus "${newEbook.title}" para ${newPurchases.length} clientes do Produto Principal.`);
      }
    }

    res.json(newEbook);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create eBook' });
  }
});

app.put('/api/admin/ebooks/:id', adminAuthMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, author, description, coverUrl, pdfUrl, htmlUrl, externalUrl, redirectUrl, salesUrl, hotmartOffer, licenseSystemId, categoryId, featuredList, isBonus, parentEbookId, language } = req.body;
    const currentEbook = await prisma.ebook.findUnique({ where: { id: String(id) } });

    // Ensure hotmartOffer remains unique for bonuses if sent as empty string
    const finalOffer = isBonus && !hotmartOffer ? (currentEbook?.hotmartOffer || `bonus_${crypto.randomUUID()}`) : hotmartOffer;

    const updatedEbook = await prisma.ebook.update({
      where: { id: String(id) },
      data: { 
        title, 
        author: author || null, 
        description: description || null, 
        coverUrl, 
        pdfUrl: pdfUrl || null, 
        htmlUrl: htmlUrl || null, 
        externalUrl: externalUrl || null,
        redirectUrl: redirectUrl || null,
        salesUrl, 
        hotmartOffer: finalOffer, 
        categoryId: categoryId || null, 
        featuredList: featuredList || null,
        isBonus: isBonus || false,
        parentEbookId: (isBonus && parentEbookId) ? String(parentEbookId) : null,
        language: language || 'pt',
        licenseSystemId: licenseSystemId !== undefined ? (licenseSystemId ? String(licenseSystemId).trim() : null) : undefined
      }
    });

    // Retroactive logic if parentEbookId changed
    if (updatedEbook.isBonus && updatedEbook.parentEbookId) {
      if (!currentEbook?.isBonus || currentEbook.parentEbookId !== updatedEbook.parentEbookId) {
        const parentPurchases = await prisma.purchase.findMany({ where: { ebookId: updatedEbook.parentEbookId } });
        if (parentPurchases.length > 0) {
          const newPurchases = parentPurchases.map(p => ({ userId: p.userId, ebookId: updatedEbook.id }));
          await prisma.purchase.createMany({ data: newPurchases, skipDuplicates: true });
          console.log(`[Bônus] ✅ Atualização: Distribuído bônus "${updatedEbook.title}" para ${newPurchases.length} clientes do Produto Principal.`);
        }
      }
    }

    res.json(updatedEbook);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update eBook' });
  }
});

app.delete('/api/admin/ebooks/:id', adminAuthMiddleware, async (req, res) => {
  try {
    const id = String(req.params.id);
    await prisma.ebook.delete({ where: { id } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete eBook' });
  }
});

// ==========================================
// SERVE STATIC PWA
// ==========================================
const distPath = path.join(__dirname, '../dist');
if (fs.existsSync(distPath)) {
  app.use(async (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    const slug = normalizeShortLinkSlug(req.path);
    if (!slug) return next();

    // Rotas reservadas da aplicação (não devem ser sequestradas por short links)
    if (
      slug === 'admin' ||
      slug === 'vitrine' ||
      slug === 'catalogo' ||
      slug === 'catálogo' ||
      slug.startsWith('api/') ||
      slug.startsWith('uploads/')
    ) {
      return next();
    }

    const link = await prisma.shortLink.findUnique({ where: { slug } }).catch(() => null);
    if (!link || !link.isActive) return next();

    const countryCode = getCountryCodeFromHeaders(req);
    const regionCode = getRegionCodeFromHeaders(req);
    const deviceType = detectDeviceType(req.headers['user-agent']);
    const ipAddress = getClientIp(req);
    const referrer = String(req.headers.referer || '').trim().slice(0, 255);

    let target = String(link.targetUrl || '').trim();
    if (!target) return next();

    target = applySmartRouting(target, link.smartRules, countryCode, regionCode, deviceType);
    target = appendTrackingParams(target, link.utmParams);

    await prisma.shortLinkClick
      .create({
        data: {
          linkId: link.id,
          ipAddress,
          countryCode,
          regionCode,
          deviceType,
          referrer
        }
      })
      .catch(() => {});

    const status = [301, 302, 307, 308].includes(link.redirectType) ? link.redirectType : 302;
    return res.redirect(status, target);
  });

  // /uploads sem arquivo no disco: 404 em texto (não devolver index.html = home)
  app.use('/uploads', (req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.status(405).end();
      return;
    }
    const raw = String(req.path || '').replace(/^\/uploads\/?/, '');
    const filename = path.basename(decodeURIComponent(raw));
    if (!filename) {
      res.status(404).type('text/plain; charset=utf-8').send('Arquivo não encontrado.');
      return;
    }
    const filePath = path.join(uploadDir, filename);
    if (!fs.existsSync(filePath)) {
      res.status(404).type('text/plain; charset=utf-8').send('Arquivo não encontrado.');
      return;
    }
    res.sendFile(filePath);
  });

  app.use(express.static(distPath));

  // Client side routing fallback
  app.use((req, res) => {
    if (req.path.startsWith('/uploads/')) {
      res.status(404).type('text/plain; charset=utf-8').send('Arquivo não encontrado.');
      return;
    }
    res.sendFile(path.join(distPath, 'index.html'));
  });
} else {
  console.warn(`[WARN] Static directory not found at ${distPath}. Build the frontend first.`);
}

// ==========================================
// SERVER INITIALIZATION
// ==========================================
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    try {
      await ensureDevTestAccount(prisma);
      console.log('[Dev] Conta teste garantida: teste@local.dev / TesteLocal123@');
    } catch (e) {
      console.error('[Dev] ensureDevTestAccount:', e);
    }
  }
  app.listen(PORT, () => {
    console.log(`[EbookPro API] Server running centrally on port ${PORT}`);
  });
}

void startServer();
