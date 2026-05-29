import React, { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Library,
  Music,
  Plus,
  Search,
  Trash2,
  X,
  ArrowUp,
  ArrowDown,
  Play,
  Pause,
  Video,
  Check,
} from 'lucide-react';
import { seriesApi } from '../../lib/seriesApi';
import { audioApi } from '../../lib/audioApi';
import { isVideo, type Audio } from '../../types/audio';
import { useAudioPlayback } from '../../lib/useAudioPlayback';

export function SeriesManagePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const { audioRef, playingAudioId, playAudio, isPlaying, currentTime, duration } = useAudioPlayback();

  const { data: series, isLoading } = useQuery({
    queryKey: ['series', id, 'admin'],
    queryFn: () => seriesApi.getById(id!),
    enabled: !!id,
  });

  const { data: allAudio } = useQuery({
    queryKey: ['audio', 'all'],
    queryFn: () => audioApi.getAll(),
    enabled: showAddModal,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['series', id, 'admin'] });
    queryClient.invalidateQueries({ queryKey: ['series'] });
  };

  const addMutation = useMutation({
    mutationFn: async (audioIds: string[]) => {
      const startOrder = (series?.audioItems.length ?? 0);
      for (let i = 0; i < audioIds.length; i++) {
        await seriesApi.addAudio(id!, audioIds[i], startOrder + i);
      }
    },
    onSuccess: () => {
      invalidate();
      setShowAddModal(false);
      setSelectedIds(new Set());
      setSearchQuery('');
    },
  });

  const removeMutation = useMutation({
    mutationFn: (audioId: string) => seriesApi.removeAudio(id!, audioId),
    onSuccess: invalidate,
  });

  const reorderMutation = useMutation({
    mutationFn: (audioIds: string[]) => seriesApi.reorder(id!, audioIds),
    onSuccess: invalidate,
  });

  const existingIds = useMemo(
    () => new Set(series?.audioItems.map((a) => a.id) ?? []),
    [series],
  );

  const candidates = useMemo(() => {
    if (!allAudio) return [] as Audio[];
    const q = searchQuery.trim().toLowerCase();
    return allAudio.filter((a) => {
      if (existingIds.has(a.id)) return false;
      if (!q) return true;
      return (
        a.title.toLowerCase().includes(q) ||
        a.speaker?.toLowerCase().includes(q) ||
        a.topic?.toLowerCase().includes(q)
      );
    });
  }, [allAudio, existingIds, searchQuery]);

  const toggleSelect = (audioId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(audioId)) next.delete(audioId);
      else next.add(audioId);
      return next;
    });
  };

  const move = (index: number, dir: -1 | 1) => {
    if (!series) return;
    const items = [...series.audioItems];
    const target = index + dir;
    if (target < 0 || target >= items.length) return;
    [items[index], items[target]] = [items[target], items[index]];
    reorderMutation.mutate(items.map((a) => a.id));
  };

  const formatDuration = (seconds: number) => {
    if (!seconds) return '';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const formatTime = (time: number) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSeek = (time: number) => {
    const media = audioRef.current;
    if (!media || !Number.isFinite(time)) {
      return;
    }

    media.currentTime = time;
  };

  if (isLoading) {
    return (
      <div>
        <div className="h-8 w-48 bg-slate-200 rounded animate-pulse mb-4" />
        <div className="h-6 w-72 bg-slate-100 rounded animate-pulse mb-8" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 bg-slate-100 rounded-lg animate-pulse mb-3" />
        ))}
      </div>
    );
  }

  if (!series) {
    return <p className="text-slate-500">Series not found</p>;
  }

  return (
    <div>
      <video ref={audioRef as React.RefObject<HTMLVideoElement>} className="hidden" />

      <button
        onClick={() => navigate('/admin/series')}
        className="flex items-center gap-2 text-slate-500 hover:text-slate-900 mb-4 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to series
      </button>

      <div className="flex items-start justify-between mb-8">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-primary-100 to-accent-100 flex items-center justify-center flex-shrink-0">
            <Library className="w-8 h-8 text-primary-600" />
          </div>
          <div>
            <p className="text-slate-500 text-xs font-medium uppercase tracking-wide mb-1">Series</p>
            <h1 className="text-3xl font-bold text-slate-900 mb-1">{series.name}</h1>
            {series.description && (
              <p className="text-slate-500">{series.description}</p>
            )}
            <p className="text-sm text-slate-400 mt-1">{series.audioItems.length} items</p>
          </div>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Audio
        </button>
      </div>

      {series.audioItems.length === 0 ? (
        <div className="text-center py-16 bg-white border border-dashed border-slate-200 rounded-xl">
          <Music className="w-12 h-12 mx-auto text-slate-300 mb-3" />
          <h3 className="text-lg font-semibold text-slate-700 mb-1">No items in this series</h3>
          <p className="text-slate-500 mb-4">Add audio or video items to build out the collection</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            Add Audio
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {series.audioItems.map((audio, index) => (
            <div
              key={audio.id}
              className="flex items-center gap-4 p-4 bg-white border border-slate-200 rounded-xl"
            >
              <span className="w-8 text-center text-sm font-medium text-slate-400">
                {index + 1}
              </span>
              <button
                onClick={() => playAudio({ id: audio.id })}
                className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
                  playingAudioId === audio.id && isPlaying
                    ? 'bg-primary-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-primary-100 hover:text-primary-600'
                }`}
                title={playingAudioId === audio.id && isPlaying ? `Pause ${audio.title}` : `Play ${audio.title}`}
              >
                {playingAudioId === audio.id && isPlaying ? (
                  <Pause className="w-4 h-4" />
                ) : (
                  <Play className="w-4 h-4 ml-0.5" />
                )}
              </button>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-900 truncate">{audio.title}</p>
                <div className="flex items-center gap-3 text-sm text-slate-500">
                  {audio.speaker && <span>{audio.speaker}</span>}
                  {audio.durationSeconds > 0 && <span>{formatDuration(audio.durationSeconds)}</span>}
                  <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100">{audio.status}</span>
                </div>
                {playingAudioId === audio.id && (
                  <div className="mt-3 space-y-1.5">
                    <input
                      type="range"
                      min={0}
                      max={Math.max(duration || audio.durationSeconds || 0, 0)}
                      step="0.1"
                      value={Math.min(currentTime, duration || audio.durationSeconds || 0)}
                      onChange={(event) => handleSeek(Number(event.target.value))}
                      className="w-full h-1.5 appearance-none rounded-full bg-slate-200 accent-primary-600 cursor-pointer"
                      aria-label={`Seek ${audio.title}`}
                      disabled={(duration || audio.durationSeconds || 0) <= 0}
                    />
                    <div className="flex justify-between text-xs text-slate-400">
                      <span>{formatTime(currentTime)}</span>
                      <span>{formatTime(duration || audio.durationSeconds || 0)}</span>
                    </div>
                  </div>
                )}
              </div>
              {isVideo(audio) && (
                <span className="flex items-center gap-1 text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                  <Video className="w-3 h-3" />
                  Video
                </span>
              )}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => move(index, -1)}
                  disabled={index === 0 || reorderMutation.isPending}
                  className="p-1.5 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg disabled:opacity-30 disabled:hover:bg-transparent"
                  title="Move up"
                >
                  <ArrowUp className="w-4 h-4" />
                </button>
                <button
                  onClick={() => move(index, 1)}
                  disabled={index === series.audioItems.length - 1 || reorderMutation.isPending}
                  className="p-1.5 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg disabled:opacity-30 disabled:hover:bg-transparent"
                  title="Move down"
                >
                  <ArrowDown className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    if (confirm(`Remove "${audio.title}" from this series?`)) {
                      removeMutation.mutate(audio.id);
                    }
                  }}
                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                  title="Remove from series"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {showAddModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
            onClick={() => setShowAddModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-6 border-b border-slate-100">
                <h2 className="text-lg font-semibold text-slate-900">Add Audio to Series</h2>
                <button onClick={() => setShowAddModal(false)} title="Close add audio dialog">
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <div className="p-6 pb-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search by title, speaker, or topic..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-6">
                {candidates.length === 0 ? (
                  <div className="text-center py-12 text-slate-500">
                    {allAudio === undefined ? 'Loading…' : 'No matching audio available'}
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {candidates.map((audio) => {
                      const selected = selectedIds.has(audio.id);
                      return (
                        <button
                          key={audio.id}
                          onClick={() => toggleSelect(audio.id)}
                          className={`w-full text-left flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                            selected
                              ? 'bg-primary-50 border-primary-200'
                              : 'bg-white border-slate-100 hover:border-slate-200'
                          }`}
                        >
                          <div
                            className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                              selected
                                ? 'bg-primary-600 border-primary-600 text-white'
                                : 'border-slate-300'
                            }`}
                          >
                            {selected && <Check className="w-3 h-3" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-slate-900 truncate">{audio.title}</p>
                            <div className="flex items-center gap-3 text-xs text-slate-500">
                              {audio.speaker && <span>{audio.speaker}</span>}
                              {audio.durationSeconds > 0 && (
                                <span>{formatDuration(audio.durationSeconds)}</span>
                              )}
                              <span className="px-1.5 py-0.5 rounded-full bg-slate-100">
                                {audio.status}
                              </span>
                              {audio.seriesName && audio.seriesId !== id && (
                                <span className="text-amber-600">
                                  Currently in: {audio.seriesName}
                                </span>
                              )}
                            </div>
                          </div>
                          {isVideo(audio) && (
                            <span className="flex items-center gap-1 text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                              <Video className="w-3 h-3" />
                              Video
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between gap-3 p-6 border-t border-slate-100">
                <span className="text-sm text-slate-500">
                  {selectedIds.size} selected
                </span>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 text-slate-600 hover:text-slate-900"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => addMutation.mutate(Array.from(selectedIds))}
                    disabled={selectedIds.size === 0 || addMutation.isPending}
                    className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                  >
                    <Plus className="w-4 h-4" />
                    {addMutation.isPending ? 'Adding…' : `Add ${selectedIds.size || ''}`}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
