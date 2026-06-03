import type { Audio, AudioStats, AudioUpdateRequest, BulkActionResult } from '../types/audio';
import { api } from './api';

export interface AudioUploadData {
  file: File;
  title: string;
  description?: string;
  speaker?: string;
  speakerId?: string;
  category?: string;
  tags?: string[];
  genres?: string[];
  mimeType?: string;
  sizeBytes?: number;
  durationSeconds?: number;
}

export const audioApi = {
  // Get all audio, optionally filtered by status
  getAll: async (status?: string): Promise<Audio[]> => {
    const params = status ? { status } : {};
    const response = await api.get<Audio[]>('/audio', { params });
    return response.data;
  },

  // Get staging (DRAFT) audio
  getStaging: async (): Promise<Audio[]> => {
    const response = await api.get<Audio[]>('/audio/staging');
    return response.data;
  },

  // Get published audio
  getPublished: async (): Promise<Audio[]> => {
    const response = await api.get<Audio[]>('/audio/published');
    return response.data;
  },

  // Search published audio with optional filters
  searchPublished: async (filters: {
    speakerName?: string | null;
    genre?: string | null;
    tag?: string | null;
    audioSubstring?: string | null;
  }): Promise<Audio[]> => {
    const params: Record<string, string> = {};
    if (filters?.speakerName) params.speaker_name = filters.speakerName;
    if (filters?.genre) params.genre = filters.genre;
    if (filters?.tag) params.tag = filters.tag;
    if (filters?.audioSubstring) params.audio_substring = filters.audioSubstring;

    const response = await api.get<Audio[]>('/audio/search', { params });
    return response.data;
  },

  // Get audio statistics
  getStats: async (): Promise<AudioStats> => {
    const response = await api.get<AudioStats>('/audio/stats');
    return response.data;
  },

  // Get single audio by ID
  getById: async (id: string): Promise<Audio> => {
    const response = await api.get<Audio>(`/audio/${id}`);
    return response.data;
  },

  // Upload new audio file with metadata (creates as DRAFT)
  upload: async (data: AudioUploadData): Promise<Audio> => {
    const formData = new FormData();
    formData.append('file', data.file);
    formData.append('title', data.title);
    if (data.description) formData.append('description', data.description);
    if (data.speaker) formData.append('speaker', data.speaker);
    if (data.speakerId) formData.append('speakerId', data.speakerId);
    if (data.category) formData.append('category', data.category);
    data.tags?.forEach(tag => formData.append('tags', tag));
    data.genres?.forEach(genre => formData.append('genres', genre));
    if (data.mimeType) formData.append('mimeType', data.mimeType);
    if (typeof data.sizeBytes === 'number') formData.append('sizeBytes', String(data.sizeBytes));
    if (typeof data.durationSeconds === 'number' && data.durationSeconds > 0) {
      formData.append('durationSeconds', String(data.durationSeconds));
    }

    const response = await api.post<Audio>('/audio', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  // Get audio stream URL
  getStreamUrl: (id: string): string => {
    return `${api.defaults.baseURL}/audio/${id}/stream`;
  },

  // Update audio metadata
  update: async (id: string, data: AudioUpdateRequest): Promise<Audio> => {
    const response = await api.put<Audio>(`/audio/${id}`, data);
    return response.data;
  },

  // Publish audio
  publish: async (id: string): Promise<Audio> => {
    const response = await api.post<Audio>(`/audio/${id}/publish`);
    return response.data;
  },

  // Unpublish audio
  unpublish: async (id: string): Promise<Audio> => {
    const response = await api.post<Audio>(`/audio/${id}/unpublish`);
    return response.data;
  },

  // Archive audio
  archive: async (id: string): Promise<Audio> => {
    const response = await api.post<Audio>(`/audio/${id}/archive`);
    return response.data;
  },

  bulkPublish: async (ids: string[]): Promise<BulkActionResult> => {
    const response = await api.post<BulkActionResult>('/audio/bulk-publish', ids);
    return response.data;
  },

  bulkUnpublish: async (ids: string[]): Promise<BulkActionResult> => {
    const response = await api.post<BulkActionResult>('/audio/bulk-unpublish', ids);
    return response.data;
  },

  bulkArchive: async (ids: string[]): Promise<BulkActionResult> => {
    const response = await api.post<BulkActionResult>('/audio/bulk-archive', ids);
    return response.data;
  },

  // Delete audio
  delete: async (id: string): Promise<void> => {
    await api.delete(`/audio/${id}`);
  },
};

