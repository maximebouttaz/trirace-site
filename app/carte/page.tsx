'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import type { Race } from '@/lib/types';
import type { CategoryFilter } from '@/components/RaceFilters';
import RaceMapSidebar from '@/components/RaceMapSidebar';

const RaceMap = dynamic(() => import('@/components/RaceMap'), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full rounded-2xl bg-gray-100 animate-pulse flex items-center justify-center">
      <span className="text-zinc-400 text-sm">Chargement de la carte...</span>
    </div>
  ),
});

export default function CartePage() {
  const [races, setRaces] = useState<Race[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>('all');
  const [focusSlug, setFocusSlug] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    async function fetchRaces() {
      const res = await fetch('/api/races?geo=true');
      if (res.ok) {
        const data = await res.json();
        setRaces(data as Race[]);
      }
      setLoading(false);
    }
    fetchRaces();
  }, []);

  const filteredForMap = races.filter((r) => {
    if (activeCategory === 'all') return true;
    if (activeCategory === 'l') return r.category === 'L';
    if (activeCategory === 'half') return r.category === '70.3';
    if (activeCategory === 'xl') return r.category === 'XL';
    if (activeCategory === 'ironman') return r.category === 'Ironman';
    return true;
  });

  const handleRaceClick = (slug: string) => {
    setFocusSlug(slug);
    setSidebarOpen(false);
  };

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col md:flex-row">
      {/* Mobile toggle */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="md:hidden px-4 py-2 bg-white border-b border-gray-200 text-sm font-bold text-zinc-700 text-left"
      >
        {sidebarOpen ? 'Voir la carte' : `Liste (${filteredForMap.length} courses)`}
      </button>

      {/* Sidebar */}
      <div
        className={`${
          sidebarOpen ? 'flex' : 'hidden'
        } md:flex flex-col w-full md:w-96 border-r border-gray-200 bg-white shrink-0 overflow-hidden`}
      >
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <span className="text-zinc-400 text-sm">Chargement...</span>
          </div>
        ) : (
          <RaceMapSidebar
            races={races}
            activeCategory={activeCategory}
            onCategoryChange={setActiveCategory}
            onRaceClick={handleRaceClick}
          />
        )}
      </div>

      {/* Map */}
      <div className={`flex-1 ${sidebarOpen ? 'hidden md:block' : 'block'}`}>
        {loading ? (
          <div className="h-full w-full bg-gray-100 animate-pulse flex items-center justify-center">
            <span className="text-zinc-400 text-sm">Chargement de la carte...</span>
          </div>
        ) : (
          <RaceMap races={filteredForMap} focusSlug={focusSlug} />
        )}
      </div>
    </div>
  );
}
