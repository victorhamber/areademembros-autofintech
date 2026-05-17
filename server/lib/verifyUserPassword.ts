import bcrypt from 'bcryptjs';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { CheckPassword } = require('wordpress-hash-node') as {
  CheckPassword: (plain: string, hash: string) => boolean;
};

/** Senha em texto puro (legado app) ou hash WordPress (phpass / bcrypt). */
export function verifyUserPassword(plain: string, stored: string | null | undefined): boolean {
  if (!stored || !plain) return false;
  if (stored === plain) return true;

  const hash = String(stored);
  if (hash.startsWith('$P$') || hash.startsWith('$wp$')) {
    try {
      return Boolean(CheckPassword(plain, hash));
    } catch {
      return false;
    }
  }

  if (hash.startsWith('$2y$') || hash.startsWith('$2a$') || hash.startsWith('$2b$')) {
    const normalized = hash.startsWith('$2y$') ? hash.replace(/^\$2y\$/, '$2a$') : hash;
    return bcrypt.compareSync(plain, normalized);
  }

  return false;
}
