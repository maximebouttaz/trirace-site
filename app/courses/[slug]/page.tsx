import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
  Calendar, MapPin, Users, Mountain, Wind, Sun,
  Waves, Bike, Activity, Euro, Clock, ExternalLink,
  Trophy, ArrowRight, Zap, ChevronRight,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Race } from '@/lib/types';
import { formatDistance, formatDateLong, categoryColor, categoryLabel, tempLabel } from '@/lib/utils';
import CTABanner from '@/components/CTABanner';
import RelatedRaces from '@/components/RelatedRaces';

// --- SSG ---
export async function generateStaticParams() {
  const { data } = await supabase.from('races').select('slug');
  return (data || []).map((race) => ({ slug: race.slug }));
}

// --- ISR ---
export const revalidate = 86400; // 1 day

// --- SEO ---
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const { data: race } = await supabase
    .from('races')
    .select('name, city, country, category, swim_distance, bike_distance, run_distance, description, tagline')
    .eq('slug', slug)
    .single();

  if (!race) return { title: 'Course introuvable' };

  const distances = [
    race.swim_distance ? formatDistance(race.swim_distance) + ' natation' : '',
    race.bike_distance ? formatDistance(race.bike_distance) + ' vélo' : '',
    race.run_distance ? formatDistance(race.run_distance) + ' course' : '',
  ].filter(Boolean).join(', ');

  const year = race.name.match(/\d{4}/) ? '' : ' 2026';

  return {
    title: `${race.name}${year} — Triathlon ${categoryLabel(race.category)} à ${race.city}`,
    description: race.tagline || `${race.name} — ${distances}. ${race.city}, ${race.country}. Infos, météo, dénivelé et records.`,
    openGraph: {
      title: `${race.name} — ${categoryLabel(race.category)} | TriRace`,
      description: `Triathlon ${categoryLabel(race.category)} à ${race.city}. ${distances}.`,
      type: 'website',
    },
  };
}

// --- PAGE ---
export default async function RaceDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { data: race } = await supabase
    .from('races')
    .select('*')
    .eq('slug', slug)
    .single();

  if (!race) notFound();

  const { data: allRacesData } = await supabase
    .from('races')
    .select('id, slug, name, date, city, country, category, swim_distance, bike_distance, run_distance, total_elevation, price_euros, image_gradient, tags');

  const allRaces = (allRacesData || []) as Race[];

  const r = race as Race;
  const temp = tempLabel(r.avg_temp_celsius);
  const TRICOACH_URL = process.env.NEXT_PUBLIC_TRICOACH_URL || 'https://tricoach.app';

  // JSON-LD structured data
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://trirace.app';

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SportsEvent',
    name: r.name,
    startDate: r.date,
    eventStatus: 'https://schema.org/EventScheduled',
    location: {
      '@type': 'Place',
      name: r.location,
      address: {
        '@type': 'PostalAddress',
        addressLocality: r.city,
        addressCountry: r.country,
      },
      ...(r.latitude && r.longitude
        ? {
            geo: {
              '@type': 'GeoCoordinates',
              latitude: r.latitude,
              longitude: r.longitude,
            },
          }
        : {}),
    },
    description: r.description || r.tagline || `Triathlon ${categoryLabel(r.category)} à ${r.city}`,
    sport: 'Triathlon',
    ...(r.website_url ? { url: r.website_url } : {}),
    ...(r.max_participants
      ? { maximumAttendeeCapacity: r.max_participants }
      : {}),
    ...(r.price_euros
      ? { offers: { '@type': 'Offer', price: r.price_euros, priceCurrency: 'EUR' } }
      : {}),
  };

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Accueil', item: siteUrl },
      { '@type': 'ListItem', position: 2, name: 'Courses', item: `${siteUrl}/courses` },
      { '@type': 'ListItem', position: 3, name: r.name },
    ],
  };

  return (
    <div className="pb-24">
      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />

      {/* BREADCRUMB */}
      <div className="max-w-7xl mx-auto px-6 md:px-10 py-3">
        <nav aria-label="Fil d'ariane" className="flex items-center gap-1.5 text-xs text-zinc-500">
          <Link href="/" className="hover:text-zinc-700 transition">Accueil</Link>
          <ChevronRight size={12} aria-hidden="true" />
          <Link href="/courses" className="hover:text-zinc-700 transition">Courses</Link>
          <ChevronRight size={12} aria-hidden="true" />
          <span className="text-zinc-400 truncate max-w-xs">{r.name}</span>
        </nav>
      </div>

      {/* HERO */}
      <div className={`h-64 md:h-80 ${r.image_gradient || 'bg-gradient-to-br from-zinc-600 to-zinc-800'} relative`}>
        <div className="absolute inset-0 bg-black/30" />
        <div className="absolute bottom-0 w-full p-6 md:p-10 bg-gradient-to-t from-black/70 to-transparent">
          <div className="max-w-7xl mx-auto">
            <span className={`${categoryColor(r.category)} px-3 py-1 rounded text-xs font-bold uppercase tracking-wider mb-2 inline-block`}>
              {categoryLabel(r.category)}
            </span>
            <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight">
              {r.name}
            </h1>
            <div className="flex flex-wrap gap-4 md:gap-6 mt-4 text-white/90 text-sm font-bold">
              <span className="flex items-center gap-2"><Calendar size={16} /> {formatDateLong(r.date)}</span>
              <span className="flex items-center gap-2"><MapPin size={16} /> {r.location}</span>
              {r.max_participants && (
                <span className="flex items-center gap-2"><Users size={16} /> {r.max_participants.toLocaleString('fr-FR')} places</span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 md:px-10 -mt-6">

        {/* CTA TriCoach */}
        <div className="mb-8">
          <a
            href={`${TRICOACH_URL}/races/${r.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-red-600 to-rose-600 text-white font-bold rounded-2xl shadow-lg hover:shadow-xl hover:shadow-red-500/20 transition-all"
          >
            <Zap size={16} /> Préparer cette course avec TriCoach <ArrowRight size={16} />
          </a>
        </div>

        {/* Distances KPI */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {r.swim_distance && (
            <div className="bg-gray-50 p-5 rounded-2xl border border-gray-200 text-center">
              <Waves size={20} className="mx-auto text-cyan-500 mb-2" />
              <p className="text-2xl font-mono font-bold text-zinc-900">{formatDistance(r.swim_distance)}</p>
              <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest mt-1">Natation</p>
            </div>
          )}
          {r.bike_distance && (
            <div className="bg-gray-50 p-5 rounded-2xl border border-gray-200 text-center">
              <Bike size={20} className="mx-auto text-red-500 mb-2" />
              <p className="text-2xl font-mono font-bold text-zinc-900">{formatDistance(r.bike_distance)}</p>
              <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest mt-1">Vélo</p>
            </div>
          )}
          {r.run_distance && (
            <div className="bg-gray-50 p-5 rounded-2xl border border-gray-200 text-center">
              <Activity size={20} className="mx-auto text-amber-500 mb-2" />
              <p className="text-2xl font-mono font-bold text-zinc-900">{formatDistance(r.run_distance)}</p>
              <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest mt-1">Course</p>
            </div>
          )}
          {r.total_elevation != null && r.total_elevation > 0 && (
            <div className="bg-gray-50 p-5 rounded-2xl border border-gray-200 text-center">
              <Mountain size={20} className="mx-auto text-purple-500 mb-2" />
              <p className="text-2xl font-mono font-bold text-zinc-900">{r.total_elevation}m</p>
              <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest mt-1">Dénivelé D+</p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Main content */}
          <div className="md:col-span-2 space-y-6">

            {/* Bike profile */}
            {r.bike_elevation && r.bike_elevation > 0 && (
              <div className="bg-gray-50 p-6 rounded-3xl border border-gray-200">
                <h3 className="font-bold text-zinc-900 mb-4 flex items-center gap-2">
                  <Mountain size={18} /> Profil Vélo ({r.bike_elevation}m D+)
                </h3>
                <div className="h-40 w-full relative">
                  <svg viewBox="0 0 100 30" className="w-full h-full" preserveAspectRatio="none">
                    <path d="M0 25 L 10 25 L 30 5 L 50 15 L 70 2 L 90 25 L 100 25" fill="none" stroke="#dc2626" strokeWidth="2" />
                    <path d="M0 25 L 10 25 L 30 5 L 50 15 L 70 2 L 90 25 L 100 25 V 30 H 0 Z" fill="url(#red-grad)" className="opacity-20" />
                    <defs>
                      <linearGradient id="red-grad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#dc2626" stopOpacity="0.5" />
                        <stop offset="100%" stopColor="#dc2626" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <div className="flex justify-between text-xs text-zinc-500 font-mono mt-2">
                    <span>0km</span>
                    <span>{formatDistance(r.bike_distance)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Description */}
            {r.description && (
              <div className="bg-gray-50 p-6 rounded-3xl border border-gray-200">
                <h2 className="font-bold text-zinc-900 mb-3">Description</h2>
                {r.tagline && (
                  <p className="text-sm font-bold italic text-zinc-400 mb-3">&ldquo;{r.tagline}&rdquo;</p>
                )}
                <p className="text-zinc-400 leading-relaxed text-sm">{r.description}</p>
              </div>
            )}

            {/* Records */}
            {(r.record_men || r.record_women) && (
              <div className="bg-gray-50 p-6 rounded-3xl border border-gray-200">
                <h3 className="font-bold text-zinc-900 mb-4 flex items-center gap-2">
                  <Trophy size={18} className="text-amber-500" /> Records
                </h3>
                <div className="space-y-3">
                  {r.record_men && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-zinc-500 font-bold">Hommes</span>
                      <span className="text-sm font-mono font-bold text-zinc-900">{r.record_men}</span>
                    </div>
                  )}
                  {r.record_women && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-zinc-500 font-bold">Femmes</span>
                      <span className="text-sm font-mono font-bold text-zinc-900">{r.record_women}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Related Races */}
            <RelatedRaces currentRace={r} allRaces={allRaces} />

            {/* CTA Banner */}
            <CTABanner raceSlug={r.slug} raceName={r.name} />
          </div>

          {/* Sidebar */}
          <div className="space-y-6">

            {/* Weather */}
            {r.avg_temp_celsius && (
              <div className="bg-gray-50 p-6 rounded-3xl border border-gray-200">
                <h3 className="font-bold text-zinc-900 mb-4">Météo Moyenne</h3>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Sun className="text-amber-500" />
                    <span className="text-2xl font-mono font-bold text-zinc-900">{r.avg_temp_celsius}°C</span>
                  </div>
                  {temp.label && (
                    <span className={`text-xs font-bold px-2 py-1 rounded ${temp.color}`}>{temp.label}</span>
                  )}
                </div>
                <div className="flex items-center justify-between text-sm text-zinc-500 border-t border-gray-200 pt-4">
                  {r.avg_wind_kmh && (
                    <div className="flex items-center gap-1"><Wind size={14} /> {r.avg_wind_kmh} km/h</div>
                  )}
                  {r.avg_water_temp_celsius && (
                    <div className="flex items-center gap-1">Eau : {r.avg_water_temp_celsius}°C</div>
                  )}
                </div>
              </div>
            )}

            {/* Infos pratiques */}
            <div className="bg-gray-50 p-6 rounded-3xl border border-gray-200 space-y-4">
              <h3 className="font-bold text-zinc-900">Infos pratiques</h3>
              {r.price_euros && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-zinc-500"><Euro size={14} /> Inscription</div>
                  <span className="font-mono font-bold text-zinc-900">{r.price_euros}€</span>
                </div>
              )}
              {r.time_limit_hours && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-zinc-500"><Clock size={14} /> Barrière horaire</div>
                  <span className="font-mono font-bold text-zinc-900">{r.time_limit_hours}h</span>
                </div>
              )}
              {r.max_participants && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-zinc-500"><Users size={14} /> Places</div>
                  <span className="font-mono font-bold text-zinc-900">{r.max_participants.toLocaleString('fr-FR')}</span>
                </div>
              )}
            </div>

            {/* Tags */}
            {r.tags && r.tags.length > 0 && (
              <div className="bg-gray-50 p-6 rounded-3xl border border-gray-200">
                <h3 className="font-bold text-zinc-900 mb-3">Tags</h3>
                <div className="flex flex-wrap gap-2">
                  {r.tags.map((tag) => (
                    <span key={tag} className="text-xs font-bold text-zinc-500 bg-gray-100 px-3 py-1.5 rounded-full">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Links */}
            {(r.website_url || r.finishers_url) && (
              <div className="bg-gray-50 p-6 rounded-3xl border border-gray-200 space-y-3">
                <h3 className="font-bold text-zinc-900">Liens</h3>
                {r.website_url && (
                  <a href={r.website_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-red-400 hover:text-red-300 font-bold transition">
                    <ExternalLink size={14} /> Site officiel
                  </a>
                )}
                {r.finishers_url && (
                  <a href={r.finishers_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-red-400 hover:text-red-300 font-bold transition">
                    <ExternalLink size={14} /> Voir sur Finishers
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
