import { useCallback, useEffect, useRef, useState, memo } from 'react';
import Plyr from 'plyr';
import 'plyr/dist/plyr.css';
import { Play } from 'lucide-react';
import type { VideoInfo } from '../lib/videoEmbed';
import { loadBestPoster, youtubePosterCandidates } from '../lib/videoEmbed';

interface Props {
  video: VideoInfo;
  title?: string;
}

const PLYR_OPTS: Plyr.Options = {
  controls: [
    'play-large',
    'play',
    'progress',
    'current-time',
    'duration',
    'mute',
    'volume',
    'settings',
    'fullscreen',
  ],
  settings: ['quality', 'speed'],
  youtube: {
    noCookie: true,
    rel: 0,
    showinfo: 0,
    iv_load_policy: 3,
    modestbranding: 1,
  },
  vimeo: {
    byline: false,
    portrait: false,
    title: false,
  },
  hideControls: true,
  clickToPlay: true,
  keyboard: { focused: true, global: false },
  tooltips: { controls: false, seek: true },
  ratio: '16:9',
};

/**
 * Player estilo Presto Player: facade com poster até o clique.
 * O iframe do YouTube só carrega depois — sem nome do canal, sem logo.
 */
export const VideoPlayer = memo(function VideoPlayer({ video, title }: Props) {
  const [activated, setActivated] = useState(false);
  const [posterUrl, setPosterUrl] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<Plyr | null>(null);

  const useFacade = video.provider === 'youtube' || video.provider === 'vimeo';

  useEffect(() => {
    if (video.provider !== 'youtube' || !video.videoId) {
      setPosterUrl(null);
      return;
    }
    let cancelled = false;
    loadBestPoster(youtubePosterCandidates(video.videoId)).then((url) => {
      if (!cancelled) setPosterUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [video.provider, video.videoId]);

  const mountPlyr = useCallback(() => {
    const el = containerRef.current;
    if (!el || video.provider === 'unknown') return;

    el.innerHTML = '';
    const wrapper = document.createElement('div');
    wrapper.className = 'plyr__video-embed';
    wrapper.setAttribute('data-plyr-provider', video.provider);
    wrapper.setAttribute('data-plyr-embed-id', video.videoId);
    el.appendChild(wrapper);

    const player = new Plyr(wrapper, PLYR_OPTS);
    playerRef.current = player;

    if (posterUrl) {
      player.poster = posterUrl;
    }

    player.on('ready', () => {
      if (posterUrl) player.poster = posterUrl;
      void player.play();
    });
  }, [video.provider, video.videoId, posterUrl]);

  useEffect(() => {
    if (!activated || !useFacade) return;
    mountPlyr();
    return () => {
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, [activated, useFacade, mountPlyr]);

  const handleActivate = () => {
    setActivated(true);
  };

  if (video.provider === 'unknown') {
    return (
      <iframe
        src={video.embedUrl}
        title={title || 'Vídeo'}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
        style={{ width: '100%', aspectRatio: '16/9', border: 0, display: 'block' }}
      />
    );
  }

  if (!activated && useFacade) {
    return (
      <button
        type="button"
        className="video-player-facade"
        onClick={handleActivate}
        aria-label={title ? `Reproduzir: ${title}` : 'Reproduzir vídeo'}
      >
        {posterUrl ? (
          <img className="video-player-facade__poster" src={posterUrl} alt="" decoding="async" />
        ) : (
          <span className="video-player-facade__placeholder" aria-hidden />
        )}
        <span className="video-player-facade__play">
          <Play size={32} fill="currentColor" strokeWidth={0} />
        </span>
      </button>
    );
  }

  return <div ref={containerRef} className="video-player-plyr-mount" />;
});
