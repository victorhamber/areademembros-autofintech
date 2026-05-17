/**
 * Teste rápido: node scripts/test-wp-password-verify.mjs "senha" '$wp$2y$...'
 */
import { createHmac } from 'node:crypto';
import bcrypt from 'bcryptjs';

const plain = process.argv[2] || '';
const hash = process.argv[3] || '';

function verify(plainText, stored) {
  if (stored.startsWith('$wp')) {
    const bcryptPart = stored.slice(3);
    for (const trim of [false, true]) {
      const p = trim ? plainText.trim() : plainText;
      const pre = createHmac('sha384', 'wp-sha384').update(p).digest('base64');
      const norm = bcryptPart.startsWith('$2y$') ? bcryptPart.replace(/^\$2y\$/, '$2a$') : bcryptPart;
      if (bcrypt.compareSync(pre, norm)) return { ok: true, trim };
    }
    return { ok: false };
  }
  return { ok: false, reason: 'not $wp hash' };
}

console.log(verify(plain, hash));
