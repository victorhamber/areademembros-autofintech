import { useCallback, useEffect, useRef, useState, memo } from 'react';
import Plyr from 'plyr';
import 'plyr/dist/plyr.css';
import { Play } from 'lucide-react';
import type { VideoInfo } from '../lib/videoEmbed';
import { loadBestPoster, youtubePosterCandidates } from '../lib/videoEmbed';
import { percentFromTime } from '../lib/lessonProgress';

interface Props {
  video: VideoInfo;
  title?: string;
  /** Percentual salvo (0–100) para retomar a reprodução */
  initialPercent?: number;
  onProgress?: (percent: number) => void;
  onEnded?: () => void;
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

const PROGRESS_SAVE_INTERVAL_MS = 8000;
const COMPLETE_AT_PERCENT = 92;

export const VideoPlayer = memo(function VideoPlayer({
  video,
  title,
  initialPercent = 0,
  onProgress,
  onEnded,
}: Props) {
  const [activated, setActivated] = useState(false);
  const [posterUrl, setPosterUrl] = useState<string | null>(null);
  const [pauseCover, setPauseCover] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<Plyr | null>(null);
  const hasPlayedRef = useRef(false);
  const endedFiredRef = useRef(false);
  const lastSavedPercentRef = useRef(0);
  const initialResumePercentRef = useRef(0);
  const [resumePercentDisplay, setResumePercentDisplay] = useState(0);
  const onProgressRef = useRef(onProgress);
  const onEndedRef = useRef(onEnded);

  useEffect(() => {
    onProgressRef.current = onProgress;
    onEndedRef.current = onEnded;
  }, [onProgress, onEnded]);

  const useFacade = video.provider === 'youtube' || video.provider === 'vimeo';
  const hideYoutubeUi = video.provider === 'youtube';

  useEffect(() => {
    const bounded = Math.min(100, Math.max(0, Math.round(initialPercent)));
    initialResumePercentRef.current = bounded;
    setResumePercentDisplay(bounded);
    endedFiredRef.current = false;
    lastSavedPercentRef.current = bounded;
  }, [video.videoId, video.provider, initialPercent]);

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

  const reportProgress = useCallback((player: Plyr, force = false) => {
    const duration = player.duration;
    const current = player.currentTime;
    if (!duration || duration <= 0) return;
    const pct = percentFromTime(current, duration);
    if (!force && pct <= lastSavedPercentRef.current && pct < COMPLETE_AT_PERCENT) return;
    lastSavedPercentRef.current = Math.max(lastSavedPercentRef.current, pct);
    onProgressRef.current?.(pct);

    if (!endedFiredRef.current && pct >= COMPLETE_AT_PERCENT) {
      endedFiredRef.current = true;
      onEndedRef.current?.();
    }
  }, []);

  const seekToSavedPosition = useCallback(
    (player: Plyr) => {
      const resumePercent = initialResumePercentRef.current;
      if (resumePercent <= 2) return;
      const duration = player.duration;
      if (!duration || duration <= 0) return;
      const target = (resumePercent / 100) * duration;
      if (target > 1) player.currentTime = target;
    },
    []
  );

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
      if (hasPlayedRef.current) {
        setPauseCover(true);
        reportProgress(player, true);
      }
    };
    const onPlay = () => {
      hasPlayedRef.current = true;
      setPauseCover(false);
    };
    const onTimeUpdate = () => reportProgress(player);
    const onEndedEvent = () => {
      if (endedFiredRef.current) return;
      endedFiredRef.current = true;
      onProgressRef.current?.(100);
      onEndedRef.current?.();
    };

    player.on('ready', () => {
      syncPoster();
      seekToSavedPosition(player);
      const resumePercent = initialResumePercentRef.current;
      if (resumePercent > 2) {
        setPauseCover(true);
      } else {
        void player.play();
      }
    });
    player.on('pause', onPause);
    player.on('play', onPlay);
    player.on('timeupdate', onTimeUpdate);
    player.on('ended', onEndedEvent);

    const progressInterval = window.setInterval(() => {
      if (player && !player.paused) reportProgress(player, true);
    }, PROGRESS_SAVE_INTERVAL_MS);

    return () => {
      window.clearInterval(progressInterval);
      reportProgress(player, true);
      player.off('pause', onPause);
      player.off('play', onPlay);
      player.off('timeupdate', onTimeUpdate);
      player.off('ended', onEndedEvent);
    };
  }, [video.provider, video.videoId, posterUrl, reportProgress, seekToSavedPosition]);

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

  const handleFacadeActivate = () => {
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
        onClick={handleFacadeActivate}
        aria-label={title ? `Reproduzir: ${title}` : 'Reproduzir vídeo'}
      >
        {posterUrl ? (
          <img className="video-player-facade__poster" src={posterUrl} alt="" decoding="async" />
        ) : (
          <span className="video-player-facade__placeholder" aria-hidden />
        )}
        {resumePercentDisplay > 2 && (
          <span className="video-player-facade__resume-hint">Continuar de {resumePercentDisplay}%</span>
        )}
        <span className="video-player-facade__play">
          <Play size={32} fill="currentColor" strokeWidth={0} />
        </span>
      </button>
    );
  }

  return (
    <div className={`video-player-wrap${hideYoutubeUi ? ' hide-youtube-ui' : ''}`}>
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
