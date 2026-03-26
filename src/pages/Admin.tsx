import React, { useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import './Admin.css';

export const Admin: React.FC = () => {
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [masterPassword, setMasterPassword] = useState('');
  const [ebooks, setEbooks] = useState<any[]>([]);
  
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

  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchEbooks = async (password: string) => {
    try {
      const res = await fetch('/api/admin/ebooks', {
        headers: { 'x-admin-password': password }
      });
      if (res.ok) {
        const data = await res.json();
        setEbooks(data);
        setIsAdminLoggedIn(true);
      } else {
        alert('Senha incorreta ou erro no servidor');
        setIsAdminLoggedIn(false);
      }
    } catch (err) {
      console.error(err);
      alert('Servidor Backend ainda não está online ou inacessível.');
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (masterPassword) fetchEbooks(masterPassword);
  };

  const uploadFile = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch('/api/admin/upload', {
      method: 'POST',
      headers: { 'x-admin-password': masterPassword },
      body: formData
    });
    if (!res.ok) throw new Error('Falha no upload do arquivo.');
    const data = await res.json();
    return data.url;
  };

  const clearForm = () => {
    setEditingId(null);
    setTitle(''); setAuthor(''); setCoverFile(null); setPdfFile(null);
    setCoverUrl(''); setPdfUrl(''); setSalesUrl(''); setHotmartOffer('');
  };

  const handleEdit = (eb: any) => {
    setEditingId(eb.id);
    setTitle(eb.title);
    setAuthor(eb.author || '');
    setCoverUrl(eb.coverUrl);
    setPdfUrl(eb.pdfUrl);
    setSalesUrl(eb.salesUrl);
    setHotmartOffer(eb.hotmartOffer);
    setCoverFile(null);
    setPdfFile(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir este ebook? Ele será removido permanentemente.')) return;
    try {
      const res = await fetch(`/api/admin/ebooks/${id}`, {
        method: 'DELETE',
        headers: { 'x-admin-password': masterPassword }
      });
      if (res.ok) fetchEbooks(masterPassword);
      else alert('Erro ao excluir Ebook.');
    } catch (err) {
      console.error(err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      let finalCoverUrl = coverUrl;
      let finalPdfUrl = pdfUrl;

      // Realiza upload de novos arquivos caso tenham sido selecionados
      if (coverFile) finalCoverUrl = await uploadFile(coverFile);
      if (pdfFile) finalPdfUrl = await uploadFile(pdfFile);

      if (!finalCoverUrl || !finalPdfUrl) {
        alert('Você precisa fornecer tanto a Capa quanto o PDF do Livro.');
        setIsSubmitting(false);
        return;
      }

      const payload = { title, author, coverUrl: finalCoverUrl, pdfUrl: finalPdfUrl, salesUrl, hotmartOffer };
      const url = editingId ? `/api/admin/ebooks/${editingId}` : '/api/admin/ebooks';
      const method = editingId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 
          'Content-Type': 'application/json',
          'x-admin-password': masterPassword 
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        alert(editingId ? 'Ebook atualizado com sucesso!' : 'Ebook cadastrado com sucesso!');
        fetchEbooks(masterPassword);
        clearForm();
      } else {
        alert('Erro ao salvar ebook no servidor.');
      }
    } catch (err) {
      console.error(err);
      alert('Erro de comunicação ou falha no envio do arquivo.');
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
          <input 
            type="password" 
            placeholder="Senha Master" 
            value={masterPassword}
            onChange={(e) => setMasterPassword(e.target.value)}
            required
          />
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
          
          <label>Capa do Ebook (Imagem) {editingId && !coverFile && coverUrl ? ' - Usando Atual' : '*'}</label>
          <input type="file" accept="image/*" onChange={e => setCoverFile(e.target?.files?.[0] || null)} required={!editingId && !coverUrl} />
          
          <label>Arquivo PDF do Ebook {editingId && !pdfFile && pdfUrl ? ' - Usando Atual' : '*'}</label>
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
                  <th>Cód. Hotmart</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {ebooks.map(eb => (
                  <tr key={eb.id}>
                    <td><img src={eb.coverUrl} alt={eb.title} width="40" /></td>
                    <td>{eb.title}</td>
                    <td><code>{eb.hotmartOffer}</code></td>
                    <td>
                      <div className="admin-actions">
                        <button className="btn-icon" onClick={() => handleEdit(eb)} title="Editar"><Pencil size={18} /></button>
                        <button className="btn-icon btn-danger" onClick={() => handleDelete(eb.id)} title="Excluir"><Trash2 size={18} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
                {ebooks.length === 0 && (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center' }}>Nenhum livro cadastrado ainda.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
