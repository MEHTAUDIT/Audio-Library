import { api } from './api';
import type { SpeakerProfileApiResponse, SpeakerProfileResponse } from '../types/speaker';

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
  getSpeakerProfile: async (speakerId: string): Promise<SpeakerProfileResponse> => {
    const response = await api.get<SpeakerProfileApiResponse>(`/speaker/${encodeURIComponent(speakerId)}`); // encoded URI component that will auto decoded by spring at backend...
    return mapSpeakerProfileResponse(response.data);
  },
};