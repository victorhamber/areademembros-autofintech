/** Mesma regra do PHP (RankingEndpoint / EA). */
export function emailToHash(email: string): string {
  const e = email.trim();
  const len = e.length;
  if (len >= 5) return e.slice(0, 2) + String(len) + e.slice(len - 2);
  return 'anon';
}
