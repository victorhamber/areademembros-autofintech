/** Rate limit simples em memória (60 req/min por chave), paridade wp_cache do plugin. */
const buckets = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(key: string, max = 60, windowMs = 60_000): boolean {
  const now = Date.now();
  let b = buckets.get(key);
  if (!b || now > b.resetAt) {
    b = { count: 0, resetAt: now + windowMs };
    buckets.set(key, b);
  }
  if (b.count >= max) return false;
  b.count += 1;
  return true;
}
