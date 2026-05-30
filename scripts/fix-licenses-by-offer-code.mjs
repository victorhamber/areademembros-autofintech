/**
 * Alinha plano e systemId de cada licença ao produto cadastrado,
 * usando o offerCode já gravado na licença (fonte da verdade Hotmart).
 *
 * Não altera datas, conta MT5, status nem eventId.
 *
 * Uso:
 *   node scripts/fix-licenses-by-offer-code.mjs --dry-run
 *   node scripts/fix-licenses-by-offer-code.mjs
 */
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
dotenv.config({ path: path.join(ROOT, '.env'), override: true });

const prisma = new PrismaClient();
const dryRun = process.argv.includes('--dry-run');

function norm(v) {
  return String(v || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function parseCsv(raw) {
  if (!raw) return [];
  return String(raw)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function csvIncludes(raw, target) {
  const t = String(target || '').trim();
  if (!t) return false;
  return parseCsv(raw).includes(t);
}

function firstCsv(raw) {
  return parseCsv(raw)[0] || '';
}

function findProductByOfferCode(products, offerCode) {
  const code = String(offerCode || '').trim();
  if (!code) return null;

  const matches = products.filter((p) => csvIncludes(p.offerCode, code));
  if (matches.length === 0) return null;
  if (matches.length === 1) return matches[0];

  const exact = matches.find((p) => String(p.offerCode || '').trim() === code);
  if (exact) return exact;

  const byPlan = matches.filter((p) => {
    const offers = parseCsv(p.offerCode);
    return offers.includes(code);
  });
  return byPlan.length === 1 ? byPlan[0] : null;
}

function findProductByPlano(products, plano) {
  const p = norm(plano);
  if (!p) return null;
  const matches = products.filter((pr) => norm(pr.plano) === p);
  if (matches.length === 1) return matches[0];
  return null;
}

function targetsFromProduct(product) {
  return {
    systemId: firstCsv(product.systemId),
    plano: String(product.plano || '').trim() || 'mensal',
    offerCode: firstCsv(product.offerCode) || null,
  };
}

async function main() {
  if (!process.env.DATABASE_URL?.trim()) {
    throw new Error(
      'DATABASE_URL não definida. Rode no terminal do app (EasyPanel) ou configure no .env local.'
    );
  }

  const licenses = await prisma.license.findMany({
    select: {
      id: true,
      email: true,
      plano: true,
      systemId: true,
      offerCode: true,
      numeroConta: true,
      statusLicenca: true,
      dataAtivacao: true,
      dataExpiracao: true,
    },
    orderBy: { id: 'asc' },
  });

  const products = await prisma.product.findMany({
    select: { id: true, productName: true, systemId: true, offerCode: true, plano: true },
    orderBy: { id: 'asc' },
  });

  const summary = {
    dryRun,
    totalLicenses: licenses.length,
    totalProducts: products.length,
    updated: 0,
    unchanged: 0,
    skippedNoProduct: 0,
    skippedAmbiguous: 0,
    bySource: { offerCode: 0, plano: 0 },
    preview: [],
    skipped: [],
  };

  const updates = [];

  for (const lic of licenses) {
    const curOffer = String(lic.offerCode || '').trim() || null;
    const curPlano = String(lic.plano || '').trim();
    const curSystem = String(lic.systemId || '').trim();

    let product = curOffer ? findProductByOfferCode(products, curOffer) : null;
    let source = 'offerCode';

    if (!product && curPlano) {
      product = findProductByPlano(products, curPlano);
      source = 'plano';
    }

    if (!product) {
      summary.skippedNoProduct += 1;
      if (summary.skipped.length < 20) {
        summary.skipped.push({
          id: lic.id,
          email: lic.email,
          offerCode: curOffer,
          plano: curPlano,
          systemId: curSystem,
        });
      }
      continue;
    }

    const next = targetsFromProduct(product);
    if (!next.systemId) {
      summary.skippedNoProduct += 1;
      continue;
    }

    const samePlano = norm(curPlano) === norm(next.plano);
    const sameSystem = curSystem === next.systemId;
    const sameOffer =
      !curOffer || !next.offerCode || curOffer === next.offerCode || csvIncludes(product.offerCode, curOffer);

    if (samePlano && sameSystem && sameOffer) {
      summary.unchanged += 1;
      continue;
    }

    summary.bySource[source] += 1;
    updates.push({
      id: lic.id,
      email: lic.email,
      productName: product.productName,
      source,
      from: { systemId: curSystem, offerCode: curOffer, plano: curPlano },
      to: {
        systemId: next.systemId,
        offerCode: curOffer || next.offerCode,
        plano: next.plano,
      },
    });
  }

  summary.updated = updates.length;
  summary.preview = updates.slice(0, 30);

  console.log(JSON.stringify(summary, null, 2));

  if (dryRun || !updates.length) {
    if (dryRun && updates.length) {
      console.log(`[dry-run] ${updates.length} licença(s) seriam atualizadas.`);
    }
    return;
  }

  for (const u of updates) {
    await prisma.license.update({
      where: { id: u.id },
      data: {
        systemId: u.to.systemId,
        plano: u.to.plano,
        offerCode: u.to.offerCode,
      },
    });
  }

  console.log(`[fix-licenses-by-offer-code] ${updates.length} licença(s) atualizada(s).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
