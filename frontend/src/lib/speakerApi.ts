import { api } from './api';
import type {
  SpeakerProfileApiResponse,
  SpeakerProfileResponse,
  SpeakerSummary,
  SpeakerUpsertRequest,
} from '../types/speaker';

const withTenantForDirectAssetRequest = (url: string | null | undefined): string => {
  if (!url) return '';
  if (!url.startsWith('/api/')) return url;

  const tenantSubdomain = localStorage.getItem('tenantSubdomain') || 'demo';
  const separator = url.includes('?') ? '&' : '?';
  const tenantAwareUrl = `${url}${separator}tenant=${encodeURIComponent(tenantSubdomain)}`;
  const apiBaseUrl = api.defaults.baseURL;

  if (!apiBaseUrl) return tenantAwareUrl;

  try {
    return new URL(tenantAwareUrl, new URL(apiBaseUrl).origin).toString();
  } catch {
    return tenantAwareUrl;
  }
};

const mapSpeakerProfileResponse = (response: SpeakerProfileApiResponse): SpeakerProfileResponse => {
  return {
    id: response.speakerId,
    name: response.name,
    bio: response.bio ?? '',
    websiteUrl: response.websiteUrl ?? '',
    avatarUrl: withTenantForDirectAssetRequest(response.profileImageUrl),
    totalAudios: response.totalAudioCount ?? 0,
    audios: response.audios ?? [],
  };
};

export const speakerApi = {
  listSpeakers: async (query?: string, signal?: AbortSignal): Promise<SpeakerSummary[]> => {
    const params = query?.trim() ? { query: query.trim() } : {};
    const response = await api.get<SpeakerSummary[]>('/speaker', { params, signal });
    return response.data.map((speaker) => ({
      ...speaker,
      avatarUrl: withTenantForDirectAssetRequest(speaker.avatarUrl),
    }));
  },

  getSpeakerProfile: async (speakerId: string): Promise<SpeakerProfileResponse> => {
    const response = await api.get<SpeakerProfileApiResponse>(`/speaker/${encodeURIComponent(speakerId)}`); // encoded URI component that will auto decoded by spring at backend...
    return mapSpeakerProfileResponse(response.data);
  },

  createSpeaker: async (data: SpeakerUpsertRequest): Promise<SpeakerProfileResponse> => {
    const response = await api.post<SpeakerProfileApiResponse>('/speaker', data);
    return mapSpeakerProfileResponse(response.data);
  },

  updateSpeaker: async (speakerId: string, data: SpeakerUpsertRequest): Promise<SpeakerProfileResponse> => {
    const response = await api.put<SpeakerProfileApiResponse>(`/speaker/${encodeURIComponent(speakerId)}`, data);
    return mapSpeakerProfileResponse(response.data);
  },

  uploadProfileImage: async (speakerId: string, file: File): Promise<SpeakerProfileResponse> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post<SpeakerProfileApiResponse>(
      `/speaker/${encodeURIComponent(speakerId)}/profile-image`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    return mapSpeakerProfileResponse(response.data);
  },
};
