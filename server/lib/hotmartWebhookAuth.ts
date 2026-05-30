import type { PrismaClient } from '@prisma/client';
import { getForexWebhookToken } from './apiSettings.js';
import { extractHotmartWebhookToken } from './appUrls.js';

/**
 * Valida token Hotmart no webhook unificado.
 * Aceita HOTMART_HOTTOK (env), forex_webhook_token (admin) ou nenhum (modo aberto — não recomendado em produção).
 */
export async function validateHotmartWebhookAuth(
  prisma: PrismaClient,
  req: { headers: Record<string, string | string[] | undefined>; query: Record<string, unknown> }
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const received = extractHotmartWebhookToken(req);
  const envToken = String(process.env.HOTMART_HOTTOK || '').trim();
  const dbToken = (await getForexWebhookToken(prisma)).trim();

  const expectedTokens = [...new Set([envToken, dbToken].filter(Boolean))];
  if (!expectedTokens.length) return { ok: true };

  if (!received) {
    return { ok: false, reason: 'Token ausente (header X-HOTTOK ou hottok)' };
  }

  if (expectedTokens.includes(received)) return { ok: true };

  return { ok: false, reason: 'Invalid hottok token' };
}
