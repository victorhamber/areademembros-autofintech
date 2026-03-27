import React, { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';
import './InstallPrompt.css';

export const InstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true) {
      setIsInstalled(true);
      return;
    }

    // Delay visibility slightly to not be too aggressive immediately
    const timer = setTimeout(() => setIsVisible(true), 2000);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstalled(false);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setIsInstalled(true);
      setIsVisible(false);
    };

    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsVisible(false);
      }
      setDeferredPrompt(null);
    } else {
      // Browser is in cooldown or it's iOS Safari
      setShowInstructions(true);
    }
  };

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;

  if (isInstalled || !isVisible) return null;

  return (
    <>
      <div className="install-prompt-banner fade-in">
        <div className="install-prompt-content">
          <div className="install-icon">
            <Download size={20} />
          </div>
          <div className="install-text">
            <strong>Instale o Aplicativo</strong>
            <p>Acesse offline e mais rápido</p>
          </div>
        </div>
        <button className="btn-install" onClick={handleInstallClick}>INSTALAR</button>
      </div>

      {showInstructions && (
        <div className="install-modal-overlay fade-in" onClick={() => setShowInstructions(false)}>
          <div className="install-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Como Instalar o Aplicativo</h3>
              <button className="btn-close" onClick={() => setShowInstructions(false)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              {isIOS ? (
                <>
                  <p>Para instalar no seu iPhone/iPad:</p>
                  <ol>
                    <li>Toque no ícone de <strong>Compartilhar</strong> (quadrado com seta pra cima) na barra inferior do Safari.</li>
                    <li>Role para baixo e toque em <strong>Adicionar à Tela de Início</strong> (Add to Home Screen).</li>
                  </ol>
                </>
              ) : (
                <>
                  <p>Parece que o seu navegador não exibiu a janela automática de instalação.</p>
                  <ol>
                    <li>Abra o menu do seu navegador (os <strong>três pontinhos verticais</strong> no canto superior).</li>
                    <li>Toque em <strong>Instalar Aplicativo</strong> ou <strong>Adicionar à tela inicial</strong>.</li>
                  </ol>
                </>
              )}
              <button className="btn-primary" style={{ width: '100%', marginTop: '15px' }} onClick={() => setShowInstructions(false)}>Entendi</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
