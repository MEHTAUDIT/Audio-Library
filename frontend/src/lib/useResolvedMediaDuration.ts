import { useEffect, useState } from 'react';
import type { Audio } from '../types/audio';
import { isVideo } from '../types/audio';
import { api } from './api';
import { audioApi } from './audioApi';
import { useAuth } from './auth';

const durationCache = new Map<string, Promise<number> | number>();

export async function resolveMediaDurationSeconds(
  media: Pick<Audio, 'id' | 'mimeType' | 'mediaType' | 'originalFilename' | 'storageKey' | 'url' | 'title'>
) {
  const cached = durationCache.get(media.id);
  if (typeof cached === 'number') {
    return cached;
  }
  if (cached) {
    return cached;
  }

  const promise = api.get(`/audio/${media.id}/stream`, { responseType: 'blob' })
    .then((response) => new Promise<number>((resolve) => {
      const streamedBlob = response.data as Blob;
      const normalizedBlob =
        (!streamedBlob.type || streamedBlob.type === 'application/octet-stream') && media.mimeType
          ? new Blob([streamedBlob], { type: media.mimeType })
          : streamedBlob;
      const objectUrl = URL.createObjectURL(normalizedBlob);
      const element = document.createElement(isVideo(media) ? 'video' : 'audio');
      const timeoutId = window.setTimeout(() => finish(0), 12_000);

      const finish = (duration: number) => {
        window.clearTimeout(timeoutId);
        element.removeAttribute('src');
        element.load();
        URL.revokeObjectURL(objectUrl);
        const roundedDuration = Number.isFinite(duration) && duration > 0 ? Math.round(duration) : 0;
        durationCache.set(media.id, roundedDuration);
        resolve(roundedDuration);
      };

      element.preload = 'metadata';
      element.onloadedmetadata = () => finish(element.duration);
      element.onerror = () => finish(0);
      element.src = objectUrl;
      element.load();
    }))
    .catch(() => {
      durationCache.delete(media.id);
      return 0;
    });

  durationCache.set(media.id, promise);
  return promise;
}

export function useResolvedMediaDuration(audio: Audio | null | undefined) {
  const { isAdmin } = useAuth();
  const storedDuration = audio?.durationSeconds || 0;
  const [resolvedDuration, setResolvedDuration] = useState(storedDuration);

  useEffect(() => {
    setResolvedDuration(storedDuration);
  }, [audio?.id, storedDuration]);

  useEffect(() => {
    if (!audio || storedDuration > 0) {
      return;
    }

    let cancelled = false;
    resolveMediaDurationSeconds(audio).then((duration) => {
      if (cancelled || duration <= 0) {
        return;
      }

      setResolvedDuration(duration);
      if (isAdmin) {
        audioApi.update(audio.id, { durationSeconds: duration }).catch(() => undefined);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [audio, isAdmin, storedDuration]);

  return resolvedDuration;
}
