/** Abas da área de membros (links internos no texto da aula). */
export type MemberTabLink = 'home' | 'courses' | 'downloads' | 'validation' | 'profile';

/** Mesma chave usada em App.tsx para restaurar a aba ao abrir nova guia. */
export const MEMBER_TAB_STORAGE_KEY = 'contentpro_member_tab';

export const MEMBER_TAB_LINK_OPTIONS: { value: MemberTabLink; label: string }[] = [
  { value: 'home', label: 'Início' },
  { value: 'courses', label: 'Cursos' },
  { value: 'downloads', label: 'Downloads' },
  { value: 'validation', label: 'Minhas licenças' },
  { value: 'profile', label: 'Perfil' },
];

export function persistMemberTab(tab: MemberTabLink): void {
  sessionStorage.setItem(MEMBER_TAB_STORAGE_KEY, tab);
}

/** URL do link no HTML — navegação real é feita via JS (hash ou sessionStorage). */
export function memberTabHref(tab: MemberTabLink, newTab: boolean): string {
  if (typeof window === 'undefined') {
    return newTab ? '/' : `#member-tab:${tab}`;
  }
  if (newTab) return `${window.location.origin}/`;
  return `#member-tab:${tab}`;
}

/** Abre a área de membros em nova guia na aba correta, sem ?tab= na URL. */
export function openMemberTabInNewWindow(tab: MemberTabLink): void {
  persistMemberTab(tab);
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  window.open(`${origin}/`, '_blank', 'noopener,noreferrer');
}

/** Remove ?tab= da barra de endereço (evita “travar” a navegação lateral). */
export function clearMemberTabQueryFromUrl(): void {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  if (!url.searchParams.has('tab')) return;
  url.searchParams.delete('tab');
  const qs = url.searchParams.toString();
  const next = url.pathname + (qs ? `?${qs}` : '') + url.hash;
  window.history.replaceState({}, '', next);
}

export function parseMemberTabFromHref(href: string): MemberTabLink | null {
  const h = href.trim();
  if (h.startsWith('#member-tab:')) {
    const tab = h.slice('#member-tab:'.length) as MemberTabLink;
    return MEMBER_TAB_LINK_OPTIONS.some((o) => o.value === tab) ? tab : null;
  }
  try {
    const url = h.startsWith('http') ? new URL(h) : new URL(h, window.location.origin);
    const tab = url.searchParams.get('tab') as MemberTabLink | null;
    if (tab && MEMBER_TAB_LINK_OPTIONS.some((o) => o.value === tab)) return tab;
  } catch {
    /* ignore */
  }
  return null;
}
