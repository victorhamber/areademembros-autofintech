import { useEffect, useState } from 'react';
import { Download, Trophy, TrendingUp } from 'lucide-react';
import type { Lang } from '../i18n/translations';
import { t } from '../i18n/translations';
import './Ranking.css';

type RankingRow = {
  rank: number;
  usuario: string;
  corretora: string;
  robo: string;
  lucro_percent: string;
  /** id da linha em RankingEntry — mesmo contrato do plugin WP */
  setup_id?: number;
};

function setupDownloadHref(setupId: number) {
  return `/api/forex-rendimento/v1/download_setup?id=${setupId}`;
}

const PERIODS = [7, 15, 30] as const;
const TOP_N = 10;

export function Ranking({ lang }: { lang: Lang }) {
  const tr = t(lang);
  const [period, setPeriod] = useState<(typeof PERIODS)[number]>(7);
  const [ranking, setRanking] = useState<RankingRow[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/forex-rendimento/v1/get_ranking?period=${period}`)
      .then(r => r.json())
      .then((d: unknown) => {
        const rows = Array.isArray(d) ? (d as RankingRow[]) : [];
        setRanking(rows.slice(0, TOP_N));
      })
      .catch(() => setRanking([]))
      .finally(() => setLoading(false));
  }, [period]);

  const rows = ranking ?? [];

  return (
    <div className="ranking-page">
      <header className="ranking-hero">
        <div className="ranking-hero-icon" aria-hidden>
          <Trophy size={22} />
        </div>
        <div className="ranking-hero-text">
          <h1>{tr.ranking_title}</h1>
          <p>{tr.ranking_intro}</p>
        </div>
        <div className="ranking-hero-controls">
          <span className="ranking-toolbar-label">{tr.ranking_period_label}</span>
          <div className="ranking-pills">
            {PERIODS.map(p => (
              <button
                key={p}
                type="button"
                className={period === p ? 'ranking-pill active' : 'ranking-pill'}
                onClick={() => setPeriod(p)}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </header>

      {loading ? (
        <div className="ranking-state">
          <TrendingUp size={18} aria-hidden />
          <span>{tr.ranking_loading}</span>
        </div>
      ) : rows.length === 0 ? (
        <div className="ranking-empty">
          <div className="ranking-empty-icon" aria-hidden>
            <Trophy size={26} />
          </div>
          <h2>{tr.ranking_empty_title}</h2>
          <p>{tr.ranking_empty}</p>
        </div>
      ) : (
        <div className="ranking-grid">
          <section className="ranking-cards" aria-label={tr.ranking_title}>
            {rows.slice(0, 3).map((row) => (
              <article
                key={`podium-${row.setup_id ?? row.rank}-${row.usuario}-${row.robo}`}
                className="ranking-card"
              >
                <div className={`ranking-rank-badge rank-${row.rank}`}>{row.rank}</div>
                <div className="ranking-card-main">
                  <div className="ranking-user">{row.usuario}</div>
                  <div className="ranking-sub">
                    <span>{row.corretora || '—'}</span>
                    <span className="dot">•</span>
                    <span>{row.robo || '—'}</span>
                  </div>
                </div>
                <div className="ranking-card-trailing">
                  <div className="ranking-profit">{row.lucro_percent}</div>
                  {typeof row.setup_id === 'number' && row.setup_id > 0 ? (
                    <a
                      className="ranking-setup-link"
                      href={setupDownloadHref(row.setup_id)}
                      download
                      target="_blank"
                      rel="noopener noreferrer"
                      title={tr.ranking_download_setup}
                      aria-label={tr.ranking_download_setup}
                    >
                      <Download size={18} strokeWidth={2.25} aria-hidden />
                    </a>
                  ) : null}
                </div>
              </article>
            ))}
          </section>

          <section className="ranking-table-panel">
            <div className="ranking-table-head">
              <h2>{tr.ranking_table_title}</h2>
              <span className="ranking-table-hint">{tr.ranking_table_hint}</span>
            </div>
            <div className="ranking-table-wrap">
              <table className="ranking-table">
                <thead>
                  <tr>
                    <th>{tr.ranking_col_rank}</th>
                    <th>{tr.ranking_col_user}</th>
                    <th>{tr.ranking_col_broker}</th>
                    <th>{tr.ranking_col_robot}</th>
                    <th>{tr.ranking_col_profit}</th>
                    <th className="ranking-th-setup">{tr.ranking_col_setup}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(row => (
                    <tr key={`${row.setup_id ?? row.rank}-${row.usuario}-${row.robo}`}>
                      <td><span className="ranking-rank-chip">{row.rank}</span></td>
                      <td className="ranking-td-strong">{row.usuario}</td>
                      <td>{row.corretora || '—'}</td>
                      <td>{row.robo || '—'}</td>
                      <td className="ranking-td-profit">{row.lucro_percent}</td>
                      <td className="ranking-td-setup">
                        {typeof row.setup_id === 'number' && row.setup_id > 0 ? (
                          <a
                            className="ranking-setup-link ranking-setup-link--table"
                            href={setupDownloadHref(row.setup_id)}
                            download
                            target="_blank"
                            rel="noopener noreferrer"
                            title={tr.ranking_download_setup}
                            aria-label={tr.ranking_download_setup}
                          >
                            <Download size={18} strokeWidth={2.25} aria-hidden />
                          </a>
                        ) : (
                          <span className="ranking-setup-missing">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
