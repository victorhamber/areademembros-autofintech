import React, { useState, useEffect } from 'react';
import { Pencil, Trash2, Users, BookOpen, KeyRound, UserPlus, Webhook, Copy, RefreshCw, Trash, Search, Mail } from 'lucide-react';
import './Admin.css';

export const Admin: React.FC = () => {
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [masterPassword, setMasterPassword] = useState('');
  const [activeTab, setActiveTab] = useState<'ebooks' | 'users' | 'webhooks' | 'email'>('ebooks');

  const [ebooks, setEbooks] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [webhookLogs, setWebhookLogs] = useState<any[]>([]);
  
  // -- EBOOK FORM STATE --
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [description, setDescription] = useState('');
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [htmlFile, setHtmlFile] = useState<File | null>(null);
  const [isBonus, setIsBonus] = useState(false);
  const [parentEbookId, setParentEbookId] = useState('');
  const [language, setLanguage] = useState('pt');
  const [coverUrl, setCoverUrl] = useState('');
  const [pdfUrl, setPdfUrl] = useState('');
  const [htmlUrl, setHtmlUrl] = useState('');
  const [externalUrl, setExternalUrl] = useState('');
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
  const [userSearch, setUserSearch] = useState('');

  // -- EMAIL SETTINGS STATE --
  const [emailSettings, setEmailSettings] = useState<Record<string, string>>({
    resend_api_key: '', sender_name: '', sender_email: '',
    welcome_template_pt: '', welcome_template_es: '',
    reset_template_pt: '', reset_template_es: ''
  });
  const [emailSaving, setEmailSaving] = useState(false);

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
        localStorage.setItem('adminToken', pwd);
      } else {
        alert('Senha incorreta.'); setIsAdminLoggedIn(false);
        localStorage.removeItem('adminToken');
      }
    } catch (err) { alert('Servidor offline.'); }
  };

  const fetchUsers = async (pwd: string) => {
    try {
      const res = await fetch('/api/admin/users', { headers: { 'x-admin-password': pwd } });
      if (res.ok) setUsers(await res.json());
    } catch (err) { console.error('Error fetching users'); }
  };

  const fetchWebhookLogs = async (pwd: string) => {
    try {
      const res = await fetch('/api/admin/webhook-logs', { headers: { 'x-admin-password': pwd } });
      if (res.ok) setWebhookLogs(await res.json());
    } catch (err) { console.error('Error fetching webhook logs'); }
  };

  const fetchEmailSettings = async (pwd: string) => {
    try {
      const res = await fetch('/api/admin/settings', { headers: { 'x-admin-password': pwd } });
      if (res.ok) {
        const data = await res.json();
        setEmailSettings(prev => ({ ...prev, ...data }));
      }
    } catch (err) { console.error('Error fetching email settings'); }
  };

  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    if (token) {
      setMasterPassword(token);
      fetchEbooks(token).then(() => {
        fetchUsers(token);
        fetchCategories(token);
        fetchWebhookLogs(token);
        fetchEmailSettings(token);
      });
    }
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (masterPassword) {
      fetchEbooks(masterPassword);
      fetchCategories(masterPassword);
      fetchUsers(masterPassword);
      fetchWebhookLogs(masterPassword);
      fetchEmailSettings(masterPassword);
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
    setEditingId(null); setTitle(''); setAuthor(''); setDescription(''); setCoverFile(null); setPdfFile(null); setHtmlFile(null);
    setCoverUrl(''); setPdfUrl(''); setHtmlUrl(''); setExternalUrl(''); setSalesUrl(''); setHotmartOffer('');
    setCategoryId(''); setFeaturedList(''); setIsBonus(false); setParentEbookId(''); setLanguage('pt');
  };

  const handleEdit = (eb: any) => {
    setEditingId(eb.id); setTitle(eb.title); setAuthor(eb.author || ''); setDescription(eb.description || '');
    setCoverUrl(eb.coverUrl); setPdfUrl(eb.pdfUrl || ''); setHtmlUrl(eb.htmlUrl || ''); setExternalUrl(eb.externalUrl || ''); setSalesUrl(eb.salesUrl);
    setHotmartOffer(eb.hotmartOffer); setCategoryId(eb.categoryId || '');
    setFeaturedList(eb.featuredList || ''); setCoverFile(null); setPdfFile(null); setHtmlFile(null);
    setIsBonus(eb.isBonus || false); setParentEbookId(eb.parentEbookId || ''); setLanguage(eb.language || 'pt');
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
      let finalCoverUrl = coverUrl; let finalPdfUrl = pdfUrl; let finalHtmlUrl = htmlUrl;
      if (coverFile) finalCoverUrl = await uploadFile(coverFile);
      if (pdfFile) finalPdfUrl = await uploadFile(pdfFile);
      if (htmlFile) finalHtmlUrl = await uploadFile(htmlFile);
      
      if (!finalCoverUrl) {
        alert('A capa é obrigatória!'); setIsSubmitting(false); return;
      }
      if (!finalPdfUrl && !finalHtmlUrl && !externalUrl) {
        alert('É obrigatório enviar um arquivo (PDF/HTML) ou inserir um Link Externo!'); setIsSubmitting(false); return;
      }

      const payload = { title, author, description, coverUrl: finalCoverUrl, pdfUrl: finalPdfUrl || null, htmlUrl: finalHtmlUrl || null, externalUrl: externalUrl || null, salesUrl, hotmartOffer, categoryId, featuredList, isBonus, parentEbookId, language };
      const res = await fetch(editingId ? `/api/admin/ebooks/${editingId}` : '/api/admin/ebooks', {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-password': masterPassword },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        alert('Salvo com sucesso!'); fetchEbooks(masterPassword); clearForm();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(`Falha ao salvar. Verifique se o Código da Oferta já não está em uso por outro livro.\nDetalhes: ${data.error || 'Erro interno.'}`);
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
    <div className="admin-dashboard-wrapper">
      <div className="admin-dashboard">
        <header className="admin-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', userSelect: 'none' }}>
          <img src="/logo.png" alt="Readlyme" style={{ height: '38px', pointerEvents: 'none', userSelect: 'none' }} draggable={false} />
          <h1 style={{ display: 'none' }}>Readlyme | Operações</h1>
        </div>
        <div className="admin-tabs">
          <button className={activeTab === 'ebooks' ? 'active' : ''} onClick={() => setActiveTab('ebooks')}>
            <BookOpen size={18} /> Livros
          </button>
          <button className={activeTab === 'users' ? 'active' : ''} onClick={() => setActiveTab('users')}>
            <Users size={18} /> Clientes
          </button>
          <button className={activeTab === 'webhooks' ? 'active' : ''} onClick={() => setActiveTab('webhooks')}>
            <Webhook size={18} /> Webhook
          </button>
          <button className={activeTab === 'email' ? 'active' : ''} onClick={() => setActiveTab('email')}>
            <Mail size={18} /> E-mail
          </button>
          
          <div style={{ width: '1px', height: '24px', background: 'var(--border-subtle)', margin: '0 8px' }}></div>
          <button onClick={() => { localStorage.removeItem('adminToken'); window.location.reload(); }} style={{ color: '#ef4444' }}>
            Sair
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
        <div className="admin-content" style={{ flexDirection: 'column' }}>
          {/* Stats Row */}
          <div className="admin-stats-row">
            <div className="admin-stat-card">
              <div><div className="stat-number">{users.length}</div><div className="stat-label">Usuários</div></div>
            </div>
            <div className="admin-stat-card">
              <div><div className="stat-number">{users.reduce((acc: number, u: any) => acc + u.purchases.length, 0)}</div><div className="stat-label">Acessos Ativos</div></div>
            </div>
            <div className="admin-stat-card">
              <div><div className="stat-number">{users.filter((u: any) => !u.password).length}</div><div className="stat-label">Sem Senha</div></div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <form className="admin-form" onSubmit={handleCreateUser}>
              <h3><UserPlus size={18} style={{ verticalAlign: 'middle', marginRight: '8px' }}/>Cadastrar Usuário</h3>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '10px' }}>
                Cadastre alunos ou dê acesso VIP manualmente.
              </p>
              <label>E-mail *</label>
              <input type="email" placeholder="email@aluno.com" value={newUserEmail} onChange={e => setNewUserEmail(e.target.value)} required />
              <label>Senha Provisória *</label>
              <input type="text" placeholder="Senha123" value={newUserPass} onChange={e => setNewUserPass(e.target.value)} required />
              <div className="admin-form-actions">
                <button type="submit">Cadastrar Usuário</button>
              </div>
            </form>

            <div className="admin-table-container" style={{ flex: 2 }}>
              <h3>Usuários Cadastrados ({users.length})</h3>
              <div className="admin-search-bar">
                <Search size={16} className="admin-search-icon" />
                <input
                  type="text"
                  placeholder="Buscar por e-mail ou nome..."
                  value={userSearch}
                  onChange={e => setUserSearch(e.target.value)}
                />
              </div>
              <div className="admin-table-scroll">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>E-mail</th>
                    <th>Nº Livros</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {users
                    .filter((u: any) => {
                      if (!userSearch.trim()) return true;
                      const q = userSearch.toLowerCase();
                      return u.email.toLowerCase().includes(q) || (u.name && u.name.toLowerCase().includes(q));
                    })
                    .map((u: any) => (
                    <tr key={u.id}>
                      <td><span style={{ fontWeight: 500 }}>{u.name || <span style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>Sem nome</span>}</span></td>
                      <td>{u.email}</td>
                      <td>
                        <span style={{ background: u.purchases.length > 0 ? 'rgba(76,175,80,0.15)' : 'rgba(158,158,158,0.15)', padding: '3px 10px', borderRadius: '12px', fontSize: '13px', fontWeight: 600, color: u.purchases.length > 0 ? '#66bb6a' : '#9e9e9e' }}>
                          {u.purchases.length}
                        </span>
                      </td>
                      <td>
                        <button className="btn-primary" onClick={() => setManagingAccessFor(u)} style={{ fontSize: '12px', padding: '6px 14px' }}>
                          <KeyRound size={14} /> Acessos
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          </div>
        </div>
      )}

      {/* --- TAB: EBOOKS --- */}
      {activeTab === 'ebooks' && (
        <div className="admin-content">
          <form className="admin-form" onSubmit={handleSubmit}>
            {!editingId ? (
              <>
                <h3>Adicionar Novo Ebook</h3>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '15px' }}>
                  Preencha os dados para criar um novo registro na biblioteca.
                </p>
              </>
            ) : (
              <div style={{ background: 'rgba(69, 196, 176, 0.15)', border: '1px solid var(--accent-primary)', padding: '16px', borderRadius: '8px', marginBottom: '20px' }}>
                <h3 style={{ color: 'var(--accent-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Pencil size={18} /> Editando Ebook
                </h3>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '8px', marginBottom: '12px' }}>
                  Atenção: Você está modificando um ebook existente. Para cadastrar um novo, cancele esta edição.
                </p>
                <button type="button" onClick={clearForm} style={{ background: 'transparent', border: '1px solid var(--accent-primary)', color: 'var(--accent-primary)', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>
                  ❌ CANCELAR E CADASTRAR NOVO
                </button>
              </div>
            )}
            
            <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
              <div style={{ flex: 1 }}>
                <label>Tipo de Cadastro *</label>
                <select value={isBonus ? 'bonus' : 'produto'} onChange={e => { setIsBonus(e.target.value === 'bonus'); if (e.target.value === 'produto') setParentEbookId(''); }} className="admin-input-styled">
                  <option value="produto">Produto Principal</option>
                  <option value="bonus">Bônus Especial</option>
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label>Idioma do Ebook *</label>
                <select value={language} onChange={e => setLanguage(e.target.value)} className="admin-input-styled">
                  <option value="pt">Português (PT)</option>
                  <option value="es">Espanhol (ES)</option>
                  <option value="en">Inglês (EN)</option>
                </select>
              </div>
            </div>

            {isBonus && (
              <div style={{ background: 'rgba(212,175,55,0.05)', padding: '15px', borderRadius: '8px', border: '1px solid rgba(212,175,55,0.2)', marginBottom: '15px' }}>
                <label style={{ color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}><KeyRound size={16} /> Vincular Bônus ao Produto Pai *</label>
                <select value={parentEbookId} onChange={e => setParentEbookId(e.target.value)} className="admin-input-styled" required={isBonus}>
                  <option value="">Selecione o Produto Principal...</option>
                  {ebooks.filter(e => !e.isBonus).map(eb => (
                    <option key={eb.id} value={eb.id}>{eb.title}</option>
                  ))}
                </select>
                <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '6px', marginBottom: 0 }}>
                  Todos os clientes que já compraram ou vierem a comprar o Produto Principal ganharão acesso a este Bônus automaticamente.
                </p>
              </div>
            )}

            <label>Título do Livro *</label>
            <input placeholder="Ex: O Poder do Hábito" value={title} onChange={e => setTitle(e.target.value)} required />
            
            <div style={{ display: 'flex', gap: '10px' }}>
              <div style={{flex: 1}}>
                <label>Autor (Opcional)</label>
                <input placeholder="Ex: Charles Duhigg" value={author} onChange={e => setAuthor(e.target.value)} />
              </div>
            </div>

            <label>Descrição Curta / Subtítulo (Opcional)</label>
            <input placeholder="Aparecerá abaixo do título na Biblioteca" value={description} onChange={e => setDescription(e.target.value)} />
            
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
            
            {/* File type selector - stacked vertically to avoid overlap */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label>Arquivo PDF {editingId && !pdfFile && pdfUrl ? ' - Atual' : ''}</label>
                  {pdfUrl && !pdfFile && (
                    <button type="button" onClick={() => setPdfUrl('')} style={{ fontSize: '11px', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Remover Arquivo</button>
                  )}
                </div>
                <input type="file" accept="application/pdf" onChange={e => setPdfFile(e.target?.files?.[0] || null)} />
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    Arquivo HTML
                    <span style={{ fontSize: '11px', background: 'rgba(69,196,176,0.2)', color: 'var(--accent-primary)', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>NOVO</span>
                    {editingId && !htmlFile && htmlUrl ? ' - Atual' : ''}
                  </label>
                  {htmlUrl && !htmlFile && (
                    <button type="button" onClick={() => setHtmlUrl('')} style={{ fontSize: '11px', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Remover Arquivo</button>
                  )}
                </div>
                <input type="file" accept=".html,text/html" onChange={e => setHtmlFile(e.target?.files?.[0] || null)} />
              </div>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              ⚡ Envie pelo menos um arquivo (PDF ou HTML) ou insira um Link abaixo. Se houver Link, ele terá prioridade total.
            </p>

            <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              Link Externo / App Interativo (Opcional)
              <span style={{ fontSize: '11px', background: 'rgba(212,175,55,0.2)', color: 'var(--accent-primary)', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>PRIORIDADE</span>
            </label>
            <input 
              placeholder="https://exemplo.com/app-ou-site-interativo" 
              value={externalUrl} 
              onChange={e => setExternalUrl(e.target.value)} 
              style={{ border: externalUrl ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle)' }}
            />
            <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '-8px', marginBottom: '10px' }}>
              Útil para integrar apps exclusivos, dashboards ou sites externos de suporte ao ebook.
            </p>
            <label>Página de Vendas ou Código HTML (Hotmart) *</label>
            <textarea 
              placeholder="https://... ou cole aqui o script do Checkout Widget da Hotmart" 
              value={salesUrl} 
              onChange={e => {
                const val = e.target.value;
                if (val.includes('<script') && val.includes('hotmart-fb')) {
                  const match = val.match(/href=["'](https:\/\/pay\.hotmart\.com\/[^"']+)["']/);
                  if (match) {
                    setSalesUrl(match[1]);
                    alert('Código Hotmart Detectado! A URL do Checkout (Pop-up) foi extraída e convertida automaticamente.');
                    return;
                  }
                }
                setSalesUrl(val);
              }} 
              rows={3}
              required 
              style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
            />
            {!isBonus && (
              <>
                <label>Código da Oferta (Hotmart) *</label>
                <input placeholder="Letras e Números da Oferta" value={hotmartOffer} onChange={e => setHotmartOffer(e.target.value)} required={!isBonus} />
              </>
            )}
            
            <div className="admin-form-actions" style={{ flexDirection: 'column' }}>
              <button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Enviando...' : (editingId ? '💾 Atualizar Ebook Existente' : 'Cadastrar Novo Ebook')}
              </button>
              {editingId && (
                <button type="button" className="btn-cancel" onClick={clearForm} disabled={isSubmitting}>
                  Cancelar Edição
                </button>
              )}
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
                    <th>Tipo</th>
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
                      <td>
                        <div style={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px' }}>
                           {eb.language === 'es' ? '🇪🇸' : eb.language === 'en' ? '🇺🇸' : '🇧🇷'} {eb.title}
                        </div>
                        {eb.isBonus && (
                          <div style={{ fontSize: '11px', color: 'var(--accent-primary)', marginTop: '4px', background: 'rgba(212,175,55,0.1)', padding: '2px 6px', borderRadius: '4px', display: 'inline-block' }}>
                            🎁 Bônus de: {ebooks.find(p => p.id === eb.parentEbookId)?.title || 'Desconhecido'}
                          </div>
                        )}
                      </td>
                      <td>
                        {eb.externalUrl && <span style={{ background: 'rgba(212,175,55,0.2)', color: 'var(--accent-primary)', padding: '2px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 700, marginRight: '4px' }}>LINK</span>}
                        {eb.htmlUrl && <span style={{ background: 'rgba(69,196,176,0.2)', color: 'var(--accent-primary)', padding: '2px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 700, marginRight: '4px' }}>HTML</span>}
                        {eb.pdfUrl && <span style={{ background: 'rgba(255,255,255,0.1)', color: 'var(--text-secondary)', padding: '2px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 700 }}>PDF</span>}
                        {!eb.htmlUrl && !eb.pdfUrl && !eb.externalUrl && <span style={{ color: '#ef4444', fontSize: '12px' }}>⚠ Sem arquivo</span>}
                      </td>
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

      {/* --- TAB: WEBHOOKS --- */}
      {activeTab === 'webhooks' && (
        <div className="admin-content">
          <div className="admin-form">
            <h3><Webhook size={18} style={{ verticalAlign: 'middle', marginRight: '8px' }}/>Configuração do Webhook Hotmart</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '15px' }}>
              Cole a URL abaixo na sua plataforma de vendas (Hotmart, Kiwify, etc.) para liberação automática de acessos.
            </p>

            <label>URL do Webhook (cole na Hotmart)</label>
            <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
              <input type="text" readOnly value={`${window.location.origin}/api/webhooks/hotmart`} style={{ flex: 1, background: 'rgba(255,255,255,0.05)', cursor: 'text' }} />
              <button 
                type="button" className="btn-primary"
                onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/api/webhooks/hotmart`); alert('URL copiada!'); }}
              >
                <Copy size={16} /> Copiar
              </button>
            </div>

            <div style={{ marginTop: '20px', padding: '15px', background: 'rgba(212,175,55,0.08)', borderRadius: '8px', border: '1px solid rgba(212,175,55,0.2)' }}>
              <h4 style={{ color: 'var(--accent-primary)', marginBottom: '12px' }}>📋 Como Configurar na Hotmart</h4>
              <ol style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.8', paddingLeft: '20px' }}>
                <li>Acesse <strong>Ferramentas → Webhook</strong> na sua conta Hotmart</li>
                <li>Clique em <strong>"Configurar Webhook"</strong></li>
                <li>Cole a <strong>URL acima</strong> no campo de URL</li>
                <li>Selecione os eventos: <code>PURCHASE_APPROVED</code>, <code>PURCHASE_CANCELED</code>, <code>PURCHASE_REFUNDED</code>, <code>PURCHASE_CHARGEBACK</code></li>
                <li>Copie o <strong>Hottok</strong> gerado e configure na variável de ambiente <code>HOTMART_HOTTOK</code> do seu servidor</li>
                <li>Salve e faça uma <strong>compra teste</strong> para validar</li>
              </ol>
            </div>

            <div style={{ marginTop: '15px', padding: '15px', background: 'rgba(102,187,106,0.08)', borderRadius: '8px', border: '1px solid rgba(102,187,106,0.2)' }}>
              <h4 style={{ color: '#66bb6a', marginBottom: '8px' }}>⚙️ Como Funciona</h4>
              <ul style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.8', paddingLeft: '20px' }}>
                <li><strong>Compra Aprovada:</strong> O sistema cria o usuário automaticamente e libera o livro correspondente ao <code>Código da Oferta</code></li>
                <li><strong>Reembolso/Cancelamento:</strong> O acesso ao livro é revogado automaticamente</li>
                <li>O <strong>Código da Oferta</strong> cadastrado no ebook deve ser igual ao ID do produto ou código da oferta na Hotmart</li>
              </ul>
            </div>
          </div>

          <div className="admin-table-container">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <h3>Log de Eventos ({webhookLogs.length})</h3>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button className="btn-icon" onClick={() => fetchWebhookLogs(masterPassword)} title="Atualizar">
                  <RefreshCw size={16} />
                </button>
                <button className="btn-icon btn-danger" onClick={async () => {
                  if (!window.confirm('Limpar todos os logs?')) return;
                  await fetch('/api/admin/webhook-logs', { method: 'DELETE', headers: { 'x-admin-password': masterPassword } });
                  setWebhookLogs([]);
                }} title="Limpar Logs">
                  <Trash size={16} />
                </button>
              </div>
            </div>
            <div className="admin-table-scroll">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Evento</th>
                    <th>Comprador</th>
                    <th>E-mail</th>
                    <th style={{ textAlign: 'center' }}>País</th>
                    <th>Produto</th>
                    <th>Status</th>
                    <th>Detalhes</th>
                  </tr>
                </thead>
                <tbody>
                  {webhookLogs.length === 0 ? (
                    <tr><td colSpan={8} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-secondary)' }}>Nenhum evento recebido ainda. Configure o webhook na Hotmart e faça uma compra teste.</td></tr>
                  ) : (
                    webhookLogs.map(log => (
                      <tr key={log.id}>
                        <td style={{ whiteSpace: 'nowrap', fontSize: '11px' }}>{new Date(log.createdAt).toLocaleString('pt-BR')}</td>
                        <td><code>{log.event}</code></td>
                        <td style={{ fontSize: '12px', fontWeight: '500' }}>{log.buyerName || '-'}</td>
                        <td style={{ fontSize: '12px' }}>{log.buyerEmail || '-'}</td>
                        <td style={{ textAlign: 'center', fontSize: '16px' }}>
                          {log.buyerCountry ? (
                            <span title={log.buyerCountry}>
                              {log.buyerCountry === 'BR' ? '🇧🇷' : 
                               log.buyerCountry === 'PT' ? '🇵🇹' :
                               ['AR', 'MX', 'CO', 'ES', 'CL', 'PE', 'EC', 'UY', 'PY', 'BO', 'VE'].includes(log.buyerCountry) ? '🇪🇸' : 
                               `🌍 (${log.buyerCountry})`}
                            </span>
                          ) : '-'}
                        </td>
                        <td><code>{log.productId || '-'}</code></td>
                        <td>
                          <span className={`webhook-status webhook-status-${log.status}`}>
                            {log.status === 'success' ? '✅' : log.status === 'error' ? '❌' : log.status === 'rejected' ? '🚫' : log.status === 'warning' ? '⚠️' : '📌'}
                            {' '}{log.status}
                          </span>
                        </td>
                        <td style={{ fontSize: '12px', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {log.details || '-'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* --- TAB: EMAIL CONFIG --- */}
      {activeTab === 'email' && (
        <div className="admin-content">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '800px' }}>
            <div className="admin-form">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Mail size={20} /> Configurações de E-mail</h3>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '15px' }}>
                Configure o token da API Resend e o remetente para envio de e-mails transacionais (boas-vindas e recuperação de senha).
              </p>

              <label>Token da API Resend</label>
              <input
                type="password"
                placeholder="re_xxxxxxxxxx"
                value={emailSettings.resend_api_key}
                onChange={e => setEmailSettings(p => ({ ...p, resend_api_key: e.target.value }))}
              />
              <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '-6px' }}>
                Este valor não é exibido por segurança. Para atualizar, cole um novo token e salve.
              </p>

              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '200px' }}>
                  <label>Nome do Remetente</label>
                  <input
                    placeholder="Ex: Readlyme"
                    value={emailSettings.sender_name}
                    onChange={e => setEmailSettings(p => ({ ...p, sender_name: e.target.value }))}
                  />
                </div>
                <div style={{ flex: 1, minWidth: '200px' }}>
                  <label>E-mail do Remetente</label>
                  <input
                    type="email"
                    placeholder="noreply@seudominio.com"
                    value={emailSettings.sender_email}
                    onChange={e => setEmailSettings(p => ({ ...p, sender_email: e.target.value }))}
                  />
                </div>
              </div>

              <hr style={{ borderColor: 'var(--border-subtle)', margin: '20px 0' }} />

              <div style={{ 
                background: 'rgba(69, 196, 176, 0.05)', 
                padding: '20px', 
                borderRadius: '12px', 
                border: '1px solid rgba(69, 196, 176, 0.1)', 
                marginBottom: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                <h4 style={{ margin: '0 0 5px 0', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>🇧🇷 Português (Brasil)</h4>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ marginTop: '0' }}>E-mail de Boas-vindas</label>
                  <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: '0' }}>
                    Placeholders: {'{{name}}'}, {'{{email}}'}, {'{{password}}'}, {'{{app_url}}'}
                  </p>
                </div>
                <textarea
                  rows={5}
                  placeholder="HTML do e-mail em PT (vazio = padrão)"
                  value={emailSettings.welcome_template_pt}
                  onChange={e => setEmailSettings(p => ({ ...p, welcome_template_pt: e.target.value }))}
                  style={{ fontFamily: 'monospace', fontSize: '12px', marginBottom: '10px' }}
                />

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ marginTop: '0' }}>Recuperação de Senha</label>
                  <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: '0' }}>
                    Placeholders: {'{{name}}'}, {'{{reset_link}}'}
                  </p>
                </div>
                <textarea
                  rows={5}
                  placeholder="HTML do e-mail de reset em PT (vazio = padrão)"
                  value={emailSettings.reset_template_pt}
                  onChange={e => setEmailSettings(p => ({ ...p, reset_template_pt: e.target.value }))}
                  style={{ fontFamily: 'monospace', fontSize: '12px' }}
                />
              </div>

              <div style={{ 
                background: 'rgba(255, 255, 255, 0.03)', 
                padding: '20px', 
                borderRadius: '12px', 
                border: '1px solid var(--border-subtle)', 
                marginBottom: '25px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                <h4 style={{ margin: '0 0 5px 0', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>🇪🇸 Español</h4>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ marginTop: '0' }}>Correo de Bienvenida</label>
                  <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: '0' }}>
                    Placeholders: {'{{name}}'}, {'{{email}}'}, {'{{password}}'}, {'{{country}}'}, {'{{app_url}}'}
                  </p>
                </div>
                <textarea
                  rows={5}
                  placeholder="HTML del correo en ES (vacio = predeterminado)"
                  value={emailSettings.welcome_template_es}
                  onChange={e => setEmailSettings(p => ({ ...p, welcome_template_es: e.target.value }))}
                  style={{ fontFamily: 'monospace', fontSize: '12px', marginBottom: '10px' }}
                />

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ marginTop: '0' }}>Recuperación de Contraseña</label>
                  <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: '0' }}>
                    Placeholders: {'{{name}}'}, {'{{reset_link}}'}, {'{{country}}'}
                  </p>
                </div>
                <textarea
                  rows={5}
                  placeholder="HTML del correo de reset en ES (vacio = predeterminado)"
                  value={emailSettings.reset_template_es}
                  onChange={e => setEmailSettings(p => ({ ...p, reset_template_es: e.target.value }))}
                  style={{ fontFamily: 'monospace', fontSize: '12px' }}
                />
              </div>

              <button
                type="button"
                className="login-submit-btn"
                disabled={emailSaving}
                onClick={async () => {
                  setEmailSaving(true);
                  try {
                    const res = await fetch('/api/admin/settings', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', 'x-admin-password': masterPassword },
                      body: JSON.stringify(emailSettings)
                    });
                    if (res.ok) {
                      alert('Configurações salvas com sucesso!');
                      fetchEmailSettings(masterPassword);
                    } else {
                      alert('Erro ao salvar configurações.');
                    }
                  } catch { alert('Erro de conexão.'); } finally { setEmailSaving(false); }
                }}
                style={{ 
                  marginTop: '10px', 
                  background: 'var(--accent-primary)', 
                  color: '#fff',
                  width: '100%',
                  fontWeight: 'bold',
                  padding: '14px',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  border: 'none'
                }}
              >
                {emailSaving ? 'Salvando...' : 'Salvar Configurações'}
              </button>
            </div>

            {/* Info panel */}
            <div style={{ background: 'var(--bg-secondary)', borderRadius: '12px', padding: '20px', border: '1px solid var(--border-subtle)' }}>
              <h4 style={{ marginTop: 0, color: 'var(--accent-primary)' }}>Como funciona</h4>
              <ul style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.7, paddingLeft: '18px' }}>
                <li>Usamos o provedor <strong>Resend</strong> para envio de e-mails transacionais.</li>
                <li>O token é salvo no banco de dados e usado apenas no backend.</li>
                <li>Os templates aceitam placeholders que serão substituídos automaticamente.</li>
                <li>Se o template estiver vazio, um template padrão será usado.</li>
                <li>Novos compradores recebem a senha padrão <code>Mudar123@</code>.</li>
                <li>O idioma do e-mail é definido automaticamente pelo país do comprador.</li>
              </ul>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};
