'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Heart, ArrowRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Race } from '@/lib/types';
import RaceCard from '@/components/RaceCard';
import { useFavorites } from '@/lib/hooks/useFavorites';

export default function MesCoursesPage() {
  const { favorites } = useFavorites();
  const [races, setRaces] = useState<Race[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (favorites.length === 0) {
      setRaces([]);
      return;
    }
    setLoading(true);
    supabase
      .from('races')
      .select('id, slug, name, date, city, country, region, department, category, swim_distance, bike_distance, run_distance, total_distance, total_elevation, price_euros, image_gradient, image_url, tags, avg_temp_high_celsius, avg_temp_low_celsius, latitude, longitude')
      .in('slug', favorites)
      .then(({ data }) => {
        if (data) {
          // Preserve favorites order
          const ordered = favorites
            .map((slug) => (data as Race[]).find((r) => r.slug === slug))
            .filter((r): r is Race => !!r);
          setRaces(ordered);
        }
        setLoading(false);
      });
  }, [favorites]);

  return (
    <div className="px-6 md:px-10 py-10 pb-24">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 bg-red-50 rounded-xl flex items-center justify-center">
              <Heart size={18} className="text-red-500 fill-red-500" />
            </div>
            <h1 className="text-3xl font-bold text-zinc-900">Mes courses</h1>
          </div>
          <p className="text-zinc-500">
            {favorites.length === 0
              ? 'Aucun favori enregistré pour le moment.'
              : `${favorites.length} course${favorites.length > 1 ? 's' : ''} sauvegardée${favorites.length > 1 ? 's' : ''}`}
          </p>
        </div>

        {/* Empty state */}
        {!loading && favorites.length === 0 && (
          <div className="text-center py-24">
            <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Heart size={28} className="text-red-300" />
            </div>
            <h2 className="text-xl font-bold text-zinc-900 mb-2">Pas encore de favoris</h2>
            <p className="text-zinc-500 text-sm mb-8 max-w-sm mx-auto">
              Clique sur le coeur d&apos;une course pour la sauvegarder ici. Tes favoris sont conservés localement dans ton navigateur.
            </p>
            <Link
              href="/courses"
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-red-600 to-rose-600 text-white font-bold rounded-xl hover:shadow-lg hover:shadow-red-500/20 transition-all"
            >
              Explorer les courses
              <ArrowRight size={16} />
            </Link>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array.from({ length: favorites.length || 4 }).map((_, i) => (
              <div key={i} className="animate-pulse bg-gray-50 rounded-3xl overflow-hidden border border-gray-200">
                <div className="h-36 bg-gray-100" />
                <div className="p-5 space-y-3">
                  <div className="h-3 w-24 bg-gray-200 rounded" />
                  <div className="h-5 w-3/4 bg-gray-200 rounded" />
                  <div className="h-3 w-32 bg-gray-200 rounded" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Races grid */}
        {!loading && races.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {races.map((race) => (
              <RaceCard key={race.id} race={race} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
