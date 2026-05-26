import type { PrismaClient } from '@prisma/client';
import { Resend } from 'resend';
import {
  applyEmailPlaceholders,
  buildWelcomeEmailHtml,
  DEFAULT_WELCOME_BODY_PT,
  emailBodyFromStored,
  type EmailLang,
} from '../../shared/emailTemplates.js';

const ES_COUNTRIES = ['AR','BO','CL','CO','CR','CU','DO','EC','SV','GQ','GT','HN','MX','NI','PA','PY','PE','ES','UY','VE'];

const DEFAULT_APP_URL = 'https://app.readlyme.com';

function getAppUrl() {
  const raw = (process.env.APP_URL || DEFAULT_APP_URL).trim();
  return raw.endsWith('/') ? raw.slice(0, -1) : raw;
}

export function detectLang(country: string | null | undefined): 'es' | 'pt' {
  if (!country) return 'pt';
  return ES_COUNTRIES.includes(country.toUpperCase()) ? 'es' : 'pt';
}

async function getSetting(prismaClient: PrismaClient, key: string): Promise<string | null> {
  const s = await prismaClient.setting.findUnique({ where: { key } });
  return s?.value || null;
}

async function sendEmail(prismaClient: PrismaClient, to: string, subject: string, html: string) {
  try {
    const apiKey = await getSetting(prismaClient, 'resend_api_key');
    if (!apiKey) { console.log('[Email] No Resend API key configured. Skipping.'); return; }

    const senderName = (await getSetting(prismaClient, 'sender_name')) || 'Autofintech';
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

export async function sendWelcomeEmail(prismaClient: PrismaClient, email: string, name: string | null, password: string, country: string | null) {
  const lang: EmailLang = detectLang(country) === 'es' ? 'es' : 'pt';
  const templateKey = lang === 'es' ? 'welcome_template_es' : 'welcome_template_pt';
  const stored = await getSetting(prismaClient, templateKey);
  const bodyPlain = emailBodyFromStored(stored, DEFAULT_WELCOME_BODY_PT);
  const appUrl = getAppUrl();
  const html = applyEmailPlaceholders(buildWelcomeEmailHtml(bodyPlain, lang), {
    name: name || 'Cliente',
    email,
    password,
    country: country || '-',
    app_url: appUrl,
  });

  const subject =
    lang === 'es' ? 'Bienvenido(a) a Autofintech — tu acceso está listo' : 'Bem-vindo(a) à Autofintech — seu acesso está pronto';
  await sendEmail(prismaClient, email, subject, html);
}
