import type { Audio } from './audio';

export interface PlaylistShareResponse {
  playlistId: string;
  visibility: 'PUBLIC' | 'PRIVATE' | 'UNLISTED';
  shareToken: string;
  shareUrl: string;
}

export interface PublicPlaylist {
  id: string;
  name: string;
  description: string | null;
  visibility: 'PUBLIC';
  shareToken: string;
  itemCount: number;
  totalDurationSeconds: number;
  createdAt: string;
  updatedAt: string;
  items: Audio[];
}

export interface Playlist extends Omit<PublicPlaylist, 'visibility' | 'shareToken'> {
  visibility: 'PUBLIC' | 'PRIVATE' | 'UNLISTED';
  shareToken: string | null;
}

export interface PlaylistCreateRequest {
  name: string;
  description?: string;
  visibility?: Playlist['visibility'];
}

export interface PlaylistUpdateRequest {
  name?: string;
  description?: string;
  visibility?: Playlist['visibility'];
}
