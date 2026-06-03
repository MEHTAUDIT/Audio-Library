import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ExternalLink, Loader2, Search, User, Users } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { speakerApi } from '../../lib/speakerApi';

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

export function SpeakersPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');

  const speakersQuery = useQuery({
    queryKey: ['speakers', 'admin-list'],
    queryFn: () => speakerApi.listSpeakers(),
  });

  const filteredSpeakers = useMemo(() => {
    const speakers = speakersQuery.data ?? [];
    const normalizedQuery = searchQuery.trim().toLowerCase();

    if (!normalizedQuery) {
      return speakers;
    }

    return speakers.filter((speaker) =>
      speaker.name.toLowerCase().includes(normalizedQuery)
    );
  }, [searchQuery, speakersQuery.data]);

  return (
    <div>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-3">
            <Users className="h-8 w-8 text-primary-600" />
            <h1 className="text-3xl font-bold text-slate-900">Speakers</h1>
          </div>
          <p className="text-slate-500">View all speaker records for the current tenant.</p>
        </div>

        <div className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700">
          {(speakersQuery.data ?? []).length} speakers
        </div>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Search speakers..."
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          className="w-full rounded-lg border border-slate-200 py-2.5 pl-10 pr-4 focus:border-transparent focus:ring-2 focus:ring-primary-500"
        />
      </div>

      {speakersQuery.isLoading ? (
        <div className="flex min-h-[260px] items-center justify-center rounded-xl border border-slate-200 bg-white">
          <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
        </div>
      ) : speakersQuery.isError ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-8 text-center">
          <h2 className="text-lg font-semibold text-rose-900">Unable to load speakers</h2>
          <p className="mt-2 text-sm text-rose-700">Please refresh or sign in again as a tenant admin.</p>
        </div>
      ) : filteredSpeakers.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white py-16 text-center">
          <User className="mx-auto mb-4 h-14 w-14 text-slate-300" />
          <h2 className="text-xl font-semibold text-slate-800">No speakers found</h2>
          <p className="mt-2 text-slate-500">
            {searchQuery.trim() ? 'Try another search term.' : 'Create speakers from Settings or while uploading media.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredSpeakers.map((speaker) => (
            <motion.button
              key={speaker.id}
              type="button"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={() => navigate(`/speaker/${speaker.id}`)}
              className="group flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-5 text-left transition-all hover:-translate-y-0.5 hover:border-primary-200 hover:shadow-md"
            >
              <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-primary-600 to-accent-500 text-lg font-semibold text-white shadow-soft">
                {speaker.avatarUrl ? (
                  <img
                    src={speaker.avatarUrl}
                    alt={speaker.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  getInitials(speaker.name)
                )}
              </div>

              <div className="min-w-0 flex-1">
                <h2 className="truncate text-lg font-semibold text-slate-900 group-hover:text-primary-700">
                  {speaker.name}
                </h2>
                <p className="mt-1 text-sm text-slate-500">Open speaker profile</p>
              </div>

              <ExternalLink className="h-5 w-5 shrink-0 text-slate-300 transition-colors group-hover:text-primary-500" />
            </motion.button>
          ))}
        </div>
      )}
    </div>
  );
}
