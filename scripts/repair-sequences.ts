/**
 * Repara sequences PostgreSQL (MAX(id)+1) após migração WordPress.
 * Uso no container: npm run db:repair:sequences
 */
import { PrismaClient } from '@prisma/client';
import { repairAutoincrementSequences } from '../server/lib/repairSequences.js';

const prisma = new PrismaClient();

try {
  const n = await repairAutoincrementSequences(prisma);
  console.log(`[repair-sequences] OK — ${n} tabela(s) ajustada(s).`);
} catch (e) {
  console.error('[repair-sequences] Falha:', e);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
