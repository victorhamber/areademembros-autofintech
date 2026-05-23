import path from 'path';

/** Extensões aceitas na biblioteca de mídia → MIME para armazenamento e resposta HTTP. */
export const UPLOAD_EXTENSION_MIME: Record<string, string> = {
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.avif': 'image/avif',
  '.bmp': 'image/bmp',
  '.ico': 'image/x-icon',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.pdf': 'application/pdf',
  '.zip': 'application/zip',
};

const IMAGE_EXTENSIONS = new Set(
  Object.entries(UPLOAD_EXTENSION_MIME)
    .filter(([, mime]) => mime.startsWith('image/'))
    .map(([ext]) => ext)
);

export function mimeFromFilename(filename: string): string | null {
  const ext = path.extname(String(filename || '')).toLowerCase();
  return UPLOAD_EXTENSION_MIME[ext] ?? null;
}

/** Normaliza MIME do multer (inclui .webp quando o SO envia octet-stream). */
export function resolveUploadMime(
  mimetype: string | undefined,
  originalname: string
): string {
  const reported = String(mimetype || '').toLowerCase().trim();
  const fromExt = mimeFromFilename(originalname);

  if (fromExt) {
    if (!reported || reported === 'application/octet-stream') return fromExt;
    if (reported === 'image/webp' || reported === fromExt) return reported;
    // Navegador reportou outro tipo — prioriza extensão para .webp/.avif etc.
    if (IMAGE_EXTENSIONS.has(path.extname(originalname).toLowerCase())) return fromExt;
  }

  if (reported && reported !== 'application/octet-stream') return reported;
  return fromExt || reported || 'application/octet-stream';
}

export function detectMediaKind(
  mimetype: string | undefined,
  originalname: string
): 'imagem' | 'video' | 'audio' | 'arquivo' {
  const mime = resolveUploadMime(mimetype, originalname);
  if (mime.startsWith('image/')) return 'imagem';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  return 'arquivo';
}

/** Nome seguro no disco preservando extensão (.webp, etc.). */
export function safeUploadFilename(originalname: string): string {
  const ext = path.extname(String(originalname || '')).toLowerCase();
  const base = path.basename(String(originalname || 'arquivo'), ext)
    .replace(/[^a-zA-Z0-9.\-_]/g, '')
    .slice(0, 100);
  const safeBase = base || 'arquivo';
  if (ext && UPLOAD_EXTENSION_MIME[ext]) return `${safeBase}${ext}`;
  if (ext && /^\.[a-z0-9]{1,8}$/i.test(ext)) return `${safeBase}${ext}`;
  return safeBase;
}

export function resolveStoredMediaMime(mimeType: string | null | undefined, storedName: string): string {
  const stored = String(mimeType || '').trim();
  if (stored && stored !== 'application/octet-stream') return stored;
  return mimeFromFilename(storedName) || stored || 'application/octet-stream';
}
