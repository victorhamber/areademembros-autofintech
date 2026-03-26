import { useState } from 'react'
import { Home as HomeIcon, Library as LibraryIcon, Settings as SettingsIcon } from 'lucide-react'
import { Home } from './pages/Home'
import { Library } from './pages/Library'
import { Login } from './pages/Login'
import { PDFReader } from './components/PDFReader'
import { mockBooks as initialBooks } from './data/mockBooks'
import './App.css'

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [activeTab, setActiveTab] = useState('home')
  const [readerData, setReaderData] = useState<{url: string, title: string} | null>(null)
  
  // Make books stateful to allow tracking wishlist interactions
  const [books, setBooks] = useState(initialBooks)

  // Demo PDF using mozilla tracer test file
  const dummyPdfUrl = 'https://raw.githubusercontent.com/mozilla/pdf.js/ba2edeae/web/compressed.tracemonkey-pldi-09.pdf';

  const handleOpenReader = (title: string, _coverUrl?: string) => {
    setReaderData({ url: dummyPdfUrl, title });
  }

  const handleToggleWishlist = (id: string) => {
    setBooks(current => 
      current.map(b => b.id === id ? { ...b, isWishlisted: !b.isWishlisted } : b)
    )
  }

  if (!isAuthenticated) {
    return <Login onLogin={() => setIsAuthenticated(true)} />
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
              </div>
            )}
          </main>

          <nav className="bottom-nav">
            <button 
              className={`bottom-nav-item ${activeTab === 'home' ? 'active' : ''}`}
              onClick={() => setActiveTab('home')}
            >
              <HomeIcon />
              <span>Vitrine</span>
            </button>
            <button 
              className={`bottom-nav-item ${activeTab === 'library' ? 'active' : ''}`}
              onClick={() => setActiveTab('library')}
            >
              <LibraryIcon />
              <span>Biblioteca</span>
            </button>
            <button 
              className={`bottom-nav-item ${activeTab === 'settings' ? 'active' : ''}`}
              onClick={() => setActiveTab('settings')}
            >
              <SettingsIcon />
              <span>Opções</span>
            </button>
          </nav>
        </>
      )}
    </div>
  )
}

export default App
