import React from 'react';
import { BookRow } from '../components/BookRow';
import './Home.css';

interface HomeProps {
  books: any[];
  onRead: (title: string, coverUrl: string) => void;
  onToggleWishlist: (id: string) => void;
}

export const Home: React.FC<HomeProps> = ({ books, onRead, onToggleWishlist }) => {
  const handleBookClick = (id: string, hasAccess: boolean) => {
    const book = books.find(b => b.id === id);
    if (!book) return;
    
    if (hasAccess) {
      onRead(book.title, book.coverUrl);
    } else {
      alert(`Redirecionando para a página de vendas do livro ${book.title}`);
    }
  };

  const myBooks = books.filter(b => b.hasAccess);
  const mostRead = [...books].reverse();
  const newReleases = books.slice(0, 3);
  const wishlisted = books.filter(b => b.isWishlisted);

  return (
    <div style={{ paddingBottom: 'var(--spacing-lg)' }}>
      <div className="hero-banner">
        <div className="hero-content">
          <h1 className="hero-greeting">Boa noite, Victor!</h1>
          <p className="hero-subtitle">Sua próxima grande leitura te espera.</p>
        </div>
        <div className="hero-overlay"></div>
      </div>

      <div className="home-content">
        {myBooks.length > 0 && <BookRow title="Meus Livros" books={myBooks} onBookClick={handleBookClick} onToggleWishlist={onToggleWishlist} />}
        <BookRow title="Mais Lidos" books={mostRead} onBookClick={handleBookClick} onToggleWishlist={onToggleWishlist} />
        <BookRow title="Lançamentos" books={newReleases} onBookClick={handleBookClick} onToggleWishlist={onToggleWishlist} />
        {wishlisted.length > 0 && <BookRow title="Lista de Desejos" books={wishlisted} onBookClick={handleBookClick} onToggleWishlist={onToggleWishlist} />}
      </div>
    </div>
  );
};
