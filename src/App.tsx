import { useState, useEffect } from 'react'
import { Home as HomeIcon, Library as LibraryIcon, User as UserIcon } from 'lucide-react'
import { Home } from './pages/Home'
import { Library } from './pages/Library'
import { Login } from './pages/Login'
import { Admin } from './pages/Admin'
import { PDFReader } from './components/PDFReader'
import { HTMLReader } from './components/HTMLReader'
import { InstallPrompt } from './components/InstallPrompt'
import { useLanguage } from './i18n/useLanguage'
import { t } from './i18n/translations'
import type { Lang } from './i18n/translations'
import './App.css'

function App() {
  if (window.location.pathname === '/admin') {
    return <Admin />
  }

  const { lang, setLang } = useLanguage()
  const tr = t(lang)

  const [userId, setUserId] = useState<string | null>(() => localStorage.getItem('ebookpro_userId'))
  const [userEmail, setUserEmail] = useState<string | null>(() => localStorage.getItem('ebookpro_userEmail'))
  const [userName, setUserName] = useState<string | null>(() => localStorage.getItem('ebookpro_userName'))
  const [activeTab, setActiveTab] = useState('home')
  const [readerData, setReaderData] = useState<{url: string, title: string, ebookId: string, initialPage: number} | null>(null)
  const [htmlReaderData, setHtmlReaderData] = useState<{url: string, title: string} | null>(null)
  
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
      
      // Auto-set language based on user's country if not manually set recently
      if (profile?.country) {
        const isSpanishCountry = ['AR','BO','CL','CO','CR','CU','DO','EC','SV','GT','HN','MX','NI','PA','PY','PE','PR','ES','UY','VE','GQ'].includes(profile.country);
        const targetLang: Lang = isSpanishCountry ? 'es' : 'pt';
        
        // If current language is different, update it
        if (lang !== targetLang) {
          console.log(`[i18n] Auto-detecting lang from country ${profile.country} -> ${targetLang}`);
          setLang(targetLang);
        }
      }
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
    if (!book) return;

    // Mark reading progress (works for both PDF and HTML)
    fetch('/api/reading-progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': userId || '' },
      body: JSON.stringify({ ebookId: book.id, page: book.lastPage || 1 })
    }).catch(console.error)

    if (book.htmlUrl) {
      // HTML ebook
      setHtmlReaderData({ url: book.htmlUrl, title });
    } else if (book.pdfUrl) {
      // PDF ebook
      setReaderData({ url: book.pdfUrl, title, ebookId: book.id, initialPage: book.lastPage || 1 });
    } else {
      alert(tr.pdf_not_found);
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
    fetchData()
  }

  const handleCloseHtmlReader = () => {
    setHtmlReaderData(null)
    fetchData()
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
    return <Login onLogin={handleLogin} lang={lang} setLang={setLang} />
  }

  return (
    <div className="app-container">
      {htmlReaderData ? (
        <HTMLReader
          url={htmlReaderData.url}
          title={htmlReaderData.title}
          lang={lang}
          onClose={handleCloseHtmlReader}
        />
      ) : readerData ? (
        <PDFReader 
          url={readerData.url} 
          title={readerData.title} 
          initialPage={readerData.initialPage}
          ebookId={readerData.ebookId}
          userId={userId || ''}
          lang={lang}
          onClose={handleCloseReader}
        />
      ) : (
        <>
          <main className="app-main">
            {activeTab === 'home' && <Home books={books} onRead={handleOpenReader} onToggleWishlist={handleToggleWishlist} isLoading={isLoading} userEmail={userEmail} userName={userName} lang={lang} setLang={setLang} />}
            {activeTab === 'library' && <Library books={books} onRead={handleOpenReader} onToggleWishlist={handleToggleWishlist} isLoading={isLoading} lang={lang} />}
            {activeTab === 'profile' && (
              <ProfilePage
                userId={userId}
                userEmail={userEmail}
                userName={userName}
                bookCount={myBooksData.length}
                lang={lang}
                onLogout={handleLogout}
                onProfileUpdate={handleProfileUpdate}
              />
            )}
          </main>

          <nav className="bottom-nav">
            <button className={`bottom-nav-item ${activeTab === 'home' ? 'active' : ''}`} onClick={() => setActiveTab('home')}>
              <HomeIcon /> <span>{tr.nav_home}</span>
            </button>
            <button className={`bottom-nav-item ${activeTab === 'library' ? 'active' : ''}`} onClick={() => setActiveTab('library')}>
              <LibraryIcon /> <span>{tr.nav_library}</span>
            </button>
            <button className={`bottom-nav-item ${activeTab === 'profile' ? 'active' : ''}`} onClick={() => setActiveTab('profile')}>
              <UserIcon /> <span>{tr.nav_profile}</span>
            </button>
          </nav>
        </>
      )}
      <InstallPrompt lang={lang} />
    </div>
  )
}

// ===== PROFILE PAGE COMPONENT =====
function ProfilePage({ userId, userEmail, userName, bookCount, lang, onLogout, onProfileUpdate }: {
  userId: string; userEmail: string | null; userName: string | null; bookCount: number;
  lang: Lang; onLogout: () => void; onProfileUpdate: (name: string) => void;
}) {
  const tr = t(lang)
  const [editingName, setEditingName] = useState(false)
  const [nameValue, setNameValue] = useState(userName || '')
  const [changingPassword, setChangingPassword] = useState(false)
  const [currentPass, setCurrentPass] = useState('')
  const [newPass, setNewPass] = useState('')
  const [saving, setSaving] = useState(false)

  const displayName = userName || userEmail?.split('@')[0] || tr.profile_user_fallback

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
        alert(tr.profile_name_updated)
      }
    } catch { alert(tr.profile_save_error) }
    finally { setSaving(false) }
  }

  const handleChangePassword = async () => {
    if (!currentPass || !newPass) { alert(tr.profile_fill_fields); return }
    setSaving(true)
    try {
      const res = await fetch('/api/profile/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
        body: JSON.stringify({ currentPassword: currentPass, newPassword: newPass })
      })
      const data = await res.json()
      if (res.ok) {
        alert(tr.profile_password_changed)
        setChangingPassword(false); setCurrentPass(''); setNewPass('')
      } else {
        alert(data.error || tr.profile_password_error)
      }
    } catch { alert(tr.profile_connection_error) }
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
              placeholder={tr.profile_name_placeholder} autoFocus
            />
            <button className="profile-save-btn" onClick={handleSaveName} disabled={saving}>{tr.profile_save}</button>
            <button className="profile-cancel-btn" onClick={() => setEditingName(false)}>✕</button>
          </div>
        ) : (
          <h2 className="profile-name" onClick={() => { setEditingName(true); setNameValue(userName || '') }} style={{ cursor: 'pointer' }}>
            {displayName} <span style={{ fontSize: '13px', color: 'var(--accent-primary)' }}>✏️</span>
          </h2>
        )}
        <p className="profile-stats">{bookCount} {tr.profile_books_count}</p>
      </div>
      
      <div className="profile-section">
        <h3>{tr.profile_section_account}</h3>
        <div className="profile-item">
          <span>{tr.profile_email}</span>
          <span className="profile-value">{userEmail}</span>
        </div>
        <div className="profile-item">
          <span>{tr.profile_name}</span>
          <span className="profile-value">{userName || tr.profile_name_undefined}</span>
        </div>
        <div className="profile-item" style={{ cursor: 'pointer' }} onClick={() => setChangingPassword(!changingPassword)}>
          <span>{tr.profile_change_password}</span>
          <span className="profile-value" style={{ color: 'var(--accent-primary)' }}>{changingPassword ? '▲' : '▶'}</span>
        </div>
        {changingPassword && (
          <div style={{ padding: 'var(--spacing-md)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <input className="profile-edit-input" type="password" placeholder={tr.profile_password_current} value={currentPass} onChange={e => setCurrentPass(e.target.value)} />
            <input className="profile-edit-input" type="password" placeholder={tr.profile_password_new} value={newPass} onChange={e => setNewPass(e.target.value)} />
            <button className="profile-save-btn" onClick={handleChangePassword} disabled={saving}>
              {saving ? tr.profile_saving : tr.profile_confirm_change}
            </button>
          </div>
        )}
      </div>

      <div className="profile-section">
        <h3>{tr.profile_section_about}</h3>
        <div className="profile-item">
          <span>{tr.profile_version}</span>
          <span className="profile-value">1.0.0</span>
        </div>
      </div>

      <button className="logout-btn" onClick={onLogout}>
        {tr.profile_logout}
      </button>
    </div>
  )
}

export default App
