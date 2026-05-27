import type { PrismaClient } from '@prisma/client';
import { log } from '../lib/logger.js';
import { invalidateLicenseCacheForEmail } from '../lib/licenseValidationCache.js';
import { postRobotJson } from '../forex/robotNotify.js';

export function startScheduledJobs(prisma: PrismaClient) {
  const rankingRetentionDays = Number(process.env.RANKING_RETENTION_DAYS || 30);
  const webhookLogRetentionDays = Number(process.env.WEBHOOK_LOG_RETENTION_DAYS || 15);
  const rawWebhookRetentionDays = Number(process.env.RAW_WEBHOOK_RETENTION_DAYS || 7);
  const trialRetentionDays = Number(process.env.TRIAL_HISTORY_RETENTION_DAYS || 30);

  const hourly = async () => {
    const now = new Date();
    const expired = await prisma.license.findMany({
      where: { statusLicenca: 'ativa', dataExpiracao: { lt: now } }
    });
    for (const lic of expired) {
      await prisma.license.update({
        where: { id: lic.id },
        data: { statusLicenca: 'expirada' }
      });
      invalidateLicenseCacheForEmail(lic.email);
      log('INFO', `Licença ${lic.id} (${lic.email}) expirada.`);
      await postRobotJson(process.env.ROBOT_DEACTIVATE_URL, {
        email: lic.email,
        numero_conta: lic.numeroConta,
        system_id: lic.systemId
      });
    }
    if (!expired.length) log('DEBUG', 'Nenhuma licença expirada encontrada.');
  };

  const daily = async () => {
    const cutoffRank = new Date();
    cutoffRank.setDate(cutoffRank.getDate() - rankingRetentionDays);
    const r = await prisma.rankingEntry.deleteMany({ where: { timestamp: { lt: cutoffRank } } });
    log('SYSTEM', `Limpeza ranking (${rankingRetentionDays}d): removidos ${r.count} registros anteriores a ${cutoffRank.toISOString()}`);

    const cutoffWebhook = new Date();
    cutoffWebhook.setDate(cutoffWebhook.getDate() - webhookLogRetentionDays);
    const w = await prisma.webhookLog.deleteMany({ where: { createdAt: { lt: cutoffWebhook } } });
    log('SYSTEM', `Limpeza webhookLog (${webhookLogRetentionDays}d): removidos ${w.count}`);

    const cutoffRawWebhook = new Date();
    cutoffRawWebhook.setDate(cutoffRawWebhook.getDate() - rawWebhookRetentionDays);
    const rw = await prisma.licenseWebhookRawLog.deleteMany({
      where: {
        createdAt: { lt: cutoffRawWebhook },
        processed: true
      }
    });
    log('SYSTEM', `Limpeza licenseWebhookRawLog (${rawWebhookRetentionDays}d, processados): removidos ${rw.count}`);

    const cutoffTrial = new Date();
    cutoffTrial.setDate(cutoffTrial.getDate() - trialRetentionDays);
    const t = await prisma.trialHistory.deleteMany({ where: { trialStart: { lt: cutoffTrial } } });
    log('SYSTEM', `Limpeza trialHistory (${trialRetentionDays}d): removidos ${t.count}`);

    const resetTokens = await prisma.setting.deleteMany({
      where: { key: { startsWith: 'reset_token_' } }
    });
    log('SYSTEM', `Limpeza reset_token_*: removidos ${resetTokens.count}`);
  };

  setInterval(() => {
    hourly().catch(e => log('ERROR', 'hourly job', { err: String(e) }));
  }, 60 * 60 * 1000);

  setInterval(() => {
    daily().catch(e => log('ERROR', 'daily job', { err: String(e) }));
  }, 24 * 60 * 60 * 1000);

  setTimeout(() => {
    hourly().catch(() => {});
    daily().catch(() => {});
  }, 5000);

  log('INFO', 'Scheduler: jobs horário (expiração) e diário (limpeza de retenção) registrados.');
}
