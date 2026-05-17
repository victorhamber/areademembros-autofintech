/**
 * Reimporta user_pass do WordPress (MariaDB) para o Postgres do app.
 * Use quando senhas não funcionarem após migração (ex.: hash $wp$2y$ do WP 6.8+).
 *
 *   WP_DATABASE_URL=mysql://... DATABASE_URL=postgresql://... node scripts/resync-wp-passwords.mjs
 *   node scripts/resync-wp-passwords.mjs --dry-run
 */
import { PrismaClient } from '@prisma/client';
import mysql from 'mysql2/promise';

const dryRun = process.argv.includes('--dry-run');
const prisma = new PrismaClient();

function parseWpDbUrl(raw) {
  const u = new URL(raw);
  return {
    host: u.hostname,
    port: Number(u.port || 3306),
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, ''),
  };
}

async function main() {
  const wpUrl = process.env.WP_DATABASE_URL;
  if (!wpUrl) throw new Error('Defina WP_DATABASE_URL (MariaDB do WordPress).');

  const prefix = process.env.WP_TABLE_PREFIX || 'wp_';
  const cfg = parseWpDbUrl(wpUrl);
  const conn = await mysql.createConnection(cfg);

  const [rows] = await conn.query(
    `SELECT user_email, user_pass, display_name FROM ${prefix}users WHERE user_pass IS NOT NULL AND user_pass != ''`
  );
  await conn.end();

  let updated = 0;
  let missing = 0;
  let skipped = 0;
  const preview = [];

  for (const r of rows) {
    const email = String(r.user_email || '').trim().toLowerCase();
    const pass = String(r.user_pass || '').trim();
    if (!email || !pass) {
      skipped += 1;
      continue;
    }

    const user = await prisma.user.findUnique({ where: { email }, select: { id: true, password: true } });
    if (!user) {
      missing += 1;
      continue;
    }
    if (user.password === pass) {
      skipped += 1;
      continue;
    }

    if (!dryRun) {
      await prisma.user.update({ where: { email }, data: { password: pass } });
    }
    updated += 1;
    if (preview.length < 15) {
      preview.push({
        email,
        hashPrefix: pass.slice(0, 7),
        hadHash: user.password ? String(user.password).slice(0, 7) : null,
      });
    }
  }

  console.log(
    JSON.stringify(
      {
        dryRun,
        wpUsersWithPassword: rows.length,
        updated,
        missingInApp: missing,
        skipped,
        preview,
      },
      null,
      2
    )
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
