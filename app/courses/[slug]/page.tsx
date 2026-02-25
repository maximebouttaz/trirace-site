import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  Calendar, MapPin, Users, Wind, Sun,
  Waves, Bike, Activity, Euro, ExternalLink,
  ArrowRight, Zap, ChevronRight,
  Flag, Medal, Shield,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Race } from '@/lib/types';
import { formatDistance, formatDateLong, categoryLabel, tempLabel } from '@/lib/utils';
import { SITE_URL, TRICOACH_URL } from '@/lib/config';
import CTABanner from '@/components/CTABanner';
import RelatedRaces from '@/components/RelatedRaces';
import RaceGPXSection from '@/components/RaceGPXSection';
import FormatSelector from '@/components/FormatSelector';

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
    .select('name, city, country, category, swim_distance, bike_distance, run_distance, description, tagline, image_url')
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
      ...(race.image_url ? { images: [{ url: race.image_url }] } : {}),
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

  const r = race as Race;

  const RELATED_COLS = 'id, slug, name, date, city, country, category, swim_distance, bike_distance, run_distance, total_distance, total_elevation, price_euros, image_gradient, image_url, tags';

  // Priority 1: same category + same country (up to 3)
  const { data: sameCountryData } = await supabase
    .from('races')
    .select(RELATED_COLS)
    .eq('category', r.category)
    .eq('country', r.country)
    .neq('slug', slug)
    .limit(3);

  let relatedRaces = (sameCountryData || []) as Race[];

  // Priority 2: fill remaining slots with same category, other countries
  if (relatedRaces.length < 3) {
    const needed = 3 - relatedRaces.length;
    const existingIds = relatedRaces.map((rc) => rc.id);
    const { data: otherCountryData } = await supabase
      .from('races')
      .select(RELATED_COLS)
      .eq('category', r.category)
      .neq('slug', slug)
      .neq('country', r.country)
      .limit(needed + existingIds.length);

    const otherCountry = ((otherCountryData || []) as Race[]).filter(
      (rc) => !existingIds.includes(rc.id)
    ).slice(0, needed);
    relatedRaces = [...relatedRaces, ...otherCountry];
  }
  const temp = tempLabel(r.avg_temp_celsius);

  // JSON-LD structured data
  const now = new Date();
  const eventDate = r.date ? new Date(r.date) : null;
  const eventStatus = eventDate && eventDate > now ? 'https://schema.org/EventScheduled' : 'https://schema.org/EventEnded';

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SportsEvent',
    name: r.name,
    startDate: r.date,
    eventStatus,
    inLanguage: 'fr',
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
    ...(r.image_url ? { image: r.image_url } : {}),
    ...(r.website_url ? { url: r.website_url, sameAs: r.website_url } : {}),
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
      { '@type': 'ListItem', position: 1, name: 'Accueil', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Courses', item: `${SITE_URL}/courses` },
      { '@type': 'ListItem', position: 3, name: r.name, item: `${SITE_URL}/courses/${r.slug}` },
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

      {/* HERO — Immersive full-screen */}
      <div className={`h-[70vh] min-h-[500px] ${!r.image_url ? (r.image_gradient || 'bg-gradient-to-br from-zinc-600 to-zinc-800') : ''} relative`}>
        {r.image_url && (
          <Image
            src={r.image_url}
            alt={r.name}
            fill
            priority
            className="object-cover"
            sizes="100vw"
          />
        )}
        {/* Dramatic scrim */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/20" aria-hidden="true" />

        {/* Breadcrumb inside hero */}
        <div className="absolute top-0 w-full px-6 md:px-10 pt-4">
          <div className="max-w-7xl mx-auto">
            <nav aria-label="Fil d'ariane" className="flex items-center gap-1.5 text-xs text-white/60">
              <Link href="/" className="hover:text-white/90 transition">Accueil</Link>
              <ChevronRight size={12} aria-hidden="true" />
              <Link href="/courses" className="hover:text-white/90 transition">Courses</Link>
              <ChevronRight size={12} aria-hidden="true" />
              <span className="text-white/40 truncate max-w-xs">{r.name}</span>
            </nav>
          </div>
        </div>

        <div className="absolute bottom-0 w-full px-6 md:px-10 pb-20 pt-16">
          <div className="max-w-7xl mx-auto">
            {/* Badges — frosted glass */}
            <div className="flex flex-wrap items-center gap-2 mb-4">
              {r.formats && r.formats.length > 0 ? (
                r.formats
                  .filter((fmt) => !fmt.is_relay)
                  .reduce<Array<{ category: string; name: string }>>((acc, fmt) => {
                    if (!acc.some((a) => a.category === fmt.category)) acc.push(fmt);
                    return acc;
                  }, [])
                  .map((fmt) => (
                    <span
                      key={fmt.category}
                      className="bg-white/15 backdrop-blur-sm text-white border border-white/20 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider inline-block"
                    >
                      {categoryLabel(fmt.category)}
                    </span>
                  ))
              ) : (
                <span className="bg-white/15 backdrop-blur-sm text-white border border-white/20 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider inline-block">
                  {categoryLabel(r.category)}
                </span>
              )}
              {r.label && (
                <span className="bg-white/15 backdrop-blur-sm text-white border border-white/20 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider inline-block">
                  {r.label}
                </span>
              )}
              {(r.is_sold_out || r.registration_status === 'sold_out') && (
                <span className="bg-red-500/90 backdrop-blur-sm text-white border border-red-400/30 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider inline-block">
                  Sold Out
                </span>
              )}
              {r.registration_status === 'closed' && !r.is_sold_out && (
                <span className="bg-zinc-600/90 backdrop-blur-sm text-white border border-zinc-500/30 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider inline-block">
                  Inscriptions fermees
                </span>
              )}
            </div>

            <h1 className="text-4xl md:text-6xl font-black text-white tracking-tight drop-shadow-sm">
              {r.name}
            </h1>

            {/* Tagline */}
            {r.tagline && (
              <p className="text-white/60 text-lg italic max-w-2xl mt-3">{r.tagline}</p>
            )}

            {/* Meta row */}
            <div className="flex flex-wrap items-center gap-2 md:gap-4 mt-5 text-white/60 text-sm">
              <span className="flex items-center gap-1.5">
                <Calendar size={14} aria-hidden="true" />
                {formatDateLong(r.date)}
              </span>
              <span aria-hidden="true">·</span>
              <span className="flex items-center gap-1.5">
                <MapPin size={14} aria-hidden="true" />
                {r.location}
              </span>
              {r.max_participants && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="flex items-center gap-1.5">
                    <Users size={14} aria-hidden="true" />
                    {r.max_participants.toLocaleString('fr-FR')} places
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* KPI Distances — overlapping hero */}
      <div className="max-w-7xl mx-auto px-6 md:px-10 -mt-16 relative z-10">
        <FormatSelector
          formats={r.formats}
          swimDistance={r.swim_distance}
          bikeDistance={r.bike_distance}
          runDistance={r.run_distance}
          totalElevation={r.total_elevation}
          priceEuros={r.price_euros}
        />
      </div>

      <div className="max-w-7xl mx-auto px-6 md:px-10 mt-10">

        {/* CTA TriCoach — sober dark */}
        <div className="mb-8">
          <a
            href={`${TRICOACH_URL}/races/${r.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center justify-between gap-4 px-6 py-4 bg-zinc-900 text-white font-bold rounded-2xl hover:bg-zinc-800 transition-colors duration-200"
          >
            <div className="flex items-center gap-3">
              <Zap size={18} className="shrink-0" aria-hidden="true" />
              <div>
                <p className="text-sm font-black leading-none mb-0.5">Préparer cette course avec TriCoach</p>
                <p className="text-xs text-white/50 font-medium">Plan d&apos;entraînement personnalisé, coaching IA</p>
              </div>
            </div>
            <span className="shrink-0 bg-white text-zinc-900 rounded-full w-8 h-8 flex items-center justify-center group-hover:scale-105 transition-transform duration-200">
              <ArrowRight size={16} aria-hidden="true" />
            </span>
          </a>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Main content — open sections separated by lines */}
          <div className="md:col-span-2">

            {/* Parcours — GPX map + discipline details */}
            <section className="first:border-t-0 first:pt-0 first:mt-0">
              <h3 className="text-xs uppercase tracking-widest text-zinc-400 font-bold mb-4">Parcours</h3>

              {/* GPX Track + Elevation Profile */}
              {r.track_geojson && (
                <div className="mb-6">
                  <RaceGPXSection
                    trackGeoJSON={r.track_geojson}
                    elevationProfile={r.elevation_profile}
                  />
                </div>
              )}

              {/* Bike profile fallback (SVG) — only if no GPX track */}
              {!r.track_geojson && r.bike_elevation && r.bike_elevation > 0 && (
                <div className="mb-6">
                  <p className="text-xs text-zinc-400 font-bold mb-2">Profil Velo ({r.bike_elevation}m D+)</p>
                  <div className="h-40 w-full relative">
                    <svg viewBox="0 0 100 30" className="w-full h-full" preserveAspectRatio="none">
                      <path d="M0 25 L 10 25 L 30 5 L 50 15 L 70 2 L 90 25 L 100 25" fill="none" stroke="#a1a1aa" strokeWidth="2" />
                      <path d="M0 25 L 10 25 L 30 5 L 50 15 L 70 2 L 90 25 L 100 25 V 30 H 0 Z" fill="url(#zinc-grad)" className="opacity-20" />
                      <defs>
                        <linearGradient id="zinc-grad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#a1a1aa" stopOpacity="0.5" />
                          <stop offset="100%" stopColor="#a1a1aa" stopOpacity="0" />
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

              {/* GPX download links */}
              {(r.swim_gpx_url || r.bike_gpx_url || r.run_gpx_url) && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {r.swim_gpx_url && (
                    <a href={r.swim_gpx_url} download className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 text-xs font-bold hover:bg-blue-100 transition-colors">
                      <Waves size={12} /> GPX Natation
                    </a>
                  )}
                  {r.bike_gpx_url && (
                    <a href={r.bike_gpx_url} download className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-50 text-orange-700 text-xs font-bold hover:bg-orange-100 transition-colors">
                      <Bike size={12} /> GPX Velo
                    </a>
                  )}
                  {r.run_gpx_url && (
                    <a href={r.run_gpx_url} download className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-50 text-green-700 text-xs font-bold hover:bg-green-100 transition-colors">
                      <Activity size={12} /> GPX Course
                    </a>
                  )}
                </div>
              )}

              {/* Discipline cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Natation */}
                <div className="bg-gray-50 rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Waves size={16} className="text-zinc-400" aria-hidden="true" />
                    <span className="text-xs font-bold uppercase tracking-widest text-zinc-400">Natation</span>
                  </div>
                  <div className="space-y-2">
                    {r.swim_type && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-zinc-500">Type</span>
                        <span className="text-sm font-bold text-zinc-900 capitalize">{r.swim_type}</span>
                      </div>
                    )}
                    {r.is_wetsuit_allowed != null && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-zinc-500">Combinaison</span>
                        <span className="text-sm font-bold text-zinc-900">{r.is_wetsuit_allowed ? 'Autorisee' : 'Non autorisee'}</span>
                      </div>
                    )}
                    {r.swim_cutoff_minutes ? (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-zinc-500">Barriere</span>
                        <span className="text-sm font-mono font-bold text-zinc-900">{Math.floor(r.swim_cutoff_minutes / 60)}h{r.swim_cutoff_minutes % 60 > 0 ? String(r.swim_cutoff_minutes % 60).padStart(2, '0') : ''}</span>
                      </div>
                    ) : r.time_limit_hours ? (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-zinc-500">Barriere totale</span>
                        <span className="text-sm font-mono font-bold text-zinc-900">{r.time_limit_hours}h</span>
                      </div>
                    ) : null}
                    {!r.swim_type && r.is_wetsuit_allowed == null && !r.swim_cutoff_minutes && !r.time_limit_hours && (
                      <p className="text-sm text-zinc-400 italic">Non renseigne</p>
                    )}
                  </div>
                </div>

                {/* Velo */}
                <div className="bg-gray-50 rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Bike size={16} className="text-zinc-400" aria-hidden="true" />
                    <span className="text-xs font-bold uppercase tracking-widest text-zinc-400">Velo</span>
                  </div>
                  <div className="space-y-2">
                    {r.bike_type && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-zinc-500">Type</span>
                        <span className="text-sm font-bold text-zinc-900 capitalize">{r.bike_type}</span>
                      </div>
                    )}
                    {r.bike_cutoff_minutes ? (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-zinc-500">Barriere</span>
                        <span className="text-sm font-mono font-bold text-zinc-900">{Math.floor(r.bike_cutoff_minutes / 60)}h{r.bike_cutoff_minutes % 60 > 0 ? String(r.bike_cutoff_minutes % 60).padStart(2, '0') : ''}</span>
                      </div>
                    ) : r.time_limit_hours ? (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-zinc-500">Barriere totale</span>
                        <span className="text-sm font-mono font-bold text-zinc-900">{r.time_limit_hours}h</span>
                      </div>
                    ) : null}
                    {!r.bike_type && !r.bike_cutoff_minutes && !r.time_limit_hours && (
                      <p className="text-sm text-zinc-400 italic">Non renseigne</p>
                    )}
                  </div>
                </div>

                {/* Course a pied */}
                <div className="bg-gray-50 rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Activity size={16} className="text-zinc-400" aria-hidden="true" />
                    <span className="text-xs font-bold uppercase tracking-widest text-zinc-400">Course</span>
                  </div>
                  <div className="space-y-2">
                    {r.run_cutoff_minutes ? (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-zinc-500">Barriere</span>
                        <span className="text-sm font-mono font-bold text-zinc-900">{Math.floor(r.run_cutoff_minutes / 60)}h{r.run_cutoff_minutes % 60 > 0 ? String(r.run_cutoff_minutes % 60).padStart(2, '0') : ''}</span>
                      </div>
                    ) : r.time_limit_hours ? (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-zinc-500">Barriere totale</span>
                        <span className="text-sm font-mono font-bold text-zinc-900">{r.time_limit_hours}h</span>
                      </div>
                    ) : (
                      <p className="text-sm text-zinc-400 italic">Non renseigne</p>
                    )}
                  </div>
                </div>
              </div>
            </section>

            {/* Description */}
            {r.description && (
              <article className="border-t border-gray-200 pt-8 mt-8 first:border-t-0 first:pt-0 first:mt-0">
                <h2 className="text-xs uppercase tracking-widest text-zinc-400 font-bold mb-4">Description</h2>
                {r.tagline && (
                  <p className="text-sm font-semibold italic text-zinc-500 border-l-2 border-zinc-300 pl-3 mb-4 leading-relaxed">&ldquo;{r.tagline}&rdquo;</p>
                )}
                <p className="text-zinc-600 leading-relaxed text-sm">{r.description}</p>
              </article>
            )}

            {/* Records */}
            {(r.record_men || r.record_women) && (
              <section className="border-t border-gray-200 pt-8 mt-8">
                <h3 className="text-xs uppercase tracking-widest text-zinc-400 font-bold mb-4">Records du parcours</h3>
                <div>
                  {r.record_men && (
                    <div className="flex items-center justify-between border-b border-gray-100 py-3">
                      <span className="text-sm text-zinc-500">Hommes</span>
                      <span className="text-sm font-mono font-black text-zinc-900">{r.record_men}</span>
                    </div>
                  )}
                  {r.record_women && (
                    <div className="flex items-center justify-between border-b border-gray-100 py-3">
                      <span className="text-sm text-zinc-500">Femmes</span>
                      <span className="text-sm font-mono font-black text-zinc-900">{r.record_women}</span>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* Qualification */}
            {r.qualification_for && (
              <section className="border-t border-gray-200 pt-8 mt-8">
                <h3 className="text-xs uppercase tracking-widest text-zinc-400 font-bold mb-4">Qualification</h3>
                <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-100 text-zinc-700 font-bold text-sm">
                  <Medal size={15} className="text-zinc-400 shrink-0" />
                  Cette course qualifie pour : {r.qualification_for}
                </span>
              </section>
            )}

            {/* Related Races */}
            <RelatedRaces relatedRaces={relatedRaces} />

            {/* CTA Banner */}
            <CTABanner raceSlug={r.slug} raceName={r.name} />
          </div>

          {/* Sidebar — unified style */}
          <div className="space-y-6">

            {/* Weather */}
            {r.avg_temp_celsius && (
              <section className="bg-gray-50/50 rounded-2xl p-5">
                <h3 className="text-[11px] uppercase tracking-widest text-zinc-400 font-bold mb-4">Météo Moyenne</h3>
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-2.5">
                    <Sun size={20} className="text-zinc-400" aria-hidden="true" />
                    <span className="text-3xl font-mono font-black text-zinc-900">{r.avg_temp_celsius}°C</span>
                  </div>
                  {temp.label && (
                    <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-zinc-100 text-zinc-600">{temp.label}</span>
                  )}
                </div>
                {(r.avg_wind_kmh || r.avg_water_temp_celsius) && (
                  <div className="grid grid-cols-2 gap-3 border-t border-gray-200 pt-4">
                    {r.avg_wind_kmh && (
                      <div className="flex flex-col items-center py-2.5">
                        <Wind size={14} className="text-zinc-400 mb-1" aria-hidden="true" />
                        <span className="text-sm font-mono font-bold text-zinc-700">{r.avg_wind_kmh} km/h</span>
                        <span className="text-[10px] text-zinc-400 uppercase tracking-wider">Vent</span>
                      </div>
                    )}
                    {r.avg_water_temp_celsius && (
                      <div className="flex flex-col items-center py-2.5">
                        <Waves size={14} className="text-zinc-400 mb-1" aria-hidden="true" />
                        <span className="text-sm font-mono font-bold text-zinc-700">{r.avg_water_temp_celsius}°C</span>
                        <span className="text-[10px] text-zinc-400 uppercase tracking-wider">Eau</span>
                      </div>
                    )}
                  </div>
                )}
              </section>
            )}

            {/* Infos pratiques */}
            <div className="bg-gray-50/50 rounded-2xl p-5">
              <h3 className="text-[11px] uppercase tracking-widest text-zinc-400 font-bold mb-4">Infos pratiques</h3>

              {r.max_participants && (
                <div className="flex items-center justify-between border-b border-gray-100 py-3">
                  <div className="flex items-center gap-2 text-sm text-zinc-500"><Users size={14} /> Places</div>
                  <span className="font-mono font-bold text-zinc-900">{r.max_participants.toLocaleString('fr-FR')}</span>
                </div>
              )}
              {r.is_draft_legal != null && (
                <div className="flex items-center justify-between border-b border-gray-100 py-3">
                  <div className="flex items-center gap-2 text-sm text-zinc-500"><Flag size={14} /> Drafting</div>
                  <span className="text-sm font-bold text-zinc-900">{r.is_draft_legal ? 'Autorisé' : 'Interdit'}</span>
                </div>
              )}
              {r.registration_deadline && (
                <div className="flex items-center justify-between border-b border-gray-100 py-3">
                  <div className="flex items-center gap-2 text-sm text-zinc-500"><Calendar size={14} /> Inscriptions jusqu&apos;au</div>
                  <span className="font-bold text-zinc-900 text-sm">{new Date(r.registration_deadline).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                </div>
              )}
              {r.finishers_count && (
                <div className="flex items-center justify-between border-b border-gray-100 py-3">
                  <div className="flex items-center gap-2 text-sm text-zinc-500"><Users size={14} /> Finishers</div>
                  <span className="font-mono font-bold text-zinc-900">{r.finishers_count.toLocaleString('fr-FR')} <span className="text-xs font-normal text-zinc-500">(dernière éd.)</span></span>
                </div>
              )}
              {r.organizer_name && (
                <div className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-2 text-sm text-zinc-500"><Shield size={14} /> Organisateur</div>
                  <span className="font-bold text-zinc-900 text-sm text-right max-w-[55%]">{r.organizer_name}</span>
                </div>
              )}

              {/* Débutant Friendly badge */}
              {r.time_limit_hours != null &&
                r.time_limit_hours >= 10 &&
                (r.total_elevation == null || r.total_elevation <= 500) &&
                ['S', 'XS', 'M'].includes(r.category) && (
                <div className="pt-3 border-t border-gray-200">
                  <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-100 text-zinc-600 text-xs font-bold">
                    <Medal size={13} className="text-zinc-400" /> Débutant Friendly
                  </span>
                </div>
              )}
            </div>

            {/* Tags */}
            {r.tags && r.tags.length > 0 && (
              <div className="bg-gray-50/50 rounded-2xl p-5">
                <h3 className="text-[11px] uppercase tracking-widest text-zinc-400 font-bold mb-3">Tags</h3>
                <div className="flex flex-wrap gap-2">
                  {r.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-xs font-bold text-zinc-500 bg-white px-3 py-1.5 rounded-full"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Links */}
            {(r.website_url || r.finishers_url) && (
              <div className="bg-gray-50/50 rounded-2xl p-5 space-y-2">
                <h3 className="text-[11px] uppercase tracking-widest text-zinc-400 font-bold mb-3">Liens</h3>
                {r.website_url && (
                  <a
                    href={r.website_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between gap-2 px-4 py-3 bg-white rounded-xl text-sm font-bold text-zinc-500 hover:text-zinc-900 transition-colors duration-200"
                  >
                    <span className="flex items-center gap-2">
                      <ExternalLink size={14} aria-hidden="true" /> Site officiel
                    </span>
                    <ArrowRight size={14} className="text-zinc-300" aria-hidden="true" />
                  </a>
                )}
                {r.finishers_url && (
                  <a
                    href={r.finishers_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between gap-2 px-4 py-3 bg-white rounded-xl text-sm font-bold text-zinc-500 hover:text-zinc-900 transition-colors duration-200"
                  >
                    <span className="flex items-center gap-2">
                      <ExternalLink size={14} aria-hidden="true" /> Voir sur Finishers
                    </span>
                    <ArrowRight size={14} className="text-zinc-300" aria-hidden="true" />
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
