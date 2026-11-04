import express from 'express';
import type { PrismaClient } from '@prisma/client';
import { checkRateLimit } from '../lib/rateLimitMem.js';
import { capPublicJson, publicAd, publicNotification } from '../lib/oraculoFeed.js';
import { log } from '../lib/logger.js';

function clientIp(req: express.Request): string {
  return String(req.ip || req.socket?.remoteAddress || 'unknown').slice(0, 45);
}

export function registerOraculoPublicRoutes(app: express.Application, prisma: PrismaClient) {
  const serve = async (
    req: express.Request,
    res: express.Response,
    kind: 'notifications' | 'ads'
  ) => {
    const ip = clientIp(req);
    if (!checkRateLimit(`oraculo_${kind}_${ip}`, 60, 60_000)) {
      log('WARN', `oraculo ${kind} rate limit: ip=${ip}`);
      return res.status(429).json({ status: 'error', message: 'Rate limit exceeded. Try again later.' });
    }
    const now = new Date();
    try {
      if (kind === 'notifications') {
        const rows = await prisma.oraculoNotification.findMany({
          where: { enabled: true, expiresAt: { gt: now } },
          orderBy: [{ startsAt: 'desc' }, { createdAt: 'desc' }],
          take: 40,
        });
        const { payload } = capPublicJson(
          'messages',
          rows.map((row) => publicNotification(row))
        );
        res.setHeader('Cache-Control', 'public, max-age=30');
        return res.json(payload);
      }
      const rows = await prisma.oraculoAd.findMany({
        where: { enabled: true, expiresAt: { gt: now } },
        orderBy: [{ sortOrder: 'asc' }, { startsAt: 'desc' }],
        take: 40,
      });
      const { payload } = capPublicJson(
        'ads',
        rows.map((row) => publicAd(row)).filter((row) => row.image_url && row.url)
      );
      res.setHeader('Cache-Control', 'public, max-age=30');
      return res.json(payload);
    } catch (err) {
      log('ERROR', `oraculo ${kind}`, { err: String(err) });
      return res.status(500).json({ status: 'error', message: 'Falha ao montar o feed.' });
    }
  };

  app.get('/api/oraculo/v1/notifications', (req, res) => void serve(req, res, 'notifications'));
  app.get('/api/oraculo/v1/ads', (req, res) => void serve(req, res, 'ads'));
}
