/**
 * Migra dados do MariaDB do WordPress → PostgreSQL da área de membros.
 * Ignora tabelas de IA (ia_aprendizado, ia_dados_detalhados).
 *
 * Uso (no servidor EasyPanel — hosts internos):
 *   WP_DATABASE_URL="mariadb://user:pass@autofintech_wordpress-db:3306/autofintech" \
 *   DATABASE_URL="postgresql://..." \
 *   node scripts/migrate-wordpress-mariadb-to-app.mjs
 *
 * Opções:
 *   --dry-run     só conta registros, não grava
 *   --no-clear    não apaga dados atuais do Postgres antes
 */
import { createRequire } from 'module';
import { randomUUID } from 'crypto';
import mysql from 'mysql2/promise';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
dotenv.config({ path: path.join(ROOT, '.env'), override: true });

const dryRun = process.argv.includes('--dry-run');
const noClear = process.argv.includes('--no-clear');

function parseMariaDbUrl(raw) {
  const url = String(raw || '').trim();
  if (!url) throw new Error('WP_DATABASE_URL ou MARIADB_URL não definida');
  const normalized = url.replace(/^mariadb:/i, 'mysql:');
  const u = new URL(normalized);
  return {
    host: u.hostname,
    port: Number(u.port || 3306),
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, ''),
  };
}

function toDate(v) {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function normalizeLicenseStatus(status) {
  const s = String(status || '').trim().toLowerCase();
  if (!s) return 'inativa';
  if (s === 'desativada' || s === 'cancelada') return 'inativa';
  return s;
}

async function tableExists(conn, table) {
  const [rows] = await conn.query(
    `SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ? LIMIT 1`,
    [table]
  );
  return rows.length > 0;
}

async function detectPrefix(conn) {
  const [rows] = await conn.query(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name LIKE '%forex_licenses'`
  );
  if (!rows.length) throw new Error('Tabela forex_licenses não encontrada no MariaDB');
  const name = rows[0].table_name;
  return name.replace(/forex_licenses$/, '');
}

async function fetchAll(conn, table) {
  if (!(await tableExists(conn, table))) return [];
  const [rows] = await conn.query(`SELECT * FROM \`${table}\``);
  return rows;
}

async function fetchWpOptions(conn, prefix) {
  const table = `${prefix}options`;
  if (!(await tableExists(conn, table))) return new Map();
  const [rows] = await conn.query(`SELECT option_name, option_value FROM \`${table}\``);
  const map = new Map();
  for (const r of rows) map.set(String(r.option_name), r.option_value);
  return map;
}

function buildDataset(conn, prefix, options) {
  return {
    async products() {
      const rows = await fetchAll(conn, `${prefix}forex_products`);
      return rows.map((r) => ({
        productName: String(r.product_name || 'Produto'),
        systemId: String(r.system_id || ''),
        description: r.description != null ? String(r.description) : null,
        offerCode: r.offer_code != null ? String(r.offer_code) : null,
        plano: r.plano != null ? String(r.plano) : null,
        downloadUrl: r.download_url != null ? String(r.download_url) : null,
        downloadFileName: r.download_file_name != null ? String(r.download_file_name) : null,
        downloadVersion: r.download_version != null ? String(r.download_version) : null,
      }));
    },
    async licenses() {
      const rows = await fetchAll(conn, `${prefix}forex_licenses`);
      return rows
        .map((r) => {
          const email = String(r.email || '').trim().toLowerCase();
          const eventId = String(r.event_id || '').trim();
          if (!email || !eventId) return null;
          return {
            email,
            buyerName: r.buyer_name != null ? String(r.buyer_name) : null,
            numeroConta: r.numero_conta != null ? String(r.numero_conta) : '',
            eventId,
            plano: r.plano != null ? String(r.plano) : 'mensal',
            statusLicenca: normalizeLicenseStatus(r.status_licenca),
            dataExpiracao: toDate(r.data_expiracao),
            dataCancelamento: toDate(r.data_cancelamento),
            dataAtivacao: toDate(r.data_ativacao) || new Date(),
            systemId: r.system_id != null ? String(r.system_id) : '',
            offerCode: r.offer_code != null ? String(r.offer_code) : null,
            subscriberCode: r.subscriber_code != null ? String(r.subscriber_code) : null,
          };
        })
        .filter(Boolean);
    },
    async ranking() {
      const rows = await fetchAll(conn, `${prefix}forex_ranking`);
      return rows.map((r) => ({
        id: Number(r.id),
        emailHash: String(r.email_hash || ''),
        numeroConta: String(r.numero_conta || ''),
        systemId: String(r.system_id || ''),
        corretora: r.corretora != null ? String(r.corretora) : '',
        ativo: r.ativo != null ? String(r.ativo) : '',
        lucro: Number(r.lucro ?? 0),
        lucroPercent: Number(r.lucro_percent ?? 0),
        drawdown: Number(r.drawdown ?? 0),
        saldoInicial: Number(r.saldo_inicial ?? 0),
        saldoFinal: Number(r.saldo_final ?? 0),
        depositos: Number(r.depositos ?? 0),
        setupFile: r.setup_file != null ? String(r.setup_file) : '',
        timestamp: toDate(r.timestamp) || new Date(),
      }));
    },
    async shortLinks() {
      const candidates = [`${prefix}wplm_links`, `wplm_links`];
      for (const t of candidates) {
        const rows = await fetchAll(conn, t);
        if (!rows.length && !(await tableExists(conn, t))) continue;
        return rows
          .map((r) => {
            const slug = String(r.slug || '')
              .trim()
              .replace(/^\/+/, '')
              .replace(/\/+$/, '')
              .toLowerCase();
            const targetUrl = String(r.target_url || r.url || '').trim();
            if (!slug || !targetUrl) return null;
            return {
              id: Number(r.id),
              name: r.name != null ? String(r.name) : '',
              slug,
              targetUrl,
              redirectType: Number(r.redirect_type || 301) || 301,
              smartRules: r.smart_rules != null && String(r.smart_rules).trim() ? String(r.smart_rules) : null,
              utmParams: r.utm_params != null && String(r.utm_params).trim() ? String(r.utm_params) : null,
              isActive: Number(r.is_active ?? r.active ?? 1) === 1,
              createdAt: toDate(r.created_at) || new Date(),
            };
          })
          .filter(Boolean);
      }
      return [];
    },
    async shortLinkClicks() {
      const candidates = [`${prefix}wplm_stats`, `wplm_stats`];
      for (const t of candidates) {
        const rows = await fetchAll(conn, t);
        if (!rows.length && !(await tableExists(conn, t))) continue;
        return rows
          .map((r) => ({
            id: Number(r.id),
            linkId: Number(r.link_id),
            clickedAt: toDate(r.clicked_at || r.created_at) || new Date(),
            ipAddress: r.ip_address != null ? String(r.ip_address) : '',
            countryCode: r.country_code != null ? String(r.country_code) : '',
            deviceType: r.device_type != null ? String(r.device_type) : 'desktop',
            referrer: r.referrer != null ? String(r.referrer) : '',
            regionCode: r.region_code != null ? String(r.region_code) : '',
          }))
          .filter((r) => Number.isFinite(r.id) && Number.isFinite(r.linkId));
      }
      return [];
    },
    async trialForms() {
      const rows = await fetchAll(conn, `${prefix}forex_form_builder`);
      return rows.map((r) => ({
        formName: String(r.form_name || 'Formulário trial'),
        systemId: String(r.system_id || ''),
        fields: String(r.fields || '[]'),
        styles: r.styles != null ? String(r.styles) : null,
        settings: r.settings != null ? String(r.settings) : null,
        status: r.status != null ? String(r.status) : 'active',
      }));
    },
    async trialHistory() {
      const rows = await fetchAll(conn, `${prefix}forex_trial_history`);
      return rows
        .map((r) => {
          const email = String(r.email || '').trim().toLowerCase();
          const systemId = String(r.system_id || '').trim();
          const eventId = String(r.event_id || '').trim();
          if (!email || !systemId || !eventId) return null;
          return {
            email,
            systemId,
            eventId,
            trialStart: toDate(r.trial_start) || new Date(),
            trialEnd: toDate(r.trial_end),
            status: r.status != null ? String(r.status) : 'active',
            ipAddress: r.ip_address != null ? String(r.ip_address) : null,
            userAgent: r.user_agent != null ? String(r.user_agent) : null,
          };
        })
        .filter(Boolean);
    },
    async outgoingWebhooks() {
      const rows = await fetchAll(conn, `${prefix}forex_outgoing_webhooks`);
      return rows.map((r) => ({
        id: Number(r.id),
        destinationUrl: String(r.destination_url || ''),
        events: String(r.events || ''),
        status: r.status != null ? String(r.status) : 'active',
        createdAt: toDate(r.created_at) || new Date(),
        lastTriggered: toDate(r.last_triggered),
      }));
    },
    async licenseWebhookLogs() {
      const rows = await fetchAll(conn, `${prefix}forex_webhook_logs`);
      return rows.map((r) => ({
        id: Number(r.id),
        rawData: String(r.raw_data || ''),
        processed: Number(r.processed || 0) === 1,
        createdAt: toDate(r.created_at) || new Date(),
      }));
    },
    async wpUsers() {
      const table = `${prefix}users`;
      const rows = await fetchAll(conn, table);
      return rows
        .map((r) => {
          const email = String(r.user_email || '').trim().toLowerCase();
          if (!email || !email.includes('@')) return null;
          return {
            email,
            password: r.user_pass != null ? String(r.user_pass) : null,
            name: r.display_name != null ? String(r.display_name) : (r.user_nicename ? String(r.user_nicename) : null),
          };
        })
        .filter(Boolean);
    },
    settingsFromOptions() {
      const keys = [
        'forex_webhook_token',
        'forex_api_keys',
        'member_hero_background_url',
        'member_hero_kicker',
        'member_support_url',
        'carousel_slides',
        'resend_api_key',
        'sender_name',
        'sender_email',
        'wpf_trail_form_options',
      ];
      const settings = [];
      for (const key of keys) {
        const val = options.get(key);
        if (val == null || String(val).trim() === '') continue;
        if (key === 'forex_api_keys' && Array.isArray(val)) {
          settings.push({ key, value: JSON.stringify(val) });
        } else if (key === 'forex_api_keys' && typeof val === 'string') {
          try {
            JSON.parse(val);
            settings.push({ key, value: val });
          } catch {
            const lines = val.split(/[\r\n,]+/).map((s) => s.trim()).filter(Boolean);
            settings.push({ key, value: JSON.stringify(lines) });
          }
        } else if (typeof val === 'object') {
          settings.push({ key, value: JSON.stringify(val) });
        } else {
          settings.push({ key, value: String(val) });
        }
      }
      return settings;
    },
    skippedIa: async () => {
      let n = 0;
      for (const t of [`${prefix}ia_aprendizado`, `${prefix}ia_dados_detalhados`]) {
        const rows = await fetchAll(conn, t);
        n += rows.length;
      }
      return n;
    },
  };
}

async function clearPostgres(prisma) {
  const order = [
    'shortLinkClick',
    'lessonProgress',
    'purchase',
    'wishlist',
    'highlight',
    'courseLesson',
    'courseModule',
    'course',
    'license',
    'licenseWebhookRawLog',
    'rankingEntry',
    'trialHistory',
    'trialForm',
    'outgoingWebhook',
    'shortLink',
    'mediaAsset',
    'webhookLog',
    'product',
    'setting',
    'ebook',
    'category',
    'user',
  ];
  for (const model of order) {
    await prisma[model].deleteMany();
  }
}

async function applyToPostgres(prisma, data) {
  if (!noClear) await clearPostgres(prisma);

  for (const row of data.products) {
    await prisma.product.create({ data: row }).catch(() => {});
  }

  for (const row of data.licenses) {
    await prisma.license.upsert({
      where: { eventId: row.eventId },
      update: row,
      create: row,
    });
  }

  for (const row of data.shortLinks) {
    const { id, ...rest } = row;
    await prisma.shortLink.upsert({ where: { id }, update: rest, create: row });
  }

  for (const row of data.shortLinkClicks) {
    const link = await prisma.shortLink.findUnique({ where: { id: row.linkId } });
    if (!link) continue;
    const { id, ...rest } = row;
    await prisma.shortLinkClick.upsert({ where: { id }, update: rest, create: row });
  }

  for (const row of data.ranking) {
    const { id, ...rest } = row;
    await prisma.rankingEntry.upsert({ where: { id }, update: rest, create: row });
  }

  for (const row of data.trialForms) {
    await prisma.trialForm.upsert({
      where: { systemId: row.systemId },
      update: row,
      create: row,
    });
  }

  for (const row of data.trialHistory) {
    await prisma.trialHistory.upsert({
      where: { email_systemId: { email: row.email, systemId: row.systemId } },
      update: row,
      create: row,
    });
  }

  for (const row of data.outgoingWebhooks) {
    const { id, ...rest } = row;
    await prisma.outgoingWebhook.upsert({ where: { id }, update: rest, create: row });
  }

  for (const row of data.licenseWebhookLogs) {
    const { id, ...rest } = row;
    await prisma.licenseWebhookRawLog.upsert({ where: { id }, update: rest, create: row });
  }

  for (const row of data.settings) {
    await prisma.setting.upsert({
      where: { key: row.key },
      update: { value: row.value },
      create: { id: randomUUID(), key: row.key, value: row.value },
    });
  }

  const userByEmail = new Map();
  for (const u of data.wpUsers) userByEmail.set(u.email, u);

  for (const lic of data.licenses) {
    if (!userByEmail.has(lic.email)) {
      userByEmail.set(lic.email, {
        email: lic.email,
        password: null,
        name: lic.buyerName,
      });
    }
  }

  for (const u of userByEmail.values()) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {
        name: u.name || undefined,
        password: u.password ?? undefined,
      },
      create: {
        email: u.email,
        password: u.password,
        name: u.name,
      },
    });
  }

  const intTables = [
    ['Product', data.products],
    ['License', data.licenses],
    ['ShortLink', data.shortLinks],
    ['ShortLinkClick', data.shortLinkClicks],
    ['RankingEntry', data.ranking],
    ['OutgoingWebhook', data.outgoingWebhooks],
    ['LicenseWebhookRawLog', data.licenseWebhookLogs],
  ];
  for (const [table, rows] of intTables) {
    const ids = rows.map((r) => Number(r.id)).filter((id) => Number.isFinite(id) && id > 0);
    if (!ids.length) continue;
    const maxId = Math.max(...ids);
    await prisma.$executeRawUnsafe(
      `SELECT setval(pg_get_serial_sequence('"${table}"', 'id'), ${maxId}, true)`
    );
  }
}

async function main() {
  const wpUrl = process.env.WP_DATABASE_URL || process.env.MARIADB_URL;
  const pgUrl = process.env.DATABASE_URL;
  if (!pgUrl) throw new Error('DATABASE_URL não definida');

  const maria = parseMariaDbUrl(wpUrl);
  console.log(`[wp→app] MariaDB ${maria.user}@${maria.host}:${maria.port}/${maria.database}`);

  const conn = await mysql.createConnection({ ...maria, dateStrings: false });
  const prefix = await detectPrefix(conn);
  console.log(`[wp→app] Prefixo WP: ${prefix}`);

  const options = await fetchWpOptions(conn, prefix);
  const api = buildDataset(conn, prefix, options);

  const data = {
    products: await api.products(),
    licenses: await api.licenses(),
    ranking: await api.ranking(),
    shortLinks: await api.shortLinks(),
    shortLinkClicks: await api.shortLinkClicks(),
    trialForms: await api.trialForms(),
    trialHistory: await api.trialHistory(),
    outgoingWebhooks: await api.outgoingWebhooks(),
    licenseWebhookLogs: await api.licenseWebhookLogs(),
    wpUsers: await api.wpUsers(),
    settings: api.settingsFromOptions(),
    skippedIa: await api.skippedIa(),
  };

  console.log('[wp→app] Contagem:');
  console.log(
    JSON.stringify(
      {
        products: data.products.length,
        licenses: data.licenses.length,
        users: data.wpUsers.length,
        shortLinks: data.shortLinks.length,
        shortLinkClicks: data.shortLinkClicks.length,
        ranking: data.ranking.length,
        trialForms: data.trialForms.length,
        trialHistory: data.trialHistory.length,
        outgoingWebhooks: data.outgoingWebhooks.length,
        licenseWebhookLogs: data.licenseWebhookLogs.length,
        settings: data.settings.length,
        skippedIaRows: data.skippedIa,
      },
      null,
      2
    )
  );

  if (dryRun) {
    await conn.end();
    console.log('[wp→app] Dry-run — nada gravado.');
    return;
  }

  console.log('[wp→app] prisma db push...');
  execSync('npx prisma db push --accept-data-loss', {
    cwd: ROOT,
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: pgUrl },
  });

  const prisma = new PrismaClient();
  try {
    await applyToPostgres(prisma, data);
    console.log('[wp→app] Migração concluída.');
    console.log('[wp→app] Senhas WP: usuários mantêm hash WordPress; login aceita a mesma senha do site antigo.');
  } finally {
    await prisma.$disconnect();
    await conn.end();
  }
}

main().catch((e) => {
  console.error('[wp→app] Falha:', e);
  process.exit(1);
});
