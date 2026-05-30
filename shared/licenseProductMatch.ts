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

/** Plano da licença → tipo de produto (fallback legado, sem offerCode). */
export function classifyLicensePlan(plano: string | null | undefined): PlanKind {
  const p = norm(plano);
  if (!p) return 'outro';
  if (p.includes('vital')) return 'vitalicio';
  if (p.includes('anual')) return 'anual';
  if (p.includes('teste') || p.includes('desafio')) return 'desafio';
  return 'outro';
}

/** Resolve produto pelo código da oferta Hotmart (match exato na lista CSV, sem contains). */
export function findProductByOfferCodeInList<T extends ProductLite>(
  products: T[],
  offerCode: string | null | undefined
): T | null {
  const code = String(offerCode || '').trim();
  if (!code) return null;

  const matches = products.filter((p) => csvIncludes(String(p.offerCode || ''), code));
  if (matches.length === 0) return null;
  if (matches.length === 1) return matches[0];

  const exactField = matches.find((p) => String(p.offerCode || '').trim() === code);
  if (exactField) return exactField as T;

  const narrowed = narrowCandidates(matches, { offerCode: code });
  return narrowed.length === 1 ? (narrowed[0] as T) : null;
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
  const offer = String(lic.offerCode || '').trim();

  // 1) Código da oferta Hotmart é a fonte da verdade para produto + plano
  if (offer) {
    const byOffer = products.filter((p) => csvIncludes(String(p.offerCode || ''), offer));
    if (byOffer.length === 1) return byOffer;
    if (byOffer.length > 1) {
      const narrowed = narrowCandidates(byOffer, lic);
      return narrowed.length === 1 ? narrowed : [];
    }
  }

  // 2) systemId + offer/plano (legado)
  const sid = String(lic.systemId || '').trim();
  if (sid) {
    const candidates = productsBySystem(products, sid);
    if (candidates.length) {
      if (offer) {
        const byOffer = candidates.filter((p) => csvIncludes(String(p.offerCode || ''), offer));
        if (byOffer.length === 1) return byOffer;
      }

      const plan = norm(lic.plano);
      if (plan) {
        const byPlan = candidates.filter((p) => norm(p.plano) === plan);
        if (byPlan.length === 1) return byPlan;
      }

      if (candidates.length === 1) return candidates;
    }
  }

  // 3) Sem offerCode: inferir pelo plano (legado)
  if (!offer) {
    const kind = classifyLicensePlan(lic.plano);
    if (kind !== 'outro') {
      const byKind = products.filter((p) => productMatchesKind(p, kind));
      if (byKind.length) {
        const narrowed = narrowCandidates(byKind, lic);
        return narrowed.length === 1 ? narrowed : [];
      }
    }
  }

  return [];
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
