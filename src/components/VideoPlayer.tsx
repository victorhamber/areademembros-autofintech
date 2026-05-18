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
    customControls: true,
  },
  vimeo: {
    byline: false,
    portrait: false,
    title: false,
    customControls: true,
  },
  hideControls: true,
  clickToPlay: true,
  keyboard: { focused: true, global: false },
  tooltips: { controls: false, seek: true },
  ratio: '16:9',
};

/**
 * Estilo Presto Player: facade → Plyr com customControls + crop do iframe + capa ao pausar.
 */
export const VideoPlayer = memo(function VideoPlayer({ video, title }: Props) {
  const [activated, setActivated] = useState(false);
  const [posterUrl, setPosterUrl] = useState<string | null>(null);
  const [pauseCover, setPauseCover] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<Plyr | null>(null);
  const hasPlayedRef = useRef(false);

  const useFacade = video.provider === 'youtube' || video.provider === 'vimeo';
  const hideYoutubeUi = video.provider === 'youtube';

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

    const syncPoster = () => {
      if (posterUrl) player.poster = posterUrl;
    };

    const onPause = () => {
      if (hasPlayedRef.current) setPauseCover(true);
    };
    const onPlay = () => {
      hasPlayedRef.current = true;
      setPauseCover(false);
    };

    player.on('ready', () => {
      syncPoster();
      void player.play();
    });
    player.on('pause', onPause);
    player.on('play', onPlay);
    player.on('ended', onPause);

    return () => {
      player.off('pause', onPause);
      player.off('play', onPlay);
      player.off('ended', onPause);
    };
  }, [video.provider, video.videoId, posterUrl]);

  useEffect(() => {
    if (!activated || !useFacade) return;
    const cleanup = mountPlyr();
    return () => {
      cleanup?.();
      playerRef.current?.destroy();
      playerRef.current = null;
      hasPlayedRef.current = false;
      setPauseCover(false);
    };
  }, [activated, useFacade, mountPlyr]);

  const resumeFromCover = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPauseCover(false);
    void playerRef.current?.play();
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
        onClick={() => setActivated(true)}
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

  return (
    <div
      className={`video-player-wrap${hideYoutubeUi ? ' hide-youtube-ui' : ''}`}
    >
      <div ref={containerRef} className="video-player-plyr-mount" />
      {pauseCover && (
        <button
          type="button"
          className="video-player-pause-cover"
          onClick={resumeFromCover}
          aria-label="Continuar reprodução"
        >
          {posterUrl ? (
            <img className="video-player-pause-cover__poster" src={posterUrl} alt="" />
          ) : (
            <span className="video-player-facade__placeholder" aria-hidden />
          )}
          <span className="video-player-facade__play">
            <Play size={32} fill="currentColor" strokeWidth={0} />
          </span>
        </button>
      )}
    </div>
  );
});
