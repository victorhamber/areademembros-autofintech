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
      if (book.salesUrl) {
        window.open(book.salesUrl, '_blank');
      } else {
        alert('Este livro ainda não possui uma página de vendas cadastrada.');
      }
    }
  };

  // 1. Meus Livros
  const myBooks = books.filter(b => b.hasAccess);
  
  // 2. Mais Lidos (Sorted by actual sales / purchases length)
  // Backend returns `_count: { purchases: number }` for catalog items
  const mostRead = [...books].sort((a,b) => (b._count?.purchases || 0) - (a._count?.purchases || 0));
  
  // 3. Lançamentos (Sorted strictly by createdAt newest first)
  const newReleases = [...books].sort((a,b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()).reverse().slice(0, 10);
  
  // 4. Lista de Desejos
  const wishlisted = books.filter(b => b.isWishlisted);

  // 5. Categorized Lists & Featured Lists
  const categoriesMap = new Map<string, any[]>();
  const featuredMap = new Map<string, any[]>();

  books.forEach(book => {
    if (book.category && book.category.name) {
      if (!categoriesMap.has(book.category.name)) categoriesMap.set(book.category.name, []);
      categoriesMap.get(book.category.name)!.push(book);
    }
    if (book.featuredList) {
      if (!featuredMap.has(book.featuredList)) featuredMap.set(book.featuredList, []);
      featuredMap.get(book.featuredList)!.push(book);
    }
  });

  return (
    <div style={{ paddingBottom: 'var(--spacing-lg)' }}>
      <div className="hero-banner">
        <div className="hero-content">
          <h1 className="hero-greeting">Boas vindas à Plataforma!</h1>
          <p className="hero-subtitle">Sua próxima grande leitura te espera.</p>
        </div>
        <div className="hero-overlay"></div>
      </div>

      <div className="home-content">
        {myBooks.length > 0 && <BookRow title="Meus Livros Ativos" books={myBooks} onBookClick={handleBookClick} onToggleWishlist={onToggleWishlist} />}
        
        {/* Dynamic Manual / Featured Lists */}
        {Array.from(featuredMap.entries()).map(([listName, lstBooks]) => (
          <BookRow key={`featured-${listName}`} title={`✨ ${listName}`} books={lstBooks} onBookClick={handleBookClick} onToggleWishlist={onToggleWishlist} />
        ))}

        <BookRow title="Lançamentos" books={newReleases} onBookClick={handleBookClick} onToggleWishlist={onToggleWishlist} />
        <BookRow title="Mais Lidos" books={mostRead} onBookClick={handleBookClick} onToggleWishlist={onToggleWishlist} />
        
        {/* Dynamic Category Lists */}
        {Array.from(categoriesMap.entries()).map(([catName, catBooks]) => (
          <BookRow key={`cat-${catName}`} title={`📚 ${catName}`} books={catBooks} onBookClick={handleBookClick} onToggleWishlist={onToggleWishlist} />
        ))}

        {wishlisted.length > 0 && <BookRow title="Lista de Desejos" books={wishlisted} onBookClick={handleBookClick} onToggleWishlist={onToggleWishlist} />}
      </div>
    </div>
  );
};
