import type { Audio, AudioStats, AudioUpdateRequest } from '../types/audio';
import { api } from './api';

export interface AudioUploadData {
  file: File;
  title: string;
  description?: string;
  speaker?: string;
  category?: string;
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
    if (data.category) formData.append('category', data.category);

    const response = await api.post<Audio>('/audio', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  // Get audio stream URL
  getStreamUrl: (id: string): string => {
    return `http://localhost:8080/api/v1/audio/${id}/stream`; // can set here env var for base url...
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

  // Delete audio
  delete: async (id: string): Promise<void> => {
    await api.delete(`/audio/${id}`);
  },
};

