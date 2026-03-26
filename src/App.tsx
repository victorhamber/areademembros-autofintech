import { useState, useEffect } from 'react'
import { Home as HomeIcon, Library as LibraryIcon, Settings as SettingsIcon } from 'lucide-react'
import { Home } from './pages/Home'
import { Library } from './pages/Library'
import { Login } from './pages/Login'
import { Admin } from './pages/Admin'
import { PDFReader } from './components/PDFReader'
import './App.css'

function App() {
  if (window.location.pathname === '/admin') {
    return <Admin />
  }

  const [userId, setUserId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('home')
  const [readerData, setReaderData] = useState<{url: string, title: string} | null>(null)
  
  const [catalog, setCatalog] = useState<any[]>([])
  const [myBooksData, setMyBooksData] = useState<any[]>([])

  useEffect(() => {
    if (userId) {
      // Buscar catálogo completo
      fetch('/api/ebooks')
        .then(r => r.json())
        .then(data => {
          if (Array.isArray(data)) setCatalog(data);
        })
        .catch(console.error);

      // Buscar livros comprados pelo usuário
      fetch('/api/ebooks/my', { headers: { 'x-user-id': userId } })
        .then(r => r.json())
        .then(data => {
          if (Array.isArray(data)) setMyBooksData(data);
        })
        .catch(console.error);
    }
  }, [userId])

  // Merge the catalog with user access and local wishlist states
  // In a real app wishlist might be stored in the DB, but we keep it local for MVP
  const [wishlistIds, setWishlistIds] = useState<string[]>([])
  
  const books = catalog.map(book => ({
    ...book,
    hasAccess: myBooksData.some(mb => mb.id === book.id),
    isWishlisted: wishlistIds.includes(book.id)
  }))

  const handleOpenReader = (title: string, _coverUrl?: string) => {
    // Determine the actual PDF URL from the book catalog
    const book = books.find(b => b.title === title);
    if (book && book.pdfUrl) {
      setReaderData({ url: book.pdfUrl, title });
    } else {
      alert("Arquivo PDF não encontrado para este livro.");
    }
  }

  const handleToggleWishlist = (id: string) => {
    setWishlistIds(current => 
      current.includes(id) ? current.filter(wId => wId !== id) : [...current, id]
    )
  }

  if (!userId) {
    return <Login onLogin={(id) => setUserId(id)} />
  }

  return (
    <div className="app-container">
      {readerData ? (
        <PDFReader 
          url={readerData.url} 
          title={readerData.title} 
          onClose={() => setReaderData(null)} 
        />
      ) : (
        <>
          <main className="app-main">
            {activeTab === 'home' && <Home books={books} onRead={handleOpenReader} onToggleWishlist={handleToggleWishlist} />}
            {activeTab === 'library' && <Library books={books} onRead={handleOpenReader} onToggleWishlist={handleToggleWishlist} />}
            {activeTab === 'settings' && (
              <div style={{ padding: 'var(--spacing-md)', paddingTop: 'var(--spacing-lg)' }}>
                <h1 style={{ marginBottom: 'var(--spacing-md)' }}>Configurações</h1>
                <p style={{ color: 'var(--text-secondary)' }}>Ajustes de conta e notificações.</p>
                <button 
                  onClick={() => setUserId(null)}
                  style={{
                    marginTop: '20px', padding: '10px 20px', background: 'rgba(255,255,255,0.1)', 
                    color: 'white', border: '1px solid #333', borderRadius: '8px', cursor: 'pointer'
                  }}
                >
                  Sair (Logout)
                </button>
              </div>
            )}
          </main>

          <nav className="bottom-nav">
            <button className={`bottom-nav-item ${activeTab === 'home' ? 'active' : ''}`} onClick={() => setActiveTab('home')}>
              <HomeIcon /> <span>Vitrine</span>
            </button>
            <button className={`bottom-nav-item ${activeTab === 'library' ? 'active' : ''}`} onClick={() => setActiveTab('library')}>
              <LibraryIcon /> <span>Biblioteca</span>
            </button>
            <button className={`bottom-nav-item ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>
              <SettingsIcon /> <span>Opções</span>
            </button>
          </nav>
        </>
      )}
    </div>
  )
}

export default App
