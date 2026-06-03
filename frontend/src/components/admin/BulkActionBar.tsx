import type { ReactNode } from 'react';

interface BulkActionBarProps {
  selectedCount: number;
  visibleCount: number;
  allVisibleSelected: boolean;
  onToggleAllVisible: () => void;
  onClear: () => void;
  children: ReactNode;
}

export function BulkActionBar({
  selectedCount,
  visibleCount,
  allVisibleSelected,
  onToggleAllVisible,
  onClear,
  children,
}: BulkActionBarProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          checked={allVisibleSelected}
          onChange={onToggleAllVisible}
          disabled={visibleCount === 0}
          className="h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
          aria-label="Select all visible media"
        />
        <span className="text-sm font-medium text-slate-700">
          {selectedCount > 0 ? `${selectedCount} selected` : `Select from ${visibleCount} visible items`}
        </span>
        {selectedCount > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="text-sm text-slate-500 hover:text-slate-800"
          >
            Clear
          </button>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

