/**
 * Importa JSON exportado do WP (Prisma).
 * Uso: node scripts/migrate-from-wp-export.mjs export.json
 * (usa o mesmo datasource do schema — SQLite local em prisma/dev.db ou o que estiver configurado.)
 */

import { readFileSync } from 'fs';
import { PrismaClient } from '@prisma/client';

const file = process.argv[2];
if (!file) {
  console.error('Uso: node scripts/migrate-from-wp-export.mjs <export.json>');
  process.exit(1);
}

const prisma = new PrismaClient();

function pick(obj, ...keys) {
  for (const k of keys) {
    if (obj[k] != null && obj[k] !== '') return obj[k];
  }
  return undefined;
}

async function main() {
  const raw = JSON.parse(readFileSync(file, 'utf8'));
  const licenses = raw.licenses || [];
  const products = raw.products || [];

  for (const p of products) {
    const productName = pick(p, 'productName', 'product_name') || 'Produto';
    const systemId = String(pick(p, 'systemId', 'system_id') || '');
    const offerCode = pick(p, 'offerCode', 'offer_code') || null;
    const plano = pick(p, 'plano') || null;
    const description = pick(p, 'description') || null;
    try {
      await prisma.product.create({ data: { productName, systemId, offerCode, plano, description } });
    } catch {
      /* duplicado offer ou ignorar */
    }
  }

  for (const l of licenses) {
    const email = String(pick(l, 'email') || '').toLowerCase().trim();
    const eventId = String(pick(l, 'eventId', 'event_id') || '');
    if (!email || !eventId) continue;
    try {
      await prisma.license.create({
        data: {
          email,
          buyerName: pick(l, 'buyerName', 'buyer_name') || null,
          numeroConta: String(pick(l, 'numeroConta', 'numero_conta') || ''),
          eventId,
          plano: String(pick(l, 'plano') || 'mensal'),
          statusLicenca: String(pick(l, 'statusLicenca', 'status_licenca') || 'inativa'),
          dataExpiracao: pick(l, 'dataExpiracao', 'data_expiracao') ? new Date(String(pick(l, 'dataExpiracao', 'data_expiracao'))) : null,
          dataCancelamento: pick(l, 'dataCancelamento', 'data_cancelamento')
            ? new Date(String(pick(l, 'dataCancelamento', 'data_cancelamento')))
            : null,
          dataAtivacao: pick(l, 'dataAtivacao', 'data_ativacao') ? new Date(String(pick(l, 'dataAtivacao', 'data_ativacao'))) : new Date(),
          systemId: String(pick(l, 'systemId', 'system_id') || ''),
          subscriberCode: pick(l, 'subscriberCode', 'subscriber_code') || null
        }
      });
    } catch {
      /* eventId duplicado */
    }
  }

  console.log(`Processados ${licenses.length} licenças e ${products.length} produtos (inserções tentadas).`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
