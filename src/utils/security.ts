/**
 * Módulo de Segurança Global
 * Objetivo: Dificultar o acesso e cópia não autorizada do conteúdo da plataforma.
 * NOTA: Nenhum mecanismo na web é 100% à prova de falhas devido à arquitetura dos navegadores,
 * mas estes bloqueios afastam a grande maioria dos usuários mal-intencionados.
 */

export function setupSecurity() {
  // 1. Bloquear clique direito (Menu de Contexto)
  document.addEventListener('contextmenu', (e) => {
    e.preventDefault();
  }, { capture: true });

  // 2. Bloquear arrastar imagens ou links (Drag & Drop)
  document.addEventListener('dragstart', (e) => {
    e.preventDefault();
  });

  // 3. Bloquear atalhos específicos do teclado
  document.addEventListener('keydown', (e) => {
    const key = e.key;
    const keyCode = e.keyCode || e.which;

    // F12 (DevTools)
    if (keyCode === 123) {
      e.preventDefault();
    }
    
    // PrintScreen (Nem sempre o navegador consegue interceptar, mas tentamos)
    if (keyCode === 44 || key === 'PrintScreen') {
      // Tática: Colar a área de transferência vazia para frustrar a captura (se o navegador permitir).
      try {
        navigator.clipboard.writeText('');
      } catch (err) {}
      e.preventDefault();
    }

    if (e.ctrlKey || e.metaKey) { // MetaKey para Mac (Command)
      // Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C (DevTools)
      if (e.shiftKey && (key === 'I' || key === 'i' || key === 'J' || key === 'j' || key === 'C' || key === 'c')) {
        e.preventDefault();
      }
      // Ctrl+U / Cmd+U (Ver código original)
      if (key === 'U' || key === 'u') {
        e.preventDefault();
      }
      // Ctrl+P / Cmd+P (Imprimir)
      if (key === 'P' || key === 'p') {
        e.preventDefault();
      }
      // Opcional: Bloquear Ctrl+C / Cmd+C (Copiar) e Ctrl+S / Cmd+S (Salvar página)
      if (key === 'C' || key === 'c' || key === 'S' || key === 's') {
        e.preventDefault();
      }
      // Bloquear ferramentas de captura de tela web no Windows (Shift + Win/Meta + S)
      if (e.shiftKey && (key === 'S' || key === 's')) {
         e.preventDefault();
      }
    }
  }, { capture: true });

  // 4. Bloquear cópia e recorte via menu de edição ou atalhos não mapeados
  document.addEventListener('copy', (e) => {
    e.preventDefault();
    if (e.clipboardData) {
      e.clipboardData.setData('text/plain', 'Conteúdo protegido.');
    }
  });
  
  document.addEventListener('cut', (e) => {
    e.preventDefault();
  });

  // 5. Anti-debugger (Armadilha para quem conseguir abrir o DevTools)
  // Se o usuário abrir o F12 por outro meio (ex: menu do Chrome), o loop do debugger
  // vai travar a aba ou tornar a inspeção muito lenta/irritante.
  const devtoolsLoop = () => {
    // Executa e para o tempo no navegador repetidamente
    setInterval(() => {
      // Apenas aciona se o usuário tiver as ferramentas de desenvolvedor abertas com pausa ativada.
      try { (function() { return false; })['constructor']('debugger')(); } catch(err) {}
    }, 1000);
  };
  devtoolsLoop();
}
