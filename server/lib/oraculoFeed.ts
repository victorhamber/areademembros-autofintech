import { getWebhookBaseUrl } from './appUrls.js';

const IMAGE_EXT = /\.(png|jpe?g|gif|webp)(\?|#|$)/i;
const VIDEO_EXT = /\.(mp4|webm)(\?|#|$)/i;
const PUBLIC_MEDIA = /\/api\/public\/media\/[^/]+\/(file|download)(\?|#|$)/i;
const MAX_PUBLIC_ITEMS = 30;
const MAX_PUBLIC_BYTES = 100_000;

export function toIsoZ(value: Date): string {
  return value.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

export function slugify(raw: string, fallback: string): string {
  const base = String(raw || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return base || fallback;
}

export function absolutizeHttps(raw: string, base = getWebhookBaseUrl()): string {
  const value = String(raw || '').trim();
  if (!value) return '';
  if (value.startsWith('https://')) return value;
  if (value.startsWith('http://')) return '';
  if (value.startsWith('/')) return `${base}${value}`;
  return '';
}

export function isHttpsImage(url: string): boolean {
  return url.startsWith('https://') && (IMAGE_EXT.test(url) || PUBLIC_MEDIA.test(url));
}

export function isHttpsMedia(url: string): boolean {
  return url.startsWith('https://') && (IMAGE_EXT.test(url) || VIDEO_EXT.test(url) || PUBLIC_MEDIA.test(url));
}

export function isHttpsPage(url: string): boolean {
  return url.startsWith('https://');
}

export function parseWhen(raw: unknown, fallback: Date): Date {
  const text = String(raw || '').trim();
  if (!text) return fallback;
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return fallback;
  return parsed;
}

type NotificationRow = {
  slug: string;
  title: string;
  body: string;
  url: string;
  mediaUrl: string;
  popup: boolean;
  silent: boolean;
  kind: string;
  startsAt: Date;
  expiresAt: Date;
  enabled: boolean;
};

type AdRow = {
  slug: string;
  imageUrl: string;
  imageUrlDesktop?: string;
  url: string;
  startsAt: Date;
  expiresAt: Date;
  enabled: boolean;
};

export function publicNotification(row: NotificationRow, base = getWebhookBaseUrl()) {
  const media = absolutizeHttps(row.mediaUrl, base);
  const link = absolutizeHttps(row.url, base);
  return {
    id: row.slug,
    title: String(row.title || '').slice(0, 150),
    body: String(row.body || '').slice(0, 2000),
    starts_at: toIsoZ(row.startsAt),
    expires_at: toIsoZ(row.expiresAt),
    url: isHttpsPage(link) ? link : '',
    media_url: isHttpsMedia(media) ? media : '',
    popup: Boolean(row.popup),
    silent: Boolean(row.silent),
    kind: String(row.kind || 'marketing').slice(0, 32) || 'marketing',
  };
}

export function publicAd(row: AdRow, base = getWebhookBaseUrl()) {
  const image = absolutizeHttps(row.imageUrl, base);
  const desktop = absolutizeHttps(row.imageUrlDesktop || '', base);
  const link = absolutizeHttps(row.url, base);
  return {
    id: row.slug,
    image_url: isHttpsImage(image) ? image : '',
    image_url_desktop: isHttpsImage(desktop) ? desktop : '',
    url: isHttpsPage(link) ? link : '',
    starts_at: toIsoZ(row.startsAt),
    expires_at: toIsoZ(row.expiresAt),
  };
}

export function capPublicJson<T>(key: string, items: T[]): { payload: Record<string, T[]>; bytes: number } {
  const kept = items.slice(0, MAX_PUBLIC_ITEMS);
  while (kept.length) {
    const payload = { [key]: kept } as Record<string, T[]>;
    const bytes = Buffer.byteLength(JSON.stringify(payload), 'utf8');
    if (bytes <= MAX_PUBLIC_BYTES) return { payload, bytes };
    kept.pop();
  }
  return { payload: { [key]: [] }, bytes: Buffer.byteLength(`{"${key}":[]}`, 'utf8') };
}
