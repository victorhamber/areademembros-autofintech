import React, { useRef, useState } from 'react';
import { BookCard } from './BookCard';
import './BookRow.css';

interface BookRowProps {
  title: string;
  books: any[];
  onBookClick: (id: string, hasAccess: boolean) => void;
  onToggleWishlist: (id: string) => void;
}

export const BookRow: React.FC<BookRowProps> = ({ title, books, onBookClick, onToggleWishlist }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isMoved, setIsMoved] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  const startDragging = (e: React.MouseEvent) => {
    setIsDragging(true);
    setIsMoved(false);
    if (!scrollRef.current) return;
    setStartX(e.pageX - scrollRef.current.offsetLeft);
    setScrollLeft(scrollRef.current.scrollLeft);
  };

  const stopDragging = () => {
    setIsDragging(false);
  };

  const onDrag = (e: React.MouseEvent) => {
    if (!isDragging || !scrollRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollRef.current.offsetLeft;
    const walk = (x - startX) * 2;
    if (Math.abs(x - startX) > 5) {
      setIsMoved(true); // Only flag as a drag if moved more than 5px
    }
    scrollRef.current.scrollLeft = scrollLeft - walk;
  };

  const handleClick = (id: string, hasAccess: boolean) => {
    if (isMoved) return; // Prevent triggering if it was a drag
    onBookClick(id, hasAccess);
  };

  const handleWishlist = (id: string) => {
    if (isMoved) return;
    onToggleWishlist(id);
  };

  return (
    <div className="book-row-container">
      <h2 className="row-title">{title}</h2>
      <div 
        className={`row-scroll ${isDragging ? 'dragging' : ''}`}
        ref={scrollRef}
        onMouseDown={startDragging}
        onMouseLeave={stopDragging}
        onMouseUp={stopDragging}
        onMouseMove={onDrag}
      >
        {books.map(book => (
          <BookCard 
            key={book.id} 
            {...book} 
            onClick={handleClick} 
            onToggleWishlist={handleWishlist}
          />
        ))}
      </div>
    </div>
  );
};
