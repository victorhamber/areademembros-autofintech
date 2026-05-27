export type MemberHeroCache = {
  backgroundUrl: string | null;
  kicker: string | null;
};

const HERO_CACHE_KEY = 'contentpro_member_hero_cache';

export function readCachedMemberHero(): MemberHeroCache | null {
  try {
    const raw = localStorage.getItem(HERO_CACHE_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw) as MemberHeroCache;
    if (!o || typeof o !== 'object') return null;
    return {
      backgroundUrl: typeof o.backgroundUrl === 'string' ? o.backgroundUrl : null,
      kicker: typeof o.kicker === 'string' ? o.kicker : null,
    };
  } catch {
    return null;
  }
}

export function writeCachedMemberHero(hero: MemberHeroCache): void {
  try {
    localStorage.setItem(HERO_CACHE_KEY, JSON.stringify(hero));
  } catch {
    /* ignore */
  }
}
