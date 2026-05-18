export type VideoInfo = {
  provider: 'youtube' | 'vimeo' | 'unknown';
  videoId: string;
  embedUrl: string;
};

/**
 * Extrai provider + videoId + embedUrl de qualquer link de vídeo.
 */
export function parseVideoUrl(raw: string | null | undefined): VideoInfo | null {
  const url = String(raw ?? '').trim();
  if (!url) return null;

  function yt(id: string): VideoInfo {
    return { provider: 'youtube', videoId: id, embedUrl: `https://www.youtube-nocookie.com/embed/${id}` };
  }
  function vim(id: string): VideoInfo {
    return { provider: 'vimeo', videoId: id, embedUrl: `https://player.vimeo.com/video/${id}` };
  }

  try {
    const parsed = new URL(url, 'https://example.invalid');
    const host = parsed.hostname.replace(/^www\./i, '').toLowerCase();

    if (host === 'youtu.be') {
      const id = parsed.pathname.replace(/^\//, '').split('/')[0];
      if (id) return yt(id);
    }

    if (host === 'youtube.com' || host === 'youtube-nocookie.com' || host === 'm.youtube.com') {
      if (parsed.pathname.startsWith('/embed/')) {
        const id = parsed.pathname.split('/')[2];
        if (id) return yt(id);
      }
      if (parsed.pathname.startsWith('/shorts/')) {
        const id = parsed.pathname.split('/')[2];
        if (id) return yt(id);
      }
      const v = parsed.searchParams.get('v');
      if (v) return yt(v);
    }

    if (host === 'vimeo.com') {
      const id = parsed.pathname.replace(/^\//, '').split('/')[0];
      if (id && /^\d+$/.test(id)) return vim(id);
    }
    if (host === 'player.vimeo.com') {
      const id = parsed.pathname.split('/').pop();
      if (id && /^\d+$/.test(id)) return vim(id);
      return { provider: 'vimeo', videoId: '', embedUrl: url };
    }
  } catch { /* fallback */ }

  const ytWatch = url.match(/(?:youtube\.com\/watch\?.*[&?]v=|youtu\.be\/)([\w-]{11})/i);
  if (ytWatch) return yt(ytWatch[1]);

  const ytShorts = url.match(/youtube\.com\/shorts\/([\w-]{11})/i);
  if (ytShorts) return yt(ytShorts[1]);

  const vimeo = url.match(/vimeo\.com\/(\d+)/i);
  if (vimeo) return vim(vimeo[1]);

  return { provider: 'unknown', videoId: '', embedUrl: url };
}

/** Atalho legado — retorna só a embedUrl */
export function toVideoEmbedUrl(raw: string | null | undefined): string | null {
  const info = parseVideoUrl(raw);
  return info?.embedUrl ?? null;
}
