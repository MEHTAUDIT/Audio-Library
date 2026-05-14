import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { FileAudio, Clock, CheckCircle, Archive, TrendingUp, Upload, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { audioApi } from '../../lib/audioApi';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

export function DashboardPage() {
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['audioStats'],
    queryFn: audioApi.getStats,
  });

  const { data: recentDrafts } = useQuery({
    queryKey: ['recentDrafts'],
    queryFn: audioApi.getStaging,
  });

  const { data: recentPublished } = useQuery({
    queryKey: ['recentPublished'],
    queryFn: audioApi.getPublished,
  });

  const statCards = [
    {
      title: 'Total Audio',
      value: stats?.totalCount ?? 0,
      icon: FileAudio,
      color: 'from-violet-500 to-indigo-500',
      shadowColor: 'shadow-violet-200',
    },
    {
      title: 'In Staging',
      value: stats?.draftCount ?? 0,
      icon: Clock,
      color: 'from-amber-500 to-orange-500',
      shadowColor: 'shadow-amber-200',
      link: '/admin/staging',
    },
    {
      title: 'Published',
      value: stats?.publishedCount ?? 0,
      icon: CheckCircle,
      color: 'from-emerald-500 to-teal-500',
      shadowColor: 'shadow-emerald-200',
      link: '/admin/published',
    },
    {
      title: 'Archived',
      value: stats?.archivedCount ?? 0,
      icon: Archive,
      color: 'from-slate-500 to-slate-600',
      shadowColor: 'shadow-slate-200',
      link: '/admin/archived',
    },
  ];

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-500 mt-1">Welcome back! Here's an overview of your audio library.</p>
        </div>
        <Link
          to="/admin/upload"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl font-medium hover:opacity-90 transition-opacity shadow-lg shadow-violet-200"
        >
          <Upload className="w-4 h-4" />
          Upload Audio
        </Link>
      </motion.div>

      {/* Stats Grid */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5"
      >
        {statCards.map((stat) => (
          <motion.div key={stat.title} variants={item}>
            <Card className={`relative overflow-hidden hover:shadow-lg transition-shadow ${stat.link ? 'cursor-pointer' : ''}`}>
              {stat.link ? (
                <Link to={stat.link} className="block">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-500">{stat.title}</p>
                        <p className="text-3xl font-bold text-slate-900 mt-2">
                          {statsLoading ? '—' : stat.value}
                        </p>
                      </div>
                      <div className={`p-3 rounded-xl bg-gradient-to-br ${stat.color} ${stat.shadowColor} shadow-lg`}>
                        <stat.icon className="w-5 h-5 text-white" />
                      </div>
                    </div>
                  </CardContent>
                </Link>
              ) : (
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-500">{stat.title}</p>
                      <p className="text-3xl font-bold text-slate-900 mt-2">
                        {statsLoading ? '—' : stat.value}
                      </p>
                    </div>
                    <div className={`p-3 rounded-xl bg-gradient-to-br ${stat.color} ${stat.shadowColor} shadow-lg`}>
                      <stat.icon className="w-5 h-5 text-white" />
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>
          </motion.div>
        ))}
      </motion.div>

      {/* Recent Audio Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Staging Queue */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-100">
                  <Clock className="w-4 h-4 text-amber-600" />
                </div>
                <CardTitle className="text-lg">Staging Queue</CardTitle>
              </div>
              <Link
                to="/admin/staging"
                className="text-sm text-violet-600 hover:text-violet-700 font-medium flex items-center gap-1"
              >
                View all
                <ArrowRight className="w-4 h-4" />
              </Link>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentDrafts?.slice(0, 4).map((audio) => (
                  <div
                    key={audio.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center flex-shrink-0">
                        <FileAudio className="w-5 h-5 text-white" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-slate-900 truncate">{audio.title}</p>
                        <p className="text-sm text-slate-500 truncate">{audio.speaker}</p>
                      </div>
                    </div>
                    <Badge variant="warning">Draft</Badge>
                  </div>
                ))}
                {(!recentDrafts || recentDrafts.length === 0) && (
                  <p className="text-center text-slate-500 py-4">No audio in staging</p>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Recently Published */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-100">
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                </div>
                <CardTitle className="text-lg">Recently Published</CardTitle>
              </div>
              <Link
                to="/admin/published"
                className="text-sm text-violet-600 hover:text-violet-700 font-medium flex items-center gap-1"
              >
                View all
                <ArrowRight className="w-4 h-4" />
              </Link>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentPublished?.slice(0, 4).map((audio) => (
                  <div
                    key={audio.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center flex-shrink-0">
                        <FileAudio className="w-5 h-5 text-white" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-slate-900 truncate">{audio.title}</p>
                        <p className="text-sm text-slate-500 truncate">
                          {audio.speaker} • {formatDuration(audio.durationSeconds)}
                        </p>
                      </div>
                    </div>
                    <Badge variant="success">Live</Badge>
                  </div>
                ))}
                {(!recentPublished || recentPublished.length === 0) && (
                  <p className="text-center text-slate-500 py-4">No published audio</p>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Quick Actions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <Card className="bg-gradient-to-br from-violet-600 to-indigo-600 border-0 text-white overflow-hidden relative">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full -ml-24 -mb-24" />
          <CardContent className="p-8 relative">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              <div>
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  Ready to grow your library?
                </h3>
                <p className="text-violet-200 mt-2 max-w-md">
                  Upload new audio content and publish it to your users. Audio in staging can be 
                  categorized before going live.
                </p>
              </div>
              <div className="flex gap-3">
                <Link
                  to="/admin/upload"
                  className="px-5 py-2.5 bg-white text-violet-600 rounded-xl font-medium hover:bg-violet-50 transition-colors inline-flex items-center gap-2"
                >
                  <Upload className="w-4 h-4" />
                  Upload Now
                </Link>
                <Link
                  to="/library"
                  className="px-5 py-2.5 bg-white/20 text-white rounded-xl font-medium hover:bg-white/30 transition-colors"
                >
                  View Library
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

