import type { Metadata } from 'next';
import Link from 'next/link';
import { Search, ArrowRight, Waves, Bike, Activity, Trophy, Globe } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Race } from '@/lib/types';
import RaceCard from '@/components/RaceCard';
import CTABanner from '@/components/CTABanner';
import NextRaceWidget from '@/components/NextRaceWidget';

// ISR: revalidate every day
export const revalidate = 86400;

export const metadata: Metadata = {
  title: 'TriRace — Trouvez votre prochaine course triathlon',
  description:
    'Découvrez 700+ courses triathlon en France et en Europe. Comparez les distances, dénivelés, météo et records pour choisir votre prochaine épreuve : Sprint, Olympique, Half, Ironman.',
  openGraph: {
    title: 'TriRace — Trouvez votre prochaine course triathlon',
    description:
      'Découvrez 700+ courses triathlon en France et en Europe. Toutes les infos pour choisir votre épreuve.',
    url: 'https://trirace.app',
    siteName: 'TriRace',
    type: 'website',
  },
};

// Category stats for the homepage
const CATEGORY_SECTIONS: {
  key: string;
  label: string;
  desc: string;
  gradient: string;
  categories: string[];
}[] = [
  // Temporary: only Half and Full Ironman visible
  { key: 'l', label: 'L', desc: '3km nata, 80km vélo, 20km course', gradient: 'from-indigo-600 to-blue-500', categories: ['L'] },
  { key: 'half', label: '70.3', desc: '1.9km nata, 90km vélo, 21.1km course', gradient: 'from-blue-600 to-cyan-500', categories: ['70.3'] },
  { key: 'xl', label: 'XL', desc: '4km nata, 120km vélo, 30km course', gradient: 'from-purple-600 to-indigo-500', categories: ['XL'] },
  { key: 'ironman', label: 'Ironman / XXL', desc: '3.8km nata, 180km vélo, 42.2km marathon', gradient: 'from-red-600 to-orange-500', categories: ['Ironman'] },
];

export default async function HomePage() {
  const today = new Date().toISOString().slice(0, 10);

  // Fetch popular races (with most data) and category counts
  const [{ data: allRaces }, { data: nextRaceData }] = await Promise.all([
    supabase.from('races').select('*').order('date', { ascending: true }),
    supabase
      .from('races')
      .select('id, slug, name, date, city, country, category, swim_distance, bike_distance, run_distance, total_distance, image_gradient')
      .gte('date', today)
      .order('date', { ascending: true })
      .limit(1),
  ]);

  const races = (allRaces || []) as Race[];
  const nextRace = nextRaceData && nextRaceData.length > 0 ? (nextRaceData[0] as Race) : null;

  // Pick 6 "popular" races: prefer those with description, records, and weather data
  const popular = [...races]
    .filter(r => r.description && r.avg_temp_celsius && r.date)
    .sort((a, b) => {
      const scoreA = (a.record_men ? 1 : 0) + (a.record_women ? 1 : 0) + (a.max_participants ? 1 : 0) + (a.total_elevation ? 1 : 0);
      const scoreB = (b.record_men ? 1 : 0) + (b.record_women ? 1 : 0) + (b.max_participants ? 1 : 0) + (b.total_elevation ? 1 : 0);
      return scoreB - scoreA;
    })
    .slice(0, 6);

  // Category counts
  const categoryCounts: Record<string, number> = {};
  for (const r of races) {
    categoryCounts[r.category] = (categoryCounts[r.category] || 0) + 1;
  }

  return (
    <div>
      {/* HERO */}
      <section className="relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 bg-gradient-to-br from-red-50 via-white to-orange-50/30" />
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-to-bl from-red-500/8 to-transparent rounded-full -translate-y-1/2 translate-x-1/4 pointer-events-none" aria-hidden="true" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-gradient-to-tr from-orange-500/6 to-transparent rounded-full pointer-events-none" aria-hidden="true" />

        <div className="relative max-w-7xl mx-auto px-6 md:px-10 py-20 md:py-32">
          <div className="max-w-3xl">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 mb-7 px-3.5 py-1.5 bg-red-50 border border-red-200/70 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" aria-hidden="true" />
              <span className="text-xs font-bold text-red-600 uppercase tracking-wider">700+ courses référencées</span>
            </div>

            <h1 className="text-4xl md:text-6xl font-black text-zinc-900 tracking-tight leading-[1.08] mb-6">
              Trouve ta prochaine{' '}
              <span className="bg-gradient-to-r from-red-500 to-orange-500 bg-clip-text text-transparent">
                course triathlon
              </span>
            </h1>

            <p className="text-lg text-zinc-500 mb-10 max-w-xl leading-relaxed">
              Explore {races.length}+ courses en France et en Europe. Distances, dénivelé, météo, records — toutes les infos pour choisir ta course.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <Link
                href="/courses"
                className="group inline-flex items-center gap-3 px-6 py-3.5 bg-gradient-to-r from-red-600 to-orange-500 text-white font-bold rounded-2xl hover:shadow-lg hover:shadow-red-500/25 hover:scale-[1.02] transition-all duration-300"
              >
                <Search size={18} aria-hidden="true" />
                Chercher une course
                <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform duration-200" aria-hidden="true" />
              </Link>
              <Link
                href="/carte"
                className="inline-flex items-center gap-2.5 px-6 py-3.5 bg-white border border-gray-200 text-zinc-700 font-semibold rounded-2xl hover:border-gray-300 hover:bg-gray-50 hover:shadow-sm transition-all duration-200"
              >
                Voir la carte
              </Link>
            </div>
          </div>

          {/* Stats */}
          <div className="flex flex-wrap items-center gap-6 md:gap-10 mt-14">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-50 border border-red-200/60 rounded-xl flex items-center justify-center shrink-0">
                <Trophy size={18} className="text-red-500" aria-hidden="true" />
              </div>
              <div>
                <p className="text-2xl font-mono font-black text-zinc-900 leading-none">{races.length}+</p>
                <p className="text-xs text-zinc-400 font-semibold uppercase tracking-wider mt-0.5">Courses</p>
              </div>
            </div>
            <div className="w-px h-8 bg-gray-200 hidden sm:block" aria-hidden="true" />
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-50 border border-orange-200/60 rounded-xl flex items-center justify-center shrink-0">
                <Globe size={18} className="text-orange-500" aria-hidden="true" />
              </div>
              <div>
                <p className="text-2xl font-mono font-black text-zinc-900 leading-none">
                  {new Set(races.map(r => r.country)).size}
                </p>
                <p className="text-xs text-zinc-400 font-semibold uppercase tracking-wider mt-0.5">Pays</p>
              </div>
            </div>
            <div className="w-px h-8 bg-gray-200 hidden sm:block" aria-hidden="true" />
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-50 border border-amber-200/60 rounded-xl flex items-center justify-center shrink-0">
                <Activity size={18} className="text-amber-500" aria-hidden="true" />
              </div>
              <div>
                <p className="text-2xl font-mono font-black text-zinc-900 leading-none">
                  {new Set(races.map(r => r.category)).size}
                </p>
                <p className="text-xs text-zinc-400 font-semibold uppercase tracking-wider mt-0.5">Formats</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* NEXT RACE WIDGET */}
      {nextRace && <NextRaceWidget race={nextRace} />}

      {/* POPULAR RACES */}
      <section className="max-w-7xl mx-auto px-6 md:px-10 py-16">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-zinc-900 mb-1">Courses populaires</h2>
            <p className="text-sm text-zinc-500">Les incontournables du calendrier triathlon</p>
          </div>
          <Link
            href="/courses"
            className="flex items-center gap-2 text-sm font-bold text-red-500 hover:text-red-400 transition"
          >
            Voir toutes <ArrowRight size={14} />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {popular.map((race) => (
            <RaceCard key={race.id} race={race} />
          ))}
        </div>
      </section>

      {/* CATEGORIES */}
      <section className="max-w-7xl mx-auto px-6 md:px-10 py-16">
        <div className="flex items-end justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-zinc-900 mb-1">Par catégorie</h2>
            <p className="text-sm text-zinc-500">Du sprint à l&apos;Ironman, trouve le format qui te correspond</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {CATEGORY_SECTIONS.map((section) => {
            const count = section.categories.reduce((sum, cat) => sum + (categoryCounts[cat] || 0), 0);

            return (
              <Link
                key={section.key}
                href={`/courses?category=${section.key}`}
                className="group relative overflow-hidden rounded-2xl border border-gray-200 hover:border-gray-300 hover:shadow-lg hover:shadow-black/5 hover:-translate-y-0.5 transition-all duration-300 bg-white"
              >
                {/* Gradient strip on the left */}
                <div className={`absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b ${section.gradient} rounded-l-2xl`} aria-hidden="true" />
                {/* Subtle background tint on hover */}
                <div className={`absolute inset-0 bg-gradient-to-br ${section.gradient} opacity-0 group-hover:opacity-[0.04] transition-opacity duration-300`} aria-hidden="true" />

                <div className="relative pl-7 pr-6 py-5 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <h3 className="text-base font-bold text-zinc-900 mb-0.5 group-hover:text-zinc-700 transition-colors">{section.label}</h3>
                    <p className="text-sm text-zinc-500 leading-snug">{section.desc}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-3xl font-mono font-black text-zinc-900 leading-none">{count}</p>
                    <p className="text-xs text-zinc-400 font-semibold mt-0.5">courses</p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* SPORTS BREAKDOWN */}
      <section className="max-w-7xl mx-auto px-6 md:px-10 py-16">
        <div className="relative overflow-hidden bg-zinc-900 rounded-3xl p-8 md:p-12">
          {/* Background decoration */}
          <div className="absolute top-0 right-0 w-72 h-72 bg-gradient-to-bl from-red-500/10 to-transparent rounded-full -translate-y-1/3 translate-x-1/4 pointer-events-none" aria-hidden="true" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-orange-500/8 to-transparent rounded-full pointer-events-none" aria-hidden="true" />

          <div className="relative">
            <h2 className="text-2xl font-bold text-white mb-1 text-center">3 disciplines, 1 passion</h2>
            <p className="text-sm text-zinc-400 text-center mb-10">Chaque course combine natation, vélo et course à pied</p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center group">
                <div className="w-16 h-16 bg-cyan-500/15 border border-cyan-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:bg-cyan-500/25 group-hover:border-cyan-500/40 transition-all duration-300">
                  <Waves size={28} className="text-cyan-400" aria-hidden="true" />
                </div>
                <h3 className="font-bold text-white mb-1.5">Natation</h3>
                <p className="text-sm text-zinc-400 leading-relaxed">De 400m (Sprint) à 3.8km (Ironman) en eau libre</p>
              </div>
              <div className="text-center group">
                <div className="w-16 h-16 bg-red-500/15 border border-red-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:bg-red-500/25 group-hover:border-red-500/40 transition-all duration-300">
                  <Bike size={28} className="text-red-400" aria-hidden="true" />
                </div>
                <h3 className="font-bold text-white mb-1.5">Vélo</h3>
                <p className="text-sm text-zinc-400 leading-relaxed">De 20km (Sprint) à 180km (Ironman) sur route</p>
              </div>
              <div className="text-center group">
                <div className="w-16 h-16 bg-amber-500/15 border border-amber-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:bg-amber-500/25 group-hover:border-amber-500/40 transition-all duration-300">
                  <Activity size={28} className="text-amber-400" aria-hidden="true" />
                </div>
                <h3 className="font-bold text-white mb-1.5">Course à pied</h3>
                <p className="text-sm text-zinc-400 leading-relaxed">De 5km (Sprint) à 42.2km (Ironman) en marathon</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-7xl mx-auto px-6 md:px-10 py-16">
        <CTABanner />
      </section>

      {/* Organizer CTA */}
      <section className="max-w-7xl mx-auto px-6 md:px-10 pb-20">
        <div className="bg-gray-50 border border-gray-200 rounded-3xl px-8 py-12 flex flex-col md:flex-row items-center justify-between gap-8">
          <div>
            <p className="text-xs font-bold text-red-500 uppercase tracking-widest mb-2">Vous organisez des courses ?</p>
            <h2 className="text-2xl md:text-3xl font-bold text-zinc-900 mb-3">
              Référencez vos épreuves gratuitement
            </h2>
            <p className="text-zinc-500 max-w-lg">
              Créez votre espace organisateur et publiez vos courses directement sur TriRace — visibilité immédiate auprès de milliers de triathlètes.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 shrink-0">
            <a
              href="/signup"
              className="flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-red-600 to-orange-500 text-white font-bold rounded-xl hover:shadow-lg hover:shadow-red-500/20 transition-all whitespace-nowrap"
            >
              Créer un compte organisateur
            </a>
            <a
              href="/login"
              className="flex items-center justify-center px-6 py-3 bg-gray-100 hover:bg-gray-200 text-zinc-900 font-semibold rounded-xl transition whitespace-nowrap"
            >
              Se connecter
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
