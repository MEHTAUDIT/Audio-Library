import { api } from './api';
import type { Series, SeriesDetail, SeriesRequest } from '../types/audio';

export const seriesApi = {

  getAll: async (): Promise<Series[]> => {
    const response = await api.get<Series[]>('/series');
    return response.data;
  },

  getById: async (id: string): Promise<SeriesDetail> => {
    const response = await api.get<SeriesDetail>(`/series/${id}`);
    return response.data;
  },

  create: async (data: SeriesRequest): Promise<Series> => {
    const response = await api.post<Series>('/series', data);
    return response.data;
  },

  update: async (id: string, data: Partial<SeriesRequest>): Promise<Series> => {
    const response = await api.put<Series>(`/series/${id}`, data);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/series/${id}`);
  },

  getPublished: async (): Promise<Series[]> => {
    const response = await api.get<Series[]>('/series/published');
    return response.data;
  },

  getPublishedById: async (id: string): Promise<SeriesDetail> => {
    const response = await api.get<SeriesDetail>(`/series/${id}/published`);
    return response.data;
  },


  addAudio: async (seriesId: string, audioId: string, order?: number): Promise<void> => {
    await api.post(`/series/${seriesId}/audio`, { audioId, order });
  },

  removeAudio: async (seriesId: string, audioId: string): Promise<void> => {
    await api.delete(`/series/${seriesId}/audio/${audioId}`);
  },

  reorder: async (seriesId: string, audioIds: string[]): Promise<void> => {
    await api.put(`/series/${seriesId}/reorder`, audioIds);
  },
};