import React, { useState, useEffect } from 'react';
import { BookRow } from '../components/BookRow';
import { Search } from 'lucide-react';
import { t } from '../i18n/translations';
import type { Lang } from '../i18n/translations';
import './Home.css';

interface HomeProps {
  books: any[];
  onRead: (title: string, coverUrl: string) => void;
  onToggleWishlist: (id: string) => void;
  isLoading?: boolean;
  userEmail?: string | null;
  userName?: string | null;
  lang: Lang;
  setLang: (l: Lang) => void;
}

export const Home: React.FC<HomeProps> = ({ books, onRead, onToggleWishlist, isLoading, userEmail, userName, lang, setLang }) => {
  const tr = t(lang);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');

  // Reset category pill when lang changes so label matches
  useEffect(() => { setSelectedCategory(''); }, [lang]);

  const handleBookClick = (id: string, hasAccess: boolean) => {
    const book = books.find(b => b.id === id);
    if (!book) return;
    
    if (hasAccess) {
      onRead(book.title, book.coverUrl);
    } else {
      if (book.salesUrl) {
        if (book.salesUrl.includes('pay.hotmart.com')) {
          return;
        }
        window.open(book.salesUrl, '_blank');
      } else {
        alert(tr.no_sales_url);
      }
    }
  };

  // DYNAMIC GREETING
  const getGreeting = () => {
    const hour = new Date().getHours();
    const name = userName || (userEmail ? userEmail.split('@')[0].charAt(0).toUpperCase() + userEmail.split('@')[0].slice(1) : '');
    if (hour < 12) return `${tr.greeting_morning}, ${name}!`;
    if (hour < 18) return `${tr.greeting_afternoon}, ${name}!`;
    return `${tr.greeting_evening}, ${name}!`;
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
  
  // HOTMART WIDGET SPA RACE CONDITION FIX
  useEffect(() => {
    if (!isLoading && books.length > 0) {
      const timer = setTimeout(() => {
        const id = 'hotmart-logic-script';
        const existing = document.getElementById(id);
        if (existing) existing.remove();
        
        const script = document.createElement('script');
        script.id = id;
        script.src = 'https://static.hotmart.com/checkout/widget.min.js';
        script.async = true;
        document.body.appendChild(script);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isLoading, books.length]);

  const heroBook = booksWithCovers.length > 0 ? booksWithCovers[heroIndex % booksWithCovers.length] : null;

  // SEARCH FILTER
  const filteredBooks = searchQuery.trim()
    ? books.filter(b => 
        b.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (b.author && b.author.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : null;

  // Sections
  const myBooks = books.filter(b => b.hasAccess);
  const mostRead = [...books]
    .filter(b => (b._count?.purchases || 0) > 0)
    .sort((a,b) => (b._count?.purchases || 0) - (a._count?.purchases || 0));
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const newReleases = [...books]
    .filter(b => new Date(b.createdAt || 0).getTime() > thirtyDaysAgo.getTime())
    .sort((a,b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
    .slice(0, 10);
  const wishlisted = books.filter(b => b.isWishlisted);

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

  // "All" pill label comes from translations
  const allLabel = tr.category_all;
  const categoryNames = [allLabel, ...Array.from(categoriesMap.keys()).sort()];
  const activeCategory = selectedCategory || allLabel;

  const isCategoryMatch = (b: any) => activeCategory === allLabel || b.category?.name === activeCategory;

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

  const isHeroHotmart = heroBook && !heroBook.hasAccess && heroBook.salesUrl?.includes('pay.hotmart.com');

  const heroContent = (
    <>
      <div className="hero-content">
        <h1 className="hero-greeting">{getGreeting()}</h1>
        <p className="hero-subtitle">
          {heroBook ? `${tr.hero_subtitle_book}: ${heroBook.title}` : tr.hero_subtitle_default}
        </p>
      </div>
      <div className="hero-overlay"></div>

      {/* ── Language Switcher ── */}
      <div className="lang-switcher" onClick={e => e.stopPropagation()}>
        <button
          className={`lang-btn ${lang === 'pt' ? 'active' : ''}`}
          onClick={() => setLang('pt')}
          title="Português"
          aria-label="Português"
        >
          🇧🇷
        </button>
        <button
          className={`lang-btn ${lang === 'es' ? 'active' : ''}`}
          onClick={() => setLang('es')}
          title="Español"
          aria-label="Español"
        >
          🇪🇸
        </button>
      </div>
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
          placeholder={tr.search_placeholder}
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
              className={`category-pill ${activeCategory === cat ? 'active' : ''}`}
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
            <BookRow title={`${tr.search_results_title} "${searchQuery}"`} books={filteredBooks} onBookClick={handleBookClick} onToggleWishlist={onToggleWishlist} />
          ) : (
            <div className="empty-search">
              <p>{tr.no_results} "<strong>{searchQuery}</strong>"</p>
            </div>
          )
        ) : (
          <>
            {displayMyBooks.length > 0 && <BookRow title={tr.section_my_books} books={displayMyBooks} onBookClick={handleBookClick} onToggleWishlist={onToggleWishlist} />}
            
            {Array.from(featuredMap.entries()).map(([listName, lstBooks]) => {
              const displayFeatured = lstBooks.filter(isCategoryMatch);
              if (displayFeatured.length === 0) return null;
              return <BookRow key={`featured-${listName}`} title={listName} books={displayFeatured} onBookClick={handleBookClick} onToggleWishlist={onToggleWishlist} />;
            })}

            {displayNewReleases.length > 0 && <BookRow title={tr.section_new_releases} books={displayNewReleases} onBookClick={handleBookClick} onToggleWishlist={onToggleWishlist} />}
            {displayMostRead.length > 0 && <BookRow title={tr.section_most_read} books={displayMostRead} onBookClick={handleBookClick} onToggleWishlist={onToggleWishlist} />}
            
            {Array.from(categoriesMap.entries()).map(([catName, catBooks]) => {
              if (activeCategory !== allLabel && catName !== activeCategory) return null;
              return <BookRow key={`cat-${catName}`} title={catName} books={catBooks} onBookClick={handleBookClick} onToggleWishlist={onToggleWishlist} />;
            })}

            {displayWishlisted.length > 0 && <BookRow title={tr.section_wishlist} books={displayWishlisted} onBookClick={handleBookClick} onToggleWishlist={onToggleWishlist} />}
          </>
        )}
      </div>
    </div>
  );
};
