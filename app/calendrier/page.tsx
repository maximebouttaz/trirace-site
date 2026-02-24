'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, MapPin, Calendar } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Race } from '@/lib/types';
import { categoryLabel, categoryColor, formatDate } from '@/lib/utils';

const MONTHS_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

export default function CalendrierPage() {
  const [races, setRaces] = useState<Race[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  useEffect(() => {
    async function fetchRaces() {
      const { data } = await supabase
        .from('races')
        .select('id, slug, name, date, city, country, category, total_distance, image_gradient')
        .not('date', 'is', null)
        .order('date', { ascending: true });
      if (data) setRaces(data as Race[]);
      setLoading(false);
    }
    fetchRaces();
  }, []);

  // Group races by year-month
  const byMonth = useMemo(() => {
    const map: Record<string, Race[]> = {};
    for (const race of races) {
      if (!race.date) continue;
      const key = race.date.slice(0, 7); // "2026-06"
      if (!map[key]) map[key] = [];
      map[key].push(race);
    }
    return map;
  }, [races]);

  const availableMonths = useMemo(() => Object.keys(byMonth).sort(), [byMonth]);

  const currentKey = `${currentMonth.year}-${String(currentMonth.month + 1).padStart(2, '0')}`;
  const currentRaces = byMonth[currentKey] || [];

  const prevMonth = () => {
    setCurrentMonth(({ year, month }) => {
      if (month === 0) return { year: year - 1, month: 11 };
      return { year, month: month - 1 };
    });
  };

  const nextMonth = () => {
    setCurrentMonth(({ year, month }) => {
      if (month === 11) return { year: year + 1, month: 0 };
      return { year, month: month + 1 };
    });
  };

  const hasPrev = availableMonths.some((k) => k < currentKey);
  const hasNext = availableMonths.some((k) => k > currentKey);

  return (
    <div className="px-6 md:px-10 py-10 pb-24">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-zinc-900 mb-2">Calendrier des courses</h1>
          <p className="text-zinc-500">
            {loading ? 'Chargement...' : `${races.length} courses triathlon en France et en Europe`}
          </p>
        </div>

        {/* Month navigation */}
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={prevMonth}
            disabled={!hasPrev}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-zinc-600 hover:border-gray-300 hover:bg-gray-50 transition disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronLeft size={16} />
            Mois précédent
          </button>

          <div className="text-center">
            <h2 className="text-xl font-bold text-zinc-900">
              {MONTHS_FR[currentMonth.month]} {currentMonth.year}
            </h2>
            <p className="text-sm text-zinc-500 mt-0.5">
              {currentRaces.length} course{currentRaces.length !== 1 ? 's' : ''}
            </p>
          </div>

          <button
            onClick={nextMonth}
            disabled={!hasNext}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-zinc-600 hover:border-gray-300 hover:bg-gray-50 transition disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Mois suivant
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Month quick jump */}
        {!loading && availableMonths.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-8">
            {availableMonths.map((key) => {
              const [y, m] = key.split('-').map(Number);
              const isActive = key === currentKey;
              const monthRaces = byMonth[key] || [];
              return (
                <button
                  key={key}
                  onClick={() => setCurrentMonth({ year: y, month: m - 1 })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    isActive
                      ? 'bg-red-500 text-white'
                      : 'bg-gray-100 text-zinc-600 hover:bg-gray-200'
                  }`}
                >
                  {MONTHS_FR[m - 1].slice(0, 3)} {y}
                  <span className={`ml-1.5 ${isActive ? 'text-red-200' : 'text-zinc-400'}`}>
                    ({monthRaces.length})
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Race list */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="animate-pulse bg-gray-50 rounded-2xl border border-gray-200 p-5 h-20" />
            ))}
          </div>
        ) : currentRaces.length === 0 ? (
          <div className="text-center py-20">
            <Calendar size={48} className="mx-auto text-zinc-300 mb-4" />
            <h3 className="font-bold text-zinc-900 text-lg">Aucune course ce mois-ci</h3>
            <p className="text-zinc-500 text-sm mt-2">Navigue vers un autre mois pour voir les courses disponibles.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {currentRaces.map((race) => (
              <Link key={race.id} href={`/courses/${race.slug}`}>
                <div className="group flex items-center gap-4 bg-gray-50 rounded-2xl border border-gray-200 hover:border-gray-300 hover:shadow-md hover:shadow-black/5 transition-all p-4 hover:-translate-y-0.5 duration-200">
                  {/* Color strip */}
                  <div className={`w-1.5 self-stretch rounded-full shrink-0 ${race.image_gradient || 'bg-gradient-to-b from-gray-400 to-gray-600'}`} />

                  {/* Date block */}
                  <div className="shrink-0 text-center w-12">
                    <div className="text-2xl font-black font-mono text-zinc-900 leading-none">
                      {race.date ? new Date(race.date + 'T00:00:00').getDate() : '—'}
                    </div>
                    <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mt-0.5">
                      {race.date ? MONTHS_FR[new Date(race.date + 'T00:00:00').getMonth()].slice(0, 3) : ''}
                    </div>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${categoryColor(race.category)}`}>
                        {categoryLabel(race.category)}
                      </span>
                    </div>
                    <h3 className="font-bold text-zinc-900 text-base leading-tight truncate group-hover:text-red-500 transition-colors duration-200">
                      {race.name}
                    </h3>
                    <div className="flex items-center gap-1 mt-1 text-xs text-zinc-400">
                      <MapPin size={10} />
                      <span>{race.city}, {race.country}</span>
                    </div>
                  </div>

                  {/* Date badge */}
                  <div className="shrink-0 text-right hidden sm:block">
                    <span className="text-xs text-zinc-400">{formatDate(race.date)}</span>
                  </div>

                  <ChevronRight size={16} className="text-zinc-300 group-hover:text-zinc-600 transition shrink-0" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
