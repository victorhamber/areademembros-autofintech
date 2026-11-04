export type FeedStatus = 'off' | 'soon' | 'live' | 'done';

export function toLocalInput(iso: string | Date): string {
  const date = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function defaultWindow(): { startsAt: string; expiresAt: string } {
  const start = new Date();
  const end = new Date(start.getTime() + 14 * 86400000);
  return { startsAt: toLocalInput(start), expiresAt: toLocalInput(end) };
}

export function fromLocalInput(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString();
}

export function feedStatus(startsAt: string, expiresAt: string, enabled: boolean): FeedStatus {
  if (!enabled) return 'off';
  const now = Date.now();
  const start = new Date(startsAt).getTime();
  const end = new Date(expiresAt).getTime();
  if (now < start) return 'soon';
  if (now >= end) return 'done';
  return 'live';
}

export const FEED_STATUS_LABEL: Record<FeedStatus, string> = {
  off: 'Desligada',
  soon: 'Agendada',
  live: 'No ar',
  done: 'Expirada',
};

export async function uploadPublicFile(
  file: File,
  headers: Record<string, string>
): Promise<string> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch('/api/admin/upload', { method: 'POST', headers, body: form });
  const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
  if (!res.ok) throw new Error(data.error || 'Falha no upload.');
  const url = String(data.url || '');
  if (url.startsWith('https://')) return url;
  if (url.startsWith('/')) return `${window.location.origin}${url}`;
  throw new Error('O servidor não devolveu a URL do arquivo.');
}

export async function copyText(value: string): Promise<void> {
  await navigator.clipboard.writeText(value);
}
