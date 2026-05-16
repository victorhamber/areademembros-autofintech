/**
 * Usuário de desenvolvimento (login na app).
 * Rode: npx prisma db seed
 *
 * E-mail: teste@local.dev
 * Senha:  TesteLocal123@
 */
import '../server/loadEnv.js';
import { PrismaClient } from '@prisma/client';
import { DEV_TEST_EMAIL, DEV_TEST_PASSWORD, ensureDevTestAccount } from '../server/lib/ensureDevTestAccount.js';

const prisma = new PrismaClient();

async function main() {
  await ensureDevTestAccount(prisma);
  console.log('Seed OK — use no login:');
  console.log(`  E-mail: ${DEV_TEST_EMAIL}`);
  console.log(`  Senha:  ${DEV_TEST_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
