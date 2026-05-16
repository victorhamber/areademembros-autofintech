import type { PrismaClient } from '@prisma/client';
import type { RankingEntry } from '@prisma/client';
import { emailToHash } from '../lib/emailHash.js';

function groupKey(r: RankingEntry) {
  return `${r.emailHash}|${r.numeroConta}|${r.corretora}|${r.systemId}|${r.ativo}`;
}

/** Por grupo, mantém a linha com maior lucroPercent (proxy do ORDER BY do plugin). */
function pickTopPerGroup(rows: RankingEntry[]): RankingEntry[] {
  const map = new Map<string, RankingEntry>();
  for (const r of rows) {
    const k = groupKey(r);
    const cur = map.get(k);
    if (!cur || r.lucroPercent > cur.lucroPercent) map.set(k, r);
  }
  return [...map.values()].sort((a, b) => b.lucroPercent - a.lucroPercent).slice(0, 10);
}

export async function getRankingResponse(prisma: PrismaClient, period: number) {
  const p = [7, 15, 30].includes(period) ? period : 7;
  const since = new Date();
  since.setDate(since.getDate() - p);

  const rows = await prisma.rankingEntry.findMany({ where: { timestamp: { gte: since } } });
  const top = pickTopPerGroup(rows);

  const licenses = await prisma.license.findMany({
    where: { buyerName: { not: null } },
    select: { email: true, buyerName: true, numeroConta: true, systemId: true }
  });

  const ranking: object[] = [];
  let rank = 1;
  for (const row of top) {
    let buyer_name: string | null = null;
    if (row.numeroConta) {
      for (const lic of licenses) {
        if (lic.numeroConta === row.numeroConta && lic.systemId === row.systemId && emailToHash(lic.email) === row.emailHash) {
          buyer_name = lic.buyerName;
          break;
        }
      }
    }
    if (!buyer_name) {
      for (const lic of licenses) {
        if (lic.systemId === row.systemId && emailToHash(lic.email) === row.emailHash) {
          buyer_name = lic.buyerName;
          break;
        }
      }
    }
    if (!buyer_name) {
      for (const lic of licenses) {
        if (emailToHash(lic.email) === row.emailHash && lic.buyerName) {
          buyer_name = lic.buyerName;
          break;
        }
      }
    }

    let usuario: string;
    if (buyer_name?.trim()) {
      usuario = buyer_name.trim().split(/\s+/)[0]!;
    } else {
      usuario = row.emailHash;
    }

    const lucro_percent = Math.round(row.lucroPercent * 100) / 100;
    const lucroStr = lucro_percent > 0 ? `+${lucro_percent}` : String(lucro_percent);

    ranking.push({
      rank: rank++,
      usuario,
      corretora: row.corretora,
      robo: row.systemId,
      ativo: row.ativo,
      lucro_percent: lucroStr,
      drawdown: Math.abs(Math.round(row.drawdown * 100) / 100),
      saldo_inicial: row.saldoInicial.toFixed(2),
      saldo_final: row.saldoFinal.toFixed(2),
      depositos: (row.depositos ?? 0).toFixed(2),
      setup_id: row.id
    });
  }

  return ranking;
}
