import React, { useState, useRef, useEffect } from 'react';
import { isVideo } from '../../types/audio'; // ADDED: video detection
import { useParams, useNavigate, Link } from 'react-router-dom'; // CHANGED: added Link
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Play,
  Pause,
  Heart,
  ListPlus,
  Download,
  Share2,
  Clock,
  User,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Loader2,
  Check,
  Bookmark,
  Gauge,
} from 'lucide-react';
import { ListMusic } from 'lucide-react'; // ADDED: for series card
import { audioApi } from '../../lib/audioApi';
import { userLibraryApi } from '../../lib/userLibraryApi';
import { useAuth } from '../../lib/auth';
import { api } from '../../lib/api';
const PLAYBACK_SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

export function AudioDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAuthenticated, isAdmin } = useAuth();
  const audioRef = useRef<HTMLMediaElement>(null); // CHANGED: HTMLMediaElement for video support
  const objectUrlRef = useRef<string | null>(null);

  // Player state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const repairedDurationIds = useRef<Set<string>>(new Set());

  // Fetch audio details
  const { data: audio, isLoading } = useQuery({
    queryKey: ['audio', id],
    queryFn: () => audioApi.getById(id!),
    enabled: !!id,
  });

  const primarySpeakerId = audio?.speakers?.[0]?.id;

  useEffect(() => {
    const media = audioRef.current;
    if (!audio || !id || !media || media.src) {
      return;
    }

    let cancelled = false;
    api.get(`/audio/${id}/stream`, { responseType: 'blob' })
      .then((response) => {
        if (cancelled) {
          return;
        }

        const streamedBlob = response.data as Blob;
        const normalizedBlob =
          (!streamedBlob.type || streamedBlob.type === 'application/octet-stream') && audio.mimeType
            ? new Blob([streamedBlob], { type: audio.mimeType })
            : streamedBlob;
        const objectUrl = URL.createObjectURL(normalizedBlob);
        objectUrlRef.current = objectUrl;
        media.src = objectUrl;
        media.load();
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [audio, id]);

  useEffect(() => () => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }, []);

  // Fetch user status (favorited, in queue)
  const { data: isFavorited } = useQuery({
    queryKey: ['audioFavorited', id],
    queryFn: () => userLibraryApi.isAudioFavorited(id!),
    enabled: !!id && isAuthenticated,
  });

  const { data: isInQueue } = useQuery({
    queryKey: ['audioInQueue', id],
    queryFn: () => userLibraryApi.isInQueue(id!),
    enabled: !!id && isAuthenticated,
  });

  // Fetch saved position
  const { data: savedPosition } = useQuery({
    queryKey: ['audioPosition', id],
    queryFn: () => userLibraryApi.getPlaybackPosition(id!),
    enabled: !!id && isAuthenticated,
  });

  // Mutations
  const favoriteMutation = useMutation({
    mutationFn: () => isFavorited 
      ? userLibraryApi.unfavoriteAudio(id!) 
      : userLibraryApi.favoriteAudio(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['audioFavorited', id] });
      queryClient.invalidateQueries({ queryKey: ['favoriteAudios'] });
    },
  });

  const queueMutation = useMutation({
    mutationFn: () => isInQueue 
      ? userLibraryApi.removeFromQueue(id!) 
      : userLibraryApi.addToQueue(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['audioInQueue', id] });
      queryClient.invalidateQueries({ queryKey: ['userQueue'] });
    },
  });

  // Audio event handlers
  useEffect(() => {
    const media = audioRef.current;
    if (!media) return;

    const handleTimeUpdate = () => setCurrentTime(media.currentTime);
    const handleLoadedMetadata = () => {
      const mediaDuration = Number.isFinite(media.duration) ? media.duration : 0;
      setDuration(mediaDuration);

      if (isAdmin && id && mediaDuration > 0 && (!audio?.durationSeconds || audio.durationSeconds <= 0) && !repairedDurationIds.current.has(id)) {
        repairedDurationIds.current.add(id);
        audioApi.update(id, { durationSeconds: Math.round(mediaDuration) })
          .then(() => {
            queryClient.invalidateQueries({ queryKey: ['audio', id] });
            queryClient.invalidateQueries({ queryKey: ['libraryAudio'] });
          })
          .catch(() => repairedDurationIds.current.delete(id));
      }

      // Resume from saved position
      if (savedPosition && savedPosition > 0) {
        media.currentTime = savedPosition;
      }
    };
    const handleEnded = () => setIsPlaying(false);

    media.addEventListener('timeupdate', handleTimeUpdate);
    media.addEventListener('loadedmetadata', handleLoadedMetadata);
    media.addEventListener('ended', handleEnded);

    return () => {
      media.removeEventListener('timeupdate', handleTimeUpdate);
      media.removeEventListener('loadedmetadata', handleLoadedMetadata);
      media.removeEventListener('ended', handleEnded);
    };
  }, [audio?.durationSeconds, id, isAdmin, queryClient, savedPosition]);

  // Save position periodically
  useEffect(() => {
    if (!isAuthenticated || !id || !isPlaying) return;

    const interval = setInterval(() => {
      if (audioRef.current) {
        userLibraryApi.updatePlaybackPosition(id, Math.floor(audioRef.current.currentTime));
      }
    }, 10000); // Save every 10 seconds

    return () => clearInterval(interval);
  }, [isAuthenticated, id, isPlaying]);

  // Save position on pause/unmount
  useEffect(() => {
    return () => {
      if (isAuthenticated && id && audioRef.current) {
        userLibraryApi.updatePlaybackPosition(id, Math.floor(audioRef.current.currentTime));
      }
    };
  }, [isAuthenticated, id]);

  const togglePlay = async () => {
    const media = audioRef.current;
    if (!media || !id) return;

    try {
      // pause if already playing
      if (!media.paused) {
        media.pause();
        setIsPlaying(false);

        if (isAuthenticated) {
          userLibraryApi.updatePlaybackPosition(
            id,
            Math.floor(media.currentTime)
          );
        }
        return;
      }

      // if source not loaded yet
      if (!media.src) {
        const response = await api.get(
          `/audio/${id}/stream`,
          {
            responseType: "blob",
          }
        );

        const streamedBlob = response.data as Blob;
        const normalizedBlob =
          (!streamedBlob.type || streamedBlob.type === 'application/octet-stream') && audio?.mimeType
            ? new Blob([streamedBlob], { type: audio.mimeType })
            : streamedBlob;

        const audioUrl = URL.createObjectURL(normalizedBlob);
        media.src = audioUrl;
        media.load();
      }

      await media.play();
      setIsPlaying(true);
    } catch (error) {
      console.error("Audio playback error:", error);
      setIsPlaying(false);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = parseFloat(e.target.value);
    setVolume(vol);
    if (audioRef.current) {
      audioRef.current.volume = vol;
    }
    setIsMuted(vol === 0);
  };

  const toggleMute = () => {
    if (audioRef.current) {
      audioRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed);
    if (audioRef.current) {
      audioRef.current.playbackRate = speed;
    }
    if (isAuthenticated) {
      userLibraryApi.updatePlaybackSpeed(speed);
    }
    setShowSpeedMenu(false);
  };

  const skip = (seconds: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.max(0, Math.min(duration, audioRef.current.currentTime + seconds));
    }
  };

  /* handling audio download by fetching the audio blob and creating a temporary link to trigger the download */
  const handleDownload = async () => {
    try {
      if (!id) return;

      const response = await api.get(
        `/audio/${id}/download`,
        {
          responseType: "blob",
        }
      );

      const blob = new Blob([response.data]);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${audio?.title || "audio"}.mp3`;

      document.body.appendChild(a);
      a.click();

      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Download failed:", error);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-slate-50 flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-accent-600 animate-spin" />
      </div>
    );
  }

  if (!audio) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-slate-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Audio not found</h2>
          <button
            onClick={() => navigate('/library')}
            className="text-accent-600 hover:text-accent-500"
          >
            Back to Library
          </button>
        </div>
      </div>
    );
  }

  const displayDuration = duration > 0 ? duration : audio.durationSeconds || 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-slate-50">
      {/* Hidden audio element for audio files */}
      {!(audio && isVideo(audio)) && (
        <audio
          ref={audioRef as React.RefObject<HTMLAudioElement>}
          preload="metadata"
        />
      )}

      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-lg border-b border-slate-200 shadow-sm">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <button
            onClick={() => navigate('/library')}
            className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Library
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-6 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-8"
        >
          {/* Audio/Video Info */}
          <div className="flex flex-col md:flex-row gap-8">
            {/* CHANGED: Video player replaces cover art for video files */}
            {audio && isVideo(audio) ? (
              <div className="w-full md:w-96">
                <video
                  ref={audioRef as React.RefObject<HTMLVideoElement>}
                  className="w-full rounded-2xl shadow-2xl"
                  controls
                  preload="metadata"
                />
              </div>
            ) : (
              <div className="w-full md:w-72 aspect-square rounded-2xl bg-gradient-to-br from-accent-600 to-primary-700 flex items-center justify-center shadow-2xl shadow-accent-500/20">
                <Play className="w-24 h-24 text-white/30" />
              </div>
            )}

            {/* Info */}
            <div className="flex-1 space-y-4">
              <h1 className="text-3xl md:text-4xl font-bold text-slate-900">{audio.title}</h1>

              {audio.speaker && (
                <div className="flex items-center gap-2 text-slate-700">
                  <User className="w-5 h-5" />
                  {primarySpeakerId ? (
                    <button
                      type="button"
                      onClick={() => navigate(`/speaker/${primarySpeakerId}`)}
                      className="text-lg text-left transition-colors hover:text-primary-700"
                    >
                      {audio.speaker}
                    </button>
                  ) : (
                    <span className="text-lg">{audio.speaker}</span>
                  )}
                </div>
              )}

              <div className="flex items-center gap-4 text-slate-500">
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {formatTime(displayDuration)}
                </span>
                {audio.topic && (
                  <span className="px-3 py-1 rounded-full bg-accent-100 text-accent-700 text-sm">
                    {audio.topic}
                  </span>
                )}
              </div>

              {audio.description && (
                <p className="text-slate-600 leading-relaxed">{audio.description}</p>
              )}

              {/* ADDED: Series card with navigation */}
              {audio.seriesId && audio.seriesName && (
                <Link
                  to={`/series/${audio.seriesId}`}
                  className="flex items-center gap-3 p-3 bg-primary-50 border border-primary-100 rounded-xl hover:bg-primary-100 transition-colors"
                >
                  <div className="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center flex-shrink-0">
                    <ListMusic className="w-5 h-5 text-primary-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-primary-900">Part of series</p>
                    <p className="text-sm text-primary-700 truncate">{audio.seriesName}</p>
                  </div>
                  {audio.seriesOrder > 0 && (
                    <span className="text-xs font-medium text-primary-600 bg-primary-100 px-2 py-0.5 rounded-full">
                      #{audio.seriesOrder}
                    </span>
                  )}
                </Link>
              )}

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-3 pt-4">
                {isAuthenticated && (
                  <>
                    <button
                      onClick={() => favoriteMutation.mutate()}
                      disabled={favoriteMutation.isPending}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                        isFavorited
                          ? 'bg-rose-100 text-rose-600 hover:bg-rose-200'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      <Heart className={`w-5 h-5 ${isFavorited ? 'fill-current' : ''}`} />
                      {isFavorited ? 'Favorited' : 'Favorite'}
                    </button>

                    <button
                      onClick={() => queueMutation.mutate()}
                      disabled={queueMutation.isPending}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                        isInQueue
                          ? 'bg-emerald-100 text-emerald-600 hover:bg-emerald-200'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {isInQueue ? <Check className="w-5 h-5" /> : <ListPlus className="w-5 h-5" />}
                      {isInQueue ? 'In Queue' : 'Add to Queue'}
                    </button>
                  </>
                )}

                <button
                  onClick={handleDownload}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                >
                  <Download className="w-5 h-5" />
                  Download
                </button>

                <button
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                  onClick={() => navigator.clipboard.writeText(window.location.href)}
                >
                  <Share2 className="w-5 h-5" />
                  Share
                </button>
              </div>
            </div>
          </div>

          {/* Player */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-6 shadow-lg">
            {/* Progress Bar */}
            <div className="space-y-2">
              <input
                type="range"
                min="0"
                max={displayDuration || 100}
                value={currentTime}
                onChange={handleSeek}
                className="w-full h-2 bg-slate-200 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-accent-600 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer"
              />
              <div className="flex justify-between text-sm text-slate-500">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(displayDuration)}</span>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-6">
              <button
                onClick={() => skip(-15)}
                className="p-3 rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                title="Rewind 15 seconds"
              >
                <SkipBack className="w-6 h-6" />
              </button>

              <button
                onClick={togglePlay}
                className="p-5 rounded-full bg-gradient-to-r from-accent-600 to-primary-700 text-white hover:opacity-90 transition-opacity shadow-lg shadow-accent-500/30"
              >
                {isPlaying ? <Pause className="w-8 h-8" /> : <Play className="w-8 h-8 ml-1" />}
              </button>

              <button
                onClick={() => skip(30)}
                className="p-3 rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                title="Forward 30 seconds"
              >
                <SkipForward className="w-6 h-6" />
              </button>
            </div>

            {/* Secondary Controls */}
            <div className="flex items-center justify-between">
              {/* Volume */}
              <div className="flex items-center gap-3">
                <button onClick={toggleMute} className="text-slate-500 hover:text-slate-700">
                  {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  className="w-24 h-1 bg-slate-200 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-accent-600 [&::-webkit-slider-thumb]:rounded-full"
                />
              </div>

              {/* Playback Speed */}
              <div className="relative">
                <button
                  onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors text-sm"
                >
                  <Gauge className="w-4 h-4" />
                  {playbackSpeed}x
                </button>

                {showSpeedMenu && (
                  <div className="absolute bottom-full right-0 mb-2 bg-white rounded-lg border border-slate-200 shadow-xl overflow-hidden">
                    {PLAYBACK_SPEEDS.map((speed) => (
                      <button
                        key={speed}
                        onClick={() => handleSpeedChange(speed)}
                        className={`block w-full px-4 py-2 text-sm text-left hover:bg-slate-100 transition-colors ${
                          playbackSpeed === speed ? 'text-accent-600 bg-accent-50' : 'text-slate-700'
                        }`}
                      >
                        {speed}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Resume indicator */}
            {savedPosition && savedPosition > 0 && currentTime === 0 && (
              <div className="text-center text-sm text-slate-500">
                Resume from {formatTime(savedPosition)}
              </div>
            )}
          </div>
        </motion.div>
      </main>
    </div>
  );
}
