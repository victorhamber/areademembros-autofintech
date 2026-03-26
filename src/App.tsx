import { useState, useEffect } from 'react'
import { Home as HomeIcon, Library as LibraryIcon, User as UserIcon } from 'lucide-react'
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

  // SESSION PERSISTENCE via localStorage
  const [userId, setUserId] = useState<string | null>(() => localStorage.getItem('ebookpro_userId'))
  const [userEmail, setUserEmail] = useState<string | null>(() => localStorage.getItem('ebookpro_userEmail'))
  const [activeTab, setActiveTab] = useState('home')
  const [readerData, setReaderData] = useState<{url: string, title: string} | null>(null)
  
  const [catalog, setCatalog] = useState<any[]>([])
  const [myBooksData, setMyBooksData] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const handleLogin = (id: string, email: string) => {
    setUserId(id)
    setUserEmail(email)
    localStorage.setItem('ebookpro_userId', id)
    localStorage.setItem('ebookpro_userEmail', email)
  }

  const handleLogout = () => {
    setUserId(null)
    setUserEmail(null)
    localStorage.removeItem('ebookpro_userId')
    localStorage.removeItem('ebookpro_userEmail')
  }

  useEffect(() => {
    if (userId) {
      setIsLoading(true)
      Promise.all([
        fetch('/api/ebooks').then(r => r.json()),
        fetch('/api/ebooks/my', { headers: { 'x-user-id': userId } }).then(r => r.json()),
        fetch('/api/wishlist', { headers: { 'x-user-id': userId } }).then(r => r.json())
      ]).then(([catalogData, myBooks, wishlistData]) => {
        if (Array.isArray(catalogData)) setCatalog(catalogData)
        if (Array.isArray(myBooks)) setMyBooksData(myBooks)
        if (Array.isArray(wishlistData)) setWishlistIds(wishlistData)
      }).catch(console.error)
        .finally(() => setIsLoading(false))
    }
  }, [userId])

  // Merge the catalog with user access and local wishlist states
  const [wishlistIds, setWishlistIds] = useState<string[]>([])
  
  const books = catalog.map(book => ({
    ...book,
    hasAccess: myBooksData.some(mb => mb.id === book.id),
    isWishlisted: wishlistIds.includes(book.id)
  }))

  const handleOpenReader = (title: string, _coverUrl?: string) => {
    const book = books.find(b => b.title === title);
    if (book && book.pdfUrl) {
      setReaderData({ url: book.pdfUrl, title });
    } else {
      alert("Arquivo PDF não encontrado para este livro.");
    }
  }

  const handleToggleWishlist = (id: string) => {
    // Optimistic UI update
    setWishlistIds(current => 
      current.includes(id) ? current.filter(wId => wId !== id) : [...current, id]
    )
    // Sync with server
    fetch('/api/wishlist/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': userId || '' },
      body: JSON.stringify({ ebookId: id })
    }).catch(console.error)
  }

  if (!userId) {
    return <Login onLogin={handleLogin} />
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
            {activeTab === 'home' && <Home books={books} onRead={handleOpenReader} onToggleWishlist={handleToggleWishlist} isLoading={isLoading} userEmail={userEmail} />}
            {activeTab === 'library' && <Library books={books} onRead={handleOpenReader} onToggleWishlist={handleToggleWishlist} isLoading={isLoading} />}
            {activeTab === 'profile' && (
              <div className="profile-page">
                <div className="profile-card">
                  <div className="profile-avatar">
                    {(userEmail || '?')[0].toUpperCase()}
                  </div>
                  <h2 className="profile-name">{userEmail}</h2>
                  <p className="profile-stats">{myBooksData.length} livro(s) na sua biblioteca</p>
                </div>
                
                <div className="profile-section">
                  <h3>Conta</h3>
                  <div className="profile-item">
                    <span>E-mail</span>
                    <span className="profile-value">{userEmail}</span>
                  </div>
                  <div className="profile-item">
                    <span>Versão do App</span>
                    <span className="profile-value">1.0.0</span>
                  </div>
                </div>

                <button className="logout-btn" onClick={handleLogout}>
                  Sair da Conta
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
            <button className={`bottom-nav-item ${activeTab === 'profile' ? 'active' : ''}`} onClick={() => setActiveTab('profile')}>
              <UserIcon /> <span>Perfil</span>
            </button>
          </nav>
        </>
      )}
    </div>
  )
}

export default App
