export type AudioStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

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
}

