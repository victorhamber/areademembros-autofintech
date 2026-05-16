import type { PrismaClient } from '@prisma/client';
import { log } from '../lib/logger.js';

/** Paridade com PerformanceEndpoint::get_period_start (PHP). */
function getPeriodStart(timestamp: Date, periodDays: number): number {
  const date = new Date(timestamp);
  let dayOfPeriod = date.getDate() % periodDays;
  if (dayOfPeriod === 0) dayOfPeriod = periodDays;
  const daysToSubtract = dayOfPeriod - 1;
  date.setDate(date.getDate() - daysToSubtract);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

export async function submitPerformance(prisma: PrismaClient, data: Record<string, unknown>) {
  const email_hash = String(data.email_hash || '').trim();
  const numero_conta = String(data.numero_conta || '').trim();
  const system_id = String(data.system_id || '').trim();
  const corretora = String(data.corretora || '').trim();
  const ativo = String(data.ativo || '').trim();
  const lucro = Number(data.lucro ?? 0);
  let drawdown = Number(data.drawdown ?? 0);
  let saldo_inicial = Number(data.saldo_inicial ?? 0);
  const saldo_final = Number(data.saldo_final ?? 0);
  let depositos = Number(data.depositos ?? 0);
  const setup_file = data.setup_file != null ? String(data.setup_file) : '';

  if (!email_hash || !numero_conta || !system_id || !setup_file) {
    return {
      status: 400,
      json: { status: 'error', message: 'Campos obrigatórios ausentes ou setup inválido.' }
    };
  }

  const timestamp = new Date();

  const existing_record = await prisma.rankingEntry.findFirst({
    where: { emailHash: email_hash, numeroConta: numero_conta, systemId: system_id, corretora, ativo }
  });

  let saldo_inicial_final = saldo_inicial;
  let depositos_final = depositos;
  let drawdown_final = Math.abs(drawdown);
  let lucro_liquido = 0;
  let lucro_percent = 0;

  if (existing_record) {
    const lastUpdate = existing_record.timestamp.getTime();
    const now = Date.now();
    const days_diff = Math.floor((now - lastUpdate) / (24 * 60 * 60 * 1000));
    log('INFO', `Performance Update - Days since last update: ${days_diff}`);

    const existing_drawdown = Math.abs(existing_record.drawdown);
    if (drawdown_final > existing_drawdown) {
      /* keep drawdown_final */
    } else {
      drawdown_final = existing_drawdown;
    }

    if (days_diff >= 30) {
      saldo_inicial_final = saldo_inicial;
      depositos_final = depositos;
    } else if (days_diff >= 15) {
      const period_start = getPeriodStart(existing_record.timestamp, 15);
      if (now >= period_start + 15 * 24 * 60 * 60 * 1000) {
        saldo_inicial_final = saldo_inicial;
        depositos_final = depositos;
      } else {
        saldo_inicial_final = existing_record.saldoInicial;
        depositos_final = (existing_record.depositos ?? 0) + depositos;
      }
    } else if (days_diff >= 7) {
      const period_start = getPeriodStart(existing_record.timestamp, 7);
      if (now >= period_start + 7 * 24 * 60 * 60 * 1000) {
        saldo_inicial_final = saldo_inicial;
        depositos_final = depositos;
      } else {
        saldo_inicial_final = existing_record.saldoInicial;
        depositos_final = (existing_record.depositos ?? 0) + depositos;
      }
    } else {
      saldo_inicial_final = existing_record.saldoInicial;
      depositos_final = (existing_record.depositos ?? 0) + depositos;
    }
  }

  if (saldo_inicial_final > 0) {
    lucro_liquido = saldo_final - saldo_inicial_final - depositos_final;
    lucro_percent = (lucro_liquido / saldo_inicial_final) * 100;
  } else {
    lucro_percent = 0;
  }

  const data_to_save = {
    emailHash: email_hash,
    numeroConta: numero_conta,
    systemId: system_id,
    corretora,
    ativo,
    lucro,
    lucroPercent: lucro_percent,
    drawdown: drawdown_final,
    saldoInicial: saldo_inicial_final,
    saldoFinal: saldo_final,
    depositos: depositos_final,
    setupFile: setup_file,
    timestamp
  };

  let recordId: number | string = 'NOVO';
  if (existing_record) {
    await prisma.rankingEntry.update({ where: { id: existing_record.id }, data: data_to_save });
    recordId = existing_record.id;
    log('INFO', `Performance atualizada - ID: ${existing_record.id}`);
  } else {
    const created = await prisma.rankingEntry.create({ data: data_to_save });
    recordId = created.id;
    log('INFO', `Performance inserida - ID: ${created.id}`);
  }

  return {
    status: 200,
    json: {
      status: 'success',
      message: 'Performance registrada com sucesso.',
      debug: {
        saldo_inicial_recebido: saldo_inicial,
        saldo_inicial_salvo: saldo_inicial_final,
        saldo_final,
        depositos_recebidos: depositos,
        depositos_acumulados: depositos_final,
        lucro_liquido_calculado: saldo_inicial_final > 0 ? lucro_liquido : 'N/A',
        drawdown_recebido: drawdown,
        drawdown_salvo: drawdown_final,
        drawdown_existente: existing_record ? Math.abs(existing_record.drawdown) : 'N/A',
        lucro_percent_corrigido: lucro_percent,
        update_result: 'SUCCESS',
        record_id: recordId
      }
    }
  };
}
