export function getMediaDurationSeconds(file: File): Promise<number> {
  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const media = document.createElement(file.type.startsWith('video/') ? 'video' : 'audio');
    const timeoutId = window.setTimeout(() => finish(0), 10_000);

    const finish = (duration: number) => {
      window.clearTimeout(timeoutId);
      media.removeAttribute('src');
      media.load();
      URL.revokeObjectURL(objectUrl);
      resolve(Number.isFinite(duration) && duration > 0 ? Math.round(duration) : 0);
    };

    media.preload = 'metadata';
    media.onloadedmetadata = () => finish(media.duration);
    media.onerror = () => finish(0);
    media.src = objectUrl;
  });
}
