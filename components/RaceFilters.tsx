'use client';

import { Search, SlidersHorizontal, ChevronDown } from 'lucide-react';

// Temporary: only Half and Full Ironman visible
export const CATEGORIES = [
  { key: 'all', label: 'Toutes' },
  { key: 'l', label: 'L' },
  { key: 'half', label: '70.3' },
  { key: 'xl', label: 'XL' },
  { key: 'ironman', label: 'Ironman / XXL' },
] as const;

const SORT_OPTIONS = [
  { key: 'date_asc', label: 'Date (prochain)' },
  { key: 'date_desc', label: 'Date (dernier)' },
  { key: 'price_asc', label: 'Prix croissant' },
  { key: 'elevation_desc', label: 'Dénivelé (max)' },
] as const;

export type CategoryFilter = (typeof CATEGORIES)[number]['key'];
export type SortOption = (typeof SORT_OPTIONS)[number]['key'];

export default function RaceFilters({
  search,
  onSearchChange,
  activeCategory,
  onCategoryChange,
  sort,
  onSortChange,
  count,
  advancedOpen,
  onToggleAdvanced,
  activeAdvancedCount,
}: {
  search: string;
  onSearchChange: (v: string) => void;
  activeCategory: CategoryFilter;
  onCategoryChange: (v: CategoryFilter) => void;
  sort: SortOption;
  onSortChange: (v: SortOption) => void;
  count: number;
  advancedOpen?: boolean;
  onToggleAdvanced?: () => void;
  activeAdvancedCount?: number;
}) {
  return (
    <div className="space-y-3">
      {/* Search */}
      <div className="relative">
        <Search
          className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none"
          size={18}
          aria-hidden="true"
        />
        <label htmlFor="race-search" className="sr-only">Chercher une course</label>
        <input
          id="race-search"
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Chercher une course, ville, région..."
          className="w-full pl-11 pr-4 py-3 rounded-2xl border border-gray-200 bg-white text-sm text-zinc-900 placeholder-zinc-400 focus:ring-2 focus:ring-red-500/20 focus:border-red-400 outline-none transition-all duration-200 shadow-sm"
        />
        {search && (
          <button
            onClick={() => onSearchChange('')}
            aria-label="Effacer la recherche"
            className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-600 hover:bg-gray-100 transition-colors text-xs font-bold"
          >
            ✕
          </button>
        )}
      </div>

      {/* Categories + Sort row */}
      <div className="flex items-center gap-2">
        {/* Category pills — scrollable on mobile */}
        <div className="relative flex-1 min-w-0">
          <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-hide">
            {CATEGORIES.map((cat) => {
              const isActive = activeCategory === cat.key;
              return (
                <button
                  key={cat.key}
                  onClick={() => onCategoryChange(cat.key)}
                  aria-pressed={isActive}
                  className={`px-3.5 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all duration-200 shrink-0 ${
                    isActive
                      ? 'bg-zinc-900 text-white shadow-sm'
                      : 'bg-white border border-gray-200 text-zinc-500 hover:bg-gray-50 hover:text-zinc-700 hover:border-gray-300'
                  }`}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>
          {/* Fade mask on right to hint scrollability */}
          <div
            className="pointer-events-none absolute right-0 top-0 bottom-0.5 w-8 bg-gradient-to-l from-white/90 to-transparent"
            aria-hidden="true"
          />
        </div>

        {/* Actions: advanced filters + sort + count */}
        <div className="flex items-center gap-2 shrink-0">
          {onToggleAdvanced && (
            <button
              onClick={onToggleAdvanced}
              aria-pressed={advancedOpen}
              className={`relative flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold transition-all duration-200 ${
                advancedOpen
                  ? 'bg-zinc-900 text-white shadow-sm'
                  : 'bg-white border border-gray-200 text-zinc-500 hover:bg-gray-50 hover:text-zinc-700 hover:border-gray-300'
              }`}
            >
              <SlidersHorizontal size={14} aria-hidden="true" />
              <span className="hidden sm:inline">Filtres</span>
              {(activeAdvancedCount ?? 0) > 0 && (
                <span className="ml-0.5 w-4 h-4 flex items-center justify-center rounded-full bg-red-500 text-white text-[9px] font-black leading-none">
                  {activeAdvancedCount}
                </span>
              )}
            </button>
          )}

          <div className="relative">
            <label htmlFor="race-sort" className="sr-only">Trier par</label>
            <select
              id="race-sort"
              value={sort}
              onChange={(e) => onSortChange(e.target.value as SortOption)}
              className="pl-3 pr-8 py-2 rounded-xl text-sm font-bold bg-white border border-gray-200 text-zinc-600 hover:border-gray-300 focus:ring-2 focus:ring-red-500/20 focus:border-red-400 outline-none transition-all duration-200 appearance-none cursor-pointer shadow-sm"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.key} value={opt.key}>{opt.label}</option>
              ))}
            </select>
            <ChevronDown
              size={13}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none"
              aria-hidden="true"
            />
          </div>

          <span className="text-xs text-zinc-400 font-mono whitespace-nowrap tabular-nums">
            {count} course{count > 1 ? 's' : ''}
          </span>
        </div>
      </div>
    </div>
  );
}
