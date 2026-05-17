import { csvIncludes, parseCsv } from './csv.js';

export type PlanKind = 'anual' | 'vitalicio' | 'desafio' | 'outro';

export type LicenseLite = {
  systemId?: string | null;
  offerCode?: string | null;
  plano?: string | null;
};

export type ProductLite = {
  id: number;
  systemId?: string | null;
  offerCode?: string | null;
  plano?: string | null;
  productName?: string | null;
};

function norm(v: unknown): string {
  return String(v || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/** Plano da licença → tipo de produto (autoridade principal). */
export function classifyLicensePlan(plano: string | null | undefined): PlanKind {
  const p = norm(plano);
  if (!p) return 'outro';
  if (p.includes('vital')) return 'vitalicio';
  if (p.includes('anual') || p.includes('mensal') || p.includes('semestral')) return 'anual';
  if (p.includes('teste') || p.includes('desafio')) return 'desafio';
  return 'outro';
}

function productMatchesKind(product: ProductLite, kind: PlanKind): boolean {
  if (kind === 'outro') return false;
  const name = norm(product.productName);
  const plan = norm(product.plano);
  if (kind === 'anual') return name.includes('anual') || plan.includes('anual');
  if (kind === 'vitalicio') return name.includes('vitalicio') || plan.includes('vitalicio');
  if (kind === 'desafio') {
    return (
      name.includes('desafio') ||
      name.includes('teste') ||
      plan.includes('desafio') ||
      plan.includes('teste')
    );
  }
  return false;
}

function narrowCandidates(candidates: ProductLite[], lic: LicenseLite): ProductLite[] {
  if (candidates.length <= 1) return candidates;

  const sid = String(lic.systemId || '').trim();
  if (sid) {
    const bySid = candidates.filter((p) => csvIncludes(String(p.systemId || ''), sid));
    if (bySid.length === 1) return bySid;
    if (bySid.length > 1) candidates = bySid;
  }

  const offer = String(lic.offerCode || '').trim();
  if (offer) {
    const byOffer = candidates.filter((p) => csvIncludes(String(p.offerCode || ''), offer));
    if (byOffer.length) return byOffer;
  }

  const plan = norm(lic.plano);
  if (plan) {
    const byPlanField = candidates.filter((p) => norm(p.plano) === plan);
    if (byPlanField.length) return byPlanField;
  }

  return candidates;
}

function productsBySystem(products: ProductLite[], systemId: string): ProductLite[] {
  if (!systemId) return [];
  return products.filter((p) => csvIncludes(String(p.systemId || ''), systemId));
}

export function pickProductsForLicense(products: ProductLite[], lic: LicenseLite): ProductLite[] {
  const kind = classifyLicensePlan(lic.plano);

  // 1) Plano da licença define o produto (ex.: teste → Desafio, mesmo com systemId do Anual)
  if (kind !== 'outro') {
    const byKind = products.filter((p) => productMatchesKind(p, kind));
    if (byKind.length) return narrowCandidates(byKind, lic);
  }

  // 2) Fallback: systemId + offer (legado)
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

  return candidates.length === 1 ? candidates : [];
}

export function resolveOwnedProductIds(
  licenses: LicenseLite[],
  products: ProductLite[]
): Set<number> {
  const owned = new Set<number>();
  for (const lic of licenses) {
    for (const p of pickProductsForLicense(products, lic)) owned.add(p.id);
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
