import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileAudio,
  CheckCircle,
  Archive,
  Eye,
  EyeOff,
  Search,
  Filter,
  Play,
  User,
  Tag,
  Loader2,
  Calendar,
  ExternalLink,
  MoreHorizontal,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { audioApi } from '../../lib/audioApi';
import { Card, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../components/ui/Tooltip';
import type { Audio } from '../../types/audio';

export function PublishedPage() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');

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

  const filteredAudio = publishedAudio?.filter((audio) =>
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
            {filteredAudio.map((audio, index) => (
              <motion.div
                key={audio.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card className="h-full hover:shadow-lg transition-shadow group">
                  <CardContent className="p-5">
                    <div className="flex items-start gap-4">
                      <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center flex-shrink-0 shadow-lg shadow-emerald-200 group-hover:scale-105 transition-transform">
                        <FileAudio className="w-7 h-7 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-semibold text-slate-900 line-clamp-1">
                            {audio.title}
                          </h3>
                          <Badge variant="success" className="flex-shrink-0">
                            Live
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-sm text-slate-500">
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
                      </div>
                    </div>

                    {audio.description && (
                      <p className="text-slate-600 text-sm mt-3 line-clamp-2">
                        {audio.description}
                      </p>
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

