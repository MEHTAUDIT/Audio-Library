import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import {
    Archive,
    Calendar,
    CheckCircle,
    Clock,
    ExternalLink,
    EyeOff,
    Filter,
    Loader2,
    Pause,
    Play,
    Search,
    User,
    Video
} from 'lucide-react';
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { FloatingMediaPlayer } from '../../components/audio/FloatingMediaPlayer';
import { BulkActionBar } from '../../components/admin/BulkActionBar';
import { Badge } from '../../components/ui/Badge';
import { Card, CardContent } from '../../components/ui/Card';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../components/ui/Tooltip';
import { audioApi } from '../../lib/audioApi';
import { useAudioPlayback } from '../../lib/useAudioPlayback'; // ADDED: reuse existing playback hook
import { isVideo, type Audio } from '../../types/audio';
import type { BulkActionResult } from '../../types/audio';

const getPrimarySpeaker = (audio: Audio) => audio.speakers?.find((speaker) => speaker.id) ?? null;

export function PublishedPage() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkResult, setBulkResult] = useState<string | null>(null);

  // ADDED: Reuse the app's existing playback hook — same one used in Library/Series pages
  const {
    audioRef,
    playingAudioId,
    playAudio,
    isPlaying,
    currentTime,
    duration,
    setCurrentTime,
    stop,
  } = useAudioPlayback();

  const { data: publishedAudio, isLoading } = useQuery({
    queryKey: ['publishedAudio'],
    queryFn: audioApi.getPublished,
  });

  const unpublishMutation = useMutation({
    mutationFn: audioApi.unpublish,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['publishedAudio'] });
      queryClient.invalidateQueries({ queryKey: ['stagingAudio'] });
      queryClient.invalidateQueries({ queryKey: ['audioStats'] });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: audioApi.archive,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['publishedAudio'] });
      queryClient.invalidateQueries({ queryKey: ['audioStats'] });
    },
  });

  const handleBulkSuccess = (result: BulkActionResult) => {
    setBulkResult(
      `${result.successCount} ${result.action} action${result.successCount === 1 ? '' : 's'} succeeded` +
      (result.skippedCount > 0 ? `, ${result.skippedCount} skipped` : '') +
      (result.failedCount > 0 ? `, ${result.failedCount} failed` : '')
    );
    setSelectedIds(new Set());
    queryClient.invalidateQueries({ queryKey: ['publishedAudio'] });
    queryClient.invalidateQueries({ queryKey: ['stagingAudio'] });
    queryClient.invalidateQueries({ queryKey: ['allAudio'] });
    queryClient.invalidateQueries({ queryKey: ['audioStats'] });
  };

  const bulkUnpublishMutation = useMutation({
    mutationFn: audioApi.bulkUnpublish,
    onSuccess: handleBulkSuccess,
  });

  const bulkArchiveMutation = useMutation({
    mutationFn: audioApi.bulkArchive,
    onSuccess: handleBulkSuccess,
  });

  const filteredAudio = publishedAudio?.filter((audio) =>
    audio.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    audio.speaker?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    audio.topic?.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const visibleIds = filteredAudio?.map(audio => audio.id) ?? [];
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every(id => selectedIds.has(id));
  const isBulkPending = bulkUnpublishMutation.isPending || bulkArchiveMutation.isPending;

  const toggleSelected = (id: string) => {
    setSelectedIds(current => {
      const next = new Set(current);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
    setBulkResult(null);
  };

  const toggleAllVisible = () => {
    setSelectedIds(current => {
      const next = new Set(current);
      if (allVisibleSelected) {
        visibleIds.forEach(id => next.delete(id));
      } else {
        visibleIds.forEach(id => next.add(id));
      }
      return next;
    });
    setBulkResult(null);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins >= 60) {
      const hours = Math.floor(mins / 60);
      const remainingMins = mins % 60;
      return `${hours}:${remainingMins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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
    setCurrentTime(time);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Unknown';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="space-y-6">
      {/* ADDED: Hidden media element for playback — handles both audio + video */}
      <FloatingMediaPlayer
        mediaRef={audioRef}
        media={publishedAudio?.find((audio) => audio.id === playingAudioId)}
        onClose={stop}
        onEnded={stop}
      />
      {false && (() => {
        const playingItem = publishedAudio?.find(a => a.id === playingAudioId);
        const showVideo = false;
        return (
          <>
            <div className={showVideo ? 'fixed bottom-6 right-6 z-50 bg-black rounded-xl shadow-2xl overflow-hidden border border-white/10' : 'hidden'}>
              {showVideo && (
                <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900">
                  <span className="text-white text-xs font-medium truncate max-w-[200px]">
                    {playingItem?.title}
                  </span>
                  <button
                    onClick={stop}
                    className="text-white/60 hover:text-white ml-2 text-lg leading-none"
                  >×</button>
                </div>
              )}
              <video
                ref={audioRef as React.RefObject<HTMLVideoElement>}
                className="w-80 max-h-48"
                controls
                autoPlay
                onEnded={stop}
              />
            </div>
          </>
        );
      })()}

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-100">
              <CheckCircle className="w-5 h-5 text-emerald-600" />
            </div>
            <h1 className="text-3xl font-bold text-slate-900">Published Audio</h1>
          </div>
          <p className="text-slate-500 mt-2">
            Audio content that is live and visible to your users.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="success" className="text-base px-4 py-2">
            {publishedAudio?.length ?? 0} live
          </Badge>
          <Link
            to="/library"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            View Library
          </Link>
        </div>
      </motion.div>

      {/* Search & Filter */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex flex-col sm:flex-row gap-4"
      >
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search published audio..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-violet-500 focus:border-transparent"
          />
        </div>
        <button className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors">
          <Filter className="w-4 h-4" />
          Filter
        </button>
      </motion.div>

      <BulkActionBar
        selectedCount={selectedIds.size}
        visibleCount={visibleIds.length}
        allVisibleSelected={allVisibleSelected}
        onToggleAllVisible={toggleAllVisible}
        onClear={() => setSelectedIds(new Set())}
      >
        <button
          onClick={() => bulkUnpublishMutation.mutate(Array.from(selectedIds))}
          disabled={selectedIds.size === 0 || isBulkPending}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-amber-300 text-amber-700 text-sm font-medium hover:bg-amber-50 disabled:opacity-50"
        >
          {bulkUnpublishMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <EyeOff className="w-4 h-4" />}
          Move to staging
        </button>
        <button
          onClick={() => {
            if (confirm(`Archive ${selectedIds.size} selected item${selectedIds.size === 1 ? '' : 's'}?`)) {
              bulkArchiveMutation.mutate(Array.from(selectedIds));
            }
          }}
          disabled={selectedIds.size === 0 || isBulkPending}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-700 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-50"
        >
          {bulkArchiveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Archive className="w-4 h-4" />}
          Archive selected
        </button>
      </BulkActionBar>

      {bulkResult && <p className="text-sm text-emerald-700" role="status">{bulkResult}</p>}

      {/* Audio Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-violet-600" />
        </div>
      ) : filteredAudio && filteredAudio.length > 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5"
        >
          <AnimatePresence>
            {filteredAudio.map((audio, index) => {
              const isCurrentlyPlaying = playingAudioId === audio.id;
              return (
                <motion.div
                  key={audio.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: index * 0.05 }}
                >
                  {/* CHANGED: Added ring highlight when playing */}
                  <Card className={`h-full hover:shadow-lg transition-all group ${
                    selectedIds.has(audio.id)
                      ? 'ring-2 ring-violet-400 shadow-lg'
                      : isCurrentlyPlaying ? 'ring-2 ring-emerald-400 shadow-lg' : ''
                  }`}>
                    <CardContent className="p-5">
                      <div className="flex items-start gap-4">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(audio.id)}
                          onChange={() => toggleSelected(audio.id)}
                          className="mt-5 h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                          aria-label={`Select ${audio.title}`}
                        />
                        {/* CHANGED: Play button — was static icon, now functional */}
                        <button
                          onClick={() => playAudio({ id: audio.id, mimeType: audio.mimeType })}
                          className={`w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg transition-all hover:scale-105 ${
                            isCurrentlyPlaying
                              ? 'bg-gradient-to-br from-emerald-500 to-green-600 shadow-emerald-300'
                              : 'bg-gradient-to-br from-emerald-400 to-teal-500 shadow-emerald-200'
                          }`}
                          title={isCurrentlyPlaying && isPlaying ? 'Pause' : 'Play'}
                        >
                          {isCurrentlyPlaying && isPlaying ? (
                            <Pause className="w-7 h-7 text-white" />
                          ) : (
                            <Play className="w-7 h-7 text-white ml-1" />
                          )}
                        </button>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="font-semibold text-slate-900 line-clamp-1">
                              {audio.title}
                            </h3>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              {isVideo(audio) && (
                                <Badge variant="info" className="text-xs">
                                  <Video className="w-3 h-3 mr-1" />
                                  Video
                                </Badge>
                              )}
                              <Badge variant="success">
                                Live
                              </Badge>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-sm text-slate-500">
                            {(getPrimarySpeaker(audio) || audio.speaker) && (
                              getPrimarySpeaker(audio) ? (
                                <Link
                                  to={`/speaker/${getPrimarySpeaker(audio)!.id}`}
                                  className="flex items-center gap-1 hover:text-emerald-600 transition-colors"
                                  title={`Open ${getPrimarySpeaker(audio)!.name}`}
                                >
                                  <User className="w-3.5 h-3.5" />
                                  {getPrimarySpeaker(audio)!.name}
                                </Link>
                              ) : (
                                <span className="flex items-center gap-1">
                                  <User className="w-3.5 h-3.5" />
                                  {audio.speaker}
                                </span>
                              )
                            )}
                            <span className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" />
                              {isCurrentlyPlaying
                                ? formatTime(duration || audio.durationSeconds)
                                : formatDuration(audio.durationSeconds)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {audio.description && (
                        <p className="text-slate-600 text-sm mt-3 line-clamp-2">
                          {audio.description}
                        </p>
                      )}

                      {/* ADDED: Progress bar when this audio is playing */}
                      {isCurrentlyPlaying && (
                        <div className="mt-3">
                          <input
                            type="range"
                            min={0}
                            max={Math.max(duration || audio.durationSeconds || 0, 0)}
                            step="0.1"
                            value={Math.min(currentTime, duration || audio.durationSeconds || 0)}
                            onChange={(event) => handleSeek(Number(event.target.value))}
                            className="w-full h-1.5 appearance-none rounded-full bg-slate-200 accent-emerald-500 cursor-pointer"
                            aria-label={`Seek ${audio.title}`}
                            disabled={(duration || audio.durationSeconds || 0) <= 0}
                          />
                          <div className="flex justify-between text-xs text-slate-400 mt-1">
                            <span>{formatTime(currentTime)}</span>
                            <span>{formatTime(duration)}</span>
                          </div>
                        </div>
                      )}

                      <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100">
                        <div className="flex items-center gap-1 text-xs text-slate-400">
                          <Calendar className="w-3.5 h-3.5" />
                          Published {formatDate(audio.publishedAt)}
                        </div>
                        <div className="flex items-center gap-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                onClick={() => unpublishMutation.mutate(audio.id)}
                                disabled={unpublishMutation.isPending}
                                title="Move back to staging"
                                className="p-2 rounded-lg text-slate-400 hover:bg-amber-50 hover:text-amber-600 transition-colors"
                              >
                                <EyeOff className="w-4 h-4" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>Move back to staging</TooltipContent>
                          </Tooltip>

                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                onClick={() => {
                                  if (confirm('Are you sure you want to archive this audio?')) {
                                    archiveMutation.mutate(audio.id);
                                  }
                                }}
                                title="Archive audio"
                                className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                              >
                                <Archive className="w-4 h-4" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>Archive audio</TooltipContent>
                          </Tooltip>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <Card>
            <CardContent className="py-12 text-center">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-medium text-slate-900">No published audio</h3>
              <p className="text-slate-500 mt-1">
                Publish audio from the staging area to make it visible here.
              </p>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
