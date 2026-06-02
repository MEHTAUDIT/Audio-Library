export const AUDIO_EXTENSIONS = ['.mp3', '.wav', '.ogg', '.m4a', '.flac', '.aac', '.wma'];

export const VIDEO_EXTENSIONS = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v', '.wmv'];

export const MEDIA_EXTENSIONS = [...AUDIO_EXTENSIONS, ...VIDEO_EXTENSIONS];

export const MEDIA_ACCEPT_INPUT = [
  'audio/*',
  'video/*',
  ...MEDIA_EXTENSIONS,
].join(',');

export const MEDIA_DROPZONE_ACCEPT = {
  'audio/*': AUDIO_EXTENSIONS,
  'video/*': VIDEO_EXTENSIONS,
};

export function isMediaFilename(filename: string): boolean {
  const dotIndex = filename.lastIndexOf('.');
  if (dotIndex === -1) return false;
  const ext = filename.toLowerCase().slice(dotIndex);
  return MEDIA_EXTENSIONS.includes(ext);
}
