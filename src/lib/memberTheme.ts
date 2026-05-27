/** Tema da área de membros — cache local para evitar flash de cores no reload. */

export type MemberThemeSettings = {
  member_theme_bg_main?: string;
  member_theme_bg_secondary?: string;
  member_theme_bg_card?: string;
  member_theme_text_primary?: string;
  member_theme_text_secondary?: string;
  member_theme_accent_primary?: string;
  member_theme_accent_primary_hover?: string;
  member_theme_border_subtle?: string;
  member_theme_button_text?: string;
  member_theme_video_accent?: string;
};

const THEME_CACHE_KEY = 'contentpro_member_theme_cache';

export function applyMemberTheme(theme: MemberThemeSettings): void {
  const root = document.documentElement;
  const map: Array<[keyof MemberThemeSettings, string]> = [
    ['member_theme_bg_main', '--bg-main'],
    ['member_theme_bg_secondary', '--bg-secondary'],
    ['member_theme_bg_card', '--bg-card'],
    ['member_theme_text_primary', '--text-primary'],
    ['member_theme_text_secondary', '--text-secondary'],
    ['member_theme_accent_primary', '--accent-primary'],
    ['member_theme_accent_primary_hover', '--accent-primary-hover'],
    ['member_theme_border_subtle', '--border-subtle'],
    ['member_theme_button_text', '--button-text'],
    ['member_theme_video_accent', '--video-accent'],
  ];
  for (const [settingKey, cssVar] of map) {
    const value = String(theme?.[settingKey] || '').trim();
    if (value) root.style.setProperty(cssVar, value);
  }
  const setAccentSoft = (hexColor: string, cssVar: string, alpha: number) => {
    const hex = hexColor.match(/^#([0-9a-fA-F]{6})$/)?.[1];
    if (!hex) return;
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    root.style.setProperty(cssVar, `rgba(${r}, ${g}, ${b}, ${alpha})`);
  };
  setAccentSoft(String(theme?.member_theme_accent_primary || '').trim(), '--accent-soft', 0.28);
  setAccentSoft(String(theme?.member_theme_video_accent || '').trim(), '--video-accent-soft', 0.95);
}

export function readCachedMemberTheme(): MemberThemeSettings | null {
  try {
    const raw = localStorage.getItem(THEME_CACHE_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw) as MemberThemeSettings;
    return o && typeof o === 'object' ? o : null;
  } catch {
    return null;
  }
}

export function writeCachedMemberTheme(theme: MemberThemeSettings): void {
  try {
    localStorage.setItem(THEME_CACHE_KEY, JSON.stringify(theme));
  } catch {
    /* ignore */
  }
}

/** Aplica tema salvo antes do React montar (reduz flash de cores). */
export function applyCachedMemberTheme(): void {
  const cached = readCachedMemberTheme();
  if (cached) applyMemberTheme(cached);
}
