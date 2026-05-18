/** Persistência local da última aula aberta (retomar navegação). */
const EAD_STATE_KEY = 'ebookpro_ead_state';

export type EadResumeState = {
  courseSlug: string;
  lessonId: string;
};

export function readEadResumeState(): EadResumeState | null {
  try {
    const raw = localStorage.getItem(EAD_STATE_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw) as EadResumeState;
    if (o?.courseSlug && o?.lessonId) return o;
  } catch {
    /* ignore */
  }
  return null;
}

export function writeEadResumeState(state: EadResumeState | null) {
  try {
    if (!state?.courseSlug || !state?.lessonId) {
      localStorage.removeItem(EAD_STATE_KEY);
      return;
    }
    localStorage.setItem(EAD_STATE_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

export function percentFromTime(current: number, duration: number): number {
  if (!Number.isFinite(current) || !Number.isFinite(duration) || duration <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((current / duration) * 100)));
}
