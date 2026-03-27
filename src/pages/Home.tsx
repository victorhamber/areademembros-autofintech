import React, { useState, useEffect } from 'react';
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
  const [selectedCategory, setSelectedCategory] = useState('Tudo');

  const handleBookClick = (id: string, hasAccess: boolean) => {
    const book = books.find(b => b.id === id);
    if (!book) return;
    
    if (hasAccess) {
      onRead(book.title, book.coverUrl);
    } else {
      if (book.salesUrl) {
        // Native anchor tag <a className="hotmart-fb"> already handles Hotmart widget opening natively.
        if (book.salesUrl.includes('pay.hotmart.com') && book.salesUrl.includes('checkoutMode=')) {
          return;
        }
        // Standard external sales page
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

  // DYNAMIC HERO BANNER - Auto-rotating carousel
  const [heroIndex, setHeroIndex] = useState(0);
  const booksWithCovers = books.filter(b => b.coverUrl);
  
  useEffect(() => {
    if (booksWithCovers.length <= 1) return;
    const interval = setInterval(() => {
      setHeroIndex(prev => (prev + 1) % booksWithCovers.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [booksWithCovers.length]);
  
  const heroBook = booksWithCovers.length > 0 ? booksWithCovers[heroIndex % booksWithCovers.length] : null;

  // SEARCH FILTER
  const filteredBooks = searchQuery.trim()
    ? books.filter(b => 
        b.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (b.author && b.author.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : null;

  // 1. Meus Livros
  const myBooks = books.filter(b => b.hasAccess);
  
  // 2. Mais Lidos (Sorted by actual sales, strictly > 0)
  const mostRead = [...books]
    .filter(b => (b._count?.purchases || 0) > 0)
    .sort((a,b) => (b._count?.purchases || 0) - (a._count?.purchases || 0));
  
  // 3. Lançamentos (Newest first, limited to last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const newReleases = [...books]
    .filter(b => new Date(b.createdAt || 0).getTime() > thirtyDaysAgo.getTime())
    .sort((a,b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
    .slice(0, 10);
  
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

  const categoryNames = ['Tudo', ...Array.from(categoriesMap.keys()).sort()];

  // FILTER LOGIC FOR CHIPS
  const isCategoryMatch = (b: any) => selectedCategory === 'Tudo' || b.category?.name === selectedCategory;

  const displayMyBooks = myBooks.filter(isCategoryMatch);
  const displayMostRead = mostRead.filter(isCategoryMatch);
  const displayNewReleases = newReleases.filter(isCategoryMatch);
  const displayWishlisted = wishlisted.filter(isCategoryMatch);

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

  const isHeroHotmart = heroBook && !heroBook.hasAccess && heroBook.salesUrl?.includes('pay.hotmart.com') && heroBook.salesUrl?.includes('checkoutMode=');

  const heroContent = (
    <>
      <div className="hero-content">
        <h1 className="hero-greeting">{getGreeting()}</h1>
        <p className="hero-subtitle">
          {heroBook ? `Destaque: ${heroBook.title}` : 'Sua próxima grande leitura te espera.'}
        </p>
      </div>
      <div className="hero-overlay"></div>
    </>
  );

  return (
    <div style={{ paddingBottom: 'var(--spacing-lg)' }}>
      {isHeroHotmart && heroBook ? (
        <a 
          href={heroBook.salesUrl}
          className="hero-banner hotmart-fb" 
          onClick={() => handleBookClick(heroBook.id, heroBook.hasAccess)}
          style={{ cursor: 'pointer', backgroundImage: `url(${heroBook.coverUrl})`, display: 'flex', textDecoration: 'none' }}
        >
          {heroContent}
        </a>
      ) : (
        <div 
          className="hero-banner" 
          onClick={() => heroBook && handleBookClick(heroBook.id, heroBook.hasAccess)}
          style={{ cursor: heroBook ? 'pointer' : 'default', ...(heroBook ? { backgroundImage: `url(${heroBook.coverUrl})` } : {}) }}
        >
          {heroContent}
        </div>
      )}

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

      {/* CATEGORY PILLS */}
      {!searchQuery && categoryNames.length > 1 && (
        <div className="category-pills-container">
          {categoryNames.map(cat => (
            <button
              key={cat}
              className={`category-pill ${selectedCategory === cat ? 'active' : ''}`}
              onClick={() => setSelectedCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

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
            {displayMyBooks.length > 0 && <BookRow title="Meus Livros" books={displayMyBooks} onBookClick={handleBookClick} onToggleWishlist={onToggleWishlist} />}
            
            {Array.from(featuredMap.entries()).map(([listName, lstBooks]) => {
              const displayFeatured = lstBooks.filter(isCategoryMatch);
              if (displayFeatured.length === 0) return null;
              return <BookRow key={`featured-${listName}`} title={listName} books={displayFeatured} onBookClick={handleBookClick} onToggleWishlist={onToggleWishlist} />;
            })}

            {displayNewReleases.length > 0 && <BookRow title="Lançamentos" books={displayNewReleases} onBookClick={handleBookClick} onToggleWishlist={onToggleWishlist} />}
            {displayMostRead.length > 0 && <BookRow title="Mais Lidos" books={displayMostRead} onBookClick={handleBookClick} onToggleWishlist={onToggleWishlist} />}
            
            {Array.from(categoriesMap.entries()).map(([catName, catBooks]) => {
              if (selectedCategory !== 'Tudo' && catName !== selectedCategory) return null;
              return <BookRow key={`cat-${catName}`} title={catName} books={catBooks} onBookClick={handleBookClick} onToggleWishlist={onToggleWishlist} />;
            })}

            {displayWishlisted.length > 0 && <BookRow title="Lista de Desejos" books={displayWishlisted} onBookClick={handleBookClick} onToggleWishlist={onToggleWishlist} />}
          </>
        )}
      </div>
    </div>
  );
};
