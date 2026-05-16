/**
 * Utilitários para campos CSV (valores separados por vírgula) usados em
 * Product.systemId e Product.offerCode.
 */

export function parseCsv(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return String(raw)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function normalizeCsv(raw: string | null | undefined): string {
  const values = parseCsv(raw);
  return Array.from(new Set(values)).join(', ');
}

export function csvIncludes(raw: string | null | undefined, target: string | null | undefined): boolean {
  const t = String(target || '').trim();
  if (!t) return false;
  return parseCsv(raw).includes(t);
}
