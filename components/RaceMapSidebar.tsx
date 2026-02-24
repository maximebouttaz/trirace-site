'use client';

import { useState, useMemo } from 'react';
import { Search, MapPin, Calendar } from 'lucide-react';
import { CATEGORIES } from '@/components/RaceFilters';
import type { Race } from '@/lib/types';
import type { CategoryFilter } from '@/components/RaceFilters';
import { formatDate, formatDistance, categoryLabel, categoryColor } from '@/lib/utils';

export default function RaceMapSidebar({
  races,
  activeCategory,
  onCategoryChange,
  onRaceClick,
}: {
  races: Race[];
  activeCategory: CategoryFilter;
  onCategoryChange: (v: CategoryFilter) => void;
  onRaceClick: (slug: string) => void;
}) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    let result = races;

    if (activeCategory !== 'all') {
      if (activeCategory === 'l') result = result.filter(r => r.category === 'L');
      else if (activeCategory === 'half') result = result.filter(r => r.category === '70.3');
      else if (activeCategory === 'xl') result = result.filter(r => r.category === 'XL');
      else if (activeCategory === 'ironman') result = result.filter(r => r.category === 'Ironman');
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.city.toLowerCase().includes(q) ||
          (r.region && r.region.toLowerCase().includes(q))
      );
    }

    return result;
  }, [races, activeCategory, search]);

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="p-4 border-b border-gray-200">
        <div className="relative mb-3">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Chercher une course..."
            className="w-full pl-9 pr-3 py-2.5 rounded-xl text-sm bg-gray-100 border border-gray-200 text-zinc-700 placeholder-zinc-400 focus:ring-2 focus:ring-red-500/30 focus:border-red-500/50 outline-none transition"
          />
        </div>
        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-1">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.key}
              onClick={() => onCategoryChange(cat.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                activeCategory === cat.key
                  ? 'bg-zinc-900 text-white shadow-md'
                  : 'bg-white border border-gray-200 text-zinc-500 hover:bg-gray-100'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Count */}
      <div className="px-4 py-2 text-xs text-zinc-400 font-mono border-b border-gray-100">
        {filtered.length} course{filtered.length > 1 ? 's' : ''}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {filtered.map((race) => (
          <button
            key={race.slug}
            onClick={() => onRaceClick(race.slug)}
            className="w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h4 className="text-sm font-bold text-zinc-800 truncate">{race.name}</h4>
                <div className="flex items-center gap-1.5 text-xs text-zinc-400 mt-0.5">
                  <MapPin size={10} />
                  <span className="truncate">{race.city}</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-zinc-400 mt-0.5">
                  <Calendar size={10} />
                  <span>{formatDate(race.date)}</span>
                </div>
              </div>
              <div className="shrink-0 flex flex-col items-end gap-1">
                <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${categoryColor(race.category)}`}>
                  {categoryLabel(race.category)}
                </span>
                {race.total_distance != null && race.total_distance > 0 && (
                  <span className="text-[10px] font-mono text-zinc-400">
                    {formatDistance(race.total_distance)}
                  </span>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
