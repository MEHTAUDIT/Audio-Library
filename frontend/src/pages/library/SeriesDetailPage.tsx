import React from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Play,
  Pause,
  Clock,
  Music,
  User,
  Library,
  Video,
} from 'lucide-react';
import { seriesApi } from '../../lib/seriesApi';
import { isVideo } from '../../types/audio';
import { useAudioPlayback } from '../../lib/useAudioPlayback';

export function SeriesDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: series, isLoading } = useQuery({
    queryKey: ['series', id],
    queryFn: () => seriesApi.getPublishedById(id!),
    enabled: !!id,
  });

  const {
    audioRef,
    playingAudioId,
    playAudio,
    isPlaying,
    stop,
  } = useAudioPlayback();

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const formatTotalDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="h-8 w-48 bg-slate-200 rounded animate-pulse mb-4" />
          <div className="h-6 w-72 bg-slate-100 rounded animate-pulse mb-8" />
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 bg-slate-100 rounded-lg animate-pulse mb-3" />
          ))}
        </div>
      </div>
    );
  }

  if (!series) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-slate-500">Series not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      {/* Shared media element for playback */}
      {(() => {
        const playingItem = series.audioItems.find((item) => item.id === playingAudioId);
        const showVideo = playingItem && isVideo(playingItem);
        return (
          <div className={showVideo ? 'fixed bottom-6 right-6 z-50 bg-black rounded-xl shadow-2xl overflow-hidden border border-white/10' : 'hidden'}>
            {showVideo && (
              <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900">
                <span className="text-white text-xs font-medium truncate max-w-[200px]">
                  {playingItem?.title}
                </span>
                <button
                  onClick={stop}
                  className="text-white/60 hover:text-white ml-2 text-lg leading-none"
                >
                  ×
                </button>
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
        );
      })()}

      {/* Header */}
      <div className="bg-gradient-to-br from-primary-700 via-primary-600 to-accent-600 text-white">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-white/70 hover:text-white mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>

          <div className="flex items-start gap-6">
            <div className="w-28 h-28 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
              <Library className="w-14 h-14 text-white/40" />
            </div>
            <div>
              <p className="text-white/60 text-sm font-medium uppercase tracking-wide mb-1">Series</p>
              <h1 className="text-3xl font-bold mb-2">{series.name}</h1>
              {series.description && (
                <p className="text-white/80 mb-3">{series.description}</p>
              )}
              <div className="flex items-center gap-4 text-sm text-white/70">
                <span className="flex items-center gap-1.5">
                  <Music className="w-4 h-4" />
                  {series.audioCount} items
                </span>
                {series.totalDurationSeconds > 0 && (
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-4 h-4" />
                    {formatTotalDuration(series.totalDurationSeconds)}
                  </span>
                )}
                {series.speakerName && (
                  <span className="flex items-center gap-1.5">
                    <User className="w-4 h-4" />
                    {series.speakerName}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Audio list */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        {series.audioItems.length === 0 ? (
          <div className="text-center py-12">
            <Music className="w-12 h-12 mx-auto text-slate-300 mb-3" />
            <p className="text-slate-500">No published items in this series yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {series.audioItems.map((audio, index) => {
              const playing = playingAudioId === audio.id && isPlaying;
              return (
                <motion.div
                  key={audio.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={`flex items-center gap-4 p-4 rounded-xl border transition-all cursor-pointer ${
                    playing
                      ? 'bg-primary-50 border-primary-200'
                      : 'bg-white border-slate-100 hover:border-slate-200 hover:shadow-sm'
                  }`}
                >
                  {/* Track number */}
                  <span className="w-8 text-center text-sm font-medium text-slate-400">
                    {index + 1}
                  </span>

                  {/* Play button */}
                  <button
                    onClick={() => playAudio({ id: audio.id, mimeType: audio.mimeType })}
                    className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
                      playing
                        ? 'bg-primary-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-primary-100 hover:text-primary-600'
                    }`}
                  >
                    {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                  </button>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <Link
                      to={`/library/${audio.id}`}
                      className="font-medium text-slate-900 hover:text-primary-600 truncate block"
                    >
                      {audio.title}
                    </Link>
                    <div className="flex items-center gap-3 text-sm text-slate-500">
                      {audio.speaker && <span>{audio.speaker}</span>}
                      {audio.durationSeconds > 0 && (
                        <span>{formatDuration(audio.durationSeconds)}</span>
                      )}
                    </div>
                  </div>

                  {/* Media type badge */}
                  {isVideo(audio) && (
                    <span className="flex items-center gap-1 text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                      <Video className="w-3 h-3" />
                      Video
                    </span>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
