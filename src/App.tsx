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

  const [userId, setUserId] = useState<string | null>(() => localStorage.getItem('ebookpro_userId'))
  const [userEmail, setUserEmail] = useState<string | null>(() => localStorage.getItem('ebookpro_userEmail'))
  const [userName, setUserName] = useState<string | null>(() => localStorage.getItem('ebookpro_userName'))
  const [activeTab, setActiveTab] = useState('home')
  const [readerData, setReaderData] = useState<{url: string, title: string, ebookId: string} | null>(null)
  
  const [catalog, setCatalog] = useState<any[]>([])
  const [myBooksData, setMyBooksData] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [wishlistIds, setWishlistIds] = useState<string[]>([])

  const handleLogin = (id: string, email: string) => {
    setUserId(id)
    setUserEmail(email)
    localStorage.setItem('ebookpro_userId', id)
    localStorage.setItem('ebookpro_userEmail', email)
  }

  const handleLogout = () => {
    setUserId(null); setUserEmail(null); setUserName(null)
    localStorage.removeItem('ebookpro_userId')
    localStorage.removeItem('ebookpro_userEmail')
    localStorage.removeItem('ebookpro_userName')
  }

  const fetchData = () => {
    if (!userId) return
    setIsLoading(true)
    Promise.all([
      fetch('/api/ebooks').then(r => r.json()),
      fetch('/api/ebooks/my', { headers: { 'x-user-id': userId } }).then(r => r.json()),
      fetch('/api/wishlist', { headers: { 'x-user-id': userId } }).then(r => r.json()),
      fetch('/api/profile', { headers: { 'x-user-id': userId } }).then(r => r.json())
    ]).then(([catalogData, myBooks, wishlistData, profile]) => {
      if (Array.isArray(catalogData)) setCatalog(catalogData)
      if (Array.isArray(myBooks)) setMyBooksData(myBooks)
      if (Array.isArray(wishlistData)) setWishlistIds(wishlistData)
      if (profile?.name) { setUserName(profile.name); localStorage.setItem('ebookpro_userName', profile.name) }
    }).catch(console.error)
      .finally(() => setIsLoading(false))
  }

  useEffect(() => { fetchData() }, [userId])

  const books = catalog.map(book => {
    const myBookData = myBooksData.find(mb => mb.id === book.id)
    return {
      ...book,
      hasAccess: !!myBookData,
      isWishlisted: wishlistIds.includes(book.id),
      lastReadAt: myBookData?.lastReadAt || null,
      lastPage: myBookData?.lastPage || 0,
      isReading: !!myBookData?.lastReadAt
    }
  })

  const handleOpenReader = (title: string, _coverUrl?: string) => {
    const book = books.find(b => b.title === title);
    if (book && book.pdfUrl) {
      // Mark as reading in the DB
      fetch('/api/reading-progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': userId || '' },
        body: JSON.stringify({ ebookId: book.id, page: book.lastPage || 1 })
      }).catch(console.error)
      setReaderData({ url: book.pdfUrl, title, ebookId: book.id });
    } else {
      alert("Arquivo PDF não encontrado para este livro.");
    }
  }

  const handleCloseReader = (lastPage?: number) => {
    if (readerData && lastPage) {
      fetch('/api/reading-progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': userId || '' },
        body: JSON.stringify({ ebookId: readerData.ebookId, page: lastPage })
      }).catch(console.error)
    }
    setReaderData(null)
    fetchData() // Refresh data to update continue reading
  }

  const handleToggleWishlist = (id: string) => {
    setWishlistIds(current => 
      current.includes(id) ? current.filter(wId => wId !== id) : [...current, id]
    )
    fetch('/api/wishlist/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': userId || '' },
      body: JSON.stringify({ ebookId: id })
    }).catch(console.error)
  }

  const handleProfileUpdate = (newName: string) => {
    setUserName(newName)
    localStorage.setItem('ebookpro_userName', newName)
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
          onClose={handleCloseReader}
        />
      ) : (
        <>
          <main className="app-main">
            {activeTab === 'home' && <Home books={books} onRead={handleOpenReader} onToggleWishlist={handleToggleWishlist} isLoading={isLoading} userEmail={userEmail} userName={userName} />}
            {activeTab === 'library' && <Library books={books} onRead={handleOpenReader} onToggleWishlist={handleToggleWishlist} isLoading={isLoading} />}
            {activeTab === 'profile' && (
              <ProfilePage
                userId={userId}
                userEmail={userEmail}
                userName={userName}
                bookCount={myBooksData.length}
                onLogout={handleLogout}
                onProfileUpdate={handleProfileUpdate}
              />
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

// ===== PROFILE PAGE COMPONENT =====
function ProfilePage({ userId, userEmail, userName, bookCount, onLogout, onProfileUpdate }: {
  userId: string; userEmail: string | null; userName: string | null; bookCount: number;
  onLogout: () => void; onProfileUpdate: (name: string) => void;
}) {
  const [editingName, setEditingName] = useState(false)
  const [nameValue, setNameValue] = useState(userName || '')
  const [changingPassword, setChangingPassword] = useState(false)
  const [currentPass, setCurrentPass] = useState('')
  const [newPass, setNewPass] = useState('')
  const [saving, setSaving] = useState(false)

  const displayName = userName || userEmail?.split('@')[0] || 'Usuário'

  const handleSaveName = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
        body: JSON.stringify({ name: nameValue })
      })
      if (res.ok) {
        onProfileUpdate(nameValue)
        setEditingName(false)
        alert('Nome atualizado!')
      }
    } catch { alert('Erro ao salvar.') }
    finally { setSaving(false) }
  }

  const handleChangePassword = async () => {
    if (!currentPass || !newPass) { alert('Preencha ambos os campos.'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/profile/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
        body: JSON.stringify({ currentPassword: currentPass, newPassword: newPass })
      })
      const data = await res.json()
      if (res.ok) {
        alert('Senha alterada com sucesso!')
        setChangingPassword(false); setCurrentPass(''); setNewPass('')
      } else {
        alert(data.error || 'Erro ao trocar senha.')
      }
    } catch { alert('Erro de conexão.') }
    finally { setSaving(false) }
  }

  return (
    <div className="profile-page">
      <div className="profile-card">
        <div className="profile-avatar">
          {displayName[0].toUpperCase()}
        </div>
        {editingName ? (
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '8px' }}>
            <input 
              className="profile-edit-input" value={nameValue} onChange={e => setNameValue(e.target.value)}
              placeholder="Seu nome" autoFocus
            />
            <button className="profile-save-btn" onClick={handleSaveName} disabled={saving}>Salvar</button>
            <button className="profile-cancel-btn" onClick={() => setEditingName(false)}>✕</button>
          </div>
        ) : (
          <h2 className="profile-name" onClick={() => { setEditingName(true); setNameValue(userName || '') }} style={{ cursor: 'pointer' }}>
            {displayName} <span style={{ fontSize: '13px', color: 'var(--accent-primary)' }}>✏️</span>
          </h2>
        )}
        <p className="profile-stats">{bookCount} livro(s) na sua biblioteca</p>
      </div>
      
      <div className="profile-section">
        <h3>Conta</h3>
        <div className="profile-item">
          <span>E-mail</span>
          <span className="profile-value">{userEmail}</span>
        </div>
        <div className="profile-item">
          <span>Nome</span>
          <span className="profile-value">{userName || 'Não definido'}</span>
        </div>
        <div className="profile-item" style={{ cursor: 'pointer' }} onClick={() => setChangingPassword(!changingPassword)}>
          <span>Alterar Senha</span>
          <span className="profile-value" style={{ color: 'var(--accent-primary)' }}>{changingPassword ? '▲' : '▶'}</span>
        </div>
        {changingPassword && (
          <div style={{ padding: 'var(--spacing-md)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <input className="profile-edit-input" type="password" placeholder="Senha atual" value={currentPass} onChange={e => setCurrentPass(e.target.value)} />
            <input className="profile-edit-input" type="password" placeholder="Nova senha" value={newPass} onChange={e => setNewPass(e.target.value)} />
            <button className="profile-save-btn" onClick={handleChangePassword} disabled={saving}>
              {saving ? 'Salvando...' : 'Confirmar Troca'}
            </button>
          </div>
        )}
      </div>

      <div className="profile-section">
        <h3>Sobre</h3>
        <div className="profile-item">
          <span>Versão</span>
          <span className="profile-value">1.0.0</span>
        </div>
      </div>

      <button className="logout-btn" onClick={onLogout}>
        Sair da Conta
      </button>
    </div>
  )
}

export default App
