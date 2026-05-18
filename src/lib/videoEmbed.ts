/**
 * Converte links comuns (watch, youtu.be, shorts) em URL de embed para iframe.
 */
export function toVideoEmbedUrl(raw: string | null | undefined): string | null {
  const url = String(raw ?? '').trim();
  if (!url) return null;

  try {
    const parsed = new URL(url, 'https://example.invalid');
    const host = parsed.hostname.replace(/^www\./i, '').toLowerCase();

    if (host === 'youtu.be') {
      const id = parsed.pathname.replace(/^\//, '').split('/')[0];
      if (id) return `https://www.youtube-nocookie.com/embed/${id}`;
    }

    if (host === 'youtube.com' || host === 'youtube-nocookie.com' || host === 'm.youtube.com') {
      if (parsed.pathname.startsWith('/embed/')) {
        const id = parsed.pathname.split('/')[2];
        if (id) return `https://www.youtube-nocookie.com/embed/${id}`;
      }
      if (parsed.pathname.startsWith('/shorts/')) {
        const id = parsed.pathname.split('/')[2];
        if (id) return `https://www.youtube-nocookie.com/embed/${id}`;
      }
      const v = parsed.searchParams.get('v');
      if (v) return `https://www.youtube-nocookie.com/embed/${v}`;
    }

    if (host === 'vimeo.com') {
      const id = parsed.pathname.replace(/^\//, '').split('/')[0];
      if (id && /^\d+$/.test(id)) return `https://player.vimeo.com/video/${id}`;
    }

    if (host === 'player.vimeo.com') return url;
  } catch {
    /* fallback regex abaixo */
  }

  const ytWatch = url.match(/(?:youtube\.com\/watch\?.*[&?]v=|youtu\.be\/)([\w-]{11})/i);
  if (ytWatch) return `https://www.youtube-nocookie.com/embed/${ytWatch[1]}`;

  const ytShorts = url.match(/youtube\.com\/shorts\/([\w-]{11})/i);
  if (ytShorts) return `https://www.youtube-nocookie.com/embed/${ytShorts[1]}`;

  if (/\/embed\//i.test(url)) return url;

  const vimeo = url.match(/vimeo\.com\/(\d+)/i);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;

  return url;
}
