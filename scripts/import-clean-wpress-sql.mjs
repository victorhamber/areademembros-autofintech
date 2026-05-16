/**
 * Importa dados limpos do dump SQL do WordPress (.wpress extraído).
 * Inclui: licenças, produtos, ranking (wp_*_forex_ranking) e opcionalmente trial.
 *
 * Uso:
 *   node scripts/import-clean-wpress-sql.mjs <database.sql> [--out <arquivo.json>] [--apply]
 *
 * Exemplos:
 *   node scripts/import-clean-wpress-sql.mjs ../wp_extract/database.sql
 *   node scripts/import-clean-wpress-sql.mjs ../wp_extract/database.sql --out ./tmp/wp-clean-export.json --apply
 */

import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { PrismaClient } from '@prisma/client';

const argv = process.argv.slice(2);
const sqlPath = argv[0];

if (!sqlPath || sqlPath.startsWith('--')) {
  console.error('Uso: node scripts/import-clean-wpress-sql.mjs <database.sql> [--out <arquivo.json>] [--apply]');
  process.exit(1);
}

function argValue(flag, fallback) {
  const idx = argv.indexOf(flag);
  if (idx === -1 || idx + 1 >= argv.length) return fallback;
  return argv[idx + 1];
}

const outFile = path.resolve(process.cwd(), argValue('--out', './tmp/wp-clean-export.json'));
const applyImport = argv.includes('--apply');
const includeTrial = argv.includes('--include-trial');
const absoluteSql = path.resolve(process.cwd(), sqlPath);

function parseSqlValue(rawValue) {
  const value = rawValue.trim();
  if (value.toUpperCase() === 'NULL') return null;

  if (value.startsWith("'") && value.endsWith("'")) {
    const inner = value.slice(1, -1);
    return inner
      .replace(/\\\\/g, '\\')
      .replace(/\\'/g, "'")
      .replace(/\\r/g, '\r')
      .replace(/\\n/g, '\n')
      .replace(/\\t/g, '\t')
      .replace(/\\0/g, '\0');
  }

  if (/^-?\d+$/.test(value)) return Number(value);
  if (/^-?\d+\.\d+$/.test(value)) return Number(value);
  return value;
}

function splitTuples(valuesSql) {
  const tuples = [];
  let current = '';
  let inString = false;
  let escaped = false;
  let depth = 0;

  for (let i = 0; i < valuesSql.length; i += 1) {
    const ch = valuesSql[i];

    if (escaped) {
      current += ch;
      escaped = false;
      continue;
    }

    if (ch === '\\') {
      current += ch;
      escaped = true;
      continue;
    }

    if (ch === "'") {
      inString = !inString;
      current += ch;
      continue;
    }

    if (!inString && ch === '(') {
      depth += 1;
      if (depth === 1) {
        current = '';
        continue;
      }
    }

    if (!inString && ch === ')') {
      depth -= 1;
      if (depth === 0) {
        tuples.push(current);
        current = '';
        continue;
      }
    }

    if (depth >= 1) current += ch;
  }

  return tuples;
}

function splitFields(tupleSql) {
  const fields = [];
  let current = '';
  let inString = false;
  let escaped = false;

  for (let i = 0; i < tupleSql.length; i += 1) {
    const ch = tupleSql[i];

    if (escaped) {
      current += ch;
      escaped = false;
      continue;
    }

    if (ch === '\\') {
      current += ch;
      escaped = true;
      continue;
    }

    if (ch === "'") {
      inString = !inString;
      current += ch;
      continue;
    }

    if (!inString && ch === ',') {
      fields.push(parseSqlValue(current));
      current = '';
      continue;
    }

    current += ch;
  }

  fields.push(parseSqlValue(current));
  return fields;
}

function toDateOrNull(value) {
  if (!value || typeof value !== 'string') return null;
  const d = new Date(value.replace(' ', 'T'));
  return Number.isNaN(d.getTime()) ? null : d;
}

function normalizeLicenseStatus(status) {
  const s = String(status || '').trim().toLowerCase();
  if (!s) return 'inativa';
  if (s === 'desativada') return 'inativa';
  if (s === 'cancelada') return 'inativa';
  return s;
}

const dataset = {
  sourceSql: absoluteSql,
  generatedAt: new Date().toISOString(),
  licenses: [],
  products: [],
  shortLinks: [],
  shortLinkClicks: [],
  trialForms: [],
  trialHistory: [],
  /** Paridade wp_*_forex_ranking → Prisma RankingEntry */
  rankingEntries: [],
  skipped: {
    iaAprendizadoRows: 0,
    iaDetalhesRows: 0
  }
};

function handleInsert(tableName, valuesSql) {
  const tuples = splitTuples(valuesSql);

  if (tableName.endsWith('_ia_aprendizado')) {
    dataset.skipped.iaAprendizadoRows += tuples.length;
    return;
  }

  if (tableName.endsWith('_ia_dados_detalhados')) {
    dataset.skipped.iaDetalhesRows += tuples.length;
    return;
  }

  if (tableName.endsWith('_forex_licenses')) {
    for (const tuple of tuples) {
      const f = splitFields(tuple);
      if (f.length < 16) continue;

      const email = String(f[2] || '').trim().toLowerCase();
      const eventId = String(f[4] || '').trim();
      if (!email || !eventId) continue;

      dataset.licenses.push({
        email,
        buyerName: f[12] != null ? String(f[12]) : null,
        numeroConta: f[3] != null ? String(f[3]) : '',
        eventId,
        plano: f[10] != null ? String(f[10]) : 'mensal',
        statusLicenca: normalizeLicenseStatus(f[6]),
        dataExpiracao: toDateOrNull(f[7]),
        dataCancelamento: toDateOrNull(f[13]),
        dataAtivacao: toDateOrNull(f[14]) || new Date(),
        systemId: f[11] != null ? String(f[11]) : '',
        subscriberCode: f[15] != null ? String(f[15]) : null
      });
    }
    return;
  }

  if (tableName.endsWith('_forex_ranking')) {
    for (const tuple of tuples) {
      const f = splitFields(tuple);
      if (f.length < 14) continue;

      const id = Number(f[0]);
      if (!Number.isFinite(id) || id <= 0) continue;

      dataset.rankingEntries.push({
        id,
        emailHash: String(f[1] || '').trim(),
        numeroConta: String(f[2] || '').trim(),
        systemId: String(f[3] || '').trim(),
        corretora: f[4] != null ? String(f[4]) : '',
        ativo: f[5] != null ? String(f[5]) : '',
        lucro: Number(f[6] ?? 0),
        lucroPercent: Number(f[7] ?? 0),
        drawdown: Number(f[8] ?? 0),
        saldoInicial: Number(f[9] ?? 0),
        saldoFinal: Number(f[10] ?? 0),
        depositos: Number(f[11] ?? 0),
        setupFile: f[12] != null ? String(f[12]) : '',
        timestamp: toDateOrNull(f[13]) || new Date()
      });
    }
    return;
  }

  if (tableName.endsWith('_forex_products')) {
    for (const tuple of tuples) {
      const f = splitFields(tuple);
      if (f.length < 7) continue;
      dataset.products.push({
        productName: f[1] != null ? String(f[1]) : 'Produto',
        systemId: f[3] != null ? String(f[3]) : '',
        description: f[4] != null ? String(f[4]) : (f[2] != null ? String(f[2]) : null),
        offerCode: f[5] != null ? String(f[5]) : null,
        plano: f[6] != null ? String(f[6]) : null
      });
    }
    return;
  }

  if (tableName.endsWith('_wplm_links')) {
    for (const tuple of tuples) {
      const f = splitFields(tuple);
      if (f.length < 9) continue;
      const id = Number(f[0]);
      const slug = String(f[2] || '')
        .trim()
        .replace(/^\/+/, '')
        .replace(/\/+$/, '')
        .replace(/\/+/g, '/')
        .toLowerCase();
      const targetUrl = String(f[3] || '').trim();
      if (!Number.isFinite(id) || !slug || !targetUrl) continue;
      dataset.shortLinks.push({
        id,
        name: f[1] != null ? String(f[1]) : '',
        slug,
        targetUrl,
        redirectType: Number(f[4] || 301) || 301,
        smartRules: f[5] != null && String(f[5]).trim() ? String(f[5]) : null,
        utmParams: f[6] != null && String(f[6]).trim() ? String(f[6]) : null,
        isActive: Number(f[7] || 0) === 1,
        createdAt: toDateOrNull(f[8]) || new Date()
      });
    }
    return;
  }

  if (tableName.endsWith('_wplm_stats')) {
    for (const tuple of tuples) {
      const f = splitFields(tuple);
      if (f.length < 8) continue;
      const id = Number(f[0]);
      const linkId = Number(f[1]);
      if (!Number.isFinite(id) || !Number.isFinite(linkId)) continue;
      dataset.shortLinkClicks.push({
        id,
        linkId,
        clickedAt: toDateOrNull(f[2]) || new Date(),
        ipAddress: f[3] != null ? String(f[3]) : '',
        countryCode: f[4] != null ? String(f[4]) : '',
        deviceType: f[5] != null ? String(f[5]) : 'desktop',
        referrer: f[6] != null ? String(f[6]) : '',
        regionCode: f[7] != null ? String(f[7]) : ''
      });
    }
    return;
  }

  if (tableName.endsWith('_forex_form_builder')) {
    for (const tuple of tuples) {
      const f = splitFields(tuple);
      if (f.length < 9) continue;
      dataset.trialForms.push({
        formName: f[1] != null ? String(f[1]) : 'Formulário trial',
        systemId: f[2] != null ? String(f[2]) : '',
        fields: f[3] != null ? String(f[3]) : '[]',
        styles: f[4] != null ? String(f[4]) : null,
        settings: f[5] != null ? String(f[5]) : null,
        status: f[6] != null ? String(f[6]) : 'active'
      });
    }
    return;
  }

  if (tableName.endsWith('_forex_trial_history')) {
    for (const tuple of tuples) {
      const f = splitFields(tuple);
      if (f.length < 9) continue;
      const email = String(f[1] || '').trim().toLowerCase();
      const systemId = String(f[2] || '').trim();
      const eventId = String(f[3] || '').trim();
      if (!email || !systemId || !eventId) continue;

      dataset.trialHistory.push({
        email,
        systemId,
        eventId,
        trialStart: toDateOrNull(f[4]) || new Date(),
        trialEnd: toDateOrNull(f[5]),
        status: f[6] != null ? String(f[6]) : 'active',
        ipAddress: f[7] != null ? String(f[7]) : null,
        userAgent: f[8] != null ? String(f[8]) : null
      });
    }
  }
}

async function extractFromSql() {
  const stream = fs.createReadStream(absoluteSql, { encoding: 'utf8' });
  const reader = readline.createInterface({ input: stream, crlfDelay: Infinity });
  const insertPrefix = 'INSERT INTO `';

  for await (const line of reader) {
    if (!line.startsWith(insertPrefix)) continue;
    const tableEnd = line.indexOf('`', insertPrefix.length);
    if (tableEnd === -1) continue;
    const tableName = line.slice(insertPrefix.length, tableEnd);
    const valuesIdx = line.indexOf(' VALUES ');
    if (valuesIdx === -1) continue;
    const valuesSql = line.slice(valuesIdx + 8).trim().replace(/;$/, '');
    handleInsert(tableName, valuesSql);
  }
}

function dedupeByKey(rows, keyFn) {
  const map = new Map();
  for (const row of rows) map.set(keyFn(row), row);
  return [...map.values()];
}

async function writeJson() {
  const cleaned = {
    ...dataset,
    licenses: dedupeByKey(dataset.licenses, (r) => r.eventId),
    products: dedupeByKey(dataset.products, (r) => `${r.systemId}|${r.offerCode || ''}|${r.productName}`),
    shortLinks: dedupeByKey(dataset.shortLinks, (r) => r.slug),
    shortLinkClicks: dedupeByKey(dataset.shortLinkClicks, (r) => String(r.id)),
    trialForms: dedupeByKey(dataset.trialForms, (r) => r.systemId),
    trialHistory: dedupeByKey(dataset.trialHistory, (r) => `${r.email}|${r.systemId}`),
    rankingEntries: dedupeByKey(dataset.rankingEntries, (r) => String(r.id))
  };

  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(cleaned, null, 2), 'utf8');
  return cleaned;
}

async function applyToPrisma(cleaned) {
  const prisma = new PrismaClient();

  try {
    for (const row of cleaned.products) {
      await prisma.product.create({ data: row }).catch(() => {});
    }

    for (const row of cleaned.licenses) {
      await prisma.license.upsert({
        where: { eventId: row.eventId },
        update: row,
        create: row
      });
    }

    for (const row of cleaned.shortLinks) {
      const { id, ...rest } = row;
      await prisma.shortLink.upsert({
        where: { id },
        update: rest,
        create: row
      });
    }

    for (const row of cleaned.shortLinkClicks) {
      const { id, ...rest } = row;
      const linkExists = await prisma.shortLink.findUnique({ where: { id: row.linkId }, select: { id: true } });
      if (!linkExists) continue;
      await prisma.shortLinkClick.upsert({
        where: { id },
        update: rest,
        create: row
      });
    }

    /* SQLite + Prisma: createMany não suporta skipDuplicates; upsert por id evita duplicar ao reimportar. */
    for (const row of cleaned.rankingEntries) {
      const { id, ...rest } = row;
      await prisma.rankingEntry.upsert({
        where: { id },
        update: rest,
        create: row
      });
    }

    if (includeTrial) {
      for (const row of cleaned.trialForms) {
        await prisma.trialForm.upsert({
          where: { systemId: row.systemId },
          update: row,
          create: row
        });
      }

      for (const row of cleaned.trialHistory) {
        await prisma.trialHistory.upsert({
          where: {
            email_systemId: {
              email: row.email,
              systemId: row.systemId
            }
          },
          update: row,
          create: row
        });
      }
    }
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  console.log(`[wpress-sql] Lendo: ${absoluteSql}`);
  await extractFromSql();
  const cleaned = await writeJson();

  console.log(`[wpress-sql] JSON limpo salvo em: ${outFile}`);
  console.log(
    `[wpress-sql] Registros: products=${cleaned.products.length}, licenses=${cleaned.licenses.length}, shortLinks=${cleaned.shortLinks.length}, shortLinkClicks=${cleaned.shortLinkClicks.length}, rankingEntries=${cleaned.rankingEntries.length}, trialForms=${cleaned.trialForms.length}, trialHistory=${cleaned.trialHistory.length}`
  );
  console.log(
    `[wpress-sql] IA descartada: ia_aprendizado=${cleaned.skipped.iaAprendizadoRows}, ia_dados_detalhados=${cleaned.skipped.iaDetalhesRows}`
  );
  if (!includeTrial) {
    console.log('[wpress-sql] Trial/form builder ignorados por padrão (use --include-trial para importar).');
  }

  if (applyImport) {
    console.log('[wpress-sql] Aplicando import no Prisma...');
    await applyToPrisma(cleaned);
    console.log('[wpress-sql] Import finalizado.');
  } else {
    console.log('[wpress-sql] Modo dry-run (sem import no banco). Use --apply para gravar no Prisma.');
  }
}

main().catch((err) => {
  console.error('[wpress-sql] Falha:', err);
  process.exit(1);
});
