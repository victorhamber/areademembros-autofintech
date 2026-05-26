import React, { useEffect, useState } from 'react';
import { Download as DownloadIcon, FileDown } from 'lucide-react';
import { t } from '../i18n/translations';
import type { Lang } from '../i18n/translations';
import './Library.css';

interface LibraryProps {
  books: any[]; // mantido por compatibilidade com App.tsx
  onRead: (title: string, coverUrl: string) => void; // mantido por compatibilidade
  onToggleWishlist: (id: string) => void; // mantido por compatibilidade
  isLoading?: boolean;
  lang: Lang;
}

export const Library: React.FC<LibraryProps> = ({ isLoading, lang }) => {
  const tr = t(lang);
  const [downloads, setDownloads] = useState<
    Array<{
      id: number;
      productName: string;
      systemId: string;
      description: string | null;
      downloadUrl: string | null;
      downloadFileName: string | null;
      downloadVersion: string | null;
    }>
  >([]);
  const [loadingDownloads, setLoadingDownloads] = useState(true);

  useEffect(() => {
    const tok = localStorage.getItem('contentpro_token');
    const userId = localStorage.getItem('contentpro_userId');
    const h: Record<string, string> = {};
    if (userId) h['x-user-id'] = userId;
    if (tok) h['Authorization'] = `Bearer ${tok}`;
    fetch('/api/me/downloads', { headers: h })
      .then(r => r.json())
      .then((d: unknown) => {
        const rows = (d as { downloads?: unknown }).downloads;
        if (Array.isArray(rows)) setDownloads(rows as typeof downloads);
        else setDownloads([]);
      })
      .catch(() => setDownloads([]))
      .finally(() => setLoadingDownloads(false));
  }, []);

  // EMPTY STATE
  if (!isLoading && !loadingDownloads && downloads.length === 0) {
    return (
      <div className="library-empty">
        <div className="empty-icon-wrapper">
          <DownloadIcon size={48} strokeWidth={1.2} />
        </div>
        <h2>{tr.downloads_empty_title}</h2>
        <p>{tr.downloads_empty_desc}</p>
      </div>
    );
  }

  return (
    <div style={{ padding: 'var(--spacing-lg) var(--spacing-md)' }}>
      <h1 style={{ marginBottom: 'var(--spacing-lg)' }}>{tr.downloads_title}</h1>

      <h2 style={{ fontSize: '18px', marginBottom: 'var(--spacing-md)' }}>{tr.downloads_section_entitled}</h2>

      {loadingDownloads ? (
        <p style={{ color: 'var(--text-secondary)', padding: '8px 0' }}>{tr.downloads_loading}</p>
      ) : (
        <div className="downloads-grid">
          {downloads.map((row) => (
            <article key={row.id} className="download-card">
              <div className="download-card-head">
                <strong className="download-title">{row.productName}</strong>
                {row.downloadVersion && <span className="download-badge">v{row.downloadVersion}</span>}
              </div>
              {row.description && <p className="download-desc">{row.description}</p>}
              <div className="download-meta">
                <span className="download-meta-item">{row.downloadFileName || 'Arquivo'}</span>
              </div>
              {row.downloadUrl ? (
                <a className="download-btn" href={row.downloadUrl} download target="_blank" rel="noopener noreferrer">
                  <FileDown size={18} /> Baixar
                </a>
              ) : (
                <button className="download-btn" disabled>
                  <FileDown size={18} /> Indisponível
                </button>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
};
