import React, { useState } from 'react';
import { BookRow } from '../components/BookRow';
import { Search } from 'lucide-react';
import './Home.css';

interface HomeProps {
  books: any[];
  onRead: (title: string, coverUrl: string) => void;
  onToggleWishlist: (id: string) => void;
  isLoading?: boolean;
  userEmail?: string | null;
  userName?: string | null;
}

export const Home: React.FC<HomeProps> = ({ books, onRead, onToggleWishlist, isLoading, userEmail, userName }) => {
  const [searchQuery, setSearchQuery] = useState('');

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

  // DYNAMIC GREETING
  const getGreeting = () => {
    const hour = new Date().getHours();
    const name = userName || (userEmail ? userEmail.split('@')[0].charAt(0).toUpperCase() + userEmail.split('@')[0].slice(1) : '');
    if (hour < 12) return `Bom dia, ${name}!`;
    if (hour < 18) return `Boa tarde, ${name}!`;
    return `Boa noite, ${name}!`;
  };

  // DYNAMIC HERO BANNER
  const heroCover = books.length > 0 ? books[0].coverUrl : null;

  // SEARCH FILTER
  const filteredBooks = searchQuery.trim()
    ? books.filter(b => 
        b.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (b.author && b.author.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : null;

  // 1. Meus Livros
  const myBooks = books.filter(b => b.hasAccess);
  
  // 2. Mais Lidos (Sorted by actual sales)
  const mostRead = [...books].sort((a,b) => (b._count?.purchases || 0) - (a._count?.purchases || 0));
  
  // 3. Lançamentos (Newest first — BUG FIX: removed .reverse())
  const newReleases = [...books].sort((a,b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()).slice(0, 10);
  
  // 4. Lista de Desejos
  const wishlisted = books.filter(b => b.isWishlisted);

  // 5. Categories & Featured Lists
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

  // Loading skeleton
  if (isLoading) {
    return (
      <div style={{ paddingBottom: 'var(--spacing-lg)' }}>
        <div className="hero-banner hero-skeleton"></div>
        <div className="home-content">
          <div className="skeleton-row">
            <div className="skeleton-title"></div>
            <div className="skeleton-cards">
              {[1,2,3,4].map(i => <div key={i} className="skeleton-card"><div className="skeleton-cover"></div><div className="skeleton-text"></div></div>)}
            </div>
          </div>
          <div className="skeleton-row">
            <div className="skeleton-title"></div>
            <div className="skeleton-cards">
              {[1,2,3].map(i => <div key={i} className="skeleton-card"><div className="skeleton-cover"></div><div className="skeleton-text"></div></div>)}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: 'var(--spacing-lg)' }}>
      <div className="hero-banner" style={heroCover ? { backgroundImage: `url(${heroCover})` } : undefined}>
        <div className="hero-content">
          <h1 className="hero-greeting">{getGreeting()}</h1>
          <p className="hero-subtitle">Sua próxima grande leitura te espera.</p>
        </div>
        <div className="hero-overlay"></div>
      </div>

      {/* SEARCH BAR */}
      <div className="search-container">
        <Search size={18} className="search-icon" />
        <input 
          type="text" 
          placeholder="Buscar por título ou autor..." 
          value={searchQuery} 
          onChange={e => setSearchQuery(e.target.value)} 
          className="search-input"
        />
      </div>

      <div className="home-content">
        {/* SEARCH RESULTS MODE */}
        {filteredBooks !== null ? (
          filteredBooks.length > 0 ? (
            <BookRow title={`Resultados para "${searchQuery}"`} books={filteredBooks} onBookClick={handleBookClick} onToggleWishlist={onToggleWishlist} />
          ) : (
            <div className="empty-search">
              <p>Nenhum livro encontrado para "<strong>{searchQuery}</strong>"</p>
            </div>
          )
        ) : (
          <>
            {myBooks.length > 0 && <BookRow title="Meus Livros" books={myBooks} onBookClick={handleBookClick} onToggleWishlist={onToggleWishlist} />}
            
            {Array.from(featuredMap.entries()).map(([listName, lstBooks]) => (
              <BookRow key={`featured-${listName}`} title={`✨ ${listName}`} books={lstBooks} onBookClick={handleBookClick} onToggleWishlist={onToggleWishlist} />
            ))}

            <BookRow title="Lançamentos" books={newReleases} onBookClick={handleBookClick} onToggleWishlist={onToggleWishlist} />
            <BookRow title="Mais Lidos" books={mostRead} onBookClick={handleBookClick} onToggleWishlist={onToggleWishlist} />
            
            {Array.from(categoriesMap.entries()).map(([catName, catBooks]) => (
              <BookRow key={`cat-${catName}`} title={`📚 ${catName}`} books={catBooks} onBookClick={handleBookClick} onToggleWishlist={onToggleWishlist} />
            ))}

            {wishlisted.length > 0 && <BookRow title="Lista de Desejos" books={wishlisted} onBookClick={handleBookClick} onToggleWishlist={onToggleWishlist} />}
          </>
        )}
      </div>
    </div>
  );
};
