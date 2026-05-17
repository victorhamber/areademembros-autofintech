/**
 * Mantém apenas 3 produtos EA Trend (Anual, Vitalício, Desafio),
 * alinha TODAS as licenças ao systemId/offerCode corretos e remove os demais produtos.
 *
 * Uso no servidor (com DATABASE_URL):
 *   node scripts/consolidate-three-products.mjs --dry-run
 *   node scripts/consolidate-three-products.mjs
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

function firstOffer(csv) {
  return (
    String(csv || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)[0] || null
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

function pickCanonicalProduct(products, kind) {
  const list = products.filter((p) => {
    const n = norm(p.productName);
    if (kind === 'anual') return n.includes('trend') && n.includes('anual') && !n.includes('premium');
    if (kind === 'vitalicio') return n.includes('trend') && n.includes('vitalicio') && !n.includes('premium');
    if (kind === 'desafio') return n.includes('trend') && n.includes('desafio');
    return false;
  });
  if (!list.length) return null;
  // Preferir nome mais curto/padrão (ex.: "EA Trend - Anual" vs "EA TREND - VITALÍCIO")
  list.sort((a, b) => a.productName.length - b.productName.length);
  return list[0];
}

function remapProductIdsCsv(csv, idMap) {
  const ids = String(csv || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (!ids.length) return csv;
  const out = new Set();
  for (const raw of ids) {
    const n = Number(raw);
    if (Number.isFinite(n) && idMap.has(n)) out.add(String(idMap.get(n)));
    else if (Number.isFinite(n)) out.add(String(n));
  }
  return [...out].join(',');
}

async function main() {
  const products = await prisma.product.findMany({ orderBy: { id: 'asc' } });
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
  });

  const target = {
    anual: pickCanonicalProduct(products, 'anual'),
    vitalicio: pickCanonicalProduct(products, 'vitalicio'),
    desafio: pickCanonicalProduct(products, 'desafio'),
  };

  const missing = Object.entries(target)
    .filter(([, p]) => !p)
    .map(([k]) => k);
  if (missing.length) {
    throw new Error(`Produtos canônicos não encontrados: ${missing.join(', ')}`);
  }

  const keepIds = new Set([target.anual.id, target.vitalicio.id, target.desafio.id]);
  const toDelete = products.filter((p) => !keepIds.has(p.id));

  const idMap = new Map();
  for (const p of products) {
    if (keepIds.has(p.id)) {
      idMap.set(p.id, p.id);
      continue;
    }
    const kind =
      classifyByPlano(p.plano) ||
      (norm(p.productName).includes('desafio') || norm(p.productName).includes('teste')
        ? 'desafio'
        : norm(p.productName).includes('vital')
          ? 'vitalicio'
          : norm(p.productName).includes('anual')
            ? 'anual'
            : null);
    if (kind && target[kind]) idMap.set(p.id, target[kind].id);
  }

  const licenseUpdates = [];
  const stats = { anual: 0, vitalicio: 0, desafio: 0, skipped: 0 };

  for (const lic of licenses) {
    const kind = classifyLicense(lic);
    if (!kind) {
      stats.skipped += 1;
      continue;
    }
    stats[kind] += 1;
    const product = target[kind];
    const nextSystemId = String(product.systemId || '').trim();
    const nextOffer = firstOffer(product.offerCode);
    const sameSystem = String(lic.systemId || '').trim() === nextSystemId;
    const sameOffer = (String(lic.offerCode || '').trim() || null) === nextOffer;
    if (!sameSystem || !sameOffer) {
      licenseUpdates.push({
        id: lic.id,
        kind,
        data: { systemId: nextSystemId, offerCode: nextOffer },
      });
    }
  }

  const courses = await prisma.course.findMany({
    select: { id: true, title: true, productIds: true },
  });
  const courseUpdates = courses
    .map((c) => {
      const next = remapProductIdsCsv(c.productIds, idMap);
      if (next === (c.productIds || '')) return null;
      return { id: c.id, title: c.title, productIds: next };
    })
    .filter(Boolean);

  const productNormalize = [
    { id: target.anual.id, plano: 'anual' },
    { id: target.vitalicio.id, plano: 'vitalicio' },
    { id: target.desafio.id, plano: 'desafio' },
  ];

  console.log(
    JSON.stringify(
      {
        dryRun,
        keepProducts: target,
        deleteProductIds: toDelete.map((p) => ({ id: p.id, name: p.productName })),
        licenseStats: stats,
        licensesToUpdate: licenseUpdates.length,
        coursesToUpdate: courseUpdates.length,
        previewLicenseUpdates: licenseUpdates.slice(0, 15),
      },
      null,
      2
    )
  );

  if (dryRun) return;

  for (const u of licenseUpdates) {
    await prisma.license.update({ where: { id: u.id }, data: u.data });
  }

  for (const u of courseUpdates) {
    await prisma.course.update({
      where: { id: u.id },
      data: { productIds: u.productIds },
    });
  }

  for (const p of productNormalize) {
    await prisma.product.update({
      where: { id: p.id },
      data: { plano: p.plano },
    });
  }

  if (toDelete.length) {
    await prisma.product.deleteMany({
      where: { id: { in: toDelete.map((p) => p.id) } },
    });
  }

  console.log('[consolidate] Concluído: 3 produtos, licenças alinhadas, extras removidos.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
