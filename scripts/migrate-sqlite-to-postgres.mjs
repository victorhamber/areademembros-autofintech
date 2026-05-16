/**
 * Migra dados de prisma/dev.db (SQLite) para PostgreSQL (DATABASE_URL).
 *
 * Uso:
 *   node scripts/migrate-sqlite-to-postgres.mjs
 *   node scripts/migrate-sqlite-to-postgres.mjs --export-only
 *   node scripts/migrate-sqlite-to-postgres.mjs --import-only ./tmp/sqlite-export.json
 *
 * DATABASE_URL deve apontar para o Postgres de destino (.env ou variável de ambiente).
 * Para Postgres interno do EasyPanel, use túnel/porta pública ou rode este script no servidor.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SQLITE_PATH = path.join(ROOT, 'prisma', 'dev.db');
const EXPORT_PATH = path.join(ROOT, 'tmp', 'sqlite-export.json');

dotenv.config({ path: path.join(ROOT, '.env'), override: true });

/** Ordem respeitando FKs (PascalCase = nomes das tabelas Prisma). */
const TABLE_ORDER = [
  'Category',
  'User',
  'Product',
  'Setting',
  'TrialForm',
  'OutgoingWebhook',
  'ShortLink',
  'MediaAsset',
  'WebhookLog',
  'Ebook',
  'License',
  'LicenseWebhookRawLog',
  'RankingEntry',
  'TrialHistory',
  'Course',
  'CourseModule',
  'CourseLesson',
  'Purchase',
  'Wishlist',
  'Highlight',
  'LessonProgress',
  'ShortLinkClick',
];

const INT_ID_TABLES = [
  'Product',
  'License',
  'LicenseWebhookRawLog',
  'OutgoingWebhook',
  'RankingEntry',
  'TrialForm',
  'TrialHistory',
  'ShortLink',
  'ShortLinkClick',
];

function parseArgs() {
  const args = process.argv.slice(2);
  let exportOnly = false;
  let importOnly = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--export-only') exportOnly = true;
    if (args[i] === '--import-only') importOnly = args[++i] || EXPORT_PATH;
  }
  return { exportOnly, importOnly };
}

function coerceRow(row) {
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    if (v === null || v === undefined) {
      out[k] = v;
      continue;
    }
    if (typeof v === 'number' && (k.startsWith('is') || k === 'published' || k === 'processed' || k === 'completed')) {
      out[k] = v === 1;
      continue;
    }
    if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) {
      const d = new Date(v);
      if (!Number.isNaN(d.getTime())) out[k] = d;
      else out[k] = v;
      continue;
    }
    out[k] = v;
  }
  return out;
}

function exportSqlite(sqlitePath) {
  if (!fs.existsSync(sqlitePath)) {
    throw new Error(`SQLite não encontrado: ${sqlitePath}`);
  }
  const db = new Database(sqlitePath, { readonly: true });
  const payload = { exportedAt: new Date().toISOString(), tables: {} };

  for (const table of TABLE_ORDER) {
    const exists = db
      .prepare(`SELECT 1 FROM sqlite_master WHERE type='table' AND name=?`)
      .get(table);
    if (!exists) {
      console.log(`[export] ${table}: (tabela ausente)`);
      payload.tables[table] = [];
      continue;
    }
    const rows = db.prepare(`SELECT * FROM "${table}"`).all();
    payload.tables[table] = rows;
    console.log(`[export] ${table}: ${rows.length} registros`);
  }

  db.close();
  fs.mkdirSync(path.dirname(EXPORT_PATH), { recursive: true });
  fs.writeFileSync(EXPORT_PATH, JSON.stringify(payload, null, 0));
  console.log(`[export] Salvo em ${EXPORT_PATH}`);
  return payload;
}

async function importToPostgres(payload) {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error('DATABASE_URL não definida. Configure no .env ou ambiente.');
  }
  if (!url.startsWith('postgres')) {
    throw new Error('DATABASE_URL deve ser PostgreSQL.');
  }

  const prisma = new PrismaClient();

  try {
    console.log('[import] prisma db push (schema)...');
    const { execSync } = await import('child_process');
    execSync('npx prisma db push --accept-data-loss', {
      cwd: ROOT,
      stdio: 'inherit',
      env: { ...process.env, DATABASE_URL: url },
    });

    const modelMap = {
      Category: 'category',
      User: 'user',
      Product: 'product',
      Setting: 'setting',
      TrialForm: 'trialForm',
      OutgoingWebhook: 'outgoingWebhook',
      ShortLink: 'shortLink',
      MediaAsset: 'mediaAsset',
      WebhookLog: 'webhookLog',
      Ebook: 'ebook',
      License: 'license',
      LicenseWebhookRawLog: 'licenseWebhookRawLog',
      RankingEntry: 'rankingEntry',
      TrialHistory: 'trialHistory',
      Course: 'course',
      CourseModule: 'courseModule',
      CourseLesson: 'courseLesson',
      Purchase: 'purchase',
      Wishlist: 'wishlist',
      Highlight: 'highlight',
      LessonProgress: 'lessonProgress',
      ShortLinkClick: 'shortLinkClick',
    };

    // Limpa na ordem inversa (filhos antes dos pais)
    await prisma.$transaction(async (tx) => {
      for (const table of [...TABLE_ORDER].reverse()) {
        const model = modelMap[table];
        await tx[model].deleteMany();
      }
    });

    for (const table of TABLE_ORDER) {
      const rows = payload.tables[table] || [];
      if (!rows.length) {
        console.log(`[import] ${table}: 0`);
        continue;
      }
      const model = modelMap[table];
      const data = rows.map(coerceRow);
      await prisma[model].createMany({ data, skipDuplicates: true });
      console.log(`[import] ${table}: ${rows.length}`);
    }

    for (const table of INT_ID_TABLES) {
      const rows = payload.tables[table] || [];
      if (!rows.length) continue;
      const maxId = Math.max(...rows.map((r) => Number(r.id) || 0));
      if (maxId > 0) {
        await prisma.$executeRawUnsafe(
          `SELECT setval(pg_get_serial_sequence('"${table}"', 'id'), ${maxId}, true)`
        );
      }
    }

    console.log('[import] Concluído.');
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  const { exportOnly, importOnly } = parseArgs();

  if (importOnly) {
    const file = path.resolve(importOnly);
    if (!fs.existsSync(file)) throw new Error(`Arquivo não encontrado: ${file}`);
    const payload = JSON.parse(fs.readFileSync(file, 'utf8'));
    await importToPostgres(payload);
    return;
  }

  const payload = exportSqlite(SQLITE_PATH);
  if (exportOnly) return;

  await importToPostgres(payload);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
