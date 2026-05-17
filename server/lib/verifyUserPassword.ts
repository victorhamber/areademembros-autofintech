import { createHash, createHmac } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { CheckPassword } = require('wordpress-hash-node') as {
  CheckPassword: (plain: string, hash: string) => boolean;
};

/** Pré-hash WordPress 6.8+ (HMAC-SHA384 + base64). */
function wpPrehashPassword(password: string, trim: boolean): string {
  const p = trim ? password.trim() : password;
  return createHmac('sha384', 'wp-sha384').update(p).digest('base64');
}

function verifyBcrypt(plain: string, hash: string): boolean {
  const normalized = hash.startsWith('$2y$') ? hash.replace(/^\$2y\$/, '$2a$') : hash;
  try {
    return bcrypt.compareSync(plain, normalized);
  } catch {
    return false;
  }
}

/** Senha em texto puro (legado), phpass ($P$), bcrypt ($2y$) ou WordPress 6.8+ ($wp$2y$). */
export function verifyUserPassword(plain: string, stored: string | null | undefined): boolean {
  if (!stored || plain === '') return false;
  const hash = String(stored);

  if (hash === plain) return true;

  // WordPress 6.8+: $wp + bcrypt( base64( hmac-sha384( senha ) ) )
  if (hash.startsWith('$wp')) {
    const bcryptPart = hash.slice(3);
    if (!bcryptPart.startsWith('$2')) return false;
    for (const trim of [false, true]) {
      const prehashed = wpPrehashPassword(plain, trim);
      if (verifyBcrypt(prehashed, bcryptPart)) return true;
    }
    return false;
  }

  if (hash.startsWith('$P$') || hash.startsWith('$H$')) {
    try {
      return Boolean(CheckPassword(plain, hash));
    } catch {
      return false;
    }
  }

  if (hash.length === 32 && /^[a-f0-9]{32}$/i.test(hash)) {
    return createHash('md5').update(plain).digest('hex') === hash.toLowerCase();
  }

  if (hash.startsWith('$2a$') || hash.startsWith('$2b$') || hash.startsWith('$2y$')) {
    return verifyBcrypt(plain, hash);
  }

  return false;
}

export function hashMemberPassword(plain: string): string {
  return bcrypt.hashSync(plain, 10);
}
