const YT_CLEAN_PARAMS = 'modestbranding=1&rel=0&showinfo=0&iv_load_policy=3&color=white&cc_load_policy=0&disablekb=0&playsinline=1';

function ytEmbed(videoId: string): string {
  return `https://www.youtube-nocookie.com/embed/${videoId}?${YT_CLEAN_PARAMS}`;
}

/**
 * Converte links comuns (watch, youtu.be, shorts) em URL de embed para iframe.
 * Adiciona parâmetros para minimizar branding do YouTube.
 */
export function toVideoEmbedUrl(raw: string | null | undefined): string | null {
  const url = String(raw ?? '').trim();
  if (!url) return null;

  try {
    const parsed = new URL(url, 'https://example.invalid');
    const host = parsed.hostname.replace(/^www\./i, '').toLowerCase();

    if (host === 'youtu.be') {
      const id = parsed.pathname.replace(/^\//, '').split('/')[0];
      if (id) return ytEmbed(id);
    }

    if (host === 'youtube.com' || host === 'youtube-nocookie.com' || host === 'm.youtube.com') {
      if (parsed.pathname.startsWith('/embed/')) {
        const id = parsed.pathname.split('/')[2];
        if (id) return ytEmbed(id);
      }
      if (parsed.pathname.startsWith('/shorts/')) {
        const id = parsed.pathname.split('/')[2];
        if (id) return ytEmbed(id);
      }
      const v = parsed.searchParams.get('v');
      if (v) return ytEmbed(v);
    }

    if (host === 'vimeo.com') {
      const id = parsed.pathname.replace(/^\//, '').split('/')[0];
      if (id && /^\d+$/.test(id)) return `https://player.vimeo.com/video/${id}?title=0&byline=0&portrait=0`;
    }

    if (host === 'player.vimeo.com') return url;
  } catch {
    /* fallback regex abaixo */
  }

  const ytWatch = url.match(/(?:youtube\.com\/watch\?.*[&?]v=|youtu\.be\/)([\w-]{11})/i);
  if (ytWatch) return ytEmbed(ytWatch[1]);

  const ytShorts = url.match(/youtube\.com\/shorts\/([\w-]{11})/i);
  if (ytShorts) return ytEmbed(ytShorts[1]);

  if (/\/embed\//i.test(url)) return url;

  const vimeo = url.match(/vimeo\.com\/(\d+)/i);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}?title=0&byline=0&portrait=0`;

  return url;
}
