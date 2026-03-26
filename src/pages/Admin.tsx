import React, { useState } from 'react';
import './Admin.css';

export const Admin: React.FC = () => {
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [masterPassword, setMasterPassword] = useState('');
  const [ebooks, setEbooks] = useState<any[]>([]);
  
  // Form State
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [pdfUrl, setPdfUrl] = useState('');
  const [salesUrl, setSalesUrl] = useState('');
  const [hotmartOffer, setHotmartOffer] = useState('');

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
    if (masterPassword) {
      fetchEbooks(masterPassword);
    }
  };

  const handleAddEbook = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/ebooks', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-admin-password': masterPassword 
        },
        body: JSON.stringify({ title, author, coverUrl, pdfUrl, salesUrl, hotmartOffer })
      });
      if (res.ok) {
        alert('Ebook adicionado com sucesso!');
        fetchEbooks(masterPassword);
        setTitle(''); setAuthor(''); setCoverUrl(''); setPdfUrl(''); setSalesUrl(''); setHotmartOffer('');
      } else {
        alert('Erro ao salvar ebook');
      }
    } catch (err) {
      console.error(err);
      alert('Erro de comunicação com o backend');
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
        <form className="admin-form" onSubmit={handleAddEbook}>
          <h3>Adicionar Novo Ebook</h3>
          <input placeholder="Título do Livro" value={title} onChange={e => setTitle(e.target.value)} required />
          <input placeholder="Autor" value={author} onChange={e => setAuthor(e.target.value)} />
          <input placeholder="Link da Capa (Imagem)" value={coverUrl} onChange={e => setCoverUrl(e.target.value)} required />
          <input placeholder="Link do PDF" value={pdfUrl} onChange={e => setPdfUrl(e.target.value)} required />
          <input placeholder="Link da Página de Vendas" value={salesUrl} onChange={e => setSalesUrl(e.target.value)} required />
          <input placeholder="Código da Oferta (Hotmart)" value={hotmartOffer} onChange={e => setHotmartOffer(e.target.value)} required />
          <button type="submit">Cadastrar Ebook no Sistema</button>
        </form>

        <div className="admin-table-container">
          <h3>Ebooks Cadastrados</h3>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Capa</th>
                <th>Título</th>
                <th>Cód. Hotmart</th>
              </tr>
            </thead>
            <tbody>
              {ebooks.map(eb => (
                <tr key={eb.id}>
                  <td><img src={eb.coverUrl} alt={eb.title} width="40" /></td>
                  <td>{eb.title}</td>
                  <td><code>{eb.hotmartOffer}</code></td>
                </tr>
              ))}
              {ebooks.length === 0 && (
                <tr>
                  <td colSpan={3} style={{ textAlign: 'center' }}>Nenhum livro cadastrado ainda.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
