import { api } from './api';
import type {
  Playlist,
  PlaylistCreateRequest,
  PlaylistShareResponse,
  PlaylistUpdateRequest,
  PublicPlaylist,
} from '../types/playlist';

export const playlistApi = {
  getMyPlaylists: async (): Promise<Playlist[]> => {
    const response = await api.get<Playlist[]>('/playlists');
    return response.data;
  },

  getMyPlaylist: async (playlistId: string): Promise<Playlist> => {
    const response = await api.get<Playlist>(`/playlists/${encodeURIComponent(playlistId)}`);
    return response.data;
  },

  createPlaylist: async (data: PlaylistCreateRequest): Promise<Playlist> => {
    const response = await api.post<Playlist>('/playlists', data);
    return response.data;
  },

  updatePlaylist: async (playlistId: string, data: PlaylistUpdateRequest): Promise<Playlist> => {
    const response = await api.put<Playlist>(`/playlists/${encodeURIComponent(playlistId)}`, data);
    return response.data;
  },

  deletePlaylist: async (playlistId: string): Promise<void> => {
    await api.delete(`/playlists/${encodeURIComponent(playlistId)}`);
  },

  addItem: async (playlistId: string, audioId: string): Promise<Playlist> => {
    const response = await api.post<Playlist>(`/playlists/${encodeURIComponent(playlistId)}/items`, { audioId });
    return response.data;
  },

  removeItem: async (playlistId: string, audioId: string): Promise<Playlist> => {
    const response = await api.delete<Playlist>(
      `/playlists/${encodeURIComponent(playlistId)}/items/${encodeURIComponent(audioId)}`
    );
    return response.data;
  },

  getPublicPlaylist: async (shareToken: string): Promise<PublicPlaylist> => {
    const response = await api.get<PublicPlaylist>(`/public/playlists/${encodeURIComponent(shareToken)}`);
    return response.data;
  },

  sharePlaylist: async (playlistId: string): Promise<PlaylistShareResponse> => {
    const response = await api.post<PlaylistShareResponse>(`/playlists/${encodeURIComponent(playlistId)}/share`);
    return response.data;
  },

  regenerateShareLink: async (playlistId: string): Promise<PlaylistShareResponse> => {
    const response = await api.post<PlaylistShareResponse>(`/playlists/${encodeURIComponent(playlistId)}/share/regenerate`);
    return response.data;
  },

  revokeShareLink: async (playlistId: string): Promise<void> => {
    await api.delete(`/playlists/${encodeURIComponent(playlistId)}/share`);
  },

  publicStreamPath: (shareToken: string, audioId: string) =>
    `/public/playlists/${encodeURIComponent(shareToken)}/audio/${encodeURIComponent(audioId)}/stream`,

  publicDownloadUrl: (shareToken: string, audioId: string) =>
    `${api.defaults.baseURL}/public/playlists/${encodeURIComponent(shareToken)}/audio/${encodeURIComponent(audioId)}/download`,
};
