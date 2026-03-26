import React, { useState } from 'react';
import { Pencil, Trash2, Users, BookOpen, KeyRound, UserPlus } from 'lucide-react';
import './Admin.css';

export const Admin: React.FC = () => {
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [masterPassword, setMasterPassword] = useState('');
  const [activeTab, setActiveTab] = useState<'ebooks' | 'users'>('ebooks');

  const [ebooks, setEbooks] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  
  // -- EBOOK FORM STATE --
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [coverUrl, setCoverUrl] = useState('');
  const [pdfUrl, setPdfUrl] = useState('');
  const [salesUrl, setSalesUrl] = useState('');
  const [hotmartOffer, setHotmartOffer] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [featuredList, setFeaturedList] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // -- USER FORM STATE --
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPass, setNewUserPass] = useState('');
  const [managingAccessFor, setManagingAccessFor] = useState<any | null>(null);
  const [grantEbookId, setGrantEbookId] = useState('');

  // -- FETCHERS --
  const fetchCategories = async (pwd: string) => {
    try {
      const res = await fetch('/api/admin/categories', { headers: { 'x-admin-password': pwd } });
      if (res.ok) setCategories(await res.json());
    } catch(err) { console.error('Error fetching categories'); }
  };

  const fetchEbooks = async (pwd: string) => {
    try {
      const res = await fetch('/api/admin/ebooks', { headers: { 'x-admin-password': pwd } });
      if (res.ok) {
        setEbooks(await res.json());
        setIsAdminLoggedIn(true);
      } else {
        alert('Senha incorreta.'); setIsAdminLoggedIn(false);
      }
    } catch (err) { alert('Servidor offline.'); }
  };

  const fetchUsers = async (pwd: string) => {
    try {
      const res = await fetch('/api/admin/users', { headers: { 'x-admin-password': pwd } });
      if (res.ok) setUsers(await res.json());
    } catch (err) { console.error('Error fetching users'); }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (masterPassword) {
      fetchEbooks(masterPassword);
      fetchCategories(masterPassword);
      fetchUsers(masterPassword);
    }
  };

  // -- USERS MANAGEMENT --
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-password': masterPassword },
        body: JSON.stringify({ email: newUserEmail, password: newUserPass })
      });
      if (res.ok) {
        alert('Usuário Criado com Sucesso!');
        setNewUserEmail(''); setNewUserPass('');
        fetchUsers(masterPassword);
      } else {
        const errorData = await res.json();
        alert(errorData.error);
      }
    } catch(err) { alert('Erro na comunicação'); }
  };

  const grantAccess = async () => {
    if (!managingAccessFor || !grantEbookId) return;
    try {
      const res = await fetch('/api/admin/purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-password': masterPassword },
        body: JSON.stringify({ userId: managingAccessFor.id, ebookId: grantEbookId })
      });
      if (res.ok) {
        alert('Acesso Concedido!');
        setGrantEbookId('');
        fetchUsers(masterPassword); // refresh the list
        // Close modal implicitly or explicitly update `managingAccessFor`
        setManagingAccessFor(null);
      } else {
        alert('Falha. Usuário provavelmente já possui este livro.');
      }
    } catch(err) { alert('Erro.'); }
  };

  const revokeAccess = async (ebookId: string) => {
    if (!managingAccessFor) return;
    if (!window.confirm("Remover este livro da conta do usuário?")) return;
    try {
      const res = await fetch(`/api/admin/purchases/${managingAccessFor.id}/${ebookId}`, {
        method: 'DELETE',
        headers: { 'x-admin-password': masterPassword }
      });
      if (res.ok) {
        alert('Acesso Revogado!');
        fetchUsers(masterPassword);
        setManagingAccessFor(null);
      }
    } catch(err) { alert('Erro.'); }
  };

  // -- EBOOKS MANAGEMENT --
  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) return;
    try {
      const res = await fetch('/api/admin/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-password': masterPassword },
        body: JSON.stringify({ name: newCategoryName })
      });
      const data = await res.json();
      setCategories([...categories, data]);
      setCategoryId(data.id);
      setNewCategoryName('');
      alert('Categoria criada!');
    } catch(err) { alert('Erro ao criar categoria.'); }
  };

  const uploadFile = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch('/api/admin/upload', {
      method: 'POST', headers: { 'x-admin-password': masterPassword }, body: formData
    });
    const data = await res.json();
    return data.url;
  };

  const clearForm = () => {
    setEditingId(null); setTitle(''); setAuthor(''); setCoverFile(null); setPdfFile(null);
    setCoverUrl(''); setPdfUrl(''); setSalesUrl(''); setHotmartOffer('');
    setCategoryId(''); setFeaturedList('');
  };

  const handleEdit = (eb: any) => {
    setEditingId(eb.id); setTitle(eb.title); setAuthor(eb.author || '');
    setCoverUrl(eb.coverUrl); setPdfUrl(eb.pdfUrl); setSalesUrl(eb.salesUrl);
    setHotmartOffer(eb.hotmartOffer); setCategoryId(eb.categoryId || '');
    setFeaturedList(eb.featuredList || ''); setCoverFile(null); setPdfFile(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Excluir este ebook permanentemente?')) return;
    const res = await fetch(`/api/admin/ebooks/${id}`, { method: 'DELETE', headers: { 'x-admin-password': masterPassword }});
    if (res.ok) fetchEbooks(masterPassword);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      let finalCoverUrl = coverUrl; let finalPdfUrl = pdfUrl;
      if (coverFile) finalCoverUrl = await uploadFile(coverFile);
      if (pdfFile) finalPdfUrl = await uploadFile(pdfFile);

      if (!finalCoverUrl || !finalPdfUrl) {
        alert('Capa e PDF são obrigatórios!'); setIsSubmitting(false); return;
      }

      const payload = { title, author, coverUrl: finalCoverUrl, pdfUrl: finalPdfUrl, salesUrl, hotmartOffer, categoryId, featuredList };
      const res = await fetch(editingId ? `/api/admin/ebooks/${editingId}` : '/api/admin/ebooks', {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-password': masterPassword },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        alert('Salvo com sucesso!'); fetchEbooks(masterPassword); clearForm();
      }
    } catch (err) { alert('Erro de envio.'); } finally { setIsSubmitting(false); }
  };

  // LOGIN SCREEN
  if (!isAdminLoggedIn) {
    return (
      <div className="admin-login-container">
        <form onSubmit={handleLogin} className="admin-login-box">
          <h2>Centro de Comando</h2>
          <p>Exclusivo ao Criador</p>
          <input type="password" placeholder="Senha Master" value={masterPassword} onChange={e => setMasterPassword(e.target.value)} required />
          <button type="submit">Autenticar Sistema</button>
        </form>
      </div>
    );
  }

  return (
    <div className="admin-dashboard">
      <header className="admin-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>EbooksPro | Operações</h1>
        <div className="admin-tabs">
          <button className={activeTab === 'ebooks' ? 'active' : ''} onClick={() => setActiveTab('ebooks')}>
            <BookOpen size={18} /> Livros Analógicos
          </button>
          <button className={activeTab === 'users' ? 'active' : ''} onClick={() => setActiveTab('users')}>
            <Users size={18} /> Clientes & Acessos
          </button>
        </div>
      </header>

      {/* MODAL / OVERLAY FOR MANAGING ACCESS */}
      {managingAccessFor && (
        <div className="admin-modal-overlay">
          <div className="admin-modal">
            <h2>Gestão de Acessos</h2>
            <p>Gerenciando: <strong>{managingAccessFor.email}</strong></p>
            
            <div className="access-list">
              <h4>Livros Liberados Atualmente:</h4>
              {managingAccessFor.purchases.length === 0 ? <p className="empty-msg">Nenhum livro liberado ainda.</p> : (
                <ul style={{ padding: '0', listStyle: 'none' }}>
                  {managingAccessFor.purchases.map((p: any) => (
                    <li key={p.ebook.id} style={{ display: 'flex', justifyContent: 'space-between', background: 'rgba(255,255,255,0.05)', margin: '5px 0', padding: '10px', borderRadius: '4px' }}>
                      <span>{p.ebook.title}</span>
                      <button onClick={() => revokeAccess(p.ebook.id)} className="btn-danger-sm">Revogar</button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="grant-access-box">
              <h4>Conceder Novo Acesso Manual:</h4>
              <div style={{ display: 'flex', gap: '10px' }}>
                <select value={grantEbookId} onChange={e => setGrantEbookId(e.target.value)} style={{ flex: 1, padding: '10px' }}>
                  <option value="">Selecione um Livro...</option>
                  {ebooks.filter((eb: any) => !managingAccessFor.purchases.some((p: any) => p.ebookId === eb.id)).map((eb: any) => (
                    <option key={eb.id} value={eb.id}>{eb.title}</option>
                  ))}
                </select>
                <button onClick={grantAccess} className="btn-primary" disabled={!grantEbookId}>Adicionar</button>
              </div>
            </div>

            <button className="btn-cancel" onClick={() => setManagingAccessFor(null)} style={{ marginTop: '20px', width: '100%' }}>Voltar Painel</button>
          </div>
        </div>
      )}

      {/* --- TAB: USERS --- */}
      {activeTab === 'users' && (
        <div className="admin-content">
          <form className="admin-form" onSubmit={handleCreateUser}>
            <h3><UserPlus size={18} style={{ verticalAlign: 'middle', marginRight: '8px' }}/>Cadastrar Usuário Manual</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '15px' }}>
              Dê acesso VIP ou cadastre alunos antigos sem precisar vender na Hotmart.
            </p>
            <label>E-mail do Usuário *</label>
            <input type="email" placeholder="email@aluno.com" value={newUserEmail} onChange={e => setNewUserEmail(e.target.value)} required />
            <label>Senha Provisória *</label>
            <input type="text" placeholder="Senha123" value={newUserPass} onChange={e => setNewUserPass(e.target.value)} required />
            <div className="admin-form-actions">
              <button type="submit">Cadastrar e Conceder Conta</button>
            </div>
          </form>

          <div className="admin-table-container">
            <h3>Usuários Cadastrados ({users.length})</h3>
            <div className="admin-table-scroll">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>E-mail</th>
                    <th>Senha Registrada</th>
                    <th>Nº Compras</th>
                    <th>Controle</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id}>
                      <td style={{ fontWeight: 500 }}>{u.email}</td>
                      <td><code>{u.password || 'Sem Senha'}</code></td>
                      <td>{u.purchases.length} Livro(s)</td>
                      <td>
                        <button className="btn-icon" onClick={() => setManagingAccessFor(u)} title="Gerenciar Acessos" style={{ background: 'var(--accent-primary)', color: '#000', padding: '6px 12px', borderRadius: '4px', fontSize: '13px', fontWeight: 'bold' }}>
                          <KeyRound size={14} style={{ marginRight: '5px' }} /> Ver Acessos
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* --- TAB: EBOOKS --- */}
      {activeTab === 'ebooks' && (
        <div className="admin-content">
          <form className="admin-form" onSubmit={handleSubmit}>
            <h3>{editingId ? 'Editar Ebook' : 'Adicionar Novo Ebook'}</h3>
            <label>Título do Livro *</label>
            <input placeholder="Ex: O Poder do Hábito" value={title} onChange={e => setTitle(e.target.value)} required />
            <label>Autor (Opcional)</label>
            <input placeholder="Ex: Charles Duhigg" value={author} onChange={e => setAuthor(e.target.value)} />
            
            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
              <div style={{flex: 1}}>
                <label>Categoria (Opcional)</label>
                <select value={categoryId} onChange={e => setCategoryId(e.target.value)} className="admin-input-styled">
                  <option value="">Sem Categoria</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div style={{flex: 1}}>
                <label>Nova Categoria Rápida</label>
                <div style={{ display: 'flex', gap: '5px', marginTop: '8px' }}>
                  <input placeholder="Ex: Ficção" value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} style={{ marginTop: 0 }} />
                  <button type="button" onClick={handleCreateCategory} className="btn-add">+</button>
                </div>
              </div>
            </div>

            <label>Lista Especial / Destaque (Opcional)</label>
            <input placeholder="Ex: Recomendados pelo Autor" value={featuredList} onChange={e => setFeaturedList(e.target.value)} />
            
            <hr style={{ borderColor: 'var(--border-subtle)', margin: '15px 0' }} />

            <label>Capa do Ebook {editingId && !coverFile && coverUrl ? ' - Atual' : '*'}</label>
            <input type="file" accept="image/*" onChange={e => setCoverFile(e.target?.files?.[0] || null)} required={!editingId && !coverUrl} />
            <label>Arquivo PDF {editingId && !pdfFile && pdfUrl ? ' - Atual' : '*'}</label>
            <input type="file" accept="application/pdf" onChange={e => setPdfFile(e.target?.files?.[0] || null)} required={!editingId && !pdfUrl} />
            <label>Link da Página de Vendas *</label>
            <input placeholder="https://..." type="url" value={salesUrl} onChange={e => setSalesUrl(e.target.value)} required />
            <label>Código da Oferta (Hotmart) *</label>
            <input placeholder="Letras e Números da Oferta" value={hotmartOffer} onChange={e => setHotmartOffer(e.target.value)} required />
            
            <div className="admin-form-actions">
              <button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Enviando...' : (editingId ? 'Salvar Alterações' : 'Cadastrar Ebook')}</button>
              {editingId && <button type="button" className="btn-cancel" onClick={clearForm} disabled={isSubmitting}>Cancelar Edição</button>}
            </div>
          </form>

          <div className="admin-table-container">
            <h3>Ebooks Cadastrados ({ebooks.length})</h3>
            <div className="admin-table-scroll">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Capa</th>
                    <th>Título</th>
                    <th>Categoria</th>
                    <th>Destaque</th>
                    <th>Oferta</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {ebooks.map(eb => (
                    <tr key={eb.id}>
                      <td><img src={eb.coverUrl} alt={eb.title} /></td>
                      <td>{eb.title}</td>
                      <td>{eb.category?.name || '-'}</td>
                      <td><span className="badge-highlight">{eb.featuredList || '-'}</span></td>
                      <td><code>{eb.hotmartOffer}</code></td>
                      <td>
                        <div className="admin-actions">
                          <button className="btn-icon" onClick={() => handleEdit(eb)} title="Editar"><Pencil size={18} /></button>
                          <button className="btn-icon btn-danger" onClick={() => handleDelete(eb.id)} title="Excluir"><Trash2 size={18} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
