import express from 'express';
import type { PrismaClient } from '@prisma/client';
import { resolveUserId } from '../auth/resolveUser.js';
import { adminAuthMiddleware } from '../middleware/adminAuth.js';
import { normalizeCsv, parseCsv, csvIncludes } from '../lib/csv.js';
import { resolveOwnedProductIds } from '../lib/licenseProductMatch.js';

function sanitizeUrl(raw: unknown): string | null {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  return s.slice(0, 2048);
}

function normalizeProductIdsCsv(raw: unknown): string | null {
  if (raw == null) return null;
  const ids = String(raw)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => Number(s))
    .filter((n) => Number.isInteger(n) && n > 0);
  if (!ids.length) return null;
  return Array.from(new Set(ids)).join(',');
}

/** Resolve quais IDs de produto o usuário possui (systemId + offerCode/plano). */
async function resolveUserOwnedProductIds(prisma: PrismaClient, userId: string | null): Promise<Set<number>> {
  const owned = new Set<number>();
  if (!userId) return owned;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return owned;
  const now = new Date();
  const activeLicenses = await prisma.license.findMany({
    where: {
      email: user.email.toLowerCase(),
      statusLicenca: 'ativa',
      OR: [{ dataExpiracao: null }, { dataExpiracao: { gte: now } }],
    },
    select: { systemId: true, offerCode: true },
  });
  if (!activeLicenses.length) return owned;
  const allProducts = await prisma.product.findMany({
    select: { id: true, systemId: true, offerCode: true, plano: true },
  });
  return resolveOwnedProductIds(activeLicenses, allProducts);
}

function computeCourseAccess(
  course: { licenseSystemId: string | null; productIds: string | null },
  ownedProductIds: Set<number>,
  userSystemIds: string[],
  allProducts: Array<{ id: number; systemId: string }>
): { isPublic: boolean; hasAccess: boolean; requiredProductIds: number[]; requiredSystemIds: string[] } {
  const requiredProductIds = (course.productIds || '')
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n > 0);
  const requiredSystemIds = parseCsv(course.licenseSystemId);
  const isPublic = requiredProductIds.length === 0 && requiredSystemIds.length === 0;
  let hasAccess = isPublic;
  if (!isPublic) {
    if (requiredProductIds.length) {
      hasAccess = requiredProductIds.some((pid) => ownedProductIds.has(pid));
    }
    if (!hasAccess && requiredSystemIds.length) {
      const mappedProductIds = Array.from(
        new Set(
          allProducts
            .filter((p) => requiredSystemIds.some((sid) => csvIncludes(p.systemId, sid)))
            .map((p) => p.id)
        )
      );
      if (mappedProductIds.length > 0) {
        hasAccess = mappedProductIds.some((pid) => ownedProductIds.has(pid));
      } else {
        hasAccess = requiredSystemIds.some((sid) => userSystemIds.includes(sid));
      }
    }
  }
  return { isPublic, hasAccess, requiredProductIds, requiredSystemIds };
}

export function registerEadAndTrialRoutes(app: express.Application, prisma: PrismaClient) {
  const admin = adminAuthMiddleware;

  app.get('/api/public/products', async (_req, res) => {
    const products = await prisma.product.findMany({
      orderBy: { id: 'asc' },
      select: { productName: true, systemId: true, description: true, plano: true }
    });
    res.json(products);
  });

  app.get('/api/public/courses', async (req, res) => {
    const userId = resolveUserId(req);
    const ownedProductIds = await resolveUserOwnedProductIds(prisma, userId);
    let userSystemIds: string[] = [];
    if (userId) {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (user) {
        const now = new Date();
        const activeLicenses = await prisma.license.findMany({
          where: {
            email: user.email.toLowerCase(),
            statusLicenca: 'ativa',
            OR: [{ dataExpiracao: null }, { dataExpiracao: { gte: now } }],
          },
          select: { systemId: true },
        });
        userSystemIds = [...new Set(activeLicenses.map(l => l.systemId).filter(Boolean))];
      }
    }

    const courses = await prisma.course.findMany({
      where: { published: true },
      orderBy: { sortOrder: 'asc' },
      include: {
        modules: {
          orderBy: { sortOrder: 'asc' },
          include: { lessons: { orderBy: { sortOrder: 'asc' }, include: { ebook: true } } },
        },
      },
    });
    const allProducts = await prisma.product.findMany({
      select: { id: true, systemId: true }
    });

    const result = courses.map((c) => {
      const access = computeCourseAccess(c, ownedProductIds, userSystemIds, allProducts);
      const safeModules = access.hasAccess
        ? c.modules
        : c.modules.map((m) => ({ ...m, lessons: [] as typeof m.lessons }));
      return {
        ...c,
        modules: safeModules,
        ...access,
      };
    });

    res.json(result);
  });

  app.get('/api/public/courses/:slug', async (req, res) => {
    const c = await prisma.course.findFirst({
      where: { slug: req.params.slug, published: true },
      include: {
        modules: {
          orderBy: { sortOrder: 'asc' },
          include: {
            lessons: {
              orderBy: { sortOrder: 'asc' },
              include: { ebook: { select: { id: true, title: true, coverUrl: true } } },
            },
          },
        },
      },
    });
    if (!c) return res.status(404).json({ error: 'Not found' });

    const userId = resolveUserId(req);
    const ownedProductIds = await resolveUserOwnedProductIds(prisma, userId);
    let userSystemIds: string[] = [];
    if (userId) {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (user) {
        const now = new Date();
        const activeLicenses = await prisma.license.findMany({
          where: {
            email: user.email.toLowerCase(),
            statusLicenca: 'ativa',
            OR: [{ dataExpiracao: null }, { dataExpiracao: { gte: now } }],
          },
          select: { systemId: true },
        });
        userSystemIds = activeLicenses.map((l) => l.systemId).filter(Boolean);
      }
    }
    const allProducts = await prisma.product.findMany({
      select: { id: true, systemId: true }
    });
    const access = computeCourseAccess(c, ownedProductIds, userSystemIds, allProducts);

    if (!access.hasAccess) {
      return res.status(403).json({
        error: 'Acesso negado',
        salesPageUrl: c.salesPageUrl || null,
        ...access,
      });
    }

    res.json({ ...c, ...access });
  });

  app.get('/api/me/course-progress', async (req, res) => {
    const userId = resolveUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const slug = String(req.query.course || '');
    if (!slug) {
      const prog = await prisma.lessonProgress.findMany({ where: { userId } });
      return res.json({ progress: prog });
    }
    const course = await prisma.course.findFirst({ where: { slug } });
    if (!course) return res.status(404).json({ error: 'Course not found' });
    const lessons = await prisma.courseLesson.findMany({
      where: { module: { courseId: course.id } },
      select: { id: true }
    });
    const ids = lessons.map(l => l.id);
    const prog = await prisma.lessonProgress.findMany({ where: { userId, lessonId: { in: ids } } });
    res.json({ courseId: course.id, progress: prog });
  });

  app.post('/api/me/lesson-progress', async (req, res) => {
    const userId = resolveUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const { lessonId, percent, completed } = req.body as { lessonId?: string; percent?: number; completed?: boolean };
    if (!lessonId) return res.status(400).json({ error: 'lessonId required' });
    const p = await prisma.lessonProgress.upsert({
      where: { userId_lessonId: { userId, lessonId } },
      create: {
        userId,
        lessonId,
        percent: Math.min(100, Math.max(0, percent ?? 0)),
        completed: Boolean(completed)
      },
      update: {
        percent: percent != null ? Math.min(100, Math.max(0, percent)) : undefined,
        completed: completed != null ? Boolean(completed) : undefined
      }
    });
    res.json(p);
  });

  app.post('/api/public/trial', async (req, res) => {
    const email = String(req.body?.email || '')
      .trim()
      .toLowerCase();
    const name = String(req.body?.name || '').trim();
    const systemId = String(req.body?.systemId || 'TESTE_GRATUITO').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Invalid email' });

    const existingLic = await prisma.license.count({ where: { email } });
    if (existingLic > 0) return res.status(400).json({ error: 'E-mail já possui licença.' });

    const trial = await prisma.trialHistory.findUnique({ where: { email_systemId: { email, systemId } } });
    if (trial) return res.status(400).json({ error: 'Trial já utilizado para este produto.' });

    const eventId = `trial_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const end = new Date();
    end.setDate(end.getDate() + 10); // 7 dias de trial + 3 dias de tolerância

    await prisma.license.create({
      data: {
        email,
        buyerName: name || null,
        numeroConta: '',
        eventId,
        plano: 'teste',
        statusLicenca: 'ativa',
        dataExpiracao: end,
        systemId,
        dataAtivacao: new Date()
      }
    });

    await prisma.trialHistory.create({
      data: {
        email,
        systemId,
        eventId,
        trialEnd: end,
        status: 'active',
        ipAddress: req.socket.remoteAddress || undefined,
        userAgent: String(req.headers['user-agent'] || '').slice(0, 500)
      }
    });

    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      user = await prisma.user.create({ data: { email, name: name || null, password: null } });
    }

    const ebooks = await prisma.ebook.findMany({ where: { licenseSystemId: systemId } });
    for (const eb of ebooks) {
      try {
        await prisma.purchase.create({ data: { userId: user.id, ebookId: eb.id } });
      } catch {
        /* */
      }
    }

    res.json({ success: true, message: 'Trial de 7 dias criado.', eventId });
  });

  app.get('/api/admin/courses', admin, async (_req, res) => {
    const courses = await prisma.course.findMany({
      orderBy: { sortOrder: 'asc' },
      include: {
        modules: {
          orderBy: { sortOrder: 'asc' },
          include: { lessons: { orderBy: { sortOrder: 'asc' }, include: { ebook: true } } },
        },
      },
    });
    res.json(courses);
  });

  app.post('/api/admin/courses', admin, async (req, res) => {
    const { title, slug, coverUrl, licenseSystemId, productIds, salesPageUrl, published } = req.body as {
      title?: string;
      slug?: string;
      coverUrl?: string | null;
      licenseSystemId?: string | null;
      productIds?: string | null;
      salesPageUrl?: string | null;
      published?: boolean;
    };
    if (!title || !slug) return res.status(400).json({ error: 'title and slug required' });
    const c = await prisma.course.create({
      data: {
        title,
        slug,
        coverUrl: coverUrl || null,
        published: published ?? true,
        licenseSystemId: normalizeCsv(licenseSystemId ?? '') || null,
        productIds: normalizeProductIdsCsv(productIds),
        salesPageUrl: sanitizeUrl(salesPageUrl),
      },
    });
    res.json(c);
  });

  app.put('/api/admin/courses/:id', admin, async (req, res) => {
    const { title, slug, coverUrl, published, sortOrder, licenseSystemId, productIds, salesPageUrl } =
      req.body as {
        title?: string;
        slug?: string;
        coverUrl?: string | null;
        published?: boolean;
        sortOrder?: number;
        licenseSystemId?: string | null;
        productIds?: string | null;
        salesPageUrl?: string | null;
      };
    const c = await prisma.course
      .update({
        where: { id: req.params.id },
        data: {
          title: title ?? undefined,
          slug: slug ?? undefined,
          coverUrl: coverUrl === undefined ? undefined : coverUrl,
          published: published ?? undefined,
          sortOrder: sortOrder ?? undefined,
          licenseSystemId:
            licenseSystemId === undefined ? undefined : normalizeCsv(licenseSystemId ?? '') || null,
          productIds: productIds === undefined ? undefined : normalizeProductIdsCsv(productIds),
          salesPageUrl: salesPageUrl === undefined ? undefined : sanitizeUrl(salesPageUrl),
        },
      })
      .catch(() => null);
    if (!c) return res.status(404).json({ error: 'Not found' });
    res.json(c);
  });

  app.post('/api/admin/course-modules', admin, async (req, res) => {
    const { courseId, title, sortOrder } = req.body as { courseId?: string; title?: string; sortOrder?: number };
    if (!courseId || !title) return res.status(400).json({ error: 'courseId and title required' });
    const m = await prisma.courseModule.create({
      data: { courseId, title, sortOrder: sortOrder ?? 0 }
    });
    res.json(m);
  });

  app.post('/api/admin/course-lessons', admin, async (req, res) => {
    const { moduleId, title, sortOrder, ebookId, videoUrl, bodyText, actionLabel, actionUrl } = req.body as {
      moduleId?: string;
      title?: string;
      sortOrder?: number;
      ebookId?: string | null;
      videoUrl?: string | null;
      bodyText?: string | null;
      actionLabel?: string | null;
      actionUrl?: string | null;
    };
    if (!moduleId || !title) return res.status(400).json({ error: 'moduleId and title required' });
    const l = await prisma.courseLesson.create({
      data: {
        moduleId,
        title,
        sortOrder: sortOrder ?? 0,
        ebookId: ebookId || null,
        videoUrl: videoUrl || null,
        bodyText: bodyText || null,
        actionLabel: actionLabel || null,
        actionUrl: actionUrl || null,
      }
    });
    res.json(l);
  });

  app.put('/api/admin/course-modules/:id', admin, async (req, res) => {
    const { title, sortOrder } = req.body as { title?: string; sortOrder?: number };
    const m = await prisma.courseModule
      .update({
        where: { id: req.params.id },
        data: {
          title: title ?? undefined,
          sortOrder: sortOrder ?? undefined,
        },
      })
      .catch(() => null);
    if (!m) return res.status(404).json({ error: 'Not found' });
    res.json(m);
  });

  app.delete('/api/admin/course-modules/:id', admin, async (req, res) => {
    await prisma.courseModule.delete({ where: { id: req.params.id } }).catch(() => null);
    res.json({ success: true });
  });

  app.put('/api/admin/course-lessons/:id', admin, async (req, res) => {
    const { title, sortOrder, ebookId, videoUrl, bodyText, actionLabel, actionUrl } = req.body as {
      title?: string;
      sortOrder?: number;
      ebookId?: string | null;
      videoUrl?: string | null;
      bodyText?: string | null;
      actionLabel?: string | null;
      actionUrl?: string | null;
    };
    const l = await prisma.courseLesson
      .update({
        where: { id: req.params.id },
        data: {
          title: title ?? undefined,
          sortOrder: sortOrder ?? undefined,
          ebookId: ebookId === undefined ? undefined : ebookId || null,
          videoUrl: videoUrl === undefined ? undefined : videoUrl,
          bodyText: bodyText === undefined ? undefined : bodyText,
          actionLabel: actionLabel === undefined ? undefined : actionLabel,
          actionUrl: actionUrl === undefined ? undefined : actionUrl,
        },
      })
      .catch(() => null);
    if (!l) return res.status(404).json({ error: 'Not found' });
    res.json(l);
  });

  app.delete('/api/admin/course-lessons/:id', admin, async (req, res) => {
    await prisma.courseLesson.delete({ where: { id: req.params.id } }).catch(() => null);
    res.json({ success: true });
  });

  app.delete('/api/admin/courses/:id', admin, async (req, res) => {
    await prisma.course.delete({ where: { id: req.params.id } }).catch(() => null);
    res.json({ success: true });
  });
}
