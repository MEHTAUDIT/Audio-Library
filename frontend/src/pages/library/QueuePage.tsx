import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
    AlertCircle,
    ArrowLeft,
    Clock,
    ListMusic,
    Music2,
    Pause,
    Play,
    RefreshCw,
    Shuffle,
    Trash2,
    User,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FloatingMediaPlayer } from '../../components/audio/FloatingMediaPlayer';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card, CardContent } from '../../components/ui/Card';
import { audioApi } from '../../lib/audioApi';
import { useAuth } from '../../lib/auth';
import { useAudioPlayback } from '../../lib/useAudioPlayback';
import { resolveMediaDurationSeconds } from '../../lib/useResolvedMediaDuration';
import { userLibraryApi } from '../../lib/userLibraryApi';
import type { Audio } from '../../types/audio';

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0 },
};

function formatDuration(seconds: number) {
  const safeSeconds = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  const mins = Math.floor(safeSeconds / 60);
  const secs = safeSeconds % 60;

  if (mins >= 60) {
    const hours = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    return `${hours}h ${remainingMins}m`;
  }

  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function shuffleIds(ids: string[]) {
  const shuffled = [...ids];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
  }

  return shuffled;
}

function QueueSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="flex items-center gap-4 min-w-0 flex-1">
              <div className="skeleton h-16 w-16 rounded-2xl" />
              <div className="min-w-0 flex-1 space-y-3">
                <div className="skeleton h-4 w-3/4" />
                <div className="skeleton h-3 w-1/2" />
                <div className="skeleton h-3 w-5/6" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="skeleton h-9 w-9 rounded-full" />
              <div className="skeleton h-9 w-24 rounded-xl" />
              <div className="skeleton h-9 w-24 rounded-xl" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function QueueEmptyState() {
  return (
    <Card variant="elevated" className="overflow-hidden">
      <CardContent className="p-8 sm:p-10 text-center relative">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-50 to-white" />
        <div className="relative max-w-xl mx-auto space-y-5">
          <div className="mx-auto h-20 w-20 rounded-3xl bg-gradient-to-br from-primary-100 to-accent-100 flex items-center justify-center shadow-sm">
            <ListMusic className="h-10 w-10 text-primary-600" />
          </div>
          <div className="space-y-2">
            <h3 className="text-2xl font-bold text-slate-900">Your queue is empty</h3>
            <p className="text-slate-500 max-w-lg mx-auto">
              Add recordings from the library or the audio detail page and they will appear here,
              ready to play in order.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button onClick={() => (window.location.href = '/library')} icon={<Music2 className="h-4 w-4" />}>
              Browse library
            </Button>
            <Button variant="outline" onClick={() => (window.location.href = '/library')}>
              Discover more audio
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function QueuePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAdmin } = useAuth();
  const [playbackOrder, setPlaybackOrder] = useState<string[]>([]);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [durationOverrides, setDurationOverrides] = useState<Record<string, number>>({});
  const repairedDurationIds = useRef<Set<string>>(new Set());

  const {
    audioRef,
    playingAudioId,
    currentTime,
    duration,
    isPlaying,
    setCurrentTime,
    playAudio,
    stop,
  } = useAudioPlayback({
    onEnded: () => {
      setPlaybackOrder((currentOrder) => {
        if (currentOrder.length === 0 || activeIndex === null) {
          return currentOrder;
        }

        const nextIndex = activeIndex + 1;
        if (nextIndex >= currentOrder.length) {
          setActiveIndex(null);
          return [];
        }

        const nextAudioId = currentOrder[nextIndex];
        const nextAudio = queue.find((audio) => audio.id === nextAudioId);
        if (!nextAudio) {
          setActiveIndex(null);
          return [];
        }

        setActiveIndex(nextIndex);
        void playAudio(nextAudio, { restart: true });
        return currentOrder;
      });
    },
  });

  const {
    data: queue = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['userQueue'],
    queryFn: userLibraryApi.getQueue,
  });

  const removeMutation = useMutation({
    mutationFn: (audioId: string) => userLibraryApi.removeFromQueue(audioId),
    onSuccess: (_data, audioId) => {
      queryClient.invalidateQueries({ queryKey: ['userQueue'] });

      if (playingAudioId === audioId) {
        stop();
      }

      setPlaybackOrder((currentOrder) => currentOrder.filter((id) => id !== audioId));
    },
  });

  const queueIds = useMemo(() => queue.map((audio) => audio.id), [queue]);

  const totalDuration = useMemo(
    () => queue.reduce((sum, audio) => sum + (durationOverrides[audio.id] || audio.durationSeconds || 0), 0),
    [durationOverrides, queue]
  );

  const currentAudio = useMemo(
    () => queue.find((audio) => audio.id === playingAudioId) ?? null,
    [playingAudioId, queue]
  );

  useEffect(() => {
    let cancelled = false;

    queue
      .filter((audio) => !audio.durationSeconds && !durationOverrides[audio.id])
      .forEach((audio) => {
        resolveMediaDurationSeconds(audio).then((resolvedDuration) => {
          if (cancelled || resolvedDuration <= 0) {
            return;
          }

          setDurationOverrides((current) => ({ ...current, [audio.id]: resolvedDuration }));
          if (isAdmin && !repairedDurationIds.current.has(audio.id)) {
            repairedDurationIds.current.add(audio.id);
            audioApi.update(audio.id, { durationSeconds: resolvedDuration })
              .then(() => queryClient.invalidateQueries({ queryKey: ['userQueue'] }))
              .catch(() => repairedDurationIds.current.delete(audio.id));
          }
        });
      });

    return () => {
      cancelled = true;
    };
  }, [durationOverrides, isAdmin, queryClient, queue]);

  const getDisplayDuration = useCallback(
    (audio: Audio) => durationOverrides[audio.id] || audio.durationSeconds || 0,
    [durationOverrides]
  );

  useEffect(() => {
    if (!playingAudioId || duration <= 0) {
      return;
    }

    const roundedDuration = Math.round(duration);
    setDurationOverrides((current) => (
      current[playingAudioId] && current[playingAudioId] >= roundedDuration
        ? current
        : { ...current, [playingAudioId]: roundedDuration }
    ));

    const activeAudio = queue.find((audio) => audio.id === playingAudioId);
    if (!isAdmin || !activeAudio || activeAudio.durationSeconds > 0 || repairedDurationIds.current.has(playingAudioId)) {
      return;
    }

    repairedDurationIds.current.add(playingAudioId);
    audioApi.update(playingAudioId, { durationSeconds: roundedDuration })
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ['userQueue'] });
        queryClient.invalidateQueries({ queryKey: ['libraryAudio'] });
        queryClient.invalidateQueries({ queryKey: ['audio', playingAudioId] });
      })
      .catch(() => repairedDurationIds.current.delete(playingAudioId));
  }, [duration, isAdmin, playingAudioId, queryClient, queue]);

  useEffect(() => {
    if (playbackOrder.length === 0) return;

    const queueSet = new Set(queueIds);
    const nextOrder = playbackOrder.filter((id) => queueSet.has(id));

    if (nextOrder.length !== playbackOrder.length) {
      setPlaybackOrder(nextOrder);
    }

    if (activeIndex !== null && activeIndex >= nextOrder.length) {
      setActiveIndex(nextOrder.length > 0 ? nextOrder.length - 1 : null);
    }
  }, [activeIndex, playbackOrder, queueIds]);

  const startQueuePlayback = useCallback(
    async (orderedIds: string[], index: number) => {
      const audioId = orderedIds[index];
      if (!audioId) return;

      const nextAudio = queue.find((audio) => audio.id === audioId);
      if (!nextAudio) return;

      setPlaybackOrder(orderedIds);
      setActiveIndex(index);
      await playAudio(nextAudio, { restart: true });
    },
    [playAudio, queue]
  );

  const handlePlayAll = async () => {
    if (queue.length === 0) return;

    await startQueuePlayback(queueIds, 0);
  };

  const handleShuffle = async () => {
    if (queue.length === 0) return;

    await startQueuePlayback(shuffleIds(queueIds), 0);
  };

  const handlePlayAudio = async (audio: Audio) => {
    const order = playbackOrder.length > 0 ? playbackOrder : queueIds;
    const index = order.indexOf(audio.id);

    setPlaybackOrder(order);
    setActiveIndex(index >= 0 ? index : 0);
    await playAudio(audio, { restart: playingAudioId !== audio.id });
  };

  const handleRetry = () => {
    void refetch();
  };

  const handleSeek = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextTime = Number(event.target.value);
    const audio = audioRef.current;
    if (!audio) return;

    audio.currentTime = nextTime;
    setCurrentTime(nextTime);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
        <header className="relative overflow-hidden bg-gradient-to-br from-primary-700 via-primary-600 to-accent-600">
          <div className="absolute inset-0 opacity-10 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%239C92AC%22%20fill-opacity%3D%220.05%22%3E%3Cpath%20d%3D%22M36%2034v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6%2034v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6%204V0H4v4H0v2h4v4h2V6h4V4H6z%22%2F%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fsvg%3E')]" />
          <div className="relative max-w-7xl mx-auto px-6 py-12 lg:py-16">
            <div className="h-8 w-32 skeleton rounded-full mb-4 bg-white/20" />
            <div className="h-12 w-72 skeleton rounded-2xl mb-3 bg-white/20" />
            <div className="h-5 w-96 skeleton rounded-full bg-white/20" />
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-6 py-8">
          <QueueSkeleton />
        </main>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 flex items-center justify-center px-6">
        <Card variant="elevated" className="max-w-lg w-full">
          <CardContent className="p-8 text-center space-y-4">
            <div className="mx-auto h-14 w-14 rounded-2xl bg-rose-100 flex items-center justify-center">
              <AlertCircle className="h-7 w-7 text-rose-600" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-slate-900">Unable to load your queue</h2>
              <p className="text-slate-500">
                {error instanceof Error ? error.message : 'The queue request failed. Please try again.'}
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button onClick={handleRetry} icon={<RefreshCw className="h-4 w-4" />}>
                Retry
              </Button>
              <Button variant="outline" onClick={() => navigate('/library')}>
                Back to library
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      <FloatingMediaPlayer
        mediaRef={audioRef}
        media={currentAudio}
        onClose={stop}
      />

      <header className="relative overflow-hidden bg-gradient-to-br from-primary-700 via-primary-600 to-accent-600">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%239C92AC%22%20fill-opacity%3D%220.05%22%3E%3Cpath%20d%3D%22M36%2034v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6%2034v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6%204V0H4v4H0v2h4v4h2V6h4V4H6z%22%2F%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fsvg%3E')] opacity-10" />
        <div className="absolute top-0 left-1/4 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute bottom-0 right-1/4 h-96 w-96 rounded-full bg-accent-400/20 blur-3xl" />

        <div className="relative max-w-7xl mx-auto px-6 py-12 lg:py-16">
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="flex flex-wrap items-center gap-3">
              <Link
                to="/library"
                className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm text-white/90 backdrop-blur-sm hover:bg-white/15 transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to library
              </Link>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm text-white/90 backdrop-blur-sm">
                <ListMusic className="h-4 w-4" />
                Queue
              </span>
            </div>

            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl space-y-3">
                <h1 className="text-4xl lg:text-5xl font-bold text-white">Your queue</h1>
                <p className="text-lg text-white/80 max-w-2xl">
                  Review the audio you have lined up, play it in order, or shuffle the listening flow.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap">
                <div className="rounded-2xl bg-white/10 border border-white/15 px-4 py-3 backdrop-blur-sm">
                  <p className="text-xs uppercase tracking-[0.2em] text-white/70">Items</p>
                  <p className="text-2xl font-semibold text-white">{queue.length}</p>
                </div>
                <div className="rounded-2xl bg-white/10 border border-white/15 px-4 py-3 backdrop-blur-sm">
                  <p className="text-xs uppercase tracking-[0.2em] text-white/70">Duration</p>
                  <p className="text-2xl font-semibold text-white">{formatDuration(totalDuration)}</p>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Button onClick={handlePlayAll} icon={<Play className="h-4 w-4" />} disabled={queue.length === 0}>
                Play all
              </Button>
              <Button variant="outline" onClick={handleShuffle} icon={<Shuffle className="h-4 w-4" />} disabled={queue.length === 0}>
                Shuffle
              </Button>
            </div>
          </motion.div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 lg:py-10 space-y-6">
        {currentAudio && (
          <Card variant="elevated" className="overflow-hidden border-primary-100">
            <div className="h-1.5 bg-gradient-to-r from-primary-500 to-accent-500" />
            <CardContent className="p-5 sm:p-6">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary-600 to-accent-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-primary-200">
                    <Music2 className="h-7 w-7 text-white/90" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-primary-600">Now playing</p>
                    <h2 className="text-xl font-semibold text-slate-900 truncate">{currentAudio.title}</h2>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-slate-500">
                      {currentAudio.speaker && (
                        <span className="flex items-center gap-1.5">
                          <User className="h-4 w-4" />
                          {currentAudio.speaker}
                        </span>
                      )}
                      <span className="flex items-center gap-1.5">
                        <Clock className="h-4 w-4" />
                        {formatDuration(getDisplayDuration(currentAudio))}
                      </span>
                      <Badge variant="outline">Queue item {queue.findIndex((audio) => audio.id === currentAudio.id) + 1}</Badge>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => void playAudio(currentAudio, { restart: false })}
                    className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-r from-primary-600 to-accent-600 text-white shadow-lg shadow-primary-200 hover:opacity-95 transition-opacity"
                    aria-label={isPlaying ? 'Pause current audio' : 'Play current audio'}
                  >
                    {isPlaying && playingAudioId === currentAudio.id ? (
                      <Pause className="h-5 w-5" />
                    ) : (
                      <Play className="h-5 w-5 ml-0.5" />
                    )}
                  </button>

                  <div className="hidden sm:block min-w-56 space-y-2">
                    <input
                      type="range"
                      min="0"
                      max={duration || getDisplayDuration(currentAudio)}
                      value={currentTime}
                      aria-label="Queue playback progress"
                      title="Queue playback progress"
                      onChange={handleSeek}
                      className="w-full h-2 rounded-full appearance-none cursor-pointer bg-slate-200 accent-primary-600"
                    />
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>{formatDuration(currentTime)}</span>
                      <span>{formatDuration(duration || getDisplayDuration(currentAudio))}</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Queue list</h2>
            <p className="text-sm text-slate-500">Play items directly from this page or remove them when you are done.</p>
          </div>
        </div>

        {queue.length === 0 ? (
          <QueueEmptyState />
        ) : (
          <motion.div variants={container} initial="hidden" animate="show" className="space-y-3">
            {queue.map((audio, index) => {
              const isActive = audio.id === playingAudioId;

              return (
                <motion.div key={audio.id} variants={item}>
                  <Card
                    hover
                    className={`overflow-hidden border-slate-200 ${isActive ? 'border-primary-300 shadow-lg shadow-primary-100' : ''}`}
                  >
                    <CardContent className="p-4 sm:p-5">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
                        <Link
                          to={`/library/${audio.id}`}
                          className="flex items-center gap-4 min-w-0 flex-1 group"
                        >
                          <div className="relative h-18 w-18 sm:h-20 sm:w-20 rounded-2xl bg-gradient-to-br from-primary-600 to-accent-600 flex items-center justify-center flex-shrink-0 shadow-md shadow-primary-100 overflow-hidden">
                            <Music2 className="h-8 w-8 text-white/70" />
                            {isActive && (
                              <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                                <div className="h-10 w-10 rounded-full bg-white/90 flex items-center justify-center">
                                  {isPlaying ? (
                                    <Pause className="h-5 w-5 text-primary-600" />
                                  ) : (
                                    <Play className="h-5 w-5 text-primary-600 ml-0.5" />
                                  )}
                                </div>
                              </div>
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                                #{index + 1}
                              </p>
                              {isActive && <Badge variant="success">Playing</Badge>}
                            </div>
                            <h3 className="mt-1 text-lg font-semibold text-slate-900 line-clamp-1 group-hover:text-primary-600 transition-colors">
                              {audio.title}
                            </h3>
                            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-slate-500">
                              {audio.speaker && (
                                <span className="flex items-center gap-1.5 min-w-0">
                                  <User className="h-4 w-4" />
                                  <span className="truncate">{audio.speaker}</span>
                                </span>
                              )}
                              <span className="flex items-center gap-1.5">
                                <Clock className="h-4 w-4" />
                                {formatDuration(getDisplayDuration(audio))}
                              </span>
                              {audio.topic && <Badge variant="outline">{audio.topic}</Badge>}
                            </div>
                            {audio.description && (
                              <p className="mt-2 text-sm text-slate-500 line-clamp-2">{audio.description}</p>
                            )}
                          </div>
                        </Link>

                        <div className="flex items-center gap-2 lg:justify-end">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void handlePlayAudio(audio)}
                            icon={isActive && isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                          >
                            {isActive && isPlaying ? 'Pause' : 'Play'}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeMutation.mutate(audio.id)}
                            loading={removeMutation.isLoading && removeMutation.variables === audio.id}
                            icon={<Trash2 className="h-4 w-4" />}
                            className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                          >
                            Remove
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </main>
    </div>
  );
}
