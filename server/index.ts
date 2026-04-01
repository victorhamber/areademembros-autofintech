import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';
import { Resend } from 'resend';
import multer from 'multer';

dotenv.config();

const DEFAULT_PASSWORD = 'Mudar123@';

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
            <a href="{{app_url}}" style="display:inline-block;background-color:#45c4b0;color:#ffffff;padding:16px 32px;text-decoration:none;border-radius:12px;font-weight:bold;font-size:16px;">Entrar a la Biblioteca</a>
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
            <a href="{{app_url}}" style="display:inline-block;background-color:#45c4b0;color:#ffffff;padding:16px 32px;text-decoration:none;border-radius:12px;font-weight:bold;font-size:16px;">Acessar Biblioteca</a>
          </div>
          <p style="color:#888;font-size:13px;text-align:center;margin-top:30px;">Recomendamos que troque sua senha após o primeiro login.</p>
        </div>`;
  }

  const appUrl = process.env.APP_URL || 'https://readlyme.com';
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

// ==========================================
// FILE UPLOADS (MULTER)
// ==========================================
const uploadDir = path.join(__dirname, '../uploads');
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

// Serve uploaded files publicly
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

// ==========================================
// USER AUTHENTICATION & ACCESS ROUTES
// ==========================================
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    let user = await prisma.user.findUnique({ where: { email } });
    
    // First-Time Login Logic: If user exists from Hotmart but has no password yet
    if (user && !user.password) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { password }
      });
      return res.json({ id: user.id, email: user.email, name: user.name });
    }
    
    // Validate Existing User
    if (user && user.password === password) {
      return res.json({ id: user.id, email: user.email, name: user.name });
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

    const appUrl = process.env.APP_URL || 'https://readlyme.com';
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
              <a href="{{reset_link}}" style="display:inline-block;background-color:#45c4b0;color:#ffffff;padding:16px 32px;text-decoration:none;border-radius:12px;font-weight:bold;font-size:16px;">Cambiar mi Contraseña</a>
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
              <a href="{{reset_link}}" style="display:inline-block;background-color:#45c4b0;color:#ffffff;padding:16px 32px;text-decoration:none;border-radius:12px;font-weight:bold;font-size:16px;">Alterar minha Senha</a>
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

    await prisma.user.update({ where: { id: userId }, data: { password: newPassword } });
    await prisma.setting.delete({ where: { key: `reset_token_${userId}` } }).catch(() => {});

    res.json({ success: true });
  } catch (err) {
    console.error('[Reset Password Error]', err);
    res.status(500).json({ error: 'Server Error' });
  }
});

app.get('/api/ebooks/my', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] as string;
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
    const userId = req.headers['x-user-id'] as string;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, name: true, country: true } });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (error) { res.status(500).json({ error: 'Failed' }); }
});

app.put('/api/profile', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const { name } = req.body;
    const user = await prisma.user.update({ where: { id: userId }, data: { name } });
    res.json({ id: user.id, email: user.email, name: user.name });
  } catch (error) { res.status(500).json({ error: 'Failed to update profile' }); }
});

app.put('/api/profile/password', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const { currentPassword, newPassword } = req.body;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.password !== currentPassword) {
      return res.status(400).json({ error: 'Senha atual incorreta.' });
    }
    await prisma.user.update({ where: { id: userId }, data: { password: newPassword } });
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: 'Failed' }); }
});

// READING PROGRESS
app.post('/api/reading-progress', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] as string;
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
    const userId = req.headers['x-user-id'] as string;
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
    const userId = req.headers['x-user-id'] as string;
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
    const userId = req.headers['x-user-id'] as string;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    await prisma.highlight.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: 'Failed' }); }
});

// WISHLIST (synced across devices)
app.get('/api/wishlist', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const items = await prisma.wishlist.findMany({ where: { userId }, select: { ebookId: true } });
    res.json(items.map(i => i.ebookId));
  } catch (error) {
    res.status(500).json({ error: 'Failed' });
  }
});

app.post('/api/wishlist/toggle', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] as string;
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

    if (event === 'PURCHASE_CANCELED' || event === 'PURCHASE_REFUNDED' || event === 'PURCHASE_CHARGEBACK') {
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
// ADMIN DASHBOARD ROUTES
// ==========================================
const adminAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const adminPassword = req.headers['x-admin-password'];
  if (!process.env.ADMIN_PASSWORD || adminPassword !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized Access. Invalid Master Password.' });
  }
  next();
};

app.get('/api/admin/categories', adminAuth, async (req, res) => {
  try {
    const cats = await prisma.category.findMany({ orderBy: { name: 'asc' } });
    res.json(cats);
  } catch (error) {
    res.status(500).json({ error: 'Failed' });
  }
});

app.post('/api/admin/categories', adminAuth, async (req, res) => {
  try {
    const { name } = req.body;
    const cat = await prisma.category.create({ data: { name } });
    res.json(cat);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create Category' });
  }
});

app.post('/api/admin/upload', adminAuth, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const fileUrl = `/uploads/${req.file.filename}`;
  res.json({ url: fileUrl });
});

// -- USER & ACCESS MANAGEMENT --
app.get('/api/admin/users', adminAuth, async (req, res) => {
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

app.post('/api/admin/users', adminAuth, async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await prisma.user.create({ data: { email, password } });
    res.json(user);
  } catch(error) {
    res.status(400).json({ error: 'Erro. Talvez e-mail já exista.' });
  }
});

app.post('/api/admin/purchases', adminAuth, async (req, res) => {
  try {
    const { userId, ebookId } = req.body;
    const purchase = await prisma.purchase.create({ data: { userId, ebookId } });
    res.json(purchase);
  } catch (error) {
    res.status(400).json({ error: 'Falha ao conceder acesso ou o usuário já o possui.' });
  }
});

app.delete('/api/admin/purchases/:userId/:ebookId', adminAuth, async (req, res) => {
  try {
    const userId = String(req.params.userId);
    const ebookId = String(req.params.ebookId);
    await prisma.purchase.deleteMany({ where: { userId, ebookId } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Falha ao revogar acesso' });
  }
});

app.delete('/api/admin/users/:id', adminAuth, async (req, res) => {
  try {
    const id = String(req.params.id);
    
    // Cleanup user relations first
    await prisma.purchase.deleteMany({ where: { userId: id } });
    await prisma.wishlist.deleteMany({ where: { userId: id } });
    await prisma.highlight.deleteMany({ where: { userId: id } });
    
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
app.get('/api/admin/webhook-logs', adminAuth, async (req, res) => {
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

app.delete('/api/admin/webhook-logs', adminAuth, async (req, res) => {
  try {
    await prisma.webhookLog.deleteMany({});
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to clear logs' });
  }
});

// -- EMAIL SETTINGS --
app.get('/api/admin/settings', adminAuth, async (req, res) => {
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

app.post('/api/admin/settings', adminAuth, async (req, res) => {
  try {
    const entries = req.body as Record<string, string>;
    for (const [key, value] of Object.entries(entries)) {
      // Skip masked values (don't overwrite with masked text)
      if (key === 'resend_api_key' && value.startsWith('••')) continue;
      if (key.startsWith('reset_token_')) continue; // Security: don't allow writing reset tokens
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

app.get('/api/admin/ebooks', adminAuth, async (req, res) => {
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

app.post('/api/admin/ebooks', adminAuth, async (req, res) => {
  try {
    const { title, author, description, coverUrl, pdfUrl, htmlUrl, externalUrl, salesUrl, hotmartOffer, categoryId, featuredList, isBonus, parentEbookId, language } = req.body;
    
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
        salesUrl, 
        hotmartOffer: finalOffer,
        categoryId: categoryId || null, 
        featuredList: featuredList || null,
        isBonus: isBonus || false,
        parentEbookId: (isBonus && parentEbookId) ? String(parentEbookId) : null,
        language: language || 'pt'
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

app.put('/api/admin/ebooks/:id', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, author, description, coverUrl, pdfUrl, htmlUrl, externalUrl, salesUrl, hotmartOffer, categoryId, featuredList, isBonus, parentEbookId, language } = req.body;
    
    // Fetch current to see if it just became a bonus or changed parent
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
        salesUrl, 
        hotmartOffer: finalOffer, 
        categoryId: categoryId || null, 
        featuredList: featuredList || null,
        isBonus: isBonus || false,
        parentEbookId: (isBonus && parentEbookId) ? String(parentEbookId) : null,
        language: language || 'pt'
      }
    });

    // Retroactive logic if parentEbookId changed or newly became bonus
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

app.delete('/api/admin/ebooks/:id', adminAuth, async (req, res) => {
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
  app.use(express.static(distPath));
  
  // Client side routing fallback
  app.use((req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
} else {
  console.warn(`[WARN] Static directory not found at ${distPath}. Build the frontend first.`);
}

// ==========================================
// SERVER INITIALIZATION
// ==========================================
app.listen(PORT, () => {
  console.log(`[EbookPro API] Server running centrally on port ${PORT}`);
});
