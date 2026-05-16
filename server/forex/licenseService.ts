import type { PrismaClient } from '@prisma/client';
import { cacheGet, cacheSet } from '../lib/licenseValidationCache.js';
import { log } from '../lib/logger.js';

const ACTIVE = 'ativa';
const EXPIRED = 'expirada';

function isEmailValid(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function validateLicenseHandler(prisma: PrismaClient, body: { email?: string; numero_conta?: string; system_id?: string }) {
  const email = (body.email || '').trim().toLowerCase();
  const numero_conta = String(body.numero_conta || '').trim();
  const system_id = String(body.system_id || '').trim();

  if (!isEmailValid(email)) {
    return { status: 400, json: { status: 'error', message: 'Email format invalid.' } };
  }
  if (!numero_conta || numero_conta.length < 3) {
    return { status: 400, json: { status: 'error', message: 'Account number must have at least 3 characters.' } };
  }
  if (!system_id) {
    return { status: 400, json: { status: 'error', message: 'system_id is required.' } };
  }

  const cacheKey = `license_validation_${email}_${numero_conta}_${system_id}`;
  const hit = cacheGet(cacheKey);
  if (hit) {
    return { status: hit.status, json: hit.body };
  }

  const license = await prisma.license.findFirst({
    where: { email, numeroConta: numero_conta, systemId: system_id }
  });

  let result: { status: number; json: object };
  if (license && (license.statusLicenca === ACTIVE || license.statusLicenca === EXPIRED)) {
    if (license.statusLicenca === EXPIRED) {
      result = { status: 403, json: { status: 'error', message: 'Licença expirada.' } };
    } else {
      const now = new Date();
      if (license.dataExpiracao && license.dataExpiracao < now) {
        await prisma.license.update({ where: { id: license.id }, data: { statusLicenca: EXPIRED } });
        result = { status: 403, json: { status: 'error', message: 'Licença expirada.' } };
      } else {
        result = {
          status: 200,
          json: {
            status: 'success',
            message: 'Licença válida.',
            data_expiracao: license.dataExpiracao?.toISOString() ?? null
          }
        };
      }
    }
  } else {
    result = { status: 403, json: { status: 'error', message: 'Licença inválida ou inativa.' } };
  }

  cacheSet(cacheKey, result.status, result.json as object);
  log('DEBUG', `License validation: email=${email}, account=${numero_conta}, system=${system_id}, http=${result.status}`);
  return result;
}

export async function grantEbookAccessForSystem(prisma: PrismaClient, email: string, systemId: string) {
  if (!systemId) return;
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (!user) return;
  const ebooks = await prisma.ebook.findMany({ where: { licenseSystemId: systemId } });
  for (const eb of ebooks) {
    try {
      await prisma.purchase.create({ data: { userId: user.id, ebookId: eb.id } });
    } catch {
      /* unique */
    }
    const bonuses = await prisma.ebook.findMany({ where: { isBonus: true, parentEbookId: eb.id } });
    if (bonuses.length) {
      await prisma.purchase.createMany({
        data: bonuses.map(b => ({ userId: user.id, ebookId: b.id })),
        skipDuplicates: true
      });
    }
  }
}

export async function revokeEbookAccessForSystem(prisma: PrismaClient, email: string, systemId: string) {
  if (!systemId) return;
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (!user) return;
  const ebooks = await prisma.ebook.findMany({
    where: { licenseSystemId: systemId },
    select: { id: true }
  });
  const ids = [...ebooks.map(e => e.id)];
  for (const eb of ebooks) {
    const bonuses = await prisma.ebook.findMany({ where: { parentEbookId: eb.id }, select: { id: true } });
    ids.push(...bonuses.map(b => b.id));
  }
  if (ids.length) {
    await prisma.purchase.deleteMany({ where: { userId: user.id, ebookId: { in: ids } } });
  }
}
