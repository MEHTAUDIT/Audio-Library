import { api } from './api';
import type {
  SpeakerProfileApiResponse,
  SpeakerProfileResponse,
  SpeakerSummary,
  SpeakerUpsertRequest,
} from '../types/speaker';

const mapSpeakerProfileResponse = (response: SpeakerProfileApiResponse): SpeakerProfileResponse => {
  return {
    id: response.speakerId,
    name: response.name,
    bio: response.bio ?? '',
    websiteUrl: response.websiteUrl ?? '',
    avatarUrl: response.profileImageUrl ?? '',
    totalAudios: response.totalAudioCount ?? 0,
    audios: response.audios ?? [],
  };
};

export const speakerApi = {
  listSpeakers: async (query?: string, signal?: AbortSignal): Promise<SpeakerSummary[]> => {
    const params = query?.trim() ? { query: query.trim() } : {};
    const response = await api.get<SpeakerSummary[]>('/speaker', { params, signal });
    return response.data;
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
};
