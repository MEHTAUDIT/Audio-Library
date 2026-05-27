import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ArrowLeft, ExternalLink, Music2, RefreshCcw } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { SpeakerAudioCard, SpeakerAudioCardSkeleton } from '../components/audio/SpeakerAudioCard';
import { Badge } from '../components/ui/Badge';
import { Card, CardContent } from '../components/ui/Card';
import { speakerApi } from '../lib/speakerApi';
import { useAudioPlayback } from '../lib/useAudioPlayback';
import type { SpeakerProfileResponse } from '../types/speaker';
import type { Audio } from '../types/audio';

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0 },
};

const formatCount = (count: number) => new Intl.NumberFormat().format(count);

const normalizeWebsiteUrl = (websiteUrl: string) => {
  const trimmed = websiteUrl.trim();

  if (!trimmed) {
    return '';
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  return `https://${trimmed}`;
};

const getInitials = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return 'SP';
  }

  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
};

function SpeakerProfileSkeleton() {
  return (
    <div className="space-y-8">
      <Card className="overflow-hidden border-slate-200/70 bg-white/90">
        <CardContent className="p-6 sm:p-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-start">
            <div className="h-28 w-28 animate-pulse rounded-3xl bg-slate-200/80 md:h-36 md:w-36" />
            <div className="flex-1 space-y-4">
              <div className="h-10 w-2/3 animate-pulse rounded-full bg-slate-200/80" />
              <div className="space-y-3">
                <div className="h-4 w-full animate-pulse rounded-full bg-slate-200/80" />
                <div className="h-4 w-11/12 animate-pulse rounded-full bg-slate-200/80" />
                <div className="h-4 w-3/4 animate-pulse rounded-full bg-slate-200/80" />
              </div>
              <div className="flex flex-wrap gap-3">
                <div className="h-8 w-28 animate-pulse rounded-full bg-slate-200/80" />
                <div className="h-8 w-32 animate-pulse rounded-full bg-slate-200/80" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div className="h-7 w-56 animate-pulse rounded-full bg-slate-200/80" />
          <div className="h-5 w-24 animate-pulse rounded-full bg-slate-200/80" />
        </div>

        <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <SpeakerAudioCardSkeleton key={index} />
          ))}
        </div>
      </div>
    </div>
  );
}

function SpeakerErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <Card className="border-slate-200/70 bg-white/90 shadow-soft">
      <CardContent className="py-16 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-rose-100 text-rose-600">
          <RefreshCcw className="h-8 w-8" />
        </div>
        <h2 className="text-2xl font-semibold text-slate-900">Unable to load speaker profile</h2>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-slate-600">
          The profile request failed. You can try again or return to the library.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary-600 to-accent-500 px-4 py-2.5 text-sm font-medium text-white shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-medium"
          >
            <RefreshCcw className="h-4 w-4" />
            Try again
          </button>
          <Link
            to="/library"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to library
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyAudioState({ speakerName }: { speakerName: string }) {
  return (
    <Card className="border-dashed border-slate-200 bg-white/90">
      <CardContent className="py-16 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary-50 text-primary-600">
          <Music2 className="h-8 w-8" />
        </div>
        <h2 className="text-2xl font-semibold text-slate-900">No audios yet</h2>
        <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-slate-600">
          {speakerName} does not have any published audios available right now.
        </p>
        <Link
          to="/library"
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary-600 to-accent-500 px-4 py-2.5 text-sm font-medium text-white shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-medium"
        >
          Browse library
        </Link>
      </CardContent>
    </Card>
  );
}

export function SpeakerProfilePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { speakerId } = useParams<{ speakerId: string }>();
  const [avatarError, setAvatarError] = useState(false);

  const { audioRef, playingAudioId, playAudio } = useAudioPlayback();

  const speakerQuery = useQuery<SpeakerProfileResponse>({
    queryKey: ['speakerProfile', speakerId],
    queryFn: () => speakerApi.getSpeakerProfile(speakerId!),
    enabled: Boolean(speakerId),
  });

  useEffect(() => {
    setAvatarError(false);
  }, [speakerId, speakerQuery.data?.avatarUrl]);

  const speaker = speakerQuery.data;
  const audios: Audio[] = speaker?.audios ?? [];

  const websiteUrl = useMemo(() => {
    if (!speaker?.websiteUrl) {
      return '';
    }

    return normalizeWebsiteUrl(speaker.websiteUrl);
  }, [speaker?.websiteUrl]);

  const sortedAudios = useMemo(
    () =>
      [...audios].sort((left, right) => {
        const leftIso = left.publishedAt ?? left.createdAt ?? '';
        const rightIso = right.publishedAt ?? right.createdAt ?? '';
        const leftDate = leftIso ? new Date(leftIso).getTime() : 0;
        const rightDate = rightIso ? new Date(rightIso).getTime() : 0;
        return rightDate - leftDate;
      }),
    [audios]
  );

  const handleRetry = () => {
    if (!speakerId) {
      return;
    }

    queryClient.invalidateQueries({ queryKey: ['speakerProfile', speakerId] });
  };

  const handlePlayAudio = async (audio: Audio) => {
    await playAudio({ id: audio.id }, { restart: true });
  };

  if (speakerQuery.isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-slate-50">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <SpeakerProfileSkeleton />
        </div>
      </div>
    );
  }

  if (speakerQuery.isError || !speaker) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-slate-50 px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <SpeakerErrorState onRetry={handleRetry} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-slate-50">
      <audio ref={audioRef} className="hidden" preload="metadata" />

      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/80 backdrop-blur-xl shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <button
            type="button"
            onClick={() => navigate('/library')}
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition-colors hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to library
          </button>

          <Badge variant="outline" className="border-slate-200 bg-white text-slate-700">
            {formatCount(speaker.totalAudios)} audios
          </Badge>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-8">
          <motion.section variants={itemVariants}>
            <Card className="overflow-hidden border-slate-200/70 bg-white/90 shadow-soft">
              <CardContent className="p-6 sm:p-8">
                <div className="flex flex-col gap-6 md:flex-row md:items-start md:gap-8">
                  <div className="relative flex h-32 w-32 shrink-0 items-center justify-center overflow-hidden rounded-3xl bg-gradient-to-br from-primary-600 via-accent-500 to-primary-700 text-white shadow-2xl shadow-primary-200 sm:h-40 sm:w-40">
                    {speaker.avatarUrl && !avatarError ? (
                      <img
                        src={speaker.avatarUrl}
                        alt={speaker.name}
                        className="h-full w-full object-cover"
                        onError={() => setAvatarError(true)}
                      />
                    ) : (
                      <>
                        <span className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(255,255,255,0.18),_transparent_35%),radial-gradient(circle_at_bottom_left,_rgba(255,255,255,0.14),_transparent_28%)]" />
                        <div className="relative flex h-full w-full items-center justify-center">
                          <span className="text-4xl font-semibold tracking-tight sm:text-5xl">
                            {getInitials(speaker.name)}
                          </span>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="min-w-0 flex-1 space-y-5">
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-3">
                        <Badge variant="outline" className="border-primary-200 bg-primary-50 text-primary-700">
                          Speaker profile
                        </Badge>
                        <Badge variant="outline" className="border-slate-200 text-slate-700">
                          {formatCount(speaker.totalAudios)} audios
                        </Badge>
                      </div>

                      <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl lg:text-5xl">
                        {speaker.name}
                      </h1>

                      {speaker.bio ? (
                        <p className="max-w-4xl whitespace-pre-line text-base leading-7 text-slate-600 sm:text-lg">
                          {speaker.bio}
                        </p>
                      ) : (
                        <p className="max-w-4xl text-base leading-7 text-slate-500 sm:text-lg">
                          No bio has been provided for this speaker yet.
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      {websiteUrl && (
                        <a
                          href={websiteUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary-600 to-accent-500 px-4 py-2.5 text-sm font-medium text-white shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-medium"
                        >
                          Visit website
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      )}
                      <Link
                        to="/library"
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700"
                      >
                        <ArrowLeft className="h-4 w-4" />
                        Library
                      </Link>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.section>

          <motion.section variants={itemVariants} className="space-y-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
                  Audios by {speaker.name}
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">
                  Browse the speaker&apos;s published catalog and open any audio for the full detail page.
                </p>
              </div>
              <Badge variant="outline" className="border-slate-200 bg-white text-slate-700">
                {formatCount(sortedAudios.length)} items
              </Badge>
            </div>

            {sortedAudios.length === 0 ? (
              <EmptyAudioState speakerName={speaker.name} />
            ) : (
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {sortedAudios.map((audio) => (
                  <SpeakerAudioCard
                    key={audio.id}
                    audio={audio}
                    isPlaying={playingAudioId === audio.id}
                    onPlay={handlePlayAudio}
                    onNavigate={(audioId) => navigate(`/audio/${audioId}`)}
                  />
                ))}
              </div>
            )}
          </motion.section>
        </motion.div>
      </main>
    </div>
  );
}

export default SpeakerProfilePage;