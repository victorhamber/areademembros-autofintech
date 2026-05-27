/** Detecta se o texto da aula foi salvo como HTML enriquecido. */
export function isLessonBodyHtml(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  return /<\/?[a-z][\s\S]*>/i.test(t);
}

/** Converte texto puro legado em parágrafos HTML. */
export function plainTextToLessonHtml(text: string): string {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  return lines.map((line) => `<p>${escapeHtml(line) || '&nbsp;'}</p>`).join('');
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Sanitiza HTML permitindo apenas formatação básica e links. */
export function sanitizeLessonBodyHtml(raw: string): string {
  if (!raw.trim()) return '';

  const doc = new DOMParser().parseFromString(raw, 'text/html');
  const allowedTags = new Set(['P', 'BR', 'STRONG', 'B', 'EM', 'I', 'SPAN', 'A', 'DIV']);

  function clean(node: Node): void {
    const children = [...node.childNodes];
    for (const child of children) {
      if (child.nodeType === Node.TEXT_NODE) continue;
      if (child.nodeType !== Node.ELEMENT_NODE) {
        child.parentNode?.removeChild(child);
        continue;
      }
      const el = child as HTMLElement;
      if (!allowedTags.has(el.tagName)) {
        while (el.firstChild) el.parentNode?.insertBefore(el.firstChild, el);
        el.parentNode?.removeChild(el);
        continue;
      }

      const attrs = [...el.attributes];
      for (const attr of attrs) {
        const name = attr.name.toLowerCase();
        if (el.tagName === 'A') {
          if (!['href', 'target', 'rel', 'data-member-tab'].includes(name)) {
            el.removeAttribute(attr.name);
          }
        } else if (el.tagName === 'SPAN') {
          if (name !== 'style') el.removeAttribute(attr.name);
        } else {
          el.removeAttribute(attr.name);
        }
      }

      if (el.tagName === 'SPAN') {
        const style = el.getAttribute('style') || '';
        const colorMatch = style.match(/(?:^|;)\s*color\s*:\s*([^;]+)/i);
        el.removeAttribute('style');
        if (colorMatch?.[1]) {
          const color = colorMatch[1].trim();
          if (/^#[0-9a-f]{3,8}$/i.test(color) || /^rgb\(/i.test(color) || /^hsl\(/i.test(color)) {
            el.setAttribute('style', `color:${color}`);
          }
        }
      }

      if (el.tagName === 'A') {
        const href = el.getAttribute('href') || '';
        if (!href || /^javascript:/i.test(href) || /^data:/i.test(href)) {
          el.removeAttribute('href');
        }
        const target = el.getAttribute('target');
        if (target === '_blank') {
          el.setAttribute('rel', 'noopener noreferrer');
        } else if (target) {
          el.removeAttribute('target');
        }
      }

      clean(el);
    }
  }

  clean(doc.body);
  return doc.body.innerHTML.trim();
}
