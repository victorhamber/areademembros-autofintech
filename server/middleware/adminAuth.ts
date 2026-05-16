import type { Request, Response, NextFunction } from 'express';
import { verifyAdminBearer } from '../auth/jwt.js';
import { normalizeIncomingAdminPassword, resolveAdminPassword } from '../lib/adminPassword.js';

/** Aceita `Authorization: Bearer <jwt admin>` (preferido) ou header legado `x-admin-password`. */
export function adminAuthMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (verifyAdminBearer(req.headers.authorization)) {
    next();
    return;
  }
  const expected = resolveAdminPassword();
  const provided = normalizeIncomingAdminPassword(req.headers['x-admin-password']);
  if (expected && provided === expected) {
    next();
    return;
  }
  res.status(401).json({ error: 'Unauthorized Access. Invalid Master Password.' });
}
