import React, { useState } from 'react';
import './Login.css';

interface LoginProps {
  onLogin: () => void;
}

export const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email && password) {
      onLogin(); // Mock login logic
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <h1 className="login-logo">Ebooks<span>Pro</span></h1>
        <p className="login-subtitle">Faça login para acessar sua biblioteca de conteúdo premium</p>

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
          
          <button type="submit" className="login-submit-btn">
            Entrar na Plataforma
          </button>
        </form>
        
        <p className="login-footer">
          Ainda não tem acesso? <a href="#">Ver vitrine de Ebooks</a>
        </p>
      </div>
    </div>
  );
};
