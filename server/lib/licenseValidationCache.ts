type Cached = { body: object; status: number; expires: number };
const store = new Map<string, Cached>();

export function cacheGet(key: string): Cached | null {
  const c = store.get(key);
  if (!c || Date.now() > c.expires) {
    store.delete(key);
    return null;
  }
  return c;
}

export function cacheSet(key: string, status: number, body: object, ttlMs = 300_000) {
  store.set(key, { status, body, expires: Date.now() + ttlMs });
}
