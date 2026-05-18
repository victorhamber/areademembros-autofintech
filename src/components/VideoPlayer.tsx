import { useEffect, useRef, memo } from 'react';
import Plyr from 'plyr';
import 'plyr/dist/plyr.css';
import type { VideoInfo } from '../lib/videoEmbed';

interface Props {
  video: VideoInfo;
  title?: string;
}

/**
 * Player customizado sem branding — usa Plyr para YouTube/Vimeo.
 * Para URLs desconhecidas, cai em iframe simples.
 */
export const VideoPlayer = memo(function VideoPlayer({ video, title }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<Plyr | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    if (video.provider === 'youtube' || video.provider === 'vimeo') {
      el.innerHTML = '';
      const wrapper = document.createElement('div');
      wrapper.setAttribute('data-plyr-provider', video.provider);
      wrapper.setAttribute('data-plyr-embed-id', video.videoId);
      el.appendChild(wrapper);

      playerRef.current = new Plyr(wrapper, {
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
          transparent: false,
        },
        hideControls: true,
        clickToPlay: true,
        keyboard: { focused: true, global: false },
        tooltips: { controls: false, seek: true },
        ratio: '16:9',
      });
    }

    return () => {
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, [video.provider, video.videoId]);

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

  return <div ref={containerRef} />;
});
