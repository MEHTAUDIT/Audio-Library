import { useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ChevronRight,
  Clock,
  FileAudio,
  Flame,
  Grid,
  Headphones,
  Heart,
  History,
  List,
  ListMusic,
  LogIn,
  LogOut,
  Music2,
  Pause,
  Play,
  Sparkles,
  TrendingUp,
  User,
  UserPlus,
  Volume2
} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LibraryFilters, LibrarySearch } from '../../components/layout/LibrarySearch';
import { Badge } from '../../components/ui/Badge';
import { api } from '../../lib/api';
import { audioApi } from '../../lib/audioApi';
import { useAuth } from '../../lib/auth';
import { discoveryApi, userLibraryApi } from '../../lib/userLibraryApi';
import { seriesApi } from '../../lib/seriesApi'; // ADDED
import type { Audio } from '../../types/audio';
import { isVideo } from '../../types/audio'; // ADDED: video detection

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

// Horizontal scroll section component
function AudioSection({ 
  title, 
  icon: Icon, 
  items, 
  onPlay, 
  playingId,
  onNavigate,
  showAll,
}: { 
  title: string;
  icon: React.ElementType;
  items: Audio[];
  onPlay: (audio: Audio) => void;
  playingId: string | null;
  onNavigate: (id: string) => void;
  showAll?: string;
}) {
  if (items.length === 0) return null;

  return (
    <section className="mb-10">
      <div className="flex items-center justify-between mb-4">
        <h2 className="flex items-center gap-2 text-xl font-semibold text-slate-900">
          <Icon className="w-5 h-5 text-accent-600" />
          {title}
        </h2>
        {showAll && (
          <Link 
            to={showAll} 
            className="flex items-center gap-1 text-sm text-accent-600 hover:text-accent-500"
          >
            See All <ChevronRight className="w-4 h-4" />
          </Link>
        )}
      </div>
      <div className="flex gap-4 overflow-x-auto pb-4 -mx-6 px-6 scrollbar-hide">
        {items.map((audio) => (
          <AudioCard 
            key={audio.id} 
            audio={audio} 
            onPlay={onPlay} 
            playingId={playingId}
            onNavigate={onNavigate}
            compact
          />
        ))}
      </div>
    </section>
  );
}

// Audio card component
function AudioCard({ 
  audio, 
  onPlay, 
  playingId,
  onNavigate,
  currentTime = 0,
  duration = 0,
  compact = false,
}: {
  audio: Audio;
  onPlay: (audio: Audio) => void;
  playingId: string | null;
  onNavigate: (id: string) => void;
  currentTime?: number;
  duration?: number;
  compact?: boolean;
}){
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins >= 60) {
      const hours = Math.floor(mins / 60);
      const remainingMins = mins % 60;
      return `${hours}h ${remainingMins}m`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div
      className={`group relative bg-white backdrop-blur-sm rounded-2xl border border-slate-200 p-4 hover:bg-slate-50 transition-all hover:border-accent-400 hover:shadow-xl hover:shadow-accent-500/10 cursor-pointer ${
        compact ? 'flex-shrink-0 w-48' : ''
      }`}
      onClick={() => onNavigate(audio.id)}
    >
      {/* Thumbnail / Play Button */}
      <div className={`relative rounded-xl bg-gradient-to-br from-accent-600 to-primary-700 mb-3 overflow-hidden ${
        compact ? 'aspect-square' : 'aspect-square'
      }`}>
        <div className="absolute inset-0 flex items-center justify-center">
          <Music2 className="w-12 h-12 text-white/30" />
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onPlay(audio);
          }}
          className="absolute inset-0 flex items-center justify-center bg-black/0 hover:bg-black/30 transition-colors group/play"
        >
          
          <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center shadow-xl opacity-0 group-hover:opacity-100 group-hover/play:scale-110 transition-all">
            {playingId === audio.id ? (
              <Pause className="w-5 h-5 text-accent-600" />
            ) : (
              <Play className="w-5 h-5 text-accent-600 ml-1" />
            )}
          </div>
        </button>
        {playingId === audio.id && (
          <div className="absolute bottom-2 left-2 right-2">
            <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-black/50 backdrop-blur-sm">
              <Volume2 className="w-3 h-3 text-accent-400 animate-pulse" />
              <div className="flex-1 h-1 bg-white/20 rounded-full overflow-hidden relative">
                <div className="absolute inset-y-0 left-0 w-full bg-accent-400/80 animate-pulse" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div>
        <h3 className={`font-semibold text-slate-900 line-clamp-2 group-hover:text-accent-600 transition-colors ${
          compact ? 'text-sm' : ''
        }`}>
          {audio.title}
        </h3>
        <div className="flex items-center gap-2 mt-1.5 text-xs text-slate-600">
          {audio.speaker && (
            <span className="flex items-center gap-1 truncate">
              <User className="w-3 h-3" />
              {audio.speaker}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {formatDuration(audio.durationSeconds)}
          </span>
        </div>
      </div>
    </div>
  );
}

export function LibraryPage() {
  const navigate = useNavigate();
  const { isAuthenticated, logout } = useAuth();
  const [searchFilters, setSearchFilters] = useState<LibraryFilters>({
    audioSubstring: '',
    speakerName: null,
    genre: null,
    tag: null,
  });
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'browse' | 'favorites' | 'queue' | 'history'>('browse');
  const audioRef = useRef<HTMLMediaElement>(null); // CHANGED: HTMLMediaElement for video support

  // Queries
  // Fetch a complete published list once to populate dropdown options
  const { data: publishedAudioAll = [], isLoading: isInitialLoading } = useQuery({
    queryKey: ['libraryAudio', 'all'],
    queryFn: audioApi.getPublished,
    staleTime: 1000 * 60 * 5,
  });

  // Server-side filtered results based on filters (debounced by LibrarySearch)
  const { data: publishedAudio = [], isLoading, error } = useQuery({
    queryKey: ['libraryAudio', searchFilters],
    queryFn: () => audioApi.searchPublished(searchFilters),
  });

  const { data: trending = [] } = useQuery({
    queryKey: ['trending'],
    queryFn: () => discoveryApi.getTrending(8),
  });

  const { data: recommendations = [] } = useQuery({
    queryKey: ['recommendations'],
    queryFn: () => discoveryApi.getRecommendations(8),
    enabled: isAuthenticated,
  });

  const { data: topics = [] } = useQuery({
    queryKey: ['topics'],
    queryFn: discoveryApi.getTopics,
  });

  // Fetch published series for browse section
  const { data: publishedSeries } = useQuery({
    queryKey: ['publishedSeries'],
    queryFn: seriesApi.getPublished,
  });

  const { data: history = [] } = useQuery({
    queryKey: ['userHistory'],
    queryFn: () => userLibraryApi.getHistory(8),
    enabled: isAuthenticated,
  });

  const { data: favorites = [] } = useQuery({
    queryKey: ['favoriteAudios'],
    queryFn: userLibraryApi.getFavoriteAudios,
    enabled: isAuthenticated,
  });

  const { data: queue = [] } = useQuery({
    queryKey: ['userQueue'],
    queryFn: userLibraryApi.getQueue,
    enabled: isAuthenticated,
  });

  // Handle audio playback
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleLoadedMetadata = () => setDuration(audio.duration);
    const handleEnded = () => setPlayingId(null);

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
    };
  }, []);

  // Get unique topics for filtering from current audio
  const audioTopics = [...new Set(publishedAudio?.map((a) => a.topic).filter(Boolean))];

  const hasActiveFilters = Boolean(
    (searchFilters.audioSubstring && searchFilters.audioSubstring.length > 0) ||
      searchFilters.speakerName ||
      searchFilters.genre ||
      searchFilters.tag
  );

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins >= 60) {
      const hours = Math.floor(mins / 60);
      const remainingMins = mins % 60;
      return `${hours}h ${remainingMins}m`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  /* handling audio playback by fetching the audio stream as a blob, creating a temporary URL, and controlling the audio element to play/pause the audio */
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

  const handleNavigateToDetail = (id: string) => {
    navigate(`/library/${id}`);
  };

  const handleLogout = () => {
    logout();
    navigate('/library', { replace: true });
  };

  // Get content based on active tab
  const getTabContent = () => {
    switch (activeTab) {
      case 'favorites':
        return favorites;
      case 'queue':
        return queue;
      case 'history':
        return history;
      default:
        return publishedAudio || [];
    }
  };
  /* handling audio download by fetching the audio blob and creating a temporary link to trigger the download */
  const handleDownload = async (
    audioId: string,
    title: string
  ) => {
    try {
      const response = await api.get(
        `/audio/${audioId}/download`,
        {
          responseType: "blob",
        }
      );

      const blob = new Blob([response.data]);

      const url = window.URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = `${title}.mp3`;

      document.body.appendChild(link);
      link.click();

      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Download failed:", error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      {/* Hero Header */}
      <header className="relative overflow-hidden bg-gradient-to-br from-primary-700 via-primary-600 to-accent-600">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%239C92AC%22%20fill-opacity%3D%220.05%22%3E%3Cpath%20d%3D%22M36%2034v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6%2034v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6%204V0H4v4H0v2h4v4h2V6h4V4H6z%22%2F%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fsvg%3E')] opacity-10" />
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-accent-400/20 rounded-full blur-3xl" />

        <div className="relative max-w-7xl mx-auto px-6 py-12 lg:py-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 mb-6">
              <Headphones className="w-4 h-4 text-white" />
              <span className="text-sm text-white/90">example.audiolib.com</span>
            </div>
            <h1 className="text-4xl lg:text-5xl font-bold text-white mb-4">
              Audio{' '}
              <span className="bg-gradient-to-r from-accent-200 to-white bg-clip-text text-transparent">
                Library
              </span>
            </h1>
            <p className="text-lg text-white/80 max-w-2xl mx-auto mb-8">
              Discover and listen to our curated collection of audio content.
            </p>

            {/* Search */}
            <div className="max-w-2xl mx-auto relative">
              <LibrarySearch
                initial={{ audioSubstring: '', speakerName: null, genre: null, tag: null }}
                speakers={[...new Set(publishedAudioAll.flatMap((a) => [
                  ...(a.speakers?.map((s) => s.name) || []),
                  ...(a.speaker ? [a.speaker] : []),
                ]).filter(Boolean))] as string[]}
                genres={[...new Set(publishedAudioAll.flatMap((a) => [
                  ...(a.genres?.map((g) => g.name) || []),
                  ...(a.topic ? [a.topic] : []),
                ]).filter(Boolean))] as string[]}
                tags={[...new Set(publishedAudioAll.flatMap((a) => a.tags?.map((t) => t.name) || []).filter(Boolean))] as string[]}
                onChange={(filters) => setSearchFilters(filters)}
                debounceMs={400}
              />
            </div>

            {!isAuthenticated && (
              <div className="mt-5 flex flex-col sm:flex-row justify-center gap-3">
                <Link
                  to="/login"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-primary-700 shadow-lg shadow-black/10 transition-all hover:-translate-y-0.5 hover:shadow-xl"
                >
                  <LogIn className="w-4 h-4" />
                  Sign in
                </Link>
                <Link
                  to="/register"
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-white/30 bg-white/10 px-5 py-3 text-sm font-semibold text-white backdrop-blur-sm transition-all hover:bg-white/15 hover:-translate-y-0.5"
                >
                  <UserPlus className="w-4 h-4" />
                  Register
                </Link>
              </div>
            )}

            {isAuthenticated && (
              <div className="mt-5 flex flex-col sm:flex-row justify-center gap-3">
                <Link
                  to="/queue"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-white/90 backdrop-blur-sm border border-white/20 hover:bg-white/15 transition-colors"
                >
                  <ListMusic className="w-4 h-4" />
                  Open queue page
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-white/30 bg-white px-4 py-2 text-sm font-semibold text-primary-700 shadow-lg shadow-black/10 transition-all hover:-translate-y-0.5 hover:shadow-xl"
                >
                  <LogOut className="w-4 h-4" />
                  Logout
                </button>
              </div>
            )}
          </motion.div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 mb-8 overflow-x-auto pb-2">
          <button
            onClick={() => setActiveTab('browse')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-colors whitespace-nowrap ${
              activeTab === 'browse'
                ? 'bg-accent-600 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Grid className="w-4 h-4" />
            Browse
          </button>
          {isAuthenticated && (
            <>
              <button
                onClick={() => setActiveTab('favorites')}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-colors whitespace-nowrap ${
                  activeTab === 'favorites'
                    ? 'bg-accent-600 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <Heart className="w-4 h-4" />
                Favorites
                {favorites.length > 0 && (
                  <span className="ml-1 text-xs bg-white/20 px-2 py-0.5 rounded-full">
                    {favorites.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('queue')}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-colors whitespace-nowrap ${
                  activeTab === 'queue'
                    ? 'bg-accent-600 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <ListMusic className="w-4 h-4" />
                My Queue
                {queue.length > 0 && (
                  <span className="ml-1 text-xs bg-white/20 px-2 py-0.5 rounded-full">
                    {queue.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-colors whitespace-nowrap ${
                  activeTab === 'history'
                    ? 'bg-accent-600 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <History className="w-4 h-4" />
                History
              </button>
            </>
          )}
        </div>

        {activeTab === 'browse' && (
          <>
            {/* Series Section */}
            {publishedSeries && publishedSeries.length > 0 && (
              <section className="mb-10">
                <div className="flex items-center gap-2 mb-4">
                  <ListMusic className="w-5 h-5 text-primary-600" />
                  <h2 className="text-xl font-bold text-slate-900">Series</h2>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {publishedSeries.slice(0, 8).map((series) => (
                    <Link
                      key={series.id}
                      to={`/series/${series.id}`}
                      className="bg-white border border-slate-100 rounded-xl p-4 hover:shadow-md hover:border-slate-200 transition-all"
                    >
                      <div className="w-full aspect-square rounded-lg bg-gradient-to-br from-primary-100 to-accent-100 flex items-center justify-center mb-3">
                        <ListMusic className="w-10 h-10 text-primary-400" />
                      </div>
                      <h3 className="font-semibold text-slate-900 text-sm truncate">{series.name}</h3>
                      <p className="text-xs text-slate-500 mt-1">
                        {series.audioCount} items
                        {series.speakerName && ` · ${series.speakerName}`}
                      </p>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Trending Section */}
            {trending.length > 0 && (
              <AudioSection
                title="Trending Now"
                icon={Flame}
                items={trending}
                onPlay={togglePlay}
                playingId={playingId}
                onNavigate={handleNavigateToDetail}
              />
            )}

            {/* Recommendations Section (Authenticated users only) */}
            {isAuthenticated && recommendations.length > 0 && (
              <AudioSection
                title="Recommended For You"
                icon={Sparkles}
                items={recommendations}
                onPlay={togglePlay}
                playingId={playingId}
                onNavigate={handleNavigateToDetail}
              />
            )}

            {/* Continue Listening (History) */}
            {isAuthenticated && history.length > 0 && (
              <AudioSection
                title="Continue Listening"
                icon={History}
                items={history}
                onPlay={togglePlay}
                playingId={playingId}
                onNavigate={handleNavigateToDetail}
              />
            )}

            {/* Topics Section */}
            {topics.length > 0 && (
              <section className="mb-10">
                <h2 className="flex items-center gap-2 text-xl font-semibold text-slate-900 mb-4">
                  <TrendingUp className="w-5 h-5 text-accent-600" />
                  Browse by Topic
                </h2>
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() => setSelectedTopic(null)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                      !selectedTopic
                        ? 'bg-accent-600 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    All Topics
                  </button>
                  {topics.map((t) => (
                    <button
                      key={t.name}
                      onClick={() => setSelectedTopic(t.name === selectedTopic ? null : t.name)}
                      className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                        selectedTopic === t.name
                          ? 'bg-accent-600 text-white'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {t.name}
                      <span className="ml-2 text-xs opacity-70">({t.count})</span>
                    </button>
                  ))}
                  {audioTopics.filter(t => !topics.find(topic => topic.name === t)).map((topic) => (
                    <button
                      key={topic}
                      onClick={() => setSelectedTopic(topic === selectedTopic ? null : topic!)}
                      className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                        selectedTopic === topic
                          ? 'bg-accent-600 text-white'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {topic}
                    </button>
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        {/* View Toggle & Count */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex items-center justify-between gap-4 mb-6"
        >
          <span className="text-sm text-slate-500">
            {getTabContent().length} audio files
          </span>
          <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-md transition-colors ${
                viewMode === 'grid' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
              title="Grid view"
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-md transition-colors ${
                viewMode === 'list' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
              title="List view"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </motion.div>

        {/* Audio Grid/List */}
        {error ? (
          <div className="text-center py-20">
            <p className="text-red-500">Failed to load audio. Please try again.</p>
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-12 h-12 border-4 border-accent-500/30 border-t-accent-500 rounded-full animate-spin" />
          </div>
        ) : getTabContent().length > 0 ? (
          viewMode === 'grid' ? (
            <motion.div
              variants={container}
              initial="hidden"
              animate="show"
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5"
            >
              {getTabContent().map((audio) => (
                <motion.div key={audio.id} variants={item}>
                  <AudioCard
                    audio={audio}
                    onPlay={togglePlay}
                    playingId={playingId}
                    onNavigate={handleNavigateToDetail}
                  />
                </motion.div>
              ))}
            </motion.div>
          ) : (
            <motion.div
              variants={container}
              initial="hidden"
              animate="show"
              className="space-y-3"
            >
              {getTabContent().map((audio) => (
                <motion.div key={audio.id} variants={item}>
                  <div
                    className="group flex items-center gap-4 bg-white rounded-xl border border-slate-200 p-4 hover:bg-slate-50 hover:border-accent-400 transition-all cursor-pointer shadow-sm"
                    onClick={() => handleNavigateToDetail(audio.id)}
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        togglePlay(audio);
                      }}
                      className="w-12 h-12 rounded-xl bg-gradient-to-br from-accent-600 to-primary-700 flex items-center justify-center flex-shrink-0 hover:scale-105 transition-transform"
                    >
                      {playingId === audio.id ? (
                        <Pause className="w-5 h-5 text-white" />
                      ) : (
                        <Play className="w-5 h-5 text-white ml-0.5" />
                      )}
                    </button>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-slate-900 line-clamp-1 group-hover:text-accent-600 transition-colors">
                        {audio.title}
                      </h3>
                      <div className="flex items-center gap-3 mt-1 text-sm text-slate-500">
                        {audio.speaker && (
                          <span className="flex items-center gap-1">
                            <User className="w-3.5 h-3.5" />
                            {audio.speaker}
                          </span>
                        )}
                        {audio.topic && (
                          <Badge variant="outline" className="text-xs text-accent-600 border-accent-500/30">
                            {audio.topic}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="text-sm text-slate-500 flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {formatDuration(audio.durationSeconds)}
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-20">
            <div className="w-20 h-20 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
              <FileAudio className="w-10 h-10 text-slate-400" />
            </div>
            <h3 className="text-xl font-medium text-slate-900 mb-2">
              {activeTab === 'favorites' ? 'No favorites yet' :
               activeTab === 'queue' ? 'Your queue is empty' :
               activeTab === 'history' ? 'No listening history' :
               'No audio found'}
            </h3>
            <p className="text-slate-500">
              {activeTab === 'favorites' ? 'Heart your favorite recordings to find them here' :
               activeTab === 'queue' ? 'Add recordings to your queue to listen later' :
               activeTab === 'history' ? 'Start listening to build your history' :
               hasActiveFilters ? 'Try adjusting your search or filters' : 'Check back later for new content'}
            </p>
          </motion.div>
        )}
      </main>

      {/* CHANGED: Floating video player — visible above Now Playing Bar when playing video.
          For audio files, the <video> element stays hidden (it still plays audio fine).
          For video files, a fixed overlay appears with native browser controls. */}
      {(() => {
        const playingItem = publishedAudioAll?.find((a: Audio) => a.id === playingId);
        const showVideo = playingItem && isVideo(playingItem);
        return (
          <>
            <video
              ref={audioRef as React.RefObject<HTMLVideoElement>}
              className="hidden"
            />
            {showVideo && (
              <div className="fixed bottom-24 right-6 z-50 bg-black rounded-xl shadow-2xl overflow-hidden border border-white/10">
                <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900">
                  <span className="text-white text-xs font-medium truncate max-w-[200px]">
                    {playingItem?.title}
                  </span>
                  <button
                    onClick={() => { audioRef.current?.pause(); setPlayingId(null); }}
                    className="text-white/60 hover:text-white ml-2 text-lg leading-none"
                  >×</button>
                </div>
                <video
                  src={audioRef.current?.src}
                  className="w-80 max-h-48"
                  controls
                  autoPlay
                  onEnded={() => setPlayingId(null)}
                />
              </div>
            )}
          </>
        );
      })()}

      {/* Now Playing Bar */}
      <AnimatePresence>
        {playingId && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur-lg border-t border-white/10 p-4 z-50"
          >
            <div className="max-w-7xl mx-auto flex items-center gap-4">
              <button
                onClick={() => {
                  const audio = audioRef.current;
                  if (audio) {
                    if (audio.paused) {
                      audio.play();
                    } else {
                      audio.pause();
                      setPlayingId(null);
                    }
                  }
                }}
                className="w-12 h-12 rounded-full bg-accent-600 flex items-center justify-center hover:bg-accent-500 transition-colors"
              >
                {audioRef.current?.paused ? (
                  <Play className="w-5 h-5 text-white ml-0.5" />
                ) : (
                  <Pause className="w-5 h-5 text-white" />
                )}
              </button>
              <div
                className="flex-1 cursor-pointer"
                onClick={() => playingId && handleNavigateToDetail(playingId)}
              >
                <p className="text-white font-medium hover:text-accent-300 transition-colors">
                  {publishedAudio?.find(a => a.id === playingId)?.title || 
                   trending.find(a => a.id === playingId)?.title ||
                   favorites.find(a => a.id === playingId)?.title ||
                   'Unknown'}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-slate-400">
                    {formatDuration(Math.floor(currentTime))}
                  </span>

                  <input
                    type="range"
                    min={0}
                    max={duration || 0}
                    value={currentTime}
                    aria-label="Playback progress"
                    title="Playback progress"
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    onChange={(e) => {
                      e.stopPropagation();

                      const audio = audioRef.current;
                      if (!audio) return;

                      const newTime = Number(e.target.value);

                      audio.currentTime = newTime;
                      setCurrentTime(newTime);
                    }}
                    className="flex-1 h-1 cursor-pointer accent-cyan-500"
                  />

                  <span className="text-xs text-slate-400">
                    {formatDuration(Math.floor(duration))}
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="border-t border-slate-200 mt-20 bg-slate-50">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-slate-600">
              <Headphones className="w-5 h-5" />
              <span className="font-medium">Audio Library</span>
            </div>
            <p className="text-sm text-slate-500">
              © 2024 example.audiolib.com. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}