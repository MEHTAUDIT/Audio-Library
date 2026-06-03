import { Maximize2, Minimize2, X } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import type { Audio } from '../../types/audio';
import { isVideo } from '../../types/audio';

interface FloatingMediaPlayerProps {
  mediaRef: React.RefObject<HTMLMediaElement>;
  media: Audio | null | undefined;
  onClose: () => void;
  onEnded?: () => void;
}

export function FloatingMediaPlayer({
  mediaRef,
  media,
  onClose,
  onEnded,
}: FloatingMediaPlayerProps) {
  const [maximized, setMaximized] = useState(false);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const dragOffsetRef = useRef<{ x: number; y: number } | null>(null);
  const showVideo = Boolean(media && isVideo(media));

  useEffect(() => {
    if (!showVideo) {
      setMaximized(false);
      setPosition(null);
      dragOffsetRef.current = null;
    }
  }, [showVideo, media?.id]);

  useEffect(() => {
    if (!showVideo || maximized) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      if (!dragOffsetRef.current) {
        return;
      }

      const width = Math.min(360, window.innerWidth - 32);
      const height = width * 9 / 16 + 40;
      const nextX = Math.min(
        Math.max(8, event.clientX - dragOffsetRef.current.x),
        window.innerWidth - width - 8
      );
      const nextY = Math.min(
        Math.max(8, event.clientY - dragOffsetRef.current.y),
        window.innerHeight - height - 8
      );

      setPosition({ x: nextX, y: nextY });
    };

    const stopDragging = () => {
      dragOffsetRef.current = null;
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', stopDragging);
    window.addEventListener('pointercancel', stopDragging);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', stopDragging);
      window.removeEventListener('pointercancel', stopDragging);
    };
  }, [showVideo, maximized]);

  const handleDragStart = (event: React.PointerEvent<HTMLDivElement>) => {
    if (maximized) {
      return;
    }

    const container = event.currentTarget.closest('[data-floating-media-player]');
    const rect = container?.getBoundingClientRect();
    if (!rect) {
      return;
    }

    dragOffsetRef.current = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  };

  const floatingStyle =
    showVideo && !maximized && position
      ? { left: position.x, top: position.y, right: 'auto', bottom: 'auto' }
      : undefined;

  return (
    <div
      data-floating-media-player
      style={floatingStyle}
      className={
        showVideo
          ? `fixed z-50 overflow-hidden rounded-xl border border-white/10 bg-black shadow-2xl ${
              maximized
                ? 'inset-6'
                : 'right-4 bottom-4 w-[min(360px,calc(100vw-2rem))] sm:right-6 sm:bottom-6'
            }`
          : 'hidden'
      }
    >
      {showVideo && (
        <div
          className="flex cursor-move touch-none select-none items-center justify-between gap-2 bg-slate-950 px-3 py-2"
          onPointerDown={handleDragStart}
        >
          <span className="min-w-0 truncate text-sm font-medium text-white">
            {media?.title}
          </span>
          <div className="flex items-center gap-1" onPointerDown={(event) => event.stopPropagation()}>
            <button
              type="button"
              onClick={() => setMaximized((value) => !value)}
              className="rounded-md p-1.5 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
              title={maximized ? 'Restore video' : 'Maximize video'}
              aria-label={maximized ? 'Restore video' : 'Maximize video'}
            >
              {maximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1.5 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
              title="Close video"
              aria-label="Close video"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
      <video
        ref={mediaRef as React.RefObject<HTMLVideoElement>}
        className={showVideo ? (maximized ? 'h-[calc(100%-2.5rem)] w-full bg-black object-contain' : 'aspect-video w-full bg-black object-contain') : 'hidden'}
        controls={showVideo}
        playsInline
        onEnded={onEnded}
      />
    </div>
  );
}
