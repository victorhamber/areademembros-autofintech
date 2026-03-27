import React, { useRef, useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { t } from '../i18n/translations';
import type { Lang } from '../i18n/translations';
import './HTMLReader.css';

interface HTMLReaderProps {
  url: string;
  title: string;
  lang: Lang;
  onClose: () => void;
}

export const HTMLReader: React.FC<HTMLReaderProps> = ({ url, title, lang, onClose }) => {
  const tr = t(lang);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loading, setLoading] = useState(true);

  // Save/restore scroll position in sessionStorage per URL
  const scrollKey = `html_scroll_${url}`;

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const handleLoad = () => {
      setLoading(false);
      // Restore previous scroll position
      const saved = sessionStorage.getItem(scrollKey);
      if (saved && iframe.contentWindow) {
        try { iframe.contentWindow.scrollTo(0, parseInt(saved, 10)); } catch {}
      }
    };

    iframe.addEventListener('load', handleLoad);
    return () => iframe.removeEventListener('load', handleLoad);
  }, [scrollKey]);

  const handleClose = () => {
    // Save scroll before closing
    const iframe = iframeRef.current;
    if (iframe?.contentWindow) {
      try {
        sessionStorage.setItem(scrollKey, String(iframe.contentWindow.scrollY));
      } catch {}
    }
    onClose();
  };

  return (
    <div className="html-reader-container">
      <header className="html-reader-header">
        <button className="html-back-btn" onClick={handleClose} aria-label={tr.pdf_highlight_cancel}>
          <ArrowLeft size={24} />
        </button>
        <h2 className="html-reader-title">{title}</h2>
        {/* Spacer to keep title centered */}
        <div style={{ width: 44 }} />
      </header>

      {loading && (
        <div className="html-reader-loading">
          <div className="html-loading-spinner" />
          <span>{tr.pdf_loading}</span>
        </div>
      )}

      <iframe
        ref={iframeRef}
        src={url}
        className={`html-reader-iframe ${loading ? 'html-reader-iframe-hidden' : ''}`}
        title={title}
        sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
      />
    </div>
  );
};
