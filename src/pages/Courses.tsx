import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, ChevronDown, ChevronRight, ExternalLink, GraduationCap, Lock, Play } from 'lucide-react';
import type { Lang } from '../i18n/translations';
import { t } from '../i18n/translations';
import { toVideoEmbedUrl } from '../lib/videoEmbed';
import './Courses.css';

type Lesson = {
  id: string;
  title: string;
  sortOrder: number;
  ebookId: string | null;
  videoUrl?: string | null;
  bodyText?: string | null;
  actionLabel?: string | null;
  actionUrl?: string | null;
};
type Module = { id: string; title: string; sortOrder: number; lessons: Lesson[] };
type Course = {
  id: string;
  title: string;
  slug: string;
  coverUrl?: string | null;
  modules: Module[];
  isPublic?: boolean;
  hasAccess?: boolean;
  salesPageUrl?: string | null;
  requiredSystemIds?: string[];
};

type ProgressMap = Record<string, { completed: boolean; percent: number }>;

function courseLessonStats(course: Course, progress: ProgressMap) {
  const lessons = course.modules.flatMap(m => m.lessons);
  const total = lessons.length;
  if (!total) return { pct: 0, done: 0, total: 0 };
  const done = lessons.filter(l => progress[l.id]?.completed).length;
  return { pct: Math.round((done / total) * 100), done, total };
}

function firstSuggestedLesson(course: Course, progress: ProgressMap): Lesson | null {
  const lessons = course.modules.flatMap((m) => m.lessons);
  if (!lessons.length) return null;
  const firstPending = lessons.find((l) => !progress[l.id]?.completed);
  return firstPending || lessons[0] || null;
}

interface CoursesProps {
  userId: string;
  lang: Lang;
  /** Quando vindo da home: abre o curso com este slug e dispara consume uma vez. */
  initialSlug?: string | null;
  onInitialSlugConsumed?: () => void;
  authHeaders?: (json?: boolean) => Record<string, string>;
}

export function Courses({ userId, lang, initialSlug, onInitialSlugConsumed, authHeaders }: CoursesProps) {
  const tr = t(lang);
  const [courses, setCourses] = useState<Course[]>([]);
  const [progress, setProgress] = useState<ProgressMap>({});
  const [loading, setLoading] = useState(true);

  const [activeCourseSlug, setActiveCourseSlug] = useState('');
  const [activeLessonId, setActiveLessonId] = useState('');
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());

  const buildHeaders = (): Record<string, string> => {
    if (authHeaders) return authHeaders();
    const h: Record<string, string> = { 'x-user-id': userId };
    const tok = localStorage.getItem('ebookpro_token');
    if (tok) h['Authorization'] = `Bearer ${tok}`;
    return h;
  };

  useEffect(() => {
    fetch('/api/public/courses', { headers: buildHeaders() })
      .then(r => r.json())
      .then((data: Course[]) => setCourses(Array.isArray(data) ? data : []))
      .catch(() => setCourses([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const slug = initialSlug?.trim();
    if (!slug || !courses.length) return;
    const target = courses.find(c => c.slug === slug);
    if (!target) return;
    if (target.hasAccess === false) {
      const url = target.salesPageUrl;
      if (url) {
        window.location.href = url;
      } else {
        alert('Este curso é exclusivo para clientes da oferta. Você ainda não tem licença para acessá-lo.');
      }
      onInitialSlugConsumed?.();
      return;
    }
    setActiveCourseSlug(slug);
    onInitialSlugConsumed?.();
  }, [initialSlug, courses, onInitialSlugConsumed]);

  useEffect(() => {
    if (!userId) return;
    fetch('/api/me/course-progress', { headers: buildHeaders() })
      .then(r => r.json())
      .then((data: { progress?: { lessonId: string; completed: boolean; percent: number }[] }) => {
        const m: ProgressMap = {};
        for (const p of data.progress || []) {
          m[p.lessonId] = { completed: p.completed, percent: p.percent };
        }
        setProgress(m);
      })
      .catch(() => {});
  }, [userId, courses.length]);

  const markLesson = (lessonId: string, completed: boolean) => {
    setProgress(prev => ({ ...prev, [lessonId]: { completed, percent: completed ? 100 : 0 } }));
    const h = { ...buildHeaders(), 'Content-Type': 'application/json' };
    fetch('/api/me/lesson-progress', {
      method: 'POST',
      headers: h,
      body: JSON.stringify({ lessonId, completed, percent: completed ? 100 : 0 })
    });
  };

  const activeCourse = useMemo(() => {
    if (!activeCourseSlug) return null;
    return courses.find(c => c.slug === activeCourseSlug) || null;
  }, [courses, activeCourseSlug]);

  const activeLesson = useMemo(() => {
    if (!activeCourse || !activeLessonId) return null;
    for (const m of activeCourse.modules) {
      const found = m.lessons.find(l => l.id === activeLessonId);
      if (found) return found;
    }
    return null;
  }, [activeCourse, activeLessonId]);

  const activeLessonVideoEmbed = useMemo(
    () => toVideoEmbedUrl(activeLesson?.videoUrl),
    [activeLesson?.videoUrl]
  );

  const allCourseLessons = useMemo(() => {
    if (!activeCourse) return [];
    return activeCourse.modules.flatMap(m => m.lessons);
  }, [activeCourse]);

  const currentLessonIndex = allCourseLessons.findIndex(l => l.id === activeLessonId);
  const prevLesson = currentLessonIndex > 0 ? allCourseLessons[currentLessonIndex - 1] : null;
  const nextLesson = currentLessonIndex >= 0 && currentLessonIndex < allCourseLessons.length - 1 ? allCourseLessons[currentLessonIndex + 1] : null;

  const toggleModule = (modId: string) => {
    setExpandedModules(prev => {
      const n = new Set(prev);
      if (n.has(modId)) n.delete(modId);
      else n.add(modId);
      return n;
    });
  };

  useEffect(() => {
    if (activeCourse) {
      setExpandedModules(new Set(activeCourse.modules.map(m => m.id)));
    }
  }, [activeCourse?.id]);

  const openLesson = (lessonId: string) => {
    setActiveLessonId(lessonId);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    if (!activeCourse) return;
    if (activeLessonId && allCourseLessons.some((l) => l.id === activeLessonId)) return;
    const next = firstSuggestedLesson(activeCourse, progress);
    if (next) setActiveLessonId(next.id);
  }, [activeCourse?.id, allCourseLessons.length, activeLessonId, progress]);

  // --- LOADING ---
  if (loading) {
    return (
      <div className="courses-page">
        <p className="courses-loading">{tr.courses_loading}</p>
      </div>
    );
  }

  // --- EMPTY ---
  if (!courses.length) {
    return (
      <div className="courses-page courses-page--empty">
        <GraduationCap size={40} style={{ opacity: 0.3, marginBottom: 8 }} />
        <h1 className="courses-empty-title">{tr.nav_courses}</h1>
        <p className="courses-empty-desc">{tr.courses_empty}</p>
      </div>
    );
  }

  // --- COURSE DETAIL (modules + lessons sidebar) ---
  if (activeCourse) {
    const stats = courseLessonStats(activeCourse, progress);
    const lessonDone = !!activeLesson && !!progress[activeLesson.id]?.completed;
    const lessonOrder = new Map<string, number>();
    allCourseLessons.forEach((l, idx) => lessonOrder.set(l.id, idx + 1));
    const suggestedLesson = firstSuggestedLesson(activeCourse, progress);
    const remaining = Math.max(0, stats.total - stats.done);
    return (
      <div className="courses-page">
        <section className="course-detail-header">
          <button type="button" className="courses-back" onClick={() => { setActiveCourseSlug(''); setActiveLessonId(''); }}>
            <ArrowLeft size={16} />
            Voltar aos cursos
          </button>
          <h1 className="course-detail-title">{activeCourse.title}</h1>
          <p className="course-detail-sub">
            {stats.done} de {stats.total} aulas concluídas · {stats.pct}%
          </p>
          <div className="course-detail-bar">
            <div style={{ width: `${stats.pct}%` }} />
          </div>
          <div className="course-detail-kpis">
            <div className="course-detail-kpi">
              <span>Progresso</span>
              <strong>{stats.pct}%</strong>
            </div>
            <div className="course-detail-kpi">
              <span>Concluídas</span>
              <strong>{stats.done}</strong>
            </div>
            <div className="course-detail-kpi">
              <span>Restantes</span>
              <strong>{remaining}</strong>
            </div>
          </div>
        </section>

        <section className="course-player-layout">
          <aside className="course-player-sidebar">
            {activeCourse.modules.map((mod) => {
              const isOpen = expandedModules.has(mod.id);
              const modDone = mod.lessons.filter((l) => progress[l.id]?.completed).length;
              return (
                <div key={mod.id} className="course-module-block">
                  <button
                    type="button"
                    className={`course-module-header ${isOpen ? 'course-module-header--open' : ''}`}
                    onClick={() => toggleModule(mod.id)}
                  >
                    <div className="course-module-header-left">
                      {isOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                      <span className="course-module-header-title">{mod.title}</span>
                    </div>
                    <span className="course-module-header-count">
                      {modDone}/{mod.lessons.length}
                    </span>
                  </button>

                  {isOpen && (
                    <ul className="course-lesson-list">
                      {mod.lessons.map((les) => {
                        const done = !!progress[les.id]?.completed;
                        const isSuggested = suggestedLesson?.id === les.id;
                        const isActive = activeLesson?.id === les.id;
                        return (
                          <li key={les.id} className="course-lesson-item">
                            <button
                              type="button"
                              className={`course-lesson-btn ${isSuggested ? 'course-lesson-btn--suggested' : ''} ${
                                isActive ? 'course-lesson-btn--active' : ''
                              }`}
                              onClick={() => openLesson(les.id)}
                            >
                              <span className={`course-lesson-check ${done ? 'course-lesson-check--done' : ''}`}>
                                {done ? <Check size={12} /> : <Play size={10} />}
                              </span>
                              <span className="course-lesson-name">{les.title}</span>
                              {isSuggested && <span className="course-lesson-tag">Próxima</span>}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              );
            })}
          </aside>

          <div className="course-player-main">
            {activeLesson ? (
              <div className="lesson-page">
                <div className="lesson-content">
                  {activeLessonVideoEmbed ? (
                    <div className="lesson-video">
                      <iframe
                        src={activeLessonVideoEmbed}
                        title={activeLesson.title}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen
                        referrerPolicy="strict-origin-when-cross-origin"
                      />
                    </div>
                  ) : (
                    <div className="lesson-video lesson-video--empty">Sem vídeo nesta aula.</div>
                  )}

                  <div className="lesson-info">
                    <span className="course-lesson-tag">Aula {lessonOrder.get(activeLesson.id) || '-'}</span>
                    <h1 className="lesson-info-title">{activeLesson.title}</h1>

                    {activeLesson.bodyText && (
                      <div className="lesson-info-body">
                        {activeLesson.bodyText.split('\n').map((line, idx) => (
                          <p key={idx}>{line || '\u00A0'}</p>
                        ))}
                      </div>
                    )}

                    {activeLesson.actionUrl && (
                      <a className="lesson-info-action" href={activeLesson.actionUrl} target="_blank" rel="noreferrer">
                        <ExternalLink size={16} />
                        {activeLesson.actionLabel || 'Acessar link'}
                      </a>
                    )}

                    <div className="lesson-info-footer">
                      <button
                        type="button"
                        className={`lesson-mark-btn ${lessonDone ? 'lesson-mark-btn--done' : ''}`}
                        onClick={() => markLesson(activeLesson.id, !lessonDone)}
                      >
                        <Check size={16} />
                        {lessonDone ? 'Aula concluída' : 'Marcar como concluída'}
                      </button>

                      {prevLesson && (
                        <button type="button" className="lesson-next-btn" onClick={() => openLesson(prevLesson.id)}>
                          Aula anterior
                        </button>
                      )}
                      {nextLesson && (
                        <button type="button" className="lesson-next-btn" onClick={() => openLesson(nextLesson.id)}>
                          Próxima aula
                        </button>
                      )}
                    </div>

                  </div>
                </div>
              </div>
            ) : (
              <div className="lesson-video lesson-video--empty">Selecione uma aula na coluna da esquerda.</div>
            )}
          </div>
        </section>
      </div>
    );
  }

  // --- HUB (course cards) ---
  return (
    <div className="courses-page">
      <div className="courses-hub-header">
        <GraduationCap size={22} />
        <div>
          <h1 className="courses-hub-title">Meus cursos</h1>
          <p className="courses-hub-sub">Selecione um curso para começar a estudar.</p>
        </div>
      </div>

      <section className="courses-grid">
        {courses.map(course => {
          const st = courseLessonStats(course, progress);
          const locked = course.hasAccess === false;
          const handleClick = () => {
            if (!locked) {
              setActiveCourseSlug(course.slug);
              return;
            }
            const url = course.salesPageUrl;
            if (url) {
              window.location.href = url;
            } else {
              alert('Este curso é exclusivo para clientes da oferta. Você ainda não tem licença para acessá-lo.');
            }
          };
          return (
            <button
              key={course.id}
              type="button"
              className={`course-tile${locked ? ' course-tile--locked' : ''}`}
              onClick={handleClick}
              aria-disabled={locked || undefined}
            >
              {course.coverUrl ? (
                <img
                  src={course.coverUrl}
                  alt={course.title}
                  className="course-tile-cover"
                  style={locked ? { filter: 'grayscale(100%)' } : undefined}
                />
              ) : (
                <div className="course-tile-cover course-tile-cover--placeholder">
                  <GraduationCap size={32} />
                </div>
              )}
              {locked && (
                <div className="course-tile-lock" aria-hidden>
                  <Lock size={22} />
                </div>
              )}
              <div className="course-tile-body">
                <div className="course-tile-title">{course.title}</div>
                <div className="course-tile-meta">
                  {locked
                    ? 'Conteúdo exclusivo · liberar acesso'
                    : `${course.modules.length} módulos · ${st.total} aulas`}
                </div>
                {!locked && (
                  <>
                    <div className="course-tile-bar">
                      <div style={{ width: `${st.pct}%` }} />
                    </div>
                    <div className="course-tile-footer">
                      <span className="course-tile-pct">{st.pct}% concluído</span>
                      <span className="course-tile-cta">Acessar</span>
                    </div>
                  </>
                )}
                {locked && (
                  <div className="course-tile-footer">
                    <span className="course-tile-pct">Sem licença</span>
                    <span className="course-tile-cta">Ver oferta</span>
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </section>
    </div>
  );
}
