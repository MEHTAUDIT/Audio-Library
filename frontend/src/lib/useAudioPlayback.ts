import { useCallback, useEffect, useRef, useState } from 'react';
import type { Audio } from '../types/audio';
import { api } from './api';

interface StreamPlaybackOptions {
  restart?: boolean;
}

interface UseAudioPlaybackOptions {
  onEnded?: () => void;
}

export function useAudioPlayback(options: UseAudioPlaybackOptions = {}) {
  // CHANGED: HTMLMediaElement supports both <audio> and <video> elements
  // (play, pause, seek, timeupdate, loadedmetadata work identically on both)
  const mediaRef = useRef<HTMLMediaElement>(null);
  const objectUrlRef = useRef<string | null>(null);

  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const revokeObjectUrl = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    const audio = mediaRef.current;
    if (!audio) return;

    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    revokeObjectUrl();

    setPlayingAudioId(null);
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);
  }, [revokeObjectUrl]);

  useEffect(() => {
    const audio = mediaRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleLoadedMetadata = () => setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => {
      setIsPlaying(false);
      setPlayingAudioId(null);
      setCurrentTime(0);
      setDuration(0);
      options.onEnded?.();
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
      revokeObjectUrl();
    };
  }, [options.onEnded, revokeObjectUrl]);

  const playAudio = useCallback(
    async (audioItem: Pick<Audio, 'id'> & { mimeType?: string; streamPath?: string }, playbackOptions: StreamPlaybackOptions = {}) => {
      const audio = mediaRef.current;
      if (!audio) return;

      const shouldRestart = playbackOptions.restart === true;

      try {
        if (!shouldRestart && playingAudioId === audioItem.id) {
          if (audio.paused) {
            await audio.play();
          } else {
            audio.pause();
          }
          return;
        }

        revokeObjectUrl();
        audio.pause();

        const response = await api.get(audioItem.streamPath ?? `/audio/${audioItem.id}/stream`, {
          responseType: 'blob',
        });

        const streamedBlob = response.data as Blob;
        const normalizedBlob =
          (!streamedBlob.type || streamedBlob.type === 'application/octet-stream') && audioItem.mimeType
            ? new Blob([streamedBlob], { type: audioItem.mimeType })
            : streamedBlob;

        const audioUrl = URL.createObjectURL(normalizedBlob);
        objectUrlRef.current = audioUrl;

        audio.src = audioUrl;
        audio.load();
        setCurrentTime(0);
        setDuration(0);
        await audio.play();
        setPlayingAudioId(audioItem.id);
        setIsPlaying(true);
      } catch (error) {
        console.error('Audio playback error:', error);
        setIsPlaying(false);
      }
    },
    [playingAudioId, revokeObjectUrl]
  );

  return {
    mediaRef,        // CHANGED: renamed from audioRef
    audioRef: mediaRef, // ADDED: backward-compatible alias
    playingAudioId,
    currentTime,
    duration,
    isPlaying,
    setCurrentTime,
    setDuration,
    playAudio,
    stop,
  };
}
