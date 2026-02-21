'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { Search } from 'lucide-react';
import RaceCard from '@/components/RaceCard';
import RaceFilters, { type CategoryFilter, type SortOption } from '@/components/RaceFilters';
import { supabase } from '@/lib/supabase';
import type { Race } from '@/lib/types';

export default function CoursesPage() {
  const searchParams = useSearchParams();
  const [races, setRaces] = useState<Race[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>(() => {
    const param = searchParams.get('category');
    const valid: CategoryFilter[] = ['all', 'sprint', 'olympic', 'half', 'full'];
    return valid.includes(param as CategoryFilter) ? (param as CategoryFilter) : 'all';
  });
  const [sort, setSort] = useState<SortOption>('date_asc');

  useEffect(() => {
    async function fetchRaces() {
      const { data, error } = await supabase
        .from('races')
        .select('id, slug, name, date, city, country, region, category, swim_distance, bike_distance, run_distance, total_distance, total_elevation, price_euros, image_gradient, tags')
        .order('date', { ascending: true });

      if (error) {
        setError(true);
      } else if (data) {
        setRaces(data as Race[]);
      }
      setLoading(false);
    }
    fetchRaces();
  }, []);

  const filtered = useMemo(() => {
    let result = races;

    if (activeCategory !== 'all') {
      if (activeCategory === 'sprint') result = result.filter(r => ['XS', 'S'].includes(r.category));
      else if (activeCategory === 'olympic') result = result.filter(r => r.category === 'M');
      else if (activeCategory === 'half') result = result.filter(r => ['L', '70.3'].includes(r.category));
      else if (activeCategory === 'full') result = result.filter(r => ['XL', 'Ironman'].includes(r.category));
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(r =>
        r.name.toLowerCase().includes(q) ||
        r.city.toLowerCase().includes(q) ||
        r.country.toLowerCase().includes(q) ||
        (r.region && r.region.toLowerCase().includes(q))
      );
    }

    return [...result].sort((a, b) => {
      if (sort === 'date_asc') return (a.date ?? '').localeCompare(b.date ?? '');
      if (sort === 'date_desc') return (b.date ?? '').localeCompare(a.date ?? '');
      if (sort === 'price_asc') return (a.price_euros ?? Infinity) - (b.price_euros ?? Infinity);
      if (sort === 'elevation_desc') return (b.total_elevation ?? 0) - (a.total_elevation ?? 0);
      return 0;
    });
  }, [races, activeCategory, search, sort]);

  return (
    <div className="px-6 md:px-10 py-10 pb-24">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-zinc-900 mb-2">Toutes les courses</h1>
          <p className="text-zinc-500">
            {loading ? 'Chargement...' : `${races.length} courses triathlon en France et en Europe`}
          </p>
        </div>

        {/* Filters */}
        <div className="mb-8">
          <RaceFilters
            search={search}
            onSearchChange={setSearch}
            activeCategory={activeCategory}
            onCategoryChange={setActiveCategory}
            sort={sort}
            onSortChange={setSort}
            count={filtered.length}
          />
        </div>

        {/* Results */}
        {error ? (
          <div className="text-center py-20">
            <p className="text-zinc-500 text-sm">Impossible de charger les courses. Réessaie dans quelques instants.</p>
            <button onClick={() => window.location.reload()} className="mt-4 px-4 py-2 rounded-xl bg-gray-50 border border-gray-200 text-sm text-zinc-500 hover:border-gray-300 transition">
              Réessayer
            </button>
          </div>
        ) : loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="animate-pulse bg-gray-50 rounded-3xl overflow-hidden border border-gray-200">
                <div className="h-36 bg-gray-100" />
                <div className="p-5 space-y-3">
                  <div className="h-3 w-24 bg-gray-200 rounded" />
                  <div className="h-5 w-3/4 bg-gray-200 rounded" />
                  <div className="h-3 w-32 bg-gray-200 rounded" />
                  <div className="flex gap-4">
                    <div className="h-3 w-12 bg-gray-200 rounded" />
                    <div className="h-3 w-12 bg-gray-200 rounded" />
                    <div className="h-3 w-12 bg-gray-200 rounded" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <Search size={48} className="mx-auto text-zinc-300 mb-4" />
            <h3 className="font-bold text-zinc-900 text-lg">Aucune course trouvée</h3>
            <p className="text-zinc-500 text-sm mt-2">Essaie un autre filtre ou une autre recherche.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filtered.map((race) => (
              <RaceCard key={race.id} race={race} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
