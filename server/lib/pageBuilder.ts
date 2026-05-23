import type { PrismaClient } from '@prisma/client';

export const PAGE_BUILDER_PAGES_KEY = 'admin_page_builder_pages_json';
export const PAGE_BUILDER_LEGACY_KEY = 'admin_page_builder_html';

export type BuilderPageRecord = {
  slug: string;
  html: string;
  published?: boolean;
  target?: string;
  folderId?: string;
  updatedAt?: string;
};

export function normalizeBuilderSlug(raw: string): string {
  return (
    String(raw || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9-_/]+/g, '-')
      .replace(/\/+/g, '/')
      .replace(/(^[-/]+|[-/]+$)/g, '') || ''
  );
}

function tryParseJson(raw: string): unknown {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return null;
  }
}

/** Aceita array direto ou JSON duplamente serializado (string dentro de string). */
export function parseBuilderPagesJson(raw: string): BuilderPageRecord[] {
  let parsed: unknown = tryParseJson(raw);
  if (typeof parsed === 'string') {
    parsed = tryParseJson(parsed);
  }
  if (!Array.isArray(parsed)) return [];

  return parsed
    .map((x) => x as Partial<BuilderPageRecord>)
    .filter((x) => x && typeof x.slug === 'string')
    .map((x) => ({
      slug: normalizeBuilderSlug(String(x.slug)),
      html: String(x.html ?? ''),
      published: x.published === false ? false : true,
      target: x.target === 'header' ? 'header' : 'body',
      folderId: typeof x.folderId === 'string' ? x.folderId : undefined,
      updatedAt: x.updatedAt ? String(x.updatedAt) : undefined,
    }))
    .filter((p) => p.slug && p.html.trim().length > 0);
}

export function isBuilderPagePublished(page: BuilderPageRecord): boolean {
  return page.published !== false;
}

export async function loadBuilderPages(prisma: PrismaClient): Promise<BuilderPageRecord[]> {
  const [pagesRow, legacyRow] = await Promise.all([
    prisma.setting.findUnique({ where: { key: PAGE_BUILDER_PAGES_KEY } }),
    prisma.setting.findUnique({ where: { key: PAGE_BUILDER_LEGACY_KEY } }),
  ]);

  let pages = parseBuilderPagesJson(String(pagesRow?.value || ''));
  if (pages.length) return pages;

  const legacyHtml = String(legacyRow?.value || '').trim();
  if (legacyHtml) {
    return [
      {
        slug: 'pagina-principal',
        html: legacyHtml,
        published: true,
        target: 'body',
      },
    ];
  }

  return [];
}

export function findBuilderPageBySlug(
  pages: BuilderPageRecord[],
  slug: string
): BuilderPageRecord | null {
  const desired = normalizeBuilderSlug(slug);
  if (!desired) return null;
  return pages.find((p) => normalizeBuilderSlug(p.slug) === desired) ?? null;
}

export function serializeBuilderPagesSetting(pages: BuilderPageRecord[]): string {
  return JSON.stringify(pages, null, 2);
}
