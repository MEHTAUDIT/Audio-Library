export type AudioStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

// ADDED: Media type to distinguish audio from video content
export type MediaType = 'AUDIO' | 'VIDEO';

/** Check if a media item is video based on mediaType or mimeType fallback */
export function isVideo(media: { mediaType?: MediaType; mimeType?: string }): boolean {
  return media.mediaType === 'VIDEO' || (media.mimeType?.startsWith('video/') ?? false);
}

export interface Audio {
  id: string;
  title: string;
  description: string;
  speaker: string;
  topic: string;
  language: string;
  durationSeconds: number;
  mimeType: string;
  sizeBytes: number;
  url: string;
  storageKey: string | null;
  originalFilename: string | null;
  status: AudioStatus;
  mediaType: MediaType; // ADDED: "AUDIO" or "VIDEO"
  seriesId: string | null;    // ADDED: FK to series
  seriesName: string | null;  // ADDED: denormalized
  seriesOrder: number;        // ADDED: position in series
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  genres?: Genre[];
  tags?: Tag[];
  speakers?: Speaker[];
}

export interface Genre {
  id: string;
  name: string;
}

export interface Tag {
  id: string;
  name: string;
  slug: string;
  color: string;
}

export interface Speaker {
  id: string;
  name: string;
  avatarUrl: string;
}

export interface AudioStats {
  draftCount: number;
  publishedCount: number;
  archivedCount: number;
  totalCount: number;
}

export interface AudioUploadRequest {
  title: string;
  description: string;
  speaker: string;
  topic: string;
  language?: string;
  durationSeconds?: number;
  mimeType?: string;
  sizeBytes?: number;
}

export interface AudioUpdateRequest {
  title?: string;
  description?: string;
  speaker?: string;
  topic?: string;
  language?: string;
  genreIds?: string[];
  tagIds?: string[];
  speakerIds?: string[];
  seriesId?: string;      // ADDED: assign audio to a series
  seriesOrder?: number;   // ADDED: position within series
}

export interface BulkActionResult {
  action: string;
  totalRequested: number;
  successCount: number;
  skippedCount: number;
  failedCount: number;
  results: BulkActionItemResult[];
}

export interface BulkActionItemResult {
  audioId: string;
  status: 'SUCCESS' | 'SKIPPED' | 'FAILED';
  reason: string | null;
}

// ADDED: Series/Collection types

export interface Series {
  id: string;
  name: string;
  description: string | null;
  coverImageUrl: string | null;
  speakerId: string | null;
  speakerName: string | null;
  audioCount: number;
  totalDurationSeconds: number;
  createdAt: string;
  updatedAt: string;
}

export interface SeriesDetail extends Series {
  audioItems: Audio[];
}

export interface SeriesRequest {
  name: string;
  description?: string;
  speakerId?: string;
  coverImageUrl?: string;
}