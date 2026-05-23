/** Chaves em `Setting` para o tema da área de membros (aluno). */
export const MEMBER_THEME_KEYS = [
  'member_theme_bg_main',
  'member_theme_bg_secondary',
  'member_theme_bg_card',
  'member_theme_text_primary',
  'member_theme_text_secondary',
  'member_theme_accent_primary',
  'member_theme_accent_primary_hover',
  'member_theme_border_subtle',
  'member_theme_button_text',
  'member_theme_video_accent',
] as const;

export type MemberThemeKey = (typeof MEMBER_THEME_KEYS)[number];

/** Valores padrão (tema escuro + acento azul). Usados no GET público, validação e reset no admin. */
export const MEMBER_THEME_DEFAULTS: Record<MemberThemeKey, string> = {
  member_theme_bg_main: '#0e0e0e',
  member_theme_bg_secondary: '#141414',
  member_theme_bg_card: '#181818',
  member_theme_text_primary: '#ffffff',
  member_theme_text_secondary: '#b3b3b3',
  member_theme_accent_primary: '#3b82f6',
  member_theme_accent_primary_hover: '#60a5fa',
  member_theme_border_subtle: 'rgba(255, 255, 255, 0.12)',
  member_theme_button_text: '#031018',
  member_theme_video_accent: '#e07a2f',
};
