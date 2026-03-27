import React, { useState } from 'react';
import { t } from '../i18n/translations';
import type { Lang } from '../i18n/translations';
import './Login.css';

interface LoginProps {
  onLogin: (userId: string, email: string) => void;
  lang: Lang;
  setLang: (l: Lang) => void;
}

export const Login: React.FC<LoginProps> = ({ onLogin, lang, setLang }) => {
  const tr = t(lang);
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
        alert(data.error || tr.login_error_fields);
      }
    } catch (err) {
      console.error(err);
      alert(tr.login_error_connection);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        {/* Language switcher */}
        <div className="login-lang-switcher">
          <button
            className={`lang-btn ${lang === 'pt' ? 'active' : ''}`}
            onClick={() => setLang('pt')}
            title="Português"
          >🇧🇷</button>
          <button
            className={`lang-btn ${lang === 'es' ? 'active' : ''}`}
            onClick={() => setLang('es')}
            title="Español"
          >🇪🇸</button>
        </div>

        <div style={{ textAlign: 'center', marginBottom: '24px', userSelect: 'none' }}>
          <img 
            src="/logo.png" 
            alt="Readlyme Logo" 
            style={{ maxWidth: '240px', height: 'auto', userSelect: 'none', pointerEvents: 'none' }} 
            draggable={false} 
          />
        </div>
        <p className="login-subtitle">{tr.login_subtitle}</p>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="input-group">
            <label>{tr.login_email_label}</label>
            <input 
              type="email" 
              placeholder={tr.login_email_placeholder}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="input-group">
            <label>{tr.login_password_label}</label>
            <input 
              type="password" 
              placeholder="••••••••" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          
          <button type="submit" className="login-submit-btn" disabled={loading}>
            {loading ? tr.login_loading : tr.login_btn}
          </button>
        </form>
        
        <p className="login-footer">
          {tr.login_footer} <a href="#">{tr.login_footer_link}</a>
        </p>
      </div>
    </div>
  );
};
