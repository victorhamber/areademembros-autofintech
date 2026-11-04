import express from 'express';
import type { PrismaClient } from '@prisma/client';
import { formatPrismaError } from '../lib/prismaErrors.js';
import {
  isHttpsImage,
  isHttpsMedia,
  isHttpsPage,
  parseWhen,
  slugify,
  absolutizeHttps,
} from '../lib/oraculoFeed.js';

type AdminAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => void;

function uniqueSlug(base: string): string {
  const stamp = Date.now().toString(36).slice(-4);
  return `${slugify(base, 'aviso')}-${stamp}`.slice(0, 64);
}

function requireWindow(startsAt: Date, expiresAt: Date): string | null {
  if (!(startsAt instanceof Date) || Number.isNaN(startsAt.getTime())) return 'Informe o início.';
  if (!(expiresAt instanceof Date) || Number.isNaN(expiresAt.getTime())) return 'Informe o fim.';
  if (expiresAt.getTime() <= startsAt.getTime()) return 'O fim precisa ser depois do início.';
  return null;
}

export function registerAdminOraculoRoutes(
  app: express.Application,
  prisma: PrismaClient,
  adminAuth: AdminAuth
) {
  app.get('/api/admin/oraculo/notifications', adminAuth, async (_req, res) => {
    const rows = await prisma.oraculoNotification.findMany({
      orderBy: [{ startsAt: 'desc' }, { createdAt: 'desc' }],
    });
    res.json(rows);
  });

  app.post('/api/admin/oraculo/notifications', adminAuth, async (req, res) => {
    try {
      const body = (req.body || {}) as Record<string, unknown>;
      const title = String(body.title || '').trim().slice(0, 150);
      const text = String(body.body || '').trim().slice(0, 2000);
      if (!title) return res.status(400).json({ error: 'Informe o título.' });
      if (!text) return res.status(400).json({ error: 'Informe o texto.' });
      const now = new Date();
      const startsAt = parseWhen(body.startsAt ?? body.starts_at, now);
      const expiresAt = parseWhen(body.expiresAt ?? body.expires_at, new Date(now.getTime() + 14 * 86400000));
      const windowError = requireWindow(startsAt, expiresAt);
      if (windowError) return res.status(400).json({ error: windowError });
      const mediaUrl = String(body.mediaUrl ?? body.media_url ?? '').trim();
      const url = String(body.url || '').trim();
      if (mediaUrl && !isHttpsMedia(absolutizeHttps(mediaUrl))) {
        return res.status(400).json({ error: 'Mídia precisa ser HTTPS (png, jpg, gif, webp, mp4 ou webm).' });
      }
      if (url && !isHttpsPage(absolutizeHttps(url))) {
        return res.status(400).json({ error: 'O link precisa ser HTTPS.' });
      }
      const slug = uniqueSlug(String(body.slug || title));
      const row = await prisma.oraculoNotification.create({
        data: {
          slug,
          title,
          body: text,
          url,
          mediaUrl,
          popup: body.popup !== false,
          silent: Boolean(body.silent),
          kind: String(body.kind || 'marketing').slice(0, 32) || 'marketing',
          startsAt,
          expiresAt,
          enabled: body.enabled !== false,
        },
      });
      res.json(row);
    } catch (err) {
      res.status(400).json({ error: formatPrismaError(err) || 'Não foi possível salvar a mensagem.' });
    }
  });

  app.put('/api/admin/oraculo/notifications/:id', adminAuth, async (req, res) => {
    try {
      const body = (req.body || {}) as Record<string, unknown>;
      const current = await prisma.oraculoNotification.findUnique({ where: { id: String(req.params.id) } });
      if (!current) return res.status(404).json({ error: 'Mensagem não encontrada.' });
      const title = String(body.title ?? current.title).trim().slice(0, 150);
      const text = String(body.body ?? current.body).trim().slice(0, 2000);
      if (!title || !text) return res.status(400).json({ error: 'Título e texto são obrigatórios.' });
      const startsAt = parseWhen(body.startsAt ?? body.starts_at, current.startsAt);
      const expiresAt = parseWhen(body.expiresAt ?? body.expires_at, current.expiresAt);
      const windowError = requireWindow(startsAt, expiresAt);
      if (windowError) return res.status(400).json({ error: windowError });
      const mediaUrl = String(body.mediaUrl ?? body.media_url ?? current.mediaUrl).trim();
      const url = String(body.url ?? current.url).trim();
      if (mediaUrl && !isHttpsMedia(absolutizeHttps(mediaUrl))) {
        return res.status(400).json({ error: 'Mídia precisa ser HTTPS (png, jpg, gif, webp, mp4 ou webm).' });
      }
      if (url && !isHttpsPage(absolutizeHttps(url))) {
        return res.status(400).json({ error: 'O link precisa ser HTTPS.' });
      }
      let slug = current.slug;
      if (typeof body.slug === 'string' && body.slug.trim() && body.slug.trim() !== current.slug) {
        slug = slugify(body.slug, current.slug);
      }
      const row = await prisma.oraculoNotification.update({
        where: { id: current.id },
        data: {
          slug,
          title,
          body: text,
          url,
          mediaUrl,
          popup: body.popup == null ? current.popup : Boolean(body.popup),
          silent: body.silent == null ? current.silent : Boolean(body.silent),
          kind: String(body.kind ?? current.kind).slice(0, 32) || 'marketing',
          startsAt,
          expiresAt,
          enabled: body.enabled == null ? current.enabled : Boolean(body.enabled),
        },
      });
      res.json(row);
    } catch (err) {
      res.status(400).json({ error: formatPrismaError(err) || 'Não foi possível atualizar a mensagem.' });
    }
  });

  app.delete('/api/admin/oraculo/notifications/:id', adminAuth, async (req, res) => {
    try {
      await prisma.oraculoNotification.delete({ where: { id: String(req.params.id) } });
      res.json({ success: true });
    } catch {
      res.status(404).json({ error: 'Mensagem não encontrada.' });
    }
  });

  app.get('/api/admin/oraculo/ads', adminAuth, async (_req, res) => {
    const rows = await prisma.oraculoAd.findMany({
      orderBy: [{ sortOrder: 'asc' }, { startsAt: 'desc' }],
    });
    res.json(rows);
  });

  app.post('/api/admin/oraculo/ads', adminAuth, async (req, res) => {
    try {
      const body = (req.body || {}) as Record<string, unknown>;
      const imageUrl = String(body.imageUrl ?? body.image_url ?? '').trim();
      const url = String(body.url || '').trim();
      if (!isHttpsImage(absolutizeHttps(imageUrl))) {
        return res.status(400).json({ error: 'A peça precisa de uma imagem HTTPS (png, jpg, gif ou webp).' });
      }
      if (!isHttpsPage(absolutizeHttps(url))) {
        return res.status(400).json({ error: 'O clique precisa abrir um link HTTPS.' });
      }
      const now = new Date();
      const startsAt = parseWhen(body.startsAt ?? body.starts_at, now);
      const expiresAt = parseWhen(body.expiresAt ?? body.expires_at, new Date(now.getTime() + 14 * 86400000));
      const windowError = requireWindow(startsAt, expiresAt);
      if (windowError) return res.status(400).json({ error: windowError });
      const label = String(body.label || '').trim().slice(0, 80);
      const slug = uniqueSlug(String(body.slug || label || 'peca'));
      const sortOrder = Number(body.sortOrder ?? 0) || 0;
      const row = await prisma.oraculoAd.create({
        data: {
          slug,
          label,
          imageUrl,
          url,
          startsAt,
          expiresAt,
          enabled: body.enabled !== false,
          sortOrder,
        },
      });
      res.json(row);
    } catch (err) {
      res.status(400).json({ error: formatPrismaError(err) || 'Não foi possível salvar a peça.' });
    }
  });

  app.put('/api/admin/oraculo/ads/:id', adminAuth, async (req, res) => {
    try {
      const body = (req.body || {}) as Record<string, unknown>;
      const current = await prisma.oraculoAd.findUnique({ where: { id: String(req.params.id) } });
      if (!current) return res.status(404).json({ error: 'Peça não encontrada.' });
      const imageUrl = String(body.imageUrl ?? body.image_url ?? current.imageUrl).trim();
      const url = String(body.url ?? current.url).trim();
      if (!isHttpsImage(absolutizeHttps(imageUrl))) {
        return res.status(400).json({ error: 'A peça precisa de uma imagem HTTPS (png, jpg, gif ou webp).' });
      }
      if (!isHttpsPage(absolutizeHttps(url))) {
        return res.status(400).json({ error: 'O clique precisa abrir um link HTTPS.' });
      }
      const startsAt = parseWhen(body.startsAt ?? body.starts_at, current.startsAt);
      const expiresAt = parseWhen(body.expiresAt ?? body.expires_at, current.expiresAt);
      const windowError = requireWindow(startsAt, expiresAt);
      if (windowError) return res.status(400).json({ error: windowError });
      let slug = current.slug;
      if (typeof body.slug === 'string' && body.slug.trim() && body.slug.trim() !== current.slug) {
        slug = slugify(body.slug, current.slug);
      }
      const row = await prisma.oraculoAd.update({
        where: { id: current.id },
        data: {
          slug,
          label: String(body.label ?? current.label).trim().slice(0, 80),
          imageUrl,
          url,
          startsAt,
          expiresAt,
          enabled: body.enabled == null ? current.enabled : Boolean(body.enabled),
          sortOrder: body.sortOrder == null ? current.sortOrder : Number(body.sortOrder) || 0,
        },
      });
      res.json(row);
    } catch (err) {
      res.status(400).json({ error: formatPrismaError(err) || 'Não foi possível atualizar a peça.' });
    }
  });

  app.delete('/api/admin/oraculo/ads/:id', adminAuth, async (req, res) => {
    try {
      await prisma.oraculoAd.delete({ where: { id: String(req.params.id) } });
      res.json({ success: true });
    } catch {
      res.status(404).json({ error: 'Peça não encontrada.' });
    }
  });
}
