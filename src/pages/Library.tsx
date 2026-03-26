import React from 'react';
import { BookCard } from '../components/BookCard';
import { PlayCircle } from 'lucide-react';
import './Library.css';

interface LibraryProps {
  books: any[];
  onRead: (title: string, coverUrl: string) => void;
  onToggleWishlist: (id: string) => void;
}

export const Library: React.FC<LibraryProps> = ({ books, onRead, onToggleWishlist }) => {
  const purchasedBooks = books.filter(b => b.hasAccess);
  const currentlyReading = purchasedBooks.filter(b => b.isReading);

  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const [isMoved, setIsMoved] = React.useState(false);
  const [startX, setStartX] = React.useState(0);
  const [scrollLeft, setScrollLeft] = React.useState(0);

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
      setIsMoved(true); // Drag occurred
    }
    scrollRef.current.scrollLeft = scrollLeft - walk;
  };

  const handleContinueClick = (title: string, coverUrl: string) => {
    if (isMoved) return; // Prevent opening if it was a drag
    onRead(title, coverUrl);
  };

  return (
    <div style={{ padding: 'var(--spacing-lg) var(--spacing-md)' }}>
      <h1 style={{ marginBottom: 'var(--spacing-lg)' }}>Sua Biblioteca</h1>
      
      {currentlyReading.length > 0 && (
        <div className="continue-reading-section">
          <h2 style={{ fontSize: '18px', marginBottom: 'var(--spacing-sm)' }}>Continuar Leitura</h2>
          <div 
            className={`continue-reading-scroll ${isDragging ? 'dragging' : ''}`} 
            style={{ display: 'flex', gap: 'var(--spacing-md)', overflowX: 'auto', paddingBottom: 'var(--spacing-sm)' }}
            ref={scrollRef}
            onMouseDown={startDragging}
            onMouseLeave={stopDragging}
            onMouseUp={stopDragging}
            onMouseMove={onDrag}
          >
            {currentlyReading.map(book => (
              <div key={book.id} className="continue-card" onClick={() => handleContinueClick(book.title, book.coverUrl)}>
                <img src={book.coverUrl} alt={book.title} className="continue-cover" draggable={false} />
                <div className="continue-info">
                  <h3>{book.title}</h3>
                  <p>Capítulo 4 • 45% concluído</p>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: '45%' }}></div>
                  </div>
                </div>
                <button className="play-btn">
                  <PlayCircle size={32} strokeWidth={1.5} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <h2 style={{ fontSize: '18px', marginBottom: 'var(--spacing-md)' }}>Todos os Livros</h2>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-md)' }}>
        {purchasedBooks.map(book => (
          <BookCard 
            key={book.id} 
            {...book} 
            onClick={() => onRead(book.title, book.coverUrl)} 
            onToggleWishlist={onToggleWishlist}
          />
        ))}
      </div>
    </div>
  );
};
