import type { PrismaClient } from '@prisma/client';
import { cacheGet, cacheSet } from '../lib/licenseValidationCache.js';
import { log } from '../lib/logger.js';

const ACTIVE = 'ativa';
const EXPIRED = 'expirada';

function isEmailValid(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function validateLicenseHandler(
  prisma: PrismaClient,
  body: { email?: string; numero_conta?: string; system_id?: string; license_id?: number | string }
) {
  const email = (body.email || '').trim().toLowerCase();
  const numero_conta = String(body.numero_conta || '').trim();
  const system_id = String(body.system_id || '').trim();
  const licenseIdRaw = body.license_id;
  const licenseId =
    licenseIdRaw != null && String(licenseIdRaw).trim() !== ''
      ? parseInt(String(licenseIdRaw), 10)
      : NaN;

  if (!isEmailValid(email)) {
    return { status: 400, json: { status: 'error', message: 'Email format invalid.' } };
  }
  if (!numero_conta || numero_conta.length < 3) {
    return { status: 400, json: { status: 'error', message: 'Account number must have at least 3 characters.' } };
  }
  if (!system_id && !Number.isFinite(licenseId)) {
    return { status: 400, json: { status: 'error', message: 'system_id or license_id is required.' } };
  }

  const cacheKey = `license_validation_${email}_${numero_conta}_${system_id || licenseId}`;
  const hit = cacheGet(cacheKey);
  if (hit) {
    return { status: hit.status, json: hit.body };
  }

  let license = Number.isFinite(licenseId)
    ? await prisma.license.findFirst({ where: { id: licenseId, email } })
    : null;

  if (!license && system_id) {
    const candidates = await prisma.license.findMany({
      where: { email, systemId: system_id },
      orderBy: { id: 'desc' },
    });
    if (candidates.length === 1) license = candidates[0];
    else if (candidates.length > 1) {
      const linked = candidates.find((c) => c.numeroConta === numero_conta);
      const empty = candidates.find((c) => !String(c.numeroConta || '').trim());
      license = linked || empty || null;
      if (!license) {
        return {
          status: 400,
          json: {
            status: 'error',
            message: 'Você tem mais de uma licença neste produto. Selecione qual licença deseja validar.',
          },
        };
      }
    }
  }

  if (license) {
    const currentAccount = String(license.numeroConta || '').trim();
    if (!currentAccount) {
      license = await prisma.license.update({
        where: { id: license.id },
        data: { numeroConta: numero_conta },
      });
    } else if (currentAccount !== numero_conta) {
      return {
        status: 403,
        json: {
          status: 'error',
          message: 'Este produto já está vinculado a outra conta MetaTrader.',
        },
      };
    }
  } else if (system_id) {
    license = await prisma.license.findFirst({
      where: { email, numeroConta: numero_conta, systemId: system_id },
    });
  }

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

export async function grantContentAccessForSystem(prisma: PrismaClient, email: string, systemId: string) {
  if (!systemId) return;
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (!user) return;
  const contents = await prisma.content.findMany({ where: { licenseSystemId: systemId } });
  for (const c of contents) {
    try {
      await prisma.purchase.create({ data: { userId: user.id, contentId: c.id } });
    } catch {
      /* unique */
    }
    const bonuses = await prisma.content.findMany({ where: { isBonus: true, parentContentId: c.id } });
    if (bonuses.length) {
      await prisma.purchase.createMany({
        data: bonuses.map(b => ({ userId: user.id, contentId: b.id })),
        skipDuplicates: true
      });
    }
  }
}

export async function revokeContentAccessForSystem(prisma: PrismaClient, email: string, systemId: string) {
  if (!systemId) return;
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (!user) return;
  const contents = await prisma.content.findMany({
    where: { licenseSystemId: systemId },
    select: { id: true }
  });
  const ids = [...contents.map(c => c.id)];
  for (const c of contents) {
    const bonuses = await prisma.content.findMany({ where: { parentContentId: c.id }, select: { id: true } });
    ids.push(...bonuses.map(b => b.id));
  }
  if (ids.length) {
    await prisma.purchase.deleteMany({ where: { userId: user.id, contentId: { in: ids } } });
  }
}
