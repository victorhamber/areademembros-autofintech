import type { PrismaClient } from '@prisma/client';
import { log } from '../lib/logger.js';
import { grantContentAccessForSystem, revokeContentAccessForSystem } from './licenseService.js';
import { postRobotJson } from './robotNotify.js';
import { parseCsv, csvIncludes } from '../lib/csv.js';
import { sendWelcomeEmail } from '../lib/welcomeEmail.js';

async function findProductByOfferCode(prisma: PrismaClient, offerCode: string) {
  const code = offerCode.trim();
  if (!code) return null;
  const direct = await prisma.product.findFirst({ where: { offerCode: code } });
  if (direct) return direct;
  const candidates = await prisma.product.findMany({
    where: { offerCode: { contains: code } }
  });
  return candidates.find((p) => csvIncludes(p.offerCode, code)) || null;
}

function addDuration(plano: string): Date {
  const d = new Date();
  const p = String(plano || 'mensal').toLowerCase().trim();
  const toleranceDays = 3;
  if (p === 'teste') {
    d.setDate(d.getDate() + 7 + toleranceDays);
    return d;
  }
  if (p === 'semestral') {
    d.setDate(d.getDate() + 180 + toleranceDays);
    return d;
  }
  if (p === 'anual') {
    d.setDate(d.getDate() + 365 + toleranceDays);
    return d;
  }
  if (p === 'vitalicio') {
    d.setDate(d.getDate() + 18250 + toleranceDays);
    return d;
  }
  d.setDate(d.getDate() + 30 + toleranceDays); // mensal/default
  return d;
}

function extractSubscriberCode(data: Record<string, unknown>): string {
  const d = data.data as Record<string, unknown> | undefined;
  const sub = d?.subscription as Record<string, unknown> | undefined;
  const sub2 = sub?.subscriber as Record<string, unknown> | undefined;
  const fromNested =
    (sub2?.code as string) ||
    ((d?.subscriber as Record<string, unknown> | undefined)?.code as string) ||
    ((data.subscription as Record<string, unknown> | undefined)?.subscriber as Record<string, unknown> | undefined)?.code;
  return String(fromNested || '').trim();
}

export async function processLicenseWebhook(prisma: PrismaClient, data: Record<string, unknown>) {
  const event = String(data.event || '').trim();
  if (!event) return { ok: false, status: 400, message: 'Evento não encontrado no webhook' };

  const activate = ['PURCHASE_APPROVED', 'PURCHASE_COMPLETE'];
  const deactivate = [
    'PURCHASE_PROTEST',
    'SUBSCRIPTION_CANCELLATION',
    'PURCHASE_DELAYED',
    'PURCHASE_REFUNDED',
    'PURCHASE_CHARGEBACK',
    'PURCHASE_CANCELED'
  ];

  if (activate.includes(event)) return activateLicense(prisma, data);
  if (deactivate.includes(event)) return deactivateLicense(prisma, data);
  log('INFO', `Webhook evento não tratado: ${event}`);
  return { ok: true, status: 200, message: 'Event ignored' };
}

async function ensureUser(prisma: PrismaClient, email: string, buyerName: string, country?: string | null) {
  const em = email.toLowerCase().trim();
  let user = await prisma.user.findUnique({ where: { email: em } });
  let isNewUser = false;
  if (!user) {
    const { hashMemberPassword } = await import('../lib/verifyUserPassword.js');
    const DEFAULT_PASSWORD = 'Mudar123@';
    user = await prisma.user.create({
      data: { email: em, name: buyerName || null, password: hashMemberPassword(DEFAULT_PASSWORD), country: country || null }
    });
    isNewUser = true;
  } else {
    const updates: Record<string, string> = {};
    if (buyerName && !user.name) updates.name = buyerName;
    if (country && !user.country) updates.country = country;
    if (Object.keys(updates).length > 0) {
      user = await prisma.user.update({ where: { id: user.id }, data: updates });
    }
  }
  return { user, isNewUser };
}

async function activateLicense(prisma: PrismaClient, data: Record<string, unknown>) {
  const d = data.data as Record<string, unknown> | undefined;
  const buyer = (d?.buyer || {}) as Record<string, unknown>;
  const purchase = (d?.purchase || {}) as Record<string, unknown>;
  const offer = (purchase.offer || {}) as Record<string, unknown>;
  const productObj = (d?.product || {}) as Record<string, unknown>;

  const email = String(buyer.email || '').trim().toLowerCase();
  const buyer_name = String(buyer.name || buyer.first_name || '').trim();
  const buyer_country = String(purchase.checkout_country?.toString() || (buyer.address as any)?.country || '').trim() || null;
  let event_id = String(purchase.transaction || '').trim();
  if (!event_id) event_id = `evt_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const offer_code = String(offer.code || productObj.offer_code || '').trim();
  const product_id = String(productObj.id || productObj.ucode || '').trim();
  const subscriber_code = extractSubscriberCode(data);

  if (!email) return { ok: false, status: 400, message: 'Missing buyer email' };

  const { user, isNewUser } = await ensureUser(prisma, email, buyer_name, buyer_country);
  if (isNewUser) {
    log('INFO', `Novo usuário criado via webhook: ${email} (senha padrão: Mudar123@)`);
    sendWelcomeEmail(prisma, email, buyer_name || null, 'Mudar123@', buyer_country).catch(err =>
      log('ERROR', `Falha ao enviar e-mail de boas-vindas para ${email}: ${err}`)
    );
  }

  const product = offer_code ? await findProductByOfferCode(prisma, offer_code) : null;
  const systemIds = parseCsv(product?.systemId || '');
  const hasProduct = systemIds.length > 0;
  if (!systemIds.length) systemIds.push('');
  const plano = product?.plano || 'mensal';
  const data_expiracao = addDuration(plano);

  // --- 1) Ativar licença(s) se houver Product cadastrado ---
  if (hasProduct) {
    for (const [idx, system_id] of systemIds.entries()) {
      const isFirst = idx === 0;
      let existing = null as Awaited<ReturnType<typeof prisma.license.findFirst>> | null;
      if (subscriber_code && system_id) {
        existing = await prisma.license.findFirst({
          where: { subscriberCode: subscriber_code, email, systemId: system_id }
        });
      }
      if (!existing && system_id) {
        existing = await prisma.license.findFirst({ where: { email, systemId: system_id } });
      }
      if (!existing && isFirst) {
        existing = await prisma.license.findFirst({ where: { eventId: event_id } });
      }

      if (existing) {
        const update: {
          email: string;
          buyerName: string | null;
          plano: string;
          statusLicenca: string;
          dataExpiracao: Date;
          systemId: string;
          dataAtivacao: Date;
          subscriberCode?: string | null;
          eventId?: string;
          offerCode?: string | null;
        } = {
          email,
          buyerName: buyer_name || existing.buyerName,
          plano,
          statusLicenca: 'ativa',
          dataExpiracao: data_expiracao,
          systemId: system_id || existing.systemId,
          dataAtivacao: new Date()
        };
        if (subscriber_code) update.subscriberCode = subscriber_code;
        if (offer_code) update.offerCode = offer_code;
        if (isFirst && (!subscriber_code || !existing.subscriberCode)) update.eventId = event_id;
        await prisma.license.update({ where: { id: existing.id }, data: update });
        log('INFO', `Licença ${existing.id} reativada/renovada ${email} sys=${system_id} offer=${offer_code}`);
      } else {
        await prisma.license.create({
          data: {
            email,
            buyerName: buyer_name || null,
            numeroConta: '',
            eventId: isFirst ? event_id : `${event_id}_${system_id || idx}`,
            plano,
            statusLicenca: 'ativa',
            dataExpiracao: data_expiracao,
            systemId: system_id,
            dataAtivacao: new Date(),
            subscriberCode: subscriber_code || null,
            offerCode: offer_code || null
          }
        });
        log('INFO', `Nova licença criada ${email} event=${event_id} sys=${system_id} offer=${offer_code}`);
      }

      if (system_id) await grantContentAccessForSystem(prisma, email, system_id);

      await postRobotJson(process.env.ROBOT_ACTIVATE_URL, {
        email,
        numero_conta: '',
        system_id,
        event_id
      });
    }
  }

  // --- 2) Conceder acesso a conteúdos pelo offerCode/productId ---
  const searchCode = offer_code || product_id;
  if (searchCode) {
    const possibleContents = await prisma.content.findMany({
      where: {
        OR: [
          { hotmartOffer: { contains: searchCode } },
          ...(product_id && product_id !== searchCode ? [{ hotmartOffer: { contains: product_id } }] : [])
        ]
      }
    });
    const contentsToGrant = possibleContents.filter(c => {
      const codes = c.hotmartOffer.split(',').map(s => s.trim());
      return codes.includes(offer_code) || codes.includes(product_id);
    });

    if (contentsToGrant.length > 0) {
      for (const content of contentsToGrant) {
        try {
          await prisma.purchase.create({ data: { userId: user.id, contentId: content.id } });
        } catch (e: any) {
          if (!e.message?.includes('Unique constraint')) throw e;
        }
        const bonuses = await prisma.content.findMany({ where: { isBonus: true, parentContentId: content.id } });
        if (bonuses.length > 0) {
          await prisma.purchase.createMany({
            data: bonuses.map(b => ({ userId: user.id, contentId: b.id })),
            skipDuplicates: true
          });
        }
      }
      log('INFO', `Acesso ao conteúdo concedido: ${email} -> ${contentsToGrant.map(c => c.title).join(', ')}`);
    }
  }

  return { ok: true, status: 200, message: 'Webhook processado com sucesso!' };
}

async function deactivateLicense(prisma: PrismaClient, data: Record<string, unknown>) {
  let email = '';
  let event_id = '';
  let offer_code = '';
  let subscriber_code = '';

  const d = data.data as Record<string, unknown> | undefined;
  if (d?.buyer && typeof d.buyer === 'object') {
    const buyer = d.buyer as Record<string, unknown>;
    email = String(buyer.email || '').trim().toLowerCase();
    const purchase = (d.purchase || {}) as Record<string, unknown>;
    const offer = (purchase.offer || {}) as Record<string, unknown>;
    event_id = String(purchase.transaction || '').trim();
    offer_code = String(offer.code || '').trim();
    subscriber_code = extractSubscriberCode(data);
  } else if (d?.subscriber && typeof d.subscriber === 'object') {
    const sub = d.subscriber as Record<string, unknown>;
    email = String(sub.email || '').trim().toLowerCase();
    event_id = String((data as { id?: string }).id || '').trim();
    if (typeof d.subscription === 'object' && d.subscription) {
      const plan = (d.subscription as Record<string, unknown>).plan as Record<string, unknown> | undefined;
      offer_code = String(plan?.id || '');
    }
    subscriber_code = String(sub.code || '').trim();
  }

  if (!email) return { ok: false, status: 400, message: 'Email obrigatório para desativação' };

  let license = null as Awaited<ReturnType<typeof prisma.license.findFirst>> | null;
  if (subscriber_code) {
    license = await prisma.license.findFirst({
      where: { subscriberCode: subscriber_code, email, statusLicenca: 'ativa' }
    });
  }
  if (!license && event_id) {
    license = await prisma.license.findFirst({ where: { eventId: event_id, statusLicenca: 'ativa' } });
  }
  let productSystemIds: string[] = [];
  if (!license && offer_code) {
    const product = await findProductByOfferCode(prisma, offer_code);
    productSystemIds = parseCsv(product?.systemId || '');
    if (productSystemIds.length) {
      const list = await prisma.license.findMany({
        where: { email, systemId: { in: productSystemIds }, statusLicenca: 'ativa' },
        orderBy: { id: 'desc' }
      });
      if (list.length) license = list[0];
    }
  }
  if (!license) {
    license = await prisma.license.findFirst({
      where: { email, statusLicenca: 'ativa' },
      orderBy: { id: 'desc' }
    });
  }

  // Desativar licenças encontradas
  if (license) {
    const targets = productSystemIds.length ? productSystemIds : [license.systemId];
    const toDeactivate = await prisma.license.findMany({
      where: { email, systemId: { in: targets }, statusLicenca: 'ativa' }
    });
    for (const lic of toDeactivate) {
      await prisma.license.update({
        where: { id: lic.id },
        data: { statusLicenca: 'desativada', dataCancelamento: new Date() }
      });
      if (lic.systemId) await revokeContentAccessForSystem(prisma, email, lic.systemId);
      await postRobotJson(process.env.ROBOT_DEACTIVATE_URL, {
        email: lic.email,
        numero_conta: lic.numeroConta,
        system_id: lic.systemId,
        event_id
      });
    }
    log('INFO', `Licenças desativadas para ${email}`);
  }

  // Revogar acesso ao conteúdo pelo offerCode
  const productId = extractProductId(data);
  const searchCode = offer_code || productId;
  if (searchCode) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      const possibleContents = await prisma.content.findMany({
        where: {
          OR: [
            { hotmartOffer: { contains: searchCode } },
            ...(productId && productId !== searchCode ? [{ hotmartOffer: { contains: productId } }] : [])
          ]
        }
      });
      const contentsToRevoke = possibleContents.filter(c => {
        const codes = c.hotmartOffer.split(',').map(s => s.trim());
        return codes.includes(offer_code) || codes.includes(productId);
      });
      if (contentsToRevoke.length > 0) {
        let idsToRemove: string[] = [];
        for (const c of contentsToRevoke) {
          idsToRemove.push(c.id);
          const bonuses = await prisma.content.findMany({ where: { parentContentId: c.id }, select: { id: true } });
          idsToRemove.push(...bonuses.map(b => b.id));
        }
        await prisma.purchase.deleteMany({ where: { userId: user.id, contentId: { in: idsToRemove } } });
        log('INFO', `Acesso ao conteúdo revogado: ${email} -> ${contentsToRevoke.map(c => c.title).join(', ')}`);
      }
    }
  }

  if (!license && !searchCode) {
    return { ok: false, status: 400, message: 'Licença ativa não encontrada' };
  }

  return { ok: true, status: 200, message: 'Webhook processado com sucesso!' };
}

function extractProductId(data: Record<string, unknown>): string {
  const d = data.data as Record<string, unknown> | undefined;
  const product = (d?.product || {}) as Record<string, unknown>;
  return String(product.id || product.ucode || '').trim();
}
