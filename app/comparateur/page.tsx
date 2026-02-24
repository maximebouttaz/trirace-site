'use client';

import { Suspense, useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { X, Search, Plus, Waves, Bike, Activity, Mountain, Calendar, MapPin, Euro, Clock, Users, Trophy, Wind, Thermometer } from 'lucide-react';
import { useCompare } from '@/lib/compare-context';
import { supabase } from '@/lib/supabase';
import type { Race } from '@/lib/types';
import { formatDistance, formatDate, categoryLabel, categoryColor, formatElevation } from '@/lib/utils';

function SlotSearch({
  allRaces,
  onSelect,
}: {
  allRaces: Race[];
  onSelect: (slug: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return allRaces
      .filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.city.toLowerCase().includes(q)
      )
      .slice(0, 6);
  }, [query, allRaces]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Chercher une course..."
          className="w-full pl-9 pr-3 py-2.5 rounded-xl text-sm bg-white border border-gray-200 text-zinc-700 placeholder-zinc-400 focus:ring-2 focus:ring-red-500/30 focus:border-red-500/50 outline-none transition"
        />
      </div>
      {open && results.length > 0 && (
        <div className="absolute z-20 top-full mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
          {results.map((r) => (
            <button
              key={r.slug}
              onClick={() => {
                onSelect(r.slug);
                setQuery('');
                setOpen(false);
              }}
              className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 transition flex items-center justify-between"
            >
              <div>
                <span className="font-semibold text-zinc-800">{r.name}</span>
                <span className="text-zinc-400 ml-2 text-xs">{r.city}</span>
              </div>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${categoryColor(r.category)}`}>
                {categoryLabel(r.category)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface MetricRow {
  label: string;
  icon: React.ReactNode;
  getValue: (r: Race) => string | number | null;
  getNumeric?: (r: Race) => number | null;
  unit?: string;
}

const SECTIONS: { title: string; rows: MetricRow[] }[] = [
  {
    title: 'Distances',
    rows: [
      { label: 'Natation', icon: <Waves size={14} className="text-cyan-500" />, getValue: (r) => formatDistance(r.swim_distance), getNumeric: (r) => r.swim_distance },
      { label: 'Vélo', icon: <Bike size={14} className="text-red-500" />, getValue: (r) => formatDistance(r.bike_distance), getNumeric: (r) => r.bike_distance },
      { label: 'Course à pied', icon: <Activity size={14} className="text-amber-500" />, getValue: (r) => formatDistance(r.run_distance), getNumeric: (r) => r.run_distance },
      { label: 'Distance totale', icon: <Activity size={14} className="text-zinc-500" />, getValue: (r) => formatDistance(r.total_distance), getNumeric: (r) => r.total_distance },
    ],
  },
  {
    title: 'Dénivelé',
    rows: [
      { label: 'Vélo D+', icon: <Mountain size={14} className="text-emerald-500" />, getValue: (r) => formatElevation(r.bike_elevation), getNumeric: (r) => r.bike_elevation },
      { label: 'Course D+', icon: <Mountain size={14} className="text-orange-500" />, getValue: (r) => formatElevation(r.run_elevation), getNumeric: (r) => r.run_elevation },
      { label: 'Dénivelé total', icon: <Mountain size={14} className="text-zinc-500" />, getValue: (r) => formatElevation(r.total_elevation), getNumeric: (r) => r.total_elevation },
    ],
  },
  {
    title: 'Infos pratiques',
    rows: [
      { label: 'Prix', icon: <Euro size={14} className="text-emerald-500" />, getValue: (r) => r.price_euros != null ? `${r.price_euros}€` : '—', getNumeric: (r) => r.price_euros },
      { label: 'Participants max', icon: <Users size={14} className="text-blue-500" />, getValue: (r) => r.max_participants != null ? String(r.max_participants) : '—', getNumeric: (r) => r.max_participants },
      { label: 'Temps limite', icon: <Clock size={14} className="text-violet-500" />, getValue: (r) => r.time_limit_hours != null ? `${r.time_limit_hours}h` : '—', getNumeric: (r) => r.time_limit_hours },
    ],
  },
  {
    title: 'Météo',
    rows: [
      { label: 'Température', icon: <Thermometer size={14} className="text-red-400" />, getValue: (r) => r.avg_temp_celsius != null ? `${r.avg_temp_celsius}°C` : '—', getNumeric: (r) => r.avg_temp_celsius },
      { label: 'Eau', icon: <Waves size={14} className="text-blue-400" />, getValue: (r) => r.avg_water_temp_celsius != null ? `${r.avg_water_temp_celsius}°C` : '—', getNumeric: (r) => r.avg_water_temp_celsius },
      { label: 'Vent', icon: <Wind size={14} className="text-gray-400" />, getValue: (r) => r.avg_wind_kmh != null ? `${r.avg_wind_kmh} km/h` : '—', getNumeric: (r) => r.avg_wind_kmh },
    ],
  },
  {
    title: 'Records',
    rows: [
      { label: 'Record hommes', icon: <Trophy size={14} className="text-amber-500" />, getValue: (r) => r.record_men || '—' },
      { label: 'Record femmes', icon: <Trophy size={14} className="text-pink-500" />, getValue: (r) => r.record_women || '—' },
    ],
  },
  {
    title: 'Lieu & Date',
    rows: [
      { label: 'Ville', icon: <MapPin size={14} className="text-zinc-500" />, getValue: (r) => `${r.city}, ${r.country}` },
      { label: 'Date', icon: <Calendar size={14} className="text-red-400" />, getValue: (r) => formatDate(r.date) },
    ],
  },
];

function BarVisual({ values }: { values: (number | null)[] }) {
  const nums = values.filter((v): v is number => v != null && v > 0);
  if (nums.length === 0) return null;
  const max = Math.max(...nums);

  return (
    <div className="flex gap-2 mt-1">
      {values.map((v, i) => (
        <div key={i} className="flex-1">
          <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
            {v != null && v > 0 && (
              <div
                className="h-full rounded-full bg-red-500 transition-all"
                style={{ width: `${(v / max) * 100}%` }}
              />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ComparateurPage() {
  return (
    <Suspense fallback={<div className="px-6 md:px-10 py-10"><div className="max-w-5xl mx-auto"><h1 className="text-3xl font-bold text-zinc-900 mb-2">Comparateur de courses</h1><p className="text-zinc-400 text-sm">Chargement...</p></div></div>}>
      <ComparateurContent />
    </Suspense>
  );
}

function ComparateurContent() {
  const searchParams = useSearchParams();
  const { slugs, addRace, removeRace, clearAll } = useCompare();
  const [allRaces, setAllRaces] = useState<Race[]>([]);
  const [loading, setLoading] = useState(true);

  // Load slugs from URL on mount
  useEffect(() => {
    const urlSlugs = searchParams.get('courses')?.split(',').filter(Boolean);
    if (urlSlugs && urlSlugs.length > 0 && slugs.length === 0) {
      urlSlugs.slice(0, 3).forEach((s) => addRace(s));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync slugs to URL
  useEffect(() => {
    if (slugs.length > 0) {
      window.history.replaceState(null, '', `?courses=${slugs.join(',')}`);
    } else {
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, [slugs]);

  useEffect(() => {
    async function fetchAll() {
      const { data } = await supabase
        .from('races')
        .select('*')
        .order('name');
      if (data) setAllRaces(data as Race[]);
      setLoading(false);
    }
    fetchAll();
  }, []);

  const selectedRaces = useMemo(
    () => slugs.map((s) => allRaces.find((r) => r.slug === s)).filter((r): r is Race => !!r),
    [slugs, allRaces]
  );

  const emptySlots = 3 - slugs.length;

  return (
    <div className="px-6 md:px-10 py-10 pb-24">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-zinc-900 mb-2">Comparateur de courses</h1>
          <p className="text-zinc-500">Compare jusqu&apos;a 3 courses triathlon cote a cote.</p>
        </div>

        {/* Slots */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
          {selectedRaces.map((race) => (
            <div
              key={race.slug}
              className="relative bg-gray-50 rounded-2xl border border-gray-200 overflow-hidden"
            >
              <div className={`h-20 ${race.image_gradient || 'bg-gradient-to-br from-gray-400 to-gray-600'}`} />
              <button
                onClick={() => removeRace(race.slug)}
                className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/40 backdrop-blur text-white flex items-center justify-center hover:bg-black/60 transition"
              >
                <X size={12} />
              </button>
              <div className="p-4">
                <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold mb-1 ${categoryColor(race.category)}`}>
                  {categoryLabel(race.category)}
                </span>
                <h3 className="font-bold text-zinc-900 text-sm leading-tight">{race.name}</h3>
                <p className="text-xs text-zinc-400 mt-1">{race.city}, {race.country}</p>
              </div>
            </div>
          ))}

          {Array.from({ length: emptySlots }).map((_, i) => (
            <div key={`empty-${i}`} className="bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 p-4">
              <div className="flex items-center gap-2 text-zinc-400 mb-3">
                <Plus size={16} />
                <span className="text-sm font-semibold">Ajouter une course</span>
              </div>
              {!loading && (
                <SlotSearch
                  allRaces={allRaces.filter((r) => !slugs.includes(r.slug))}
                  onSelect={addRace}
                />
              )}
            </div>
          ))}
        </div>

        {/* Clear */}
        {selectedRaces.length > 0 && (
          <div className="flex justify-end mb-6">
            <button
              onClick={clearAll}
              className="text-xs font-bold text-zinc-400 hover:text-zinc-700 transition"
            >
              Tout effacer
            </button>
          </div>
        )}

        {/* Comparison table */}
        {selectedRaces.length >= 2 && (
          <div className="space-y-8">
            {SECTIONS.map((section) => (
              <div key={section.title}>
                <h2 className="text-sm font-bold text-zinc-500 uppercase tracking-wider mb-4">
                  {section.title}
                </h2>
                <div className="bg-gray-50 rounded-2xl border border-gray-200 divide-y divide-gray-200 overflow-hidden">
                  {section.rows.map((row) => (
                    <div key={row.label} className="px-4 py-3">
                      <div className="flex items-center gap-2 mb-2">
                        {row.icon}
                        <span className="text-xs font-semibold text-zinc-500">{row.label}</span>
                      </div>
                      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${selectedRaces.length}, 1fr)` }}>
                        {selectedRaces.map((race) => (
                          <div key={race.slug} className="text-sm font-bold text-zinc-800 font-mono">
                            {row.getValue(race)}
                          </div>
                        ))}
                      </div>
                      {row.getNumeric && (
                        <BarVisual values={selectedRaces.map((r) => row.getNumeric!(r))} />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* Links to race pages */}
            <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${selectedRaces.length}, 1fr)` }}>
              {selectedRaces.map((race) => (
                <Link
                  key={race.slug}
                  href={`/courses/${race.slug}`}
                  className="block text-center px-4 py-3 rounded-xl bg-zinc-900 text-white text-sm font-bold hover:bg-zinc-800 transition"
                >
                  Voir {race.name}
                </Link>
              ))}
            </div>
          </div>
        )}

        {selectedRaces.length < 2 && !loading && (
          <div className="text-center py-16">
            <p className="text-zinc-400 text-sm">
              Sélectionne au moins 2 courses pour les comparer.
              <br />
              Tu peux aussi ajouter des courses depuis la page{' '}
              <Link href="/courses" className="text-red-500 font-semibold hover:underline">
                Courses
              </Link>{' '}
              en cliquant sur le bouton <Plus size={12} className="inline" />.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
