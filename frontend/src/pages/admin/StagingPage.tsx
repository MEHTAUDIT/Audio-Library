import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileAudio,
  Clock,
  CheckCircle,
  Trash2,
  Edit3,
  Search,
  Filter,
  Play,
  Pause,
  User,
  Tag,
  Loader2,
  X,
  Save,
  CheckSquare,
  Square,
  Minus,
  Archive,
} from 'lucide-react';
import { audioApi } from '../../lib/audioApi';
import { Card, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../components/ui/Tooltip';
import type { Audio, AudioUpdateRequest, BulkActionResult } from '../../types/audio';

export function StagingPage() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<AudioUpdateRequest>({});
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkResult, setBulkResult] = useState<BulkActionResult | null>(null);
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

  const bulkPublishMutation = useMutation({
    mutationFn: audioApi.bulkPublish,
    onSuccess: (result) => {
      setBulkResult(result);
      setSelectedIds(new Set());
      queryClient.invalidateQueries({ queryKey: ['stagingAudio'] });
      queryClient.invalidateQueries({ queryKey: ['audioStats'] });
      queryClient.invalidateQueries({ queryKey: ['recentDrafts'] });
      queryClient.invalidateQueries({ queryKey: ['recentPublished'] });
      // Auto-dismiss result after 5 seconds
      setTimeout(() => setBulkResult(null), 5000);
    },
  });

  const bulkArchiveMutation = useMutation({
    mutationFn: audioApi.bulkArchive,
    onSuccess: (result) => {
      setBulkResult(result);
      setSelectedIds(new Set());
      queryClient.invalidateQueries({ queryKey: ['stagingAudio'] });
      queryClient.invalidateQueries({ queryKey: ['audioStats'] });
      setTimeout(() => setBulkResult(null), 5000);
    },
  });

  const filteredAudio = stagingAudio?.filter((audio) =>
    audio.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    audio.speaker?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    audio.topic?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // ── Selection helpers ──

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (!filteredAudio) return;
    if (selectedIds.size === filteredAudio.length) {
      // Deselect all
      setSelectedIds(new Set());
    } else {
      // Select all visible
      setSelectedIds(new Set(filteredAudio.map((a) => a.id)));
    }
  };

  const isAllSelected = filteredAudio && filteredAudio.length > 0 && selectedIds.size === filteredAudio.length;
  const isSomeSelected = selectedIds.size > 0 && !isAllSelected;
  const hasSelection = selectedIds.size > 0;

  const handleBulkPublish = () => {
    if (selectedIds.size === 0) return;
    bulkPublishMutation.mutate(Array.from(selectedIds));
  };

  const handleBulkArchive = () => {
    if (selectedIds.size === 0) return;
    if (confirm(`Are you sure you want to archive ${selectedIds.size} audio file(s)?`)) {
      bulkArchiveMutation.mutate(Array.from(selectedIds));
    }
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

  const startEditing = (audio: Audio) => {
    setEditingId(audio.id);
    setEditForm({
      title: audio.title,
      description: audio.description,
      speaker: audio.speaker,
      topic: audio.topic,
    });
  };

  const togglePlay = (audio: Audio) => {
    const audioElement = audioRef.current;
    if (!audioElement) return;

    if (playingId === audio.id) {
      audioElement.pause();
      setPlayingId(null);
    } else {
      const streamUrl = audioApi.getStreamUrl(audio.id);
      audioElement.src = streamUrl;
      audioElement.play().catch(console.error);
      setPlayingId(audio.id);
    }
  };

  const saveEdit = (id: string) => {
    updateMutation.mutate({ id, data: editForm });
  };

  const isBulkLoading = bulkPublishMutation.isPending || bulkArchiveMutation.isPending;

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

      {/* Bulk Result Toast */}
      <AnimatePresence>
        {bulkResult && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="rounded-lg border p-4 flex items-center justify-between"
            style={{
              backgroundColor: bulkResult.failedCount > 0 ? '#FEF2F2' : '#F0FDF4',
              borderColor: bulkResult.failedCount > 0 ? '#FECACA' : '#BBF7D0',
            }}
          >
            <div className="flex items-center gap-3">
              <CheckCircle
                className="w-5 h-5"
                style={{ color: bulkResult.failedCount > 0 ? '#DC2626' : '#16A34A' }}
              />
              <span className="text-sm font-medium">
                Bulk {bulkResult.action}: {bulkResult.successCount} succeeded
                {bulkResult.skippedCount > 0 && `, ${bulkResult.skippedCount} skipped`}
                {bulkResult.failedCount > 0 && `, ${bulkResult.failedCount} failed`}
              </span>
            </div>
            <button onClick={() => setBulkResult(null)} className="p-1 rounded hover:bg-black/5">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search & Filter + Select All */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex flex-col sm:flex-row gap-4 items-center"
      >
        {/* Select All Checkbox */}
        {filteredAudio && filteredAudio.length > 0 && (
          <button
            onClick={toggleSelectAll}
            className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors text-sm font-medium"
          >
            {isAllSelected ? (
              <CheckSquare className="w-4 h-4 text-violet-600" />
            ) : isSomeSelected ? (
              <Minus className="w-4 h-4 text-violet-600" />
            ) : (
              <Square className="w-4 h-4" />
            )}
            {isAllSelected ? 'Deselect all' : 'Select all'}
          </button>
        )}

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
                <Card
                  className={`hover:shadow-md transition-all ${
                    selectedIds.has(audio.id)
                      ? 'ring-2 ring-violet-500 bg-violet-50/50'
                      : ''
                  }`}
                >
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
                        {/* Checkbox */}
                        <button
                          onClick={() => toggleSelect(audio.id)}
                          className="mt-3 flex-shrink-0"
                        >
                          {selectedIds.has(audio.id) ? (
                            <CheckSquare className="w-5 h-5 text-violet-600" />
                          ) : (
                            <Square className="w-5 h-5 text-slate-300 hover:text-slate-500" />
                          )}
                        </button>

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

      {/* Floating Bulk Action Bar */}
      <AnimatePresence>
        {hasSelection && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50"
          >
            <div className="flex items-center gap-4 px-6 py-3 rounded-xl bg-slate-900 text-white shadow-2xl">
              <span className="text-sm font-medium">
                {selectedIds.size} selected
              </span>

              <div className="w-px h-6 bg-slate-700" />

              <button
                onClick={handleBulkPublish}
                disabled={isBulkLoading}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-500 transition-colors disabled:opacity-50"
              >
                {bulkPublishMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle className="w-4 h-4" />
                )}
                Publish all
              </button>

              <button
                onClick={handleBulkArchive}
                disabled={isBulkLoading}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-700 text-white text-sm font-medium hover:bg-slate-600 transition-colors disabled:opacity-50"
              >
                {bulkArchiveMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Archive className="w-4 h-4" />
                )}
                Archive all
              </button>

              <button
                onClick={() => setSelectedIds(new Set())}
                className="p-2 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hidden Audio Element */}
      <audio
        ref={audioRef}
        className="hidden"
        onEnded={() => setPlayingId(null)}
      />
    </div>
  );
}