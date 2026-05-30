import type { Audio } from './audio';

export interface SpeakerProfileApiResponse {
  speakerId: string;
  name: string;
  bio: string | null;
  websiteUrl: string | null;
  profileImageUrl: string | null;
  totalAudioCount: number | null;
  audios: Audio[] | null;
}

export interface SpeakerProfileResponse {
  id: string;
  name: string;
  bio: string;
  avatarUrl: string;
  websiteUrl: string;
  totalAudios: number;
  audios: Audio[];
}

export interface SpeakerUpsertRequest {
  name: string;
  bio?: string;
  websiteUrl?: string;
  profileImageUrl?: string;
}