'use client';

import { Search, ArrowUpDown } from 'lucide-react';

const CATEGORIES = [
  { key: 'all', label: 'Toutes' },
  { key: 'sprint', label: 'Sprint (S)' },
  { key: 'olympic', label: 'Olympique (M)' },
  { key: 'half', label: 'Half (L / 70.3)' },
  { key: 'full', label: 'Ironman / XL' },
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
}: {
  search: string;
  onSearchChange: (v: string) => void;
  activeCategory: CategoryFilter;
  onCategoryChange: (v: CategoryFilter) => void;
  sort: SortOption;
  onSortChange: (v: SortOption) => void;
  count: number;
}) {
  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={20} aria-hidden="true" />
        <label htmlFor="race-search" className="sr-only">Chercher une course</label>
        <input
          id="race-search"
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Chercher une course, ville, région..."
          className="w-full pl-12 pr-4 py-3.5 rounded-2xl border border-gray-200 bg-gray-100 text-sm text-zinc-900 placeholder-zinc-400 focus:ring-2 focus:ring-red-500/30 focus:border-red-500/50 outline-none transition"
        />
      </div>

      {/* Categories + Sort */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Category buttons */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide flex-1">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.key}
              onClick={() => onCategoryChange(cat.key)}
              aria-pressed={activeCategory === cat.key}
              className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${
                activeCategory === cat.key
                  ? 'bg-zinc-900 text-white shadow-md'
                  : 'bg-white border border-gray-200 text-zinc-500 hover:bg-gray-100 hover:text-zinc-700'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Sort + count */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="relative flex items-center">
            <ArrowUpDown size={14} className="absolute left-3 text-zinc-500 pointer-events-none" aria-hidden="true" />
            <label htmlFor="race-sort" className="sr-only">Trier par</label>
            <select
              id="race-sort"
              value={sort}
              onChange={(e) => onSortChange(e.target.value as SortOption)}
              className="pl-8 pr-3 py-2 rounded-xl text-sm font-bold bg-gray-100 border border-gray-200 text-zinc-500 hover:border-gray-300 focus:ring-2 focus:ring-red-500/30 focus:border-red-500/50 outline-none transition appearance-none cursor-pointer"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.key} value={opt.key}>{opt.label}</option>
              ))}
            </select>
          </div>
          <span className="text-xs text-zinc-400 font-mono whitespace-nowrap">
            {count} course{count > 1 ? 's' : ''}
          </span>
        </div>
      </div>
    </div>
  );
}
