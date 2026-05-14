import { api } from './api';
import type { Audio } from '../types/audio';

export interface UserPreferences {
  userId: string;
  preferredPlaybackSpeed: number;
  autoPlayNext: boolean;
  emailNotifications: boolean;
  pushNotifications: boolean;
  preferredLanguage: string;
  preferredAudioLength: string;
  theme: string;
}

export const userLibraryApi = {
  // ============ FAVORITE AUDIO ============
  
  favoriteAudio: async (audioId: string): Promise<void> => {
    await api.post(`/user/library/favorites/audio/${audioId}`);
  },

  unfavoriteAudio: async (audioId: string): Promise<void> => {
    await api.delete(`/user/library/favorites/audio/${audioId}`);
  },

  isAudioFavorited: async (audioId: string): Promise<boolean> => {
    const response = await api.get<{ favorited: boolean }>(`/user/library/favorites/audio/${audioId}/status`);
    return response.data.favorited;
  },

  getFavoriteAudios: async (): Promise<Audio[]> => {
    const response = await api.get<Audio[]>('/user/library/favorites/audio');
    return response.data;
  },

  // ============ FAVORITE SPEAKER ============

  favoriteSpeaker: async (speakerId: string): Promise<void> => {
    await api.post(`/user/library/favorites/speaker/${speakerId}`);
  },

  unfavoriteSpeaker: async (speakerId: string): Promise<void> => {
    await api.delete(`/user/library/favorites/speaker/${speakerId}`);
  },

  // ============ PLAYBACK QUEUE ============

  addToQueue: async (audioId: string): Promise<void> => {
    await api.post(`/user/library/queue/${audioId}`);
  },

  removeFromQueue: async (audioId: string): Promise<void> => {
    await api.delete(`/user/library/queue/${audioId}`);
  },

  getQueue: async (): Promise<Audio[]> => {
    const response = await api.get<Audio[]>('/user/library/queue');
    return response.data;
  },

  isInQueue: async (audioId: string): Promise<boolean> => {
    const response = await api.get<{ inQueue: boolean }>(`/user/library/queue/${audioId}/status`);
    return response.data.inQueue;
  },

  // ============ PLAYBACK POSITION ============

  updatePlaybackPosition: async (audioId: string, position: number): Promise<void> => {
    await api.post(`/user/library/position/${audioId}`, { position });
  },

  getPlaybackPosition: async (audioId: string): Promise<number> => {
    const response = await api.get<{ position: number }>(`/user/library/position/${audioId}`);
    return response.data.position;
  },

  // ============ HISTORY ============

  getHistory: async (limit: number = 20): Promise<Audio[]> => {
    const response = await api.get<Audio[]>('/user/library/history', { params: { limit } });
    return response.data;
  },

  // ============ PREFERENCES ============

  getPreferences: async (): Promise<UserPreferences> => {
    const response = await api.get<UserPreferences>('/user/library/preferences');
    return response.data;
  },

  updatePlaybackSpeed: async (speed: number): Promise<UserPreferences> => {
    const response = await api.put<UserPreferences>('/user/library/preferences/speed', { speed });
    return response.data;
  },
};

// ============ DISCOVERY API ============

export const discoveryApi = {
  getTrending: async (limit: number = 10): Promise<Audio[]> => {
    const response = await api.get<Audio[]>('/discovery/trending', { params: { limit } });
    return response.data;
  },

  getTopics: async (): Promise<{ name: string; count: number }[]> => {
    const response = await api.get<{ name: string; count: number }[]>('/discovery/topics');
    return response.data;
  },

  getAudioByTopic: async (topic: string): Promise<Audio[]> => {
    const response = await api.get<Audio[]>(`/discovery/topics/${encodeURIComponent(topic)}`);
    return response.data;
  },

  getRecommendations: async (limit: number = 10): Promise<Audio[]> => {
    const response = await api.get<Audio[]>('/discovery/recommendations', { params: { limit } });
    return response.data;
  },
};

