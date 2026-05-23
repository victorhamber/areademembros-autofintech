import fs from 'fs';
import path from 'path';

const DEFAULT_CANDIDATES = ['/data/uploads', '/app/uploads'];

/**
 * Resolve pasta gravável para uploads (volume Docker / EasyPanel).
 * Ordem: UPLOAD_DIR → /data/uploads → /app/uploads → ./uploads
 */
export function resolveUploadDirectory(fallbackRelativeToDirname: string): string {
  const fromEnv = process.env.UPLOAD_DIR?.trim();
  const candidates = [
    ...(fromEnv ? [fromEnv] : []),
    ...DEFAULT_CANDIDATES,
    fallbackRelativeToDirname,
  ];

  const tried: string[] = [];
  for (const raw of candidates) {
    const dir = path.resolve(raw);
    if (tried.includes(dir)) continue;
    tried.push(dir);
    try {
      fs.mkdirSync(dir, { recursive: true });
      fs.accessSync(dir, fs.constants.W_OK);
      return dir;
    } catch {
      // tenta próximo candidato
    }
  }

  throw new Error(
    `Nenhuma pasta de upload gravável. Defina UPLOAD_DIR (ex.: /data/uploads) com volume montado. Tentativas: ${tried.join(', ')}`
  );
}

export function assertUploadDirectoryWritable(uploadDir: string): { ok: true } | { ok: false; error: string } {
  try {
    fs.accessSync(uploadDir, fs.constants.W_OK);
    const probe = path.join(uploadDir, `.write-probe-${process.pid}`);
    fs.writeFileSync(probe, 'ok');
    fs.unlinkSync(probe);
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}
