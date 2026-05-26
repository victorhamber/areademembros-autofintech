/**
 * Proteção leve opcional — apenas em containers marcados com [data-protect-content].
 * O app em geral permite copiar texto, clique direito e atalhos normais do navegador.
 */

function isInsideProtectedContent(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest('[data-protect-content]'));
}

export function setupSecurity() {
  // Bloqueia menu/cópia só dentro de áreas explicitamente protegidas (ex.: leitor de conteúdo).
  document.addEventListener(
    'contextmenu',
    (e) => {
      if (!isInsideProtectedContent(e.target)) return;
      e.preventDefault();
    },
    { capture: true }
  );

  document.addEventListener(
    'copy',
    (e) => {
      if (!isInsideProtectedContent(e.target)) return;
      e.preventDefault();
      if (e.clipboardData) {
        e.clipboardData.setData('text/plain', '');
      }
    },
    { capture: true }
  );

  document.addEventListener(
    'dragstart',
    (e) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest('[data-allow-drag="true"]')) return;
      if (!isInsideProtectedContent(e.target)) return;
      e.preventDefault();
    },
    { capture: true }
  );
}
