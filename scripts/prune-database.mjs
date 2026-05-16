/**
 * Limpa dados não essenciais para manter banco leve.
 *
 * Foco padrão:
 * - manter licenças e produtos;
 * - manter ranking apenas dos últimos 30 dias;
 * - remover logs e tokens de reset antigos.
 *
 * Uso:
 *   node scripts/prune-database.mjs
 *   node scripts/prune-database.mjs --aggressive
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const aggressive = process.argv.includes('--aggressive');

function daysAgo(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

async function main() {
  const cutoffRanking = daysAgo(30);
  const cutoffWebhook = daysAgo(15);
  const cutoffRaw = daysAgo(7);
  const cutoffTrial = daysAgo(30);

  const removedRanking = await prisma.rankingEntry.deleteMany({
    where: { timestamp: { lt: cutoffRanking } }
  });

  const removedWebhookLogs = await prisma.webhookLog.deleteMany({
    where: { createdAt: { lt: cutoffWebhook } }
  });

  const removedRawWebhookLogs = await prisma.licenseWebhookRawLog.deleteMany({
    where: {
      createdAt: { lt: cutoffRaw },
      processed: true
    }
  });

  const removedResetTokens = await prisma.setting.deleteMany({
    where: { key: { startsWith: 'reset_token_' } }
  });

  const removedTrialHistory = await prisma.trialHistory.deleteMany({
    where: { trialStart: { lt: cutoffTrial } }
  });

  let aggressiveResult = {
    highlightsAll: 0,
    wishlistsAll: 0,
    outgoingWebhooksAll: 0,
    webhookRawAll: 0,
    trialFormsAll: 0,
    trialHistoryAll: 0
  };

  if (aggressive) {
    const [highlights, wishlists, outgoingWebhooks, webhookRawRemaining, trialForms, trialHistoryRemaining] =
      await Promise.all([
        prisma.highlight.deleteMany({}),
        prisma.wishlist.deleteMany({}),
        prisma.outgoingWebhook.deleteMany({}),
        prisma.licenseWebhookRawLog.deleteMany({}),
        prisma.trialForm.deleteMany({}),
        prisma.trialHistory.deleteMany({})
      ]);

    aggressiveResult = {
      highlightsAll: highlights.count,
      wishlistsAll: wishlists.count,
      outgoingWebhooksAll: outgoingWebhooks.count,
      webhookRawAll: webhookRawRemaining.count,
      trialFormsAll: trialForms.count,
      trialHistoryAll: trialHistoryRemaining.count
    };
  }

  await prisma.$executeRawUnsafe('VACUUM');

  const [licensesCount, productsCount, rankingCount] = await Promise.all([
    prisma.license.count(),
    prisma.product.count(),
    prisma.rankingEntry.count()
  ]);

  console.log(
    JSON.stringify(
      {
        mode: aggressive ? 'aggressive' : 'safe',
        removed: {
          rankingOlderThan30Days: removedRanking.count,
          webhookLogsOlderThan15Days: removedWebhookLogs.count,
          processedRawWebhookOlderThan7Days: removedRawWebhookLogs.count,
          resetTokens: removedResetTokens.count,
          trialHistoryOlderThan30Days: removedTrialHistory.count,
          ...aggressiveResult
        },
        kept: {
          licenses: licensesCount,
          products: productsCount,
          ranking: rankingCount
        }
      },
      null,
      2
    )
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
