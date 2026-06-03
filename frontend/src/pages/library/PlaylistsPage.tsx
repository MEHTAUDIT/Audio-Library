import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Check,
  Copy,
  Eye,
  EyeOff,
  Library,
  Link as LinkIcon,
  Loader2,
  Music,
  Pause,
  Play,
  Plus,
  Search,
  Share2,
  Trash2,
  Video,
  X,
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FloatingMediaPlayer } from '../../components/audio/FloatingMediaPlayer';
import { audioApi } from '../../lib/audioApi';
import { playlistApi } from '../../lib/playlistApi';
import { useAudioPlayback } from '../../lib/useAudioPlayback';
import { isVideo, type Audio } from '../../types/audio';
import type { Playlist, PlaylistCreateRequest } from '../../types/playlist';

export function PlaylistsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<PlaylistCreateRequest>({ name: '', description: '', visibility: 'PRIVATE' });
  const [search, setSearch] = useState('');
  const [shareUrl, setShareUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [activeMedia, setActiveMedia] = useState<Audio | null>(null);

  const playlistsQuery = useQuery({
    queryKey: ['myPlaylists'],
    queryFn: playlistApi.getMyPlaylists,
  });

  const publishedQuery = useQuery({
    queryKey: ['audio', 'published'],
    queryFn: audioApi.getPublished,
  });

  const playlists = playlistsQuery.data ?? [];
  const selected = playlists.find((playlist) => playlist.id === selectedId) ?? null;

  useEffect(() => {
    if (!selectedId && playlists.length > 0) {
      setSelectedId(playlists[0].id);
    }
  }, [playlists, selectedId]);

  useEffect(() => {
    setShareUrl(
      selected?.shareToken
        ? `${window.location.origin}/playlist/${selected.shareToken}`
        : ''
    );
  }, [selected?.id, selected?.shareToken]);

  const { mediaRef, playingAudioId, playAudio, isPlaying, stop } = useAudioPlayback({
    onEnded: () => setActiveMedia(null),
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['myPlaylists'] });

  const createMutation = useMutation({
    mutationFn: playlistApi.createPlaylist,
    onSuccess: (playlist) => {
      refresh();
      setSelectedId(playlist.id);
      setShowCreate(false);
      setForm({ name: '', description: '', visibility: 'PRIVATE' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<PlaylistCreateRequest> }) =>
      playlistApi.updatePlaylist(id, data),
    onSuccess: refresh,
  });

  const deleteMutation = useMutation({
    mutationFn: playlistApi.deletePlaylist,
    onSuccess: () => {
      setSelectedId(null);
      refresh();
    },
  });

  const addMutation = useMutation({
    mutationFn: ({ playlistId, audioId }: { playlistId: string; audioId: string }) =>
      playlistApi.addItem(playlistId, audioId),
    onSuccess: refresh,
  });

  const removeMutation = useMutation({
    mutationFn: ({ playlistId, audioId }: { playlistId: string; audioId: string }) =>
      playlistApi.removeItem(playlistId, audioId),
    onSuccess: refresh,
  });

  const shareMutation = useMutation({
    mutationFn: playlistApi.sharePlaylist,
    onSuccess: (response) => {
      setShareUrl(response.shareUrl);
      refresh();
    },
  });

  const revokeMutation = useMutation({
    mutationFn: playlistApi.revokeShareLink,
    onSuccess: () => {
      setShareUrl('');
      refresh();
    },
  });

  const availableMedia = useMemo(() => {
    const inPlaylist = new Set(selected?.items.map((item) => item.id) ?? []);
    const query = search.trim().toLowerCase();
    return (publishedQuery.data ?? []).filter(
      (audio) =>
        !inPlaylist.has(audio.id) &&
        (!query ||
          audio.title.toLowerCase().includes(query) ||
          audio.speaker?.toLowerCase().includes(query))
    );
  }, [publishedQuery.data, search, selected?.items]);

  const handlePlay = async (audio: Audio) => {
    setActiveMedia(audio);
    await playAudio({ id: audio.id, mimeType: audio.mimeType }, { restart: playingAudioId !== audio.id });
  };

  const copyShareUrl = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  if (playlistsQuery.isLoading) {
    return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary-600" /></div>;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <FloatingMediaPlayer mediaRef={mediaRef} media={activeMedia} onClose={() => { stop(); setActiveMedia(null); }} />

      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <button onClick={() => navigate('/library')} className="text-sm font-medium text-slate-600 hover:text-slate-900">
            Back to library
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
          >
            <Plus className="h-4 w-4" />
            New playlist
          </button>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-6 px-6 py-8 lg:grid-cols-[280px_1fr]">
        <aside className="rounded-xl border border-slate-200 bg-white p-3">
          <div className="mb-3 flex items-center gap-2 px-2 py-1">
            <Library className="h-5 w-5 text-primary-600" />
            <h1 className="font-semibold text-slate-900">My playlists</h1>
          </div>
          {playlists.length === 0 ? (
            <p className="px-2 py-8 text-center text-sm text-slate-500">No playlists yet.</p>
          ) : (
            <div className="space-y-1">
              {playlists.map((playlist) => (
                <button
                  key={playlist.id}
                  onClick={() => setSelectedId(playlist.id)}
                  className={`w-full rounded-lg px-3 py-2.5 text-left transition-colors ${
                    selectedId === playlist.id ? 'bg-primary-50 text-primary-800' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span className="block truncate font-medium">{playlist.name}</span>
                  <span className="mt-0.5 block text-xs text-slate-500">{playlist.itemCount} items · {playlist.visibility}</span>
                </button>
              ))}
            </div>
          )}
        </aside>

        <section className="min-w-0">
          {!selected ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-white py-20 text-center">
              <Music className="mx-auto mb-4 h-12 w-12 text-slate-300" />
              <h2 className="text-xl font-semibold text-slate-800">Create your first playlist</h2>
              <p className="mt-2 text-slate-500">Collect published audio and video, then share it publicly.</p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="rounded-xl border border-slate-200 bg-white p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900">{selected.name}</h2>
                    <p className="mt-2 text-slate-600">{selected.description || 'No description.'}</p>
                  </div>
                  <button
                    onClick={() => confirm(`Delete "${selected.name}"?`) && deleteMutation.mutate(selected.id)}
                    className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                    aria-label="Delete playlist"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>

                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <select
                    value={selected.visibility}
                    onChange={(event) =>
                      updateMutation.mutate({ id: selected.id, data: { visibility: event.target.value as Playlist['visibility'] } })
                    }
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                  >
                    <option value="PRIVATE">Private</option>
                    <option value="PUBLIC">Public</option>
                  </select>

                  {shareUrl ? (
                    <>
                      <button onClick={copyShareUrl} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
                        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        {copied ? 'Copied' : 'Copy link'}
                      </button>
                      <Link to={`/playlist/${selected.shareToken}`} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
                        <Eye className="h-4 w-4" />
                        Open public page
                      </Link>
                      <button onClick={() => revokeMutation.mutate(selected.id)} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
                        <EyeOff className="h-4 w-4" />
                        Make private
                      </button>
                    </>
                  ) : (
                    <button onClick={() => shareMutation.mutate(selected.id)} className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-3 py-2 text-sm font-medium text-white hover:bg-primary-700">
                      <Share2 className="h-4 w-4" />
                      Make public and share
                    </button>
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-6">
                <h3 className="mb-4 text-lg font-semibold text-slate-900">Playlist items</h3>
                {selected.items.length === 0 ? (
                  <p className="py-8 text-center text-sm text-slate-500">No items yet. Add published media below.</p>
                ) : (
                  <div className="space-y-2">
                    {selected.items.map((audio, index) => {
                      const playing = playingAudioId === audio.id && isPlaying;
                      return (
                        <div key={audio.id} className="flex items-center gap-3 rounded-lg border border-slate-100 p-3">
                          <span className="w-6 text-center text-sm text-slate-400">{index + 1}</span>
                          <button onClick={() => handlePlay(audio)} className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-primary-100 hover:text-primary-700">
                            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                          </button>
                          <div className="min-w-0 flex-1">
                            <Link to={`/library/${audio.id}`} className="block truncate font-medium text-slate-900 hover:text-primary-700">{audio.title}</Link>
                            <span className="text-xs text-slate-500">{audio.speaker || 'Unknown speaker'}</span>
                          </div>
                          {isVideo(audio) && <Video className="h-4 w-4 text-blue-500" />}
                          <button onClick={() => removeMutation.mutate({ playlistId: selected.id, audioId: audio.id })} className="rounded p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600">
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-6">
                <h3 className="text-lg font-semibold text-slate-900">Add published media</h3>
                <div className="relative my-4">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search published media..." className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm" />
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  {availableMedia.map((audio) => (
                    <button key={audio.id} onClick={() => addMutation.mutate({ playlistId: selected.id, audioId: audio.id })} className="flex items-center gap-3 rounded-lg border border-slate-100 p-3 text-left hover:border-primary-200 hover:bg-primary-50">
                      <Plus className="h-4 w-4 shrink-0 text-primary-600" />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800">{audio.title}</span>
                      {isVideo(audio) && <Video className="h-4 w-4 shrink-0 text-blue-500" />}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </section>
      </main>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={() => setShowCreate(false)}>
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl" onClick={(event) => event.stopPropagation()}>
            <h2 className="text-xl font-semibold text-slate-900">New playlist</h2>
            <div className="mt-5 space-y-4">
              <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Playlist name" className="w-full rounded-lg border border-slate-200 px-3 py-2" />
              <textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Description" rows={3} className="w-full rounded-lg border border-slate-200 px-3 py-2" />
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-slate-600">Cancel</button>
              <button disabled={!form.name.trim()} onClick={() => createMutation.mutate({ ...form, name: form.name.trim() })} className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
                Create playlist
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
