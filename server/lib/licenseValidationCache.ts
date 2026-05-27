type Cached = { body: object; status: number; expires: number };
const store = new Map<string, Cached>();

const SUCCESS_TTL_MS = 15_000;
const ERROR_TTL_MS = 60_000;

export function cacheGet(key: string): Cached | null {
  const c = store.get(key);
  if (!c || Date.now() > c.expires) {
    store.delete(key);
    return null;
  }
  return c;
}

export function cacheSet(key: string, status: number, body: object, ttlMs?: number) {
  const ttl =
    ttlMs ??
    (status === 200 ? SUCCESS_TTL_MS : ERROR_TTL_MS);
  store.set(key, { status, body, expires: Date.now() + ttl });
}

/** Limpa cache de validação do e-mail (troca de conta, expiração, desativação). */
export function invalidateLicenseCacheForEmail(email: string): void {
  const norm = email.trim().toLowerCase();
  if (!norm) return;
  const prefix = `license_validation_${norm}_`;
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}
