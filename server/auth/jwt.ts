import jwt from 'jsonwebtoken';

import { resolveAdminPassword } from '../lib/adminPassword.js';

const ADMIN_PANEL_CLAIM = 'ebookpro_admin_panel';

function getJwtSecret(): string {
  return (
    process.env.JWT_SECRET?.trim() ||
    resolveAdminPassword() ||
    'dev-only-change-JWT_SECRET'
  );
}

export function signUserToken(userId: string, email: string): string {
  return jwt.sign({ sub: userId, email }, getJwtSecret(), { expiresIn: '7d' });
}

export function verifyUserToken(token: string): { userId: string; email: string } | null {
  try {
    const p = jwt.verify(token, getJwtSecret()) as { sub?: string; email?: string; ebookpro_admin_panel?: boolean };
    if (p.ebookpro_admin_panel === true) return null;
    if (!p.sub || !p.email) return null;
    return { userId: p.sub, email: p.email };
  } catch {
    return null;
  }
}

/** JWT curto só para o painel /admin (não misturar com login de aluno). */
export function signAdminJwt(): string {
  return jwt.sign({ [ADMIN_PANEL_CLAIM]: true }, getJwtSecret(), { expiresIn: '8h' });
}

export function verifyAdminBearer(authorization: string | undefined): boolean {
  if (!authorization?.startsWith('Bearer ')) return false;
  const tok = authorization.slice(7).trim();
  try {
    const p = jwt.verify(tok, getJwtSecret()) as Record<string, unknown>;
    return p[ADMIN_PANEL_CLAIM] === true;
  } catch {
    return false;
  }
}
