import React, { useState, useEffect } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import './Admin.css';

export const Admin: React.FC = () => {
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [masterPassword, setMasterPassword] = useState('');
  const [ebooks, setEbooks] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  
  // Form State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [coverUrl, setCoverUrl] = useState('');
  const [pdfUrl, setPdfUrl] = useState('');
  const [salesUrl, setSalesUrl] = useState('');
  const [hotmartOffer, setHotmartOffer] = useState('');
  
  // Phase 5: Categories & Featured Lists
  const [categoryId, setCategoryId] = useState('');
  const [featuredList, setFeaturedList] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchCategories = async (password: string) => {
    try {
      const res = await fetch('/api/admin/categories', { headers: { 'x-admin-password': password } });
      if (res.ok) setCategories(await res.json());
    } catch(err) { console.error('Error fetching categories', err); }
  };

  const fetchEbooks = async (password: string) => {
    try {
      const res = await fetch('/api/admin/ebooks', { headers: { 'x-admin-password': password } });
      if (res.ok) {
        setEbooks(await res.json());
        setIsAdminLoggedIn(true);
      } else {
        alert('Senha incorreta ou erro no servidor');
        setIsAdminLoggedIn(false);
      }
    } catch (err) {
      alert('Servidor Backend inavegável.');
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (masterPassword) {
      fetchEbooks(masterPassword);
      fetchCategories(masterPassword);
    }
  };

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
      alert('Categoria criada com sucesso!');
    } catch(err) { alert('Erro ao criar categoria.'); }
  };

  const uploadFile = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch('/api/admin/upload', {
      method: 'POST',
      headers: { 'x-admin-password': masterPassword },
      body: formData
    });
    if (!res.ok) throw new Error('Falha no upload');
    const data = await res.json();
    return data.url;
  };

  const clearForm = () => {
    setEditingId(null);
    setTitle(''); setAuthor(''); setCoverFile(null); setPdfFile(null);
    setCoverUrl(''); setPdfUrl(''); setSalesUrl(''); setHotmartOffer('');
    setCategoryId(''); setFeaturedList('');
  };

  const handleEdit = (eb: any) => {
    setEditingId(eb.id);
    setTitle(eb.title);
    setAuthor(eb.author || '');
    setCoverUrl(eb.coverUrl);
    setPdfUrl(eb.pdfUrl);
    setSalesUrl(eb.salesUrl);
    setHotmartOffer(eb.hotmartOffer);
    setCategoryId(eb.categoryId || '');
    setFeaturedList(eb.featuredList || '');
    setCoverFile(null);
    setPdfFile(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Excluir este ebook permanentemente?')) return;
    try {
      const res = await fetch(`/api/admin/ebooks/${id}`, {
        method: 'DELETE', headers: { 'x-admin-password': masterPassword }
      });
      if (res.ok) fetchEbooks(masterPassword);
    } catch (err) { console.error(err); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      let finalCoverUrl = coverUrl;
      let finalPdfUrl = pdfUrl;
      if (coverFile) finalCoverUrl = await uploadFile(coverFile);
      if (pdfFile) finalPdfUrl = await uploadFile(pdfFile);

      if (!finalCoverUrl || !finalPdfUrl) {
        alert('Capa e PDF são obrigatórios!');
        setIsSubmitting(false); return;
      }

      const payload = { 
        title, author, coverUrl: finalCoverUrl, pdfUrl: finalPdfUrl, 
        salesUrl, hotmartOffer, categoryId, featuredList 
      };
      
      const res = await fetch(editingId ? `/api/admin/ebooks/${editingId}` : '/api/admin/ebooks', {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-password': masterPassword },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        alert('Salvo com sucesso!');
        fetchEbooks(masterPassword);
        clearForm();
      } else {
        alert('Erro ao salvar no servidor.');
      }
    } catch (err) {
      alert('Erro de envio.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isAdminLoggedIn) {
    return (
      <div className="admin-login-container">
        <form onSubmit={handleLogin} className="admin-login-box">
          <h2>Painel de Controle</h2>
          <p>Acesso Restrito ao Administrador</p>
          <input type="password" placeholder="Senha Master" value={masterPassword} onChange={e => setMasterPassword(e.target.value)} required />
          <button type="submit">Entrar no Painel</button>
        </form>
      </div>
    );
  }

  return (
    <div className="admin-dashboard">
      <header className="admin-header">
        <h1>Painel do Produtor (Ebooks)</h1>
      </header>
      
      <div className="admin-content">
        <form className="admin-form" onSubmit={handleSubmit}>
          <h3>{editingId ? 'Editar Ebook' : 'Adicionar Novo Ebook'}</h3>
          
          <label>Título do Livro *</label>
          <input placeholder="Ex: O Poder do Hábito" value={title} onChange={e => setTitle(e.target.value)} required />
          
          <label>Autor (Opcional)</label>
          <input placeholder="Ex: Charles Duhigg" value={author} onChange={e => setAuthor(e.target.value)} />
          
          {/* CATEGORIES AND LISTS SECTION */}
          <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
            <div style={{flex: 1}}>
              <label>Categoria (Opcional)</label>
              <select 
                value={categoryId} 
                onChange={e => setCategoryId(e.target.value)}
                style={{ width: '100%', padding: '12px', background: 'var(--bg-main)', border: '1px solid var(--text-secondary)', color: 'var(--text-primary)', borderRadius: '4px', marginTop: '8px' }}
              >
                <option value="">Sem Categoria</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            
            <div style={{flex: 1}}>
              <label>Nova Categoria Rápida</label>
              <div style={{ display: 'flex', gap: '5px', marginTop: '8px' }}>
                <input placeholder="Ex: Ficção" value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} style={{ marginTop: 0 }} />
                <button type="button" onClick={handleCreateCategory} style={{ padding: '0 12px', background: 'rgba(255,255,255,0.1)' }}>+</button>
              </div>
            </div>
          </div>

          <label>Lista Especial / Destaque (Opcional)</label>
          <input placeholder="Ex: Recomendados pelo Autor" value={featuredList} onChange={e => setFeaturedList(e.target.value)} />
          
          <hr style={{ borderColor: 'var(--border-subtle)', margin: '15px 0' }} />

          {/* FILES */}
          <label>Capa do Ebook {editingId && !coverFile && coverUrl ? ' - Atual' : '*'}</label>
          <input type="file" accept="image/*" onChange={e => setCoverFile(e.target?.files?.[0] || null)} required={!editingId && !coverUrl} />
          
          <label>Arquivo PDF {editingId && !pdfFile && pdfUrl ? ' - Atual' : '*'}</label>
          <input type="file" accept="application/pdf" onChange={e => setPdfFile(e.target?.files?.[0] || null)} required={!editingId && !pdfUrl} />
          
          <label>Link da Página de Vendas *</label>
          <input placeholder="https://..." type="url" value={salesUrl} onChange={e => setSalesUrl(e.target.value)} required />
          
          <label>Código da Oferta (Hotmart) *</label>
          <input placeholder="Letras e Números da Oferta" value={hotmartOffer} onChange={e => setHotmartOffer(e.target.value)} required />
          
          <div className="admin-form-actions">
            <button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Enviando arquivos...' : (editingId ? 'Salvar Alterações' : 'Cadastrar Ebook')}
            </button>
            {editingId && (
              <button type="button" className="btn-cancel" onClick={clearForm} disabled={isSubmitting}>Cancelar Edição</button>
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
                  <th>Categoria</th>
                  <th>Lista Especial</th>
                  <th>Cód. Hotmart</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {ebooks.map(eb => (
                  <tr key={eb.id}>
                    <td><img src={eb.coverUrl} alt={eb.title} /></td>
                    <td>{eb.title}</td>
                    <td>{eb.category?.name || '-'}</td>
                    <td><span style={{ fontSize: '11px', background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px' }}>{eb.featuredList || '-'}</span></td>
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
    </div>
  );
};
