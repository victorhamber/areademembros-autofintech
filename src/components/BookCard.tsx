import React from 'react';
import { Bookmark, Lock } from 'lucide-react';
import './BookCard.css';

import { t } from '../i18n/translations';
import type { Lang } from '../i18n/translations';

interface BookCardProps {
  id: string;
  title: string;
  author: string;
  description?: string;
  coverUrl: string;
  hasAccess?: boolean;
  isWishlisted?: boolean;
  salesUrl?: string;
  isBonus?: boolean;
  lang?: Lang;
  onClick: (e: React.MouseEvent, id: string, hasAccess: boolean) => void;
  onToggleWishlist?: (id: string) => void;
}

export const BookCard: React.FC<BookCardProps> = ({ 
  id, 
  title, 
  author, 
  description,
  coverUrl, 
  hasAccess = false, 
  isWishlisted = false,
  salesUrl,
  isBonus = false,
  lang = 'pt',
  onClick,
  onToggleWishlist
}) => {
  const isHotmart = !hasAccess && salesUrl && salesUrl.includes('pay.hotmart.com');
  const tr = t(lang);

  const content = (
    <>
      <div className="cover-container">
        <img 
          src={coverUrl} 
          alt={title} 
          className="book-cover" 
          loading="lazy" 
          draggable={false} 
          style={{ filter: !hasAccess ? 'grayscale(100%)' : 'none' }}
        />
        
        {hasAccess && <div className="badge-access">{isBonus ? tr.badge_bonus : tr.badge_purchased}</div>}
        
        {/* Lock overlay for books without access */}
        {!hasAccess && (
          <div className="lock-overlay">
            <Lock size={20} strokeWidth={2.5} />
          </div>
        )}
        
        {/* Wishlist Button Overlay */}
        <button 
          className="wishlist-btn"
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            if (onToggleWishlist) onToggleWishlist(id);
          }}
          aria-label={isWishlisted ? "Remover dos favoritos" : "Adicionar aos favoritos"}
        >
          <Bookmark 
            size={18} 
            color={isWishlisted ? "var(--accent-primary)" : "#fff"} 
            fill={isWishlisted ? "var(--accent-primary)" : "transparent"} 
            strokeWidth={1.5}
          />
        </button>
      </div>
      <div className="book-info">
        <h3 className="book-title">{title}</h3>
        {description ? (
          <p className="book-description">{description}</p>
        ) : (
          <p className="book-author">{author}</p>
        )}
      </div>
    </>
  );

  if (isHotmart) {
    return (
      <a href={salesUrl} className="book-card fade-in hotmart-fb" onClick={(e) => onClick(e, id, hasAccess)} style={{ textDecoration: 'none' }}>
        {content}
      </a>
    );
  }

  return (
    <div className="book-card fade-in" onClick={(e) => onClick(e, id, hasAccess)}>
      {content}
    </div>
  );
};
