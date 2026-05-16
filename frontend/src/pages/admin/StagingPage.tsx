import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import {
  CheckCircle,
  Clock,
  Edit3,
  FileAudio,
  Filter,
  Loader2,
  Pause,
  Play,
  Save,
  Search,
  Tag,
  Trash2,
  User,
  X
} from 'lucide-react';
import { useRef, useState } from 'react';
import { Badge } from '../../components/ui/Badge';
import { Card, CardContent } from '../../components/ui/Card';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../components/ui/Tooltip';
import { audioApi } from '../../lib/audioApi';
import type { Audio, AudioUpdateRequest } from '../../types/audio';
import { api } from '../../lib/api';
export function StagingPage() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<AudioUpdateRequest>({});
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const { data: stagingAudio, isLoading } = useQuery({
    queryKey: ['stagingAudio'],
    queryFn: audioApi.getStaging,
  });

  const publishMutation = useMutation({
    mutationFn: audioApi.publish,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stagingAudio'] });
      queryClient.invalidateQueries({ queryKey: ['audioStats'] });
      queryClient.invalidateQueries({ queryKey: ['recentDrafts'] });
      queryClient.invalidateQueries({ queryKey: ['recentPublished'] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: AudioUpdateRequest }) =>
      audioApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stagingAudio'] });
      setEditingId(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: audioApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stagingAudio'] });
      queryClient.invalidateQueries({ queryKey: ['audioStats'] });
    },
  });

  const filteredAudio = stagingAudio?.filter((audio) =>
    audio.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    audio.speaker?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    audio.topic?.toLowerCase().includes(searchQuery.toLowerCase())
  );

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

  const startEditing = (audio: Audio) => {
    setEditingId(audio.id);
    setEditForm({
      title: audio.title,
      description: audio.description,
      speaker: audio.speaker,
      topic: audio.topic,
    });
  };

  const togglePlay = async (audio: Audio) => {
    const audioElement = audioRef.current;
    if (!audioElement) return;

    if (playingId === audio.id) {
      audioElement.pause();
      setPlayingId(null);
    } else {
      try {
        const response = await api.get(
          `/audio/${audio.id}/stream`,
          {
            responseType: "blob",
          }
        );

        const audioUrl = URL.createObjectURL(response.data);

        audioElement.src = audioUrl;
        await audioElement.play();

        setPlayingId(audio.id);
      } catch (error) {
        console.error("Audio playback error:", error);
      }
    }
  };

  const saveEdit = (id: string) => {
    updateMutation.mutate({ id, data: editForm });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-100">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
            <h1 className="text-3xl font-bold text-slate-900">Staging Area</h1>
          </div>
          <p className="text-slate-500 mt-2">
            Review and categorize draft audio before publishing to users.
          </p>
        </div>
        <Badge variant="warning" className="text-base px-4 py-2">
          {stagingAudio?.length ?? 0} drafts
        </Badge>
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
            placeholder="Search by title, speaker, or topic..."
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
          className="space-y-4"
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
                <Card className="hover:shadow-md transition-shadow">
                  <CardContent className="p-5">
                    {editingId === audio.id ? (
                      // Edit Mode
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="font-semibold text-slate-900">Edit Audio</h3>
                          <button
                            onClick={() => setEditingId(null)}
                            className="p-1 rounded hover:bg-slate-100"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                              Title
                            </label>
                            <input
                              type="text"
                              value={editForm.title || ''}
                              onChange={(e) =>
                                setEditForm({ ...editForm, title: e.target.value })
                              }
                              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                              Speaker
                            </label>
                            <input
                              type="text"
                              value={editForm.speaker || ''}
                              onChange={(e) =>
                                setEditForm({ ...editForm, speaker: e.target.value })
                              }
                              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">
                            Description
                          </label>
                          <textarea
                            value={editForm.description || ''}
                            onChange={(e) =>
                              setEditForm({ ...editForm, description: e.target.value })
                            }
                            rows={2}
                            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm resize-none"
                          />
                        </div>
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => setEditingId(null)}
                            className="px-4 py-2 rounded-lg border border-slate-300 text-sm font-medium hover:bg-slate-50"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => saveEdit(audio.id)}
                            disabled={updateMutation.isPending}
                            className="px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 disabled:opacity-50 inline-flex items-center gap-2"
                          >
                            {updateMutation.isPending ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Save className="w-4 h-4" />
                            )}
                            Save
                          </button>
                        </div>
                      </div>
                    ) : (
                      // View Mode
                      <div className="flex items-start gap-4">
                        {/* Play Button */}
                        <button
                          onClick={() => togglePlay(audio)}
                          className="w-14 h-14 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center flex-shrink-0 shadow-lg shadow-amber-200 hover:scale-105 transition-transform"
                          title={playingId === audio.id ? 'Pause' : 'Preview audio'}
                        >
                          {playingId === audio.id ? (
                            <Pause className="w-7 h-7 text-white" />
                          ) : (
                            <Play className="w-7 h-7 text-white ml-1" />
                          )}
                        </button>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <h3 className="font-semibold text-slate-900 text-lg">
                                {audio.title}
                              </h3>
                              <div className="flex items-center gap-4 mt-1 text-sm text-slate-500">
                                {audio.speaker && (
                                  <span className="flex items-center gap-1">
                                    <User className="w-3.5 h-3.5" />
                                    {audio.speaker}
                                  </span>
                                )}
                                {audio.topic && (
                                  <span className="flex items-center gap-1">
                                    <Tag className="w-3.5 h-3.5" />
                                    {audio.topic}
                                  </span>
                                )}
                                <span className="flex items-center gap-1">
                                  <Play className="w-3.5 h-3.5" />
                                  {formatDuration(audio.durationSeconds)}
                                </span>
                              </div>
                            </div>
                            <Badge variant="warning">Draft</Badge>
                          </div>

                          {audio.description && (
                            <p className="text-slate-600 text-sm mt-2 line-clamp-2">
                              {audio.description}
                            </p>
                          )}

                          {/* Actions */}
                          <div className="flex items-center gap-2 mt-4">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  onClick={() => publishMutation.mutate(audio.id)}
                                  disabled={publishMutation.isPending}
                                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50"
                                >
                                  {publishMutation.isPending ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <CheckCircle className="w-4 h-4" />
                                  )}
                                  Publish
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>
                                Make this audio visible to all users
                              </TooltipContent>
                            </Tooltip>

                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  onClick={() => startEditing(audio)}
                                  className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors"
                                >
                                  <Edit3 className="w-4 h-4" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>Edit audio details</TooltipContent>
                            </Tooltip>

                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  onClick={() => {
                                    if (confirm('Are you sure you want to delete this audio?')) {
                                      deleteMutation.mutate(audio.id);
                                    }
                                  }}
                                  className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition-colors"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>Delete audio</TooltipContent>
                            </Tooltip>
                          </div>
                        </div>
                      </div>
                    )}
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
                <FileAudio className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-medium text-slate-900">No audio in staging</h3>
              <p className="text-slate-500 mt-1">
                Upload new audio files to see them here for review.
              </p>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Hidden Audio Element */}
      <audio
        ref={audioRef}
        className="hidden"
        onEnded={() => setPlayingId(null)}
      />
    </div>
  );
}

