import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import {
    Archive,
    FileAudio,
    Loader2,
    Pause,
    Play,
    RotateCcw,
    Search,
    Trash2,
    User,
} from 'lucide-react';
import React, { useState } from 'react';
import { Badge } from '../../components/ui/Badge';
import { Card, CardContent } from '../../components/ui/Card';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../components/ui/Tooltip';
import { audioApi } from '../../lib/audioApi';
import { useAudioPlayback } from '../../lib/useAudioPlayback';

export function ArchivedPage() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');

  const {
    audioRef,
    playingAudioId,
    playAudio,
    isPlaying,
    currentTime,
    duration,
  } = useAudioPlayback();

  const { data: allAudio, isLoading } = useQuery({
    queryKey: ['allAudio', 'ARCHIVED'],
    queryFn: () => audioApi.getAll('ARCHIVED'),
  });

  const unpublishMutation = useMutation({
    mutationFn: audioApi.publish,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allAudio'] });
      queryClient.invalidateQueries({ queryKey: ['publishedAudio'] });
      queryClient.invalidateQueries({ queryKey: ['stagingAudio'] });
      queryClient.invalidateQueries({ queryKey: ['audioStats'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: audioApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allAudio'] });
      queryClient.invalidateQueries({ queryKey: ['audioStats'] });
    },
  });

  const filteredAudio = allAudio?.filter((audio) =>
    audio.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    audio.speaker?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
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
  };

  return (
    <div className="space-y-6">
      <video ref={audioRef as React.RefObject<HTMLVideoElement>} className="hidden" />

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-slate-200">
              <Archive className="w-5 h-5 text-slate-600" />
            </div>
            <h1 className="text-3xl font-bold text-slate-900">Archived Audio</h1>
          </div>
          <p className="text-slate-500 mt-2">
            Audio content that has been archived and is no longer visible to users.
          </p>
        </div>
        <Badge variant="default" className="text-base px-4 py-2">
          {allAudio?.length ?? 0} archived
        </Badge>
      </motion.div>

      {/* Search */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search archived audio..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-violet-500 focus:border-transparent"
          />
        </div>
      </motion.div>

      {/* Audio List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-violet-600" />
        </div>
      ) : filteredAudio && filteredAudio.length > 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="space-y-3"
        >
          <AnimatePresence>
            {filteredAudio.map((audio, index) => (
              <motion.div
                key={audio.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card className="opacity-75 hover:opacity-100 transition-opacity">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-lg bg-slate-200 flex items-center justify-center flex-shrink-0">
                        <FileAudio className="w-6 h-6 text-slate-400" />
                      </div>
                      <button
                        onClick={() => playAudio({ id: audio.id })}
                        className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
                          playingAudioId === audio.id && isPlaying
                            ? 'bg-slate-900 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
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
                        <h3 className="font-medium text-slate-700">{audio.title}</h3>
                        <div className="flex items-center gap-3 mt-0.5 text-sm text-slate-400">
                          {audio.speaker && (
                            <span className="flex items-center gap-1">
                              <User className="w-3.5 h-3.5" />
                              {audio.speaker}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Play className="w-3.5 h-3.5" />
                            {formatDuration(audio.durationSeconds)}
                          </span>
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
                              className="w-full h-1.5 appearance-none rounded-full bg-slate-200 accent-slate-900 cursor-pointer"
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
                      <div className="flex items-center gap-2">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => unpublishMutation.mutate(audio.id)}
                              title="Restore to published"
                              className="p-2 rounded-lg text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 transition-colors"
                            >
                              <RotateCcw className="w-4 h-4" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>Restore to published</TooltipContent>
                        </Tooltip>

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => {
                                if (confirm('Permanently delete this audio?')) {
                                  deleteMutation.mutate(audio.id);
                                }
                              }}
                              title="Delete permanently"
                              className="p-2 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>Delete permanently</TooltipContent>
                        </Tooltip>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
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
                <Archive className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-medium text-slate-900">No archived audio</h3>
              <p className="text-slate-500 mt-1">
                Archived audio will appear here.
              </p>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}

