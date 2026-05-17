/**
 * Alinha systemId, offerCode e plano das licenças aos 3 produtos EA Trend
 * (Anual, Vitalício, Desafio) — sem apagar nem alterar produtos.
 *
 * Uso no servidor (DATABASE_URL apontando para Postgres de produção):
 *   node scripts/fix-license-products-by-plan.mjs --dry-run
 *   node scripts/fix-license-products-by-plan.mjs
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const dryRun = process.argv.includes('--dry-run');

function norm(v) {
  return String(v || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function firstCsvValue(csv) {
  return (
    String(csv || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)[0] || ''
  );
}

function classifyByPlano(plano) {
  const p = norm(plano);
  if (!p) return null;
  if (p.includes('vital')) return 'vitalicio';
  if (p.includes('anual')) return 'anual';
  if (p.includes('desafio') || p.includes('teste')) return 'desafio';
  if (p.includes('mensal') || p.includes('semestral')) return 'anual';
  return null;
}

function daysBetween(start, end) {
  if (!start || !end) return null;
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (!Number.isFinite(ms)) return null;
  return Math.round(ms / 86400000);
}

function classifyLicense(lic) {
  const byPlan = classifyByPlano(lic.plano);
  if (byPlan) return byPlan;

  const days = daysBetween(lic.dataAtivacao, lic.dataExpiracao);
  if (days == null) return null;
  if (days <= 12) return 'desafio';
  if (days >= 3000) return 'vitalicio';
  if (days >= 300 && days <= 450) return 'anual';
  return null;
}

function findProduct(products, kind) {
  const byName = products.find((p) => {
    const n = norm(p.productName);
    if (kind === 'anual') return n.includes('trend') && n.includes('anual');
    if (kind === 'vitalicio') return n.includes('trend') && n.includes('vitalicio');
    if (kind === 'desafio') return n.includes('trend') && n.includes('desafio');
    return false;
  });
  if (byName) return byName;

  const byPlan = products.find((p) => {
    const pl = norm(p.plano || '');
    if (kind === 'anual') return pl.includes('anual');
    if (kind === 'vitalicio') return pl.includes('vitalicio');
    if (kind === 'desafio') return pl.includes('teste') || pl.includes('desafio');
    return false;
  });
  return byPlan || null;
}

function licenseTargetsForProduct(product, kind) {
  const systemId = firstCsvValue(product.systemId);
  const offerCode = firstCsvValue(product.offerCode) || null;
  const plano = String(product.plano || kind).trim() || kind;
  return { systemId, offerCode, plano };
}

async function main() {
  const licenses = await prisma.license.findMany({
    select: {
      id: true,
      email: true,
      plano: true,
      systemId: true,
      offerCode: true,
      dataAtivacao: true,
      dataExpiracao: true,
    },
    orderBy: { id: 'asc' },
  });
  const products = await prisma.product.findMany({
    select: { id: true, productName: true, systemId: true, offerCode: true, plano: true },
    orderBy: { id: 'asc' },
  });

  const target = {
    anual: findProduct(products, 'anual'),
    vitalicio: findProduct(products, 'vitalicio'),
    desafio: findProduct(products, 'desafio'),
  };

  const missing = Object.entries(target)
    .filter(([, p]) => !p)
    .map(([k]) => k);
  if (missing.length) {
    throw new Error(`Produtos-alvo não encontrados para: ${missing.join(', ')}`);
  }

  const summary = {
    dryRun,
    targetProducts: Object.fromEntries(
      Object.entries(target).map(([k, p]) => [
        k,
        { id: p.id, name: p.productName, ...licenseTargetsForProduct(p, k) },
      ])
    ),
    totalLicenses: licenses.length,
    byKind: { anual: 0, vitalicio: 0, desafio: 0 },
    updated: 0,
    unchanged: 0,
    skippedNoKind: 0,
    preview: [],
  };

  const updates = [];

  for (const lic of licenses) {
    const kind = classifyLicense(lic);
    if (!kind) {
      summary.skippedNoKind += 1;
      continue;
    }
    summary.byKind[kind] += 1;

    const product = target[kind];
    const next = licenseTargetsForProduct(product, kind);

    const curSystem = String(lic.systemId || '').trim();
    const curOffer = String(lic.offerCode || '').trim() || null;
    const curPlano = String(lic.plano || '').trim();

    const same =
      curSystem === next.systemId &&
      curOffer === next.offerCode &&
      norm(curPlano) === norm(next.plano);

    // Corrige systemId legado (ex.: teste com 5162473 do Anual)
    const wrongSystemForPlan = curSystem && curSystem !== next.systemId;

    if (same && !wrongSystemForPlan) {
      summary.unchanged += 1;
      continue;
    }

    updates.push({
      id: lic.id,
      email: lic.email,
      kind,
      from: { systemId: curSystem, offerCode: curOffer, plano: curPlano },
      to: next,
    });
  }

  summary.updated = updates.length;
  summary.preview = updates.slice(0, 25);

  console.log(JSON.stringify(summary, null, 2));

  if (dryRun || !updates.length) return;

  for (const u of updates) {
    await prisma.license.update({
      where: { id: u.id },
      data: {
        systemId: u.to.systemId,
        offerCode: u.to.offerCode,
        plano: u.to.plano,
      },
    });
  }

  console.log(`[fix-license-products] ${updates.length} licença(s) atualizada(s).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
