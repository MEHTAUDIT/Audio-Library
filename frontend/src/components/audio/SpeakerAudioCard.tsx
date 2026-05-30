import { CalendarDays, Clock, Music2, Pause, Play, Volume2 } from 'lucide-react';
import React from 'react';
import { Badge } from '../ui/Badge';
import { Card } from '../ui/Card';
import { cn } from '../../lib/utils';
import type { Audio } from '../../types/audio';

interface SpeakerAudioCardProps {
  audio: Audio;
  isPlaying: boolean;
  onPlay: (audio: Audio) => void;
  onNavigate: (audioId: string) => void;
}

const formatDuration = (seconds: number) => {
  const totalMinutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);

  if (totalMinutes >= 60) {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours}h ${minutes}m`;
  }

  return `${totalMinutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
};

export function SpeakerAudioCard({ audio, isPlaying, onPlay, onNavigate }: SpeakerAudioCardProps) {
  const handleNavigate = () => onNavigate(audio.id);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleNavigate();
    }
  };

  return (
    <Card
      hover
      className="group overflow-hidden p-0 cursor-pointer border-slate-200/70 bg-white/90 backdrop-blur-sm hover:border-primary-200"
      role="button"
      tabIndex={0}
      aria-label={`Open details for ${audio.title}`}
      onClick={handleNavigate}
      onKeyDown={handleKeyDown}
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-gradient-to-br from-primary-600 via-accent-500 to-primary-700">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(255,255,255,0.22),_transparent_42%),radial-gradient(circle_at_bottom_left,_rgba(255,255,255,0.12),_transparent_28%)]" />
        <div className="absolute inset-0 flex items-center justify-center">
          <Music2 className="h-14 w-14 text-white/25" />
        </div>

        <button
          type="button"
          aria-label={`${isPlaying ? 'Pause' : 'Play'} ${audio.title}`}
          onClick={(event) => {
            event.stopPropagation();
            onPlay(audio);
          }}
          className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors duration-300 group-hover:bg-black/20"
        >
          <span
            className={cn(
              'inline-flex h-14 w-14 items-center justify-center rounded-full bg-white/95 text-primary-700 shadow-xl transition-all duration-300',
              'opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100'
            )}
          >
            {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 translate-x-0.5" />}
          </span>
        </button>

        <div className="absolute left-3 top-3 flex flex-wrap gap-2">
          <Badge variant="outline" className="border-white/30 bg-white/90 text-slate-800">
            {formatDuration(audio.durationSeconds)}
          </Badge>
          <Badge variant="outline" className="border-white/30 bg-white/90 text-slate-800">
            {audio.language}
          </Badge>
        </div>

        {isPlaying && (
          <div className="absolute bottom-3 right-3 flex items-center gap-2 rounded-full bg-black/45 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm">
            <Volume2 className="h-3.5 w-3.5 text-accent-300" />
            Playing
          </div>
        )}
      </div>

      <div className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="line-clamp-2 text-lg font-semibold tracking-tight text-slate-900 transition-colors group-hover:text-primary-700">
              {audio.title}
            </h3>
            <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-slate-600">
              {audio.description || 'No description available.'}
            </p>
          </div>

          <Badge variant="outline" className="shrink-0 border-slate-200 text-slate-700">
            {audio.topic || 'General'}
          </Badge>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-600">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1">
            <Clock className="h-3.5 w-3.5" />
            {formatDuration(audio.durationSeconds)}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1">
            <CalendarDays className="h-3.5 w-3.5" />
            {formatDate(audio.publishedAt)}
          </span>
        </div>
      </div>
    </Card>
  );
}

export function SpeakerAudioCardSkeleton() {
  return (
    <Card className="overflow-hidden border-slate-200/70 bg-white/90 p-0">
      <div className="aspect-[16/10] animate-pulse bg-slate-200/80" />
      <div className="space-y-4 p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 space-y-2">
            <div className="h-5 w-4/5 animate-pulse rounded-full bg-slate-200/80" />
            <div className="h-4 w-full animate-pulse rounded-full bg-slate-200/80" />
            <div className="h-4 w-5/6 animate-pulse rounded-full bg-slate-200/80" />
          </div>
          <div className="h-7 w-20 animate-pulse rounded-full bg-slate-200/80" />
        </div>

        <div className="flex gap-2">
          <div className="h-6 w-20 animate-pulse rounded-full bg-slate-200/80" />
          <div className="h-6 w-24 animate-pulse rounded-full bg-slate-200/80" />
        </div>
      </div>
    </Card>
  );
}