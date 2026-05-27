/** Abas da área de membros (links internos no texto da aula). */
export type MemberTabLink = 'home' | 'courses' | 'downloads' | 'validation' | 'profile';

export const MEMBER_TAB_LINK_OPTIONS: { value: MemberTabLink; label: string }[] = [
  { value: 'home', label: 'Início' },
  { value: 'courses', label: 'Cursos' },
  { value: 'downloads', label: 'Downloads' },
  { value: 'validation', label: 'Minhas licenças' },
  { value: 'profile', label: 'Perfil' },
];

export function memberTabHref(tab: MemberTabLink, newTab: boolean): string {
  const path = `/?tab=${encodeURIComponent(tab)}`;
  if (typeof window === 'undefined') return path;
  if (newTab) return `${window.location.origin}${path}`;
  return `#member-tab:${tab}`;
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
