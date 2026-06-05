import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Clock,
  Download,
  Library,
  Link as LinkIcon,
  Loader2,
  Music,
  Pause,
  Play,
  Share2,
  Video,
} from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { FloatingMediaPlayer } from '../../components/audio/FloatingMediaPlayer';
import { playlistApi } from '../../lib/playlistApi';
import { useAudioPlayback } from '../../lib/useAudioPlayback';
import { isVideo, type Audio } from '../../types/audio';

const formatDuration = (seconds: number) => {
  const totalSeconds = Math.max(0, Math.floor(seconds || 0));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const remainingSeconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

const formatTotalDuration = (seconds: number) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
};

export function PublicPlaylistPage() {
  const { shareToken } = useParams<{ shareToken: string }>();
  const navigate = useNavigate();
  const [activeMedia, setActiveMedia] = useState<Audio | null>(null);
  const [copied, setCopied] = useState(false);

  const playlistQuery = useQuery({
    queryKey: ['publicPlaylist', shareToken],
    queryFn: () => playlistApi.getPublicPlaylist(shareToken!),
    enabled: Boolean(shareToken),
    retry: false,
  });

  const { mediaRef, playingAudioId, playAudio, isPlaying, stop } = useAudioPlayback({
    onEnded: () => setActiveMedia(null),
  });

  const playlist = playlistQuery.data;
  const items = playlist?.items ?? [];
  const totalDurationSeconds = useMemo(
    () => items.reduce((sum, audio) => sum + (audio.durationSeconds || 0), 0),
    [items]
  );

  const videoCount = useMemo(() => items.filter(isVideo).length, [items]);

  const handlePlay = async (audio: Audio) => {
    if (!shareToken) {
      return;
    }

    setActiveMedia(audio);
    await playAudio(
      {
        id: audio.id,
        mimeType: audio.mimeType,
        streamPath: playlistApi.publicStreamPath(shareToken, audio.id),
      },
      { restart: playingAudioId !== audio.id }
    );
  };

  const handleClosePlayer = () => {
    stop();
    setActiveMedia(null);
  };

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  if (playlistQuery.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-50">
        <Loader2 className="h-10 w-10 animate-spin text-primary-600" />
      </div>
    );
  }

  if (playlistQuery.isError || !playlist) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-50 px-6">
        <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-lg">
          <Library className="mx-auto mb-4 h-12 w-12 text-slate-300" />
          <h1 className="text-2xl font-bold text-slate-900">Playlist not available</h1>
          <p className="mt-3 text-slate-600">
            This link may have been revoked, made private, or removed.
          </p>
          <button
            type="button"
            onClick={() => navigate('/library')}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Browse library
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      <FloatingMediaPlayer
        mediaRef={mediaRef}
        media={activeMedia}
        onClose={handleClosePlayer}
        onEnded={() => setActiveMedia(null)}
      />

      <header className="border-b border-slate-200 bg-white/80 backdrop-blur-lg">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <button
            type="button"
            onClick={() => navigate('/library')}
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Library
          </button>
          <button
            type="button"
            onClick={handleCopyLink}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:border-primary-300 hover:text-primary-700"
          >
            {copied ? <LinkIcon className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
            {copied ? 'Copied' : 'Share'}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        <section className="rounded-3xl bg-gradient-to-br from-primary-700 via-primary-600 to-accent-500 p-8 text-white shadow-2xl shadow-primary-200">
          <div className="flex flex-col gap-6 md:flex-row md:items-center">
            <div className="flex h-28 w-28 shrink-0 items-center justify-center rounded-3xl bg-white/15">
              <Library className="h-14 w-14 text-white/55" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold uppercase tracking-wide text-white/65">Public playlist</p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-5xl">{playlist.name}</h1>
              {playlist.description && (
                <p className="mt-4 max-w-3xl whitespace-pre-line text-white/80">{playlist.description}</p>
              )}
              <div className="mt-5 flex flex-wrap gap-3 text-sm text-white/75">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/12 px-3 py-1.5">
                  <Music className="h-4 w-4" />
                  {playlist.itemCount} items
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/12 px-3 py-1.5">
                  <Clock className="h-4 w-4" />
                  {formatTotalDuration(totalDurationSeconds || playlist.totalDurationSeconds)}
                </span>
                {videoCount > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/12 px-3 py-1.5">
                    <Video className="h-4 w-4" />
                    {videoCount} video{videoCount === 1 ? '' : 's'}
                  </span>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="mt-8">
          {items.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white py-16 text-center">
              <Music className="mx-auto mb-4 h-12 w-12 text-slate-300" />
              <h2 className="text-xl font-semibold text-slate-800">No published items</h2>
              <p className="mt-2 text-slate-500">This playlist is public, but it has no published media yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((audio, index) => {
                const playing = playingAudioId === audio.id && isPlaying;
                const video = isVideo(audio);
                return (
                  <motion.div
                    key={audio.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.035 }}
                    className={`flex items-center gap-4 rounded-2xl border bg-white p-4 shadow-sm transition-colors ${
                      playing ? 'border-primary-200 bg-primary-50' : 'border-slate-200 hover:border-primary-200'
                    }`}
                  >
                    <span className="w-8 text-center text-sm font-medium text-slate-400">{index + 1}</span>
                    <button
                      type="button"
                      onClick={() => handlePlay(audio)}
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors ${
                        playing
                          ? 'bg-primary-600 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-primary-100 hover:text-primary-700'
                      }`}
                      aria-label={`${playing ? 'Pause' : 'Play'} ${audio.title}`}
                    >
                      {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 translate-x-0.5" />}
                    </button>

                    <div className="min-w-0 flex-1">
                      <Link to={`/library/${audio.id}`} className="block truncate font-semibold text-slate-900 hover:text-primary-700">
                        {audio.title}
                      </Link>
                      <div className="mt-1 flex flex-wrap gap-3 text-sm text-slate-500">
                        {audio.speaker && <span>{audio.speaker}</span>}
                        {audio.durationSeconds > 0 && <span>{formatDuration(audio.durationSeconds)}</span>}
                        {audio.topic && <span>{audio.topic}</span>}
                      </div>
                    </div>

                    {video && (
                      <span className="hidden items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 sm:inline-flex">
                        <Video className="h-3.5 w-3.5" />
                        Video
                      </span>
                    )}

                    {shareToken && (
                      <a
                        href={playlistApi.publicDownloadUrl(shareToken, audio.id)}
                        className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                        aria-label={`Download ${audio.title}`}
                      >
                        <Download className="h-5 w-5" />
                      </a>
                    )}
                  </motion.div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
