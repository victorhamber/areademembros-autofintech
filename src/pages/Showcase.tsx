import React, { useState, useEffect } from 'react';
import { t } from '../i18n/translations';
import type { Lang } from '../i18n/translations';
import './Showcase.css';
import { X, ShoppingCart } from 'lucide-react';
import { slugify } from '../utils/slug';

interface Ebook {
  id: string;
  title: string;
  author: string | null;
  description: string | null;
  coverUrl: string;
  salesUrl: string;
  category?: { name: string };
}

interface ShowcaseProps {
  lang: Lang;
  onBack: () => void;
  slug?: string | null;
}

export const Showcase: React.FC<ShowcaseProps> = ({ lang, onBack, slug }) => {
  const tr = t(lang);
  const [ebooks, setEbooks] = useState<Ebook[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEbook, setSelectedEbook] = useState<Ebook | null>(null);

  const activeSlug = (slug || '').trim().toLowerCase();
  const filteredEbooks = !activeSlug
    ? ebooks
    : ebooks.filter(e => {
        const cat = e.category?.name ? slugify(e.category.name) : '';
        return cat === activeSlug;
      });

  useEffect(() => {
    fetch('/api/public/ebooks')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setEbooks(data);
      })
      .catch(err => console.error('Failed to fetch showcase:', err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="showcase-container">
      <header className="showcase-header">
        <img src="/logo.png" alt="Readlyme" className="showcase-logo" />
        {!activeSlug && (
          <button className="showcase-back-btn" onClick={onBack}>
            {tr.showcase_back_btn}
          </button>
        )}
      </header>

      <div className="showcase-title-section">
        <h1 className="showcase-title">{tr.showcase_title}</h1>
        <p className="showcase-subtitle">{tr.showcase_description}</p>
      </div>

      {loading ? (
        <div className="showcase-grid">
          {[1,2,3,4,5,6].map(i => (
            <div key={i} className="skeleton-card" style={{ width: '100%', height: '300px' }}>
              <div className="skeleton-cover" style={{ width: '100%', height: '80%' }}></div>
              <div className="skeleton-text" style={{ width: '60%', height: '14px', marginTop: '12px' }}></div>
            </div>
          ))}
        </div>
      ) : (
        <div className="showcase-grid">
          {filteredEbooks.map(ebook => (
            <div 
              key={ebook.id} 
              className="showcase-card"
              onClick={() => setSelectedEbook(ebook)}
            >
              <div className="showcase-card-cover">
                <img src={ebook.coverUrl} alt={ebook.title} loading="lazy" />
                {ebook.category && (
                  <span className="showcase-card-badge">{ebook.category.name}</span>
                )}
              </div>
              <h3 className="showcase-card-title">{ebook.title}</h3>
              <p className="showcase-card-author">{ebook.author || 'Readlyme'}</p>
            </div>
          ))}
        </div>
      )}

      {/* QUICK VIEW MODAL */}
      {selectedEbook && (
        <div className="showcase-modal-overlay" onClick={() => setSelectedEbook(null)}>
          <div className="showcase-modal-content" onClick={e => e.stopPropagation()}>
            <button
              className="showcase-modal-close"
              onClick={() => setSelectedEbook(null)}
              aria-label="Fechar"
              title="Fechar"
            >
              <X size={20} />
            </button>
            
            <div className="showcase-modal-left">
              <img src={selectedEbook.coverUrl} alt={selectedEbook.title} className="showcase-modal-cover" />
            </div>

            <div className="showcase-modal-right">
              <span className="showcase-modal-tag">{selectedEbook.category?.name || 'Ebook Premium'}</span>
              <h2 className="showcase-modal-title">{selectedEbook.title}</h2>
              <p className="showcase-modal-author">by {selectedEbook.author || 'Readlyme'}</p>
              
              <div className="showcase-modal-description">
                {selectedEbook.description || tr.hero_subtitle_default}
              </div>

              <a 
                href={selectedEbook.salesUrl} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="showcase-buy-btn"
              >
                <ShoppingCart size={20} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
                {tr.showcase_buy_btn}
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
