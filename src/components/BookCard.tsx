import React from 'react';
import { Bookmark } from 'lucide-react';
import './BookCard.css';

interface BookCardProps {
  id: string;
  title: string;
  author: string;
  coverUrl: string;
  hasAccess?: boolean;
  isWishlisted?: boolean;
  onClick: (id: string, hasAccess: boolean) => void;
  onToggleWishlist?: (id: string) => void;
}

export const BookCard: React.FC<BookCardProps> = ({ 
  id, 
  title, 
  author, 
  coverUrl, 
  hasAccess = false, 
  isWishlisted = false,
  onClick,
  onToggleWishlist
}) => {
  return (
    <div className="book-card" onClick={() => onClick(id, hasAccess)}>
      <div className="cover-container">
        <img src={coverUrl} alt={title} className="book-cover" loading="lazy" draggable={false} />
        {hasAccess && <div className="badge-access">Comprado</div>}
        
        {/* Wishlist Button Overlay */}
        <button 
          className="wishlist-btn"
          onClick={(e) => {
            e.stopPropagation(); // Prevents opening the book when clicking the bookmark
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
        <p className="book-author">{author}</p>
      </div>
    </div>
  );
};
