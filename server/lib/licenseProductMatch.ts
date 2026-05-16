import { csvIncludes, parseCsv } from './csv.js';

type LicenseLite = {
  systemId?: string | null;
  offerCode?: string | null;
  plano?: string | null;
};

type ProductLite = {
  id: number;
  systemId?: string | null;
  offerCode?: string | null;
  plano?: string | null;
};

function norm(v: unknown): string {
  return String(v || '').trim().toLowerCase();
}

function productsBySystem(products: ProductLite[], systemId: string): ProductLite[] {
  if (!systemId) return [];
  return products.filter((p) => csvIncludes(String(p.systemId || ''), systemId));
}

function pickProductsForLicense(products: ProductLite[], lic: LicenseLite): ProductLite[] {
  const sid = String(lic.systemId || '').trim();
  if (!sid) return [];
  const candidates = productsBySystem(products, sid);
  if (!candidates.length) return [];

  const offer = String(lic.offerCode || '').trim();
  if (offer) {
    const byOffer = candidates.filter((p) => csvIncludes(String(p.offerCode || ''), offer));
    if (byOffer.length) return byOffer;
  }

  const plan = norm(lic.plano);
  if (plan) {
    const byPlan = candidates.filter((p) => norm(p.plano) === plan);
    if (byPlan.length) return byPlan;
  }

  // Compatibilidade: só cai para systemId puro quando não há ambiguidade.
  return candidates.length === 1 ? candidates : [];
}

export function resolveOwnedProductIds(
  licenses: LicenseLite[],
  products: ProductLite[]
): Set<number> {
  const owned = new Set<number>();
  for (const lic of licenses) {
    const matched = pickProductsForLicense(products, lic);
    for (const p of matched) owned.add(p.id);
  }
  return owned;
}

export function resolveProductForLicense<T extends ProductLite>(
  products: T[],
  lic: LicenseLite
): T | null {
  const matched = pickProductsForLicense(products, lic);
  if (!matched.length) return null;
  return matched[0] as T;
}

export function resolveOwnedSystemIds(licenses: LicenseLite[]): string[] {
  return [...new Set(licenses.map((l) => String(l.systemId || '').trim()).filter(Boolean))];
}

export function hasOfferCode(raw: string | null | undefined): boolean {
  return parseCsv(raw).length > 0;
}
