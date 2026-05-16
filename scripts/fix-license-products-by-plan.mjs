import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function normalizePlan(value) {
  return String(value || '').trim().toLowerCase();
}

function classifyPlan(planRaw) {
  const plan = normalizePlan(planRaw);
  if (!plan) return null;
  if (plan.includes('vital')) return 'vitalicio';
  if (plan.includes('anual')) return 'anual';
  if (plan.includes('teste') || plan.includes('desafio')) return 'desafio';
  return null;
}

function normalizeText(v) {
  return String(v || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function firstOfferCode(csvRaw) {
  const parts = String(csvRaw || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return parts[0] || null;
}

function findProduct(products, targetKind) {
  const byName = products.find((p) => {
    const n = normalizeText(p.productName);
    if (targetKind === 'anual') return n.includes('trend') && n.includes('anual');
    if (targetKind === 'vitalicio') return n.includes('trend') && n.includes('vitalicio');
    if (targetKind === 'desafio') return n.includes('trend') && n.includes('desafio');
    return false;
  });
  if (byName) return byName;

  const byPlan = products.find((p) => {
    const pl = normalizeText(p.plano || '');
    if (targetKind === 'anual') return pl.includes('anual');
    if (targetKind === 'vitalicio') return pl.includes('vitalicio');
    if (targetKind === 'desafio') return pl.includes('teste') || pl.includes('desafio');
    return false;
  });
  return byPlan || null;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const licenses = await prisma.license.findMany({
    select: { id: true, plano: true, systemId: true, offerCode: true, email: true },
    orderBy: { id: 'asc' }
  });
  const products = await prisma.product.findMany({
    select: { id: true, productName: true, systemId: true, offerCode: true, plano: true },
    orderBy: { id: 'asc' }
  });

  const target = {
    anual: findProduct(products, 'anual'),
    vitalicio: findProduct(products, 'vitalicio'),
    desafio: findProduct(products, 'desafio')
  };

  const missingTargets = Object.entries(target)
    .filter(([, p]) => !p)
    .map(([k]) => k);
  if (missingTargets.length) {
    throw new Error(`Produtos-alvo não encontrados para: ${missingTargets.join(', ')}`);
  }

  const summary = {
    totalLicenses: licenses.length,
    anual: { matched: 0, updated: 0 },
    vitalicio: { matched: 0, updated: 0 },
    desafio: { matched: 0, updated: 0 },
    unchanged: 0
  };

  const updates = [];

  for (const lic of licenses) {
    const kind = classifyPlan(lic.plano);
    if (!kind) {
      summary.unchanged += 1;
      continue;
    }
    summary[kind].matched += 1;

    const product = target[kind];
    const nextSystemId = String(product.systemId || '').trim();
    const nextOfferCode = firstOfferCode(product.offerCode);

    const sameSystem = String(lic.systemId || '').trim() === nextSystemId;
    const currentOffer = String(lic.offerCode || '').trim();
    const sameOffer = (currentOffer || null) === nextOfferCode;
    if (sameSystem && sameOffer) {
      summary.unchanged += 1;
      continue;
    }

    updates.push({
      id: lic.id,
      email: lic.email,
      plano: lic.plano,
      kind,
      fromSystemId: lic.systemId,
      toSystemId: nextSystemId,
      fromOfferCode: lic.offerCode,
      toOfferCode: nextOfferCode
    });
  }

  if (!dryRun) {
    for (const u of updates) {
      await prisma.license.update({
        where: { id: u.id },
        data: {
          systemId: u.toSystemId,
          offerCode: u.toOfferCode
        }
      });
      summary[u.kind].updated += 1;
    }
  }

  console.log(
    JSON.stringify(
      {
        dryRun,
        targetProducts: target,
        summary,
        updatedPreview: updates.slice(0, 20)
      },
      null,
      2
    )
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
