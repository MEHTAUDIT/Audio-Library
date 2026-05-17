import { Search } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

export type LibraryFilters = {
  audioSubstring: string;
  speakerName: string | null;
  genre: string | null;
  tag: string | null;
};

type Props = {
  initial?: Partial<LibraryFilters>;
  speakers: string[];
  genres: string[];
  tags: string[];
  onChange: (filters: LibraryFilters) => void;
  debounceMs?: number;
};

export function LibrarySearch({
  initial,
  speakers,
  genres,
  tags,
  onChange,
  debounceMs = 400,
}: Props) {
  const [audioSubstring, setAudioSubstring] = useState(initial?.audioSubstring || '');
  const [speakerName, setSpeakerName] = useState<string | null>(initial?.speakerName ?? null);
  const [genre, setGenre] = useState<string | null>(initial?.genre ?? null);
  const [tag, setTag] = useState<string | null>(initial?.tag ?? null);

  const timer = useRef<number | null>(null);

  // Debounce filters and notify parent
  useEffect(() => {
    if (timer.current) {
      window.clearTimeout(timer.current);
    }
    timer.current = window.setTimeout(() => {
      onChange({ audioSubstring: audioSubstring.trim(), speakerName, genre, tag });
    }, debounceMs);

    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [audioSubstring, speakerName, genre, tag, onChange, debounceMs]);

  // Helpers to render select with an "All" option
  const renderSelect = (
    value: string | null,
    onChangeFn: (v: string | null) => void,
    options: string[],
    placeholder: string
  ) => (
    <select
      value={value ?? ''}
      onChange={(e) => onChangeFn(e.target.value === '' ? null : e.target.value)}
      className="w-full md:w-auto px-3 py-2 rounded-xl bg-white/95 border border-white/20 text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-white focus:border-transparent"
    >
      <option value="">All {placeholder}</option>
      {options.map((o) => (
        <option key={o} value={o}>{o}</option>
      ))}
    </select>
  );

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <input
          type="text"
          placeholder="Search audio by title or description..."
          value={audioSubstring}
          onChange={(e) => setAudioSubstring(e.target.value)}
          className="w-full pl-12 pr-4 py-4 rounded-2xl bg-white/95 backdrop-blur-sm border border-white/20 text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-white focus:border-transparent shadow-lg"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {renderSelect(speakerName, setSpeakerName, speakers, 'Speakers')}
        {renderSelect(genre, setGenre, genres, 'Genres')}
        {renderSelect(tag, setTag, tags, 'Tags')}
      </div>
    </div>
  );
}
