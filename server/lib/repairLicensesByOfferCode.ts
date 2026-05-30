import type { PrismaClient } from '@prisma/client';
import { parseCsv } from '../../shared/csv.js';
import { findProductByOfferCodeInList } from '../../shared/licenseProductMatch.js';

function norm(v: unknown): string {
  return String(v ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function firstCsv(raw: string | null | undefined): string {
  return parseCsv(raw)[0] || '';
}

function findProductByPlano(
  products: Array<{ id: number; productName: string; systemId: string; offerCode: string | null; plano: string | null }>,
  plano: string
) {
  const p = norm(plano);
  if (!p) return null;
  const matches = products.filter((pr) => norm(pr.plano) === p);
  return matches.length === 1 ? matches[0] : null;
}

export type RepairLicensesResult = {
  dryRun: boolean;
  totalLicenses: number;
  updated: number;
  unchanged: number;
  skippedNoProduct: number;
  bySource: { offerCode: number; plano: number };
  preview: Array<{
    id: number;
    email: string;
    productName: string;
    from: { systemId: string; offerCode: string | null; plano: string };
    to: { systemId: string; offerCode: string | null; plano: string };
  }>;
  skipped: Array<{ id: number; email: string; offerCode: string | null; plano: string; systemId: string }>;
};

export async function repairLicensesByOfferCode(
  prisma: PrismaClient,
  options: { dryRun?: boolean } = {}
): Promise<RepairLicensesResult> {
  const dryRun = options.dryRun === true;

  const licenses = await prisma.license.findMany({
    select: {
      id: true,
      email: true,
      plano: true,
      systemId: true,
      offerCode: true,
    },
    orderBy: { id: 'asc' },
  });

  const products = await prisma.product.findMany({
    select: { id: true, productName: true, systemId: true, offerCode: true, plano: true },
    orderBy: { id: 'asc' },
  });

  const result: RepairLicensesResult = {
    dryRun,
    totalLicenses: licenses.length,
    updated: 0,
    unchanged: 0,
    skippedNoProduct: 0,
    bySource: { offerCode: 0, plano: 0 },
    preview: [],
    skipped: [],
  };

  const updates: RepairLicensesResult['preview'] = [];

  for (const lic of licenses) {
    const curOffer = String(lic.offerCode || '').trim() || null;
    const curPlano = String(lic.plano || '').trim();
    const curSystem = String(lic.systemId || '').trim();

    let product = curOffer ? findProductByOfferCodeInList(products, curOffer) : null;
    let source: 'offerCode' | 'plano' = 'offerCode';

    if (!product && curPlano) {
      product = findProductByPlano(products, curPlano);
      source = 'plano';
    }

    if (!product) {
      result.skippedNoProduct += 1;
      if (result.skipped.length < 30) {
        result.skipped.push({
          id: lic.id,
          email: lic.email,
          offerCode: curOffer,
          plano: curPlano,
          systemId: curSystem,
        });
      }
      continue;
    }

    const nextSystemId = firstCsv(product.systemId);
    const nextPlano = String(product.plano || '').trim() || 'mensal';
    const nextOffer = curOffer || firstCsv(product.offerCode) || null;

    if (!nextSystemId) {
      result.skippedNoProduct += 1;
      continue;
    }

    const same =
      curSystem === nextSystemId &&
      norm(curPlano) === norm(nextPlano) &&
      (curOffer === nextOffer || (!curOffer && !nextOffer));

    if (same) {
      result.unchanged += 1;
      continue;
    }

    result.bySource[source] += 1;
    const row = {
      id: lic.id,
      email: lic.email,
      productName: product.productName,
      from: { systemId: curSystem, offerCode: curOffer, plano: curPlano },
      to: { systemId: nextSystemId, offerCode: nextOffer, plano: nextPlano },
    };
    updates.push(row);
    if (result.preview.length < 40) result.preview.push(row);
  }

  result.updated = updates.length;

  if (!dryRun) {
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
  }

  return result;
}
