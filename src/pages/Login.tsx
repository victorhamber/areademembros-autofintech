import React, { useState } from 'react';
import './Login.css';

interface LoginProps {
  onLogin: (userId: string, email: string) => void;
}

export const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      
      const data = await res.json();
      
      if (res.ok) {
        onLogin(data.id, data.email);
      } else {
        alert(data.error || 'Erro ao realizar login');
      }
    } catch (err) {
      console.error(err);
      alert('Erro de conexão com o servidor. Tente novamente mais tarde.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <img src="/logo.png" alt="Readlyme Logo" style={{ maxWidth: '180px', height: 'auto' }} />
        </div>
        <p className="login-subtitle">Faça login com seu E-mail da compra</p>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="input-group">
            <label>E-mail</label>
            <input 
              type="email" 
              placeholder="seu@email.com" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="input-group">
            <label>Senha</label>
            <input 
              type="password" 
              placeholder="••••••••" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          
          <button type="submit" className="login-submit-btn" disabled={loading}>
            {loading ? 'Autenticando...' : 'Entrar na Plataforma'}
          </button>
        </form>
        
        <p className="login-footer">
          Ainda não tem acesso? <a href="#">Ver vitrine de Ebooks</a>
        </p>
      </div>
    </div>
  );
};
