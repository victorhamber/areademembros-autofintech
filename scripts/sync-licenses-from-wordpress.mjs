/**
 * Sincroniza licenças (e opcionalmente produtos) do MariaDB WordPress → Postgres do app.
 * Não apaga cursos, conteúdos, compras nem configurações do app.
 *
 * Uso (EasyPanel / servidor):
 *   WP_DATABASE_URL="mariadb://user:pass@host:3306/autofintech" \
 *   DATABASE_URL="postgresql://..." \
 *   node scripts/sync-licenses-from-wordpress.mjs --dry-run
 *
 * Opções:
 *   --dry-run           só mostra contagens, não grava
 *   --no-products       não sincroniza forex_products
 *   --ensure-users      cria usuários faltantes a partir dos e-mails das licenças (sem senha)
 *   --mirror-licenses   remove licenças do app que não existem mais no WordPress
 */
import mysql from 'mysql2/promise';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
dotenv.config({ path: path.join(ROOT, '.env'), override: true });

const dryRun = process.argv.includes('--dry-run');
const syncProducts = !process.argv.includes('--no-products');
const ensureUsers = process.argv.includes('--ensure-users');
const mirrorLicenses = process.argv.includes('--mirror-licenses');

function parseMariaDbUrl(raw) {
  const url = String(raw || '').trim();
  if (!url) throw new Error('Defina WP_DATABASE_URL (MariaDB do WordPress).');
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
  if (!rows.length) throw new Error('Tabela forex_licenses não encontrada no MariaDB.');
  const name = rows[0].table_name;
  return name.replace(/forex_licenses$/, '');
}

async function fetchAll(conn, table) {
  if (!(await tableExists(conn, table))) return [];
  const [rows] = await conn.query(`SELECT * FROM \`${table}\``);
  return rows;
}

function mapProducts(rows) {
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
}

function mapLicenses(rows) {
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
}

async function findProduct(prisma, row) {
  if (row.offerCode) {
    const byOffer = await prisma.product.findFirst({ where: { offerCode: row.offerCode } });
    if (byOffer) return byOffer;
  }
  if (row.systemId) {
    return prisma.product.findFirst({ where: { systemId: row.systemId } });
  }
  return null;
}

async function main() {
  const wpUrl = process.env.WP_DATABASE_URL || process.env.MARIADB_URL;
  if (!process.env.DATABASE_URL) throw new Error('Defina DATABASE_URL (Postgres do app).');

  const maria = parseMariaDbUrl(wpUrl);
  console.log(`[sync-licenses] WordPress: ${maria.user}@${maria.host}:${maria.port}/${maria.database}`);

  const conn = await mysql.createConnection({ ...maria, dateStrings: false });
  const prefix = await detectPrefix(conn);
  console.log(`[sync-licenses] Prefixo WP: ${prefix}`);

  const wpProducts = syncProducts ? mapProducts(await fetchAll(conn, `${prefix}forex_products`)) : [];
  const wpLicenses = mapLicenses(await fetchAll(conn, `${prefix}forex_licenses`));
  await conn.end();

  const prisma = new PrismaClient();
  try {
    const before = {
      appLicenses: await prisma.license.count(),
      appProducts: await prisma.product.count(),
    };

    const stats = {
      dryRun,
      syncProducts,
      ensureUsers,
      mirrorLicenses,
      wordpress: {
        licenses: wpLicenses.length,
        products: wpProducts.length,
      },
      before,
      licenses: { created: 0, updated: 0, unchanged: 0, removed: 0 },
      products: { created: 0, updated: 0, skipped: 0 },
      users: { created: 0, skipped: 0 },
    };

    if (dryRun) {
      const appEventIds = new Set(
        (await prisma.license.findMany({ select: { eventId: true } })).map((l) => l.eventId)
      );
      for (const row of wpLicenses) {
        if (appEventIds.has(row.eventId)) stats.licenses.updated += 1;
        else stats.licenses.created += 1;
      }
      if (mirrorLicenses) {
        const wpEventIds = new Set(wpLicenses.map((l) => l.eventId));
        stats.licenses.removed = (await prisma.license.findMany({ select: { eventId: true } })).filter(
          (l) => !wpEventIds.has(l.eventId)
        ).length;
      }
      console.log(JSON.stringify(stats, null, 2));
      console.log('[sync-licenses] Dry-run — nada gravado.');
      return;
    }

    if (syncProducts) {
      for (const row of wpProducts) {
        const existing = await findProduct(prisma, row);
        if (existing) {
          await prisma.product.update({
            where: { id: existing.id },
            data: {
              productName: row.productName,
              systemId: row.systemId,
              description: row.description,
              offerCode: row.offerCode,
              plano: row.plano,
              downloadUrl: row.downloadUrl,
              downloadFileName: row.downloadFileName,
              downloadVersion: row.downloadVersion,
            },
          });
          stats.products.updated += 1;
        } else {
          await prisma.product.create({ data: row });
          stats.products.created += 1;
        }
      }
    }

    for (const row of wpLicenses) {
      const existing = await prisma.license.findUnique({ where: { eventId: row.eventId } });
      if (existing) {
        const same =
          existing.email === row.email &&
          existing.buyerName === row.buyerName &&
          existing.numeroConta === row.numeroConta &&
          existing.plano === row.plano &&
          existing.statusLicenca === row.statusLicenca &&
          existing.systemId === row.systemId &&
          existing.offerCode === row.offerCode &&
          existing.subscriberCode === row.subscriberCode &&
          String(existing.dataExpiracao || '') === String(row.dataExpiracao || '') &&
          String(existing.dataCancelamento || '') === String(row.dataCancelamento || '') &&
          String(existing.dataAtivacao || '') === String(row.dataAtivacao || '');

        if (same) {
          stats.licenses.unchanged += 1;
          continue;
        }

        await prisma.license.update({ where: { eventId: row.eventId }, data: row });
        stats.licenses.updated += 1;
      } else {
        await prisma.license.create({ data: row });
        stats.licenses.created += 1;
      }
    }

    if (mirrorLicenses) {
      const wpEventIds = new Set(wpLicenses.map((l) => l.eventId));
      const toRemove = await prisma.license.findMany({
        where: { eventId: { notIn: [...wpEventIds] } },
        select: { id: true, eventId: true, email: true },
      });
      if (toRemove.length) {
        await prisma.license.deleteMany({ where: { id: { in: toRemove.map((l) => l.id) } } });
        stats.licenses.removed = toRemove.length;
      }
    }

    if (ensureUsers) {
      const emails = [...new Set(wpLicenses.map((l) => l.email))];
      for (const email of emails) {
        const lic = wpLicenses.find((l) => l.email === email);
        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing) {
          stats.users.skipped += 1;
          continue;
        }
        await prisma.user.create({
          data: {
            email,
            name: lic?.buyerName || null,
            password: null,
          },
        });
        stats.users.created += 1;
      }
    }

    stats.after = {
      appLicenses: await prisma.license.count(),
      appProducts: await prisma.product.count(),
    };

    console.log(JSON.stringify(stats, null, 2));
    console.log('[sync-licenses] Sincronização concluída.');
    console.log('[sync-licenses] Dica: rode também npm run db:resync:wp-passwords se precisar alinhar senhas WP.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error('[sync-licenses] Falha:', e);
  process.exit(1);
});
