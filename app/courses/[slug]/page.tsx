import { cache } from 'react';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  Calendar, Users, Wind, Sun,
  Waves, ExternalLink,
  ArrowRight, Zap, ChevronRight,
  Flag, Medal, Shield, Lock,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Race } from '@/lib/types';
import { formatDistance, formatDate, categoryLabel, tempLabel } from '@/lib/utils';
import { SITE_URL, TRICOACH_URL } from '@/lib/config';
import CTABanner from '@/components/CTABanner';
import RelatedRaces from '@/components/RelatedRaces';
import RaceDetailBody from '@/components/RaceDetailBody';
import TerrainIcons from '@/components/TerrainIcons';

/* ——— Country → flag SVG file code (ISO 3166-1 alpha-2) ——— */
const COUNTRY_CODES: Record<string, string> = {
  'France': 'fr',
  'Spain': 'es', 'Espagne': 'es',
  'Italy': 'it', 'Italie': 'it',
  'Germany': 'de', 'Allemagne': 'de',
  'Switzerland': 'ch', 'Suisse': 'ch',
  'Belgium': 'be', 'Belgique': 'be',
  'United Kingdom': 'gb', 'Royaume-Uni': 'gb',
  'Portugal': 'pt',
  'Austria': 'at', 'Autriche': 'at',
  'Netherlands': 'nl', 'Pays-Bas': 'nl',
  'Denmark': 'dk', 'Danemark': 'dk',
  'Sweden': 'se', 'Suède': 'se',
  'Norway': 'no', 'Norvège': 'no',
  'Finland': 'fi', 'Finlande': 'fi',
  'Greece': 'gr', 'Grèce': 'gr',
  'Croatia': 'hr', 'Croatie': 'hr',
  'Slovenia': 'si', 'Slovénie': 'si',
  'Poland': 'pl', 'Pologne': 'pl',
  'Czech Republic': 'cz', 'Tchéquie': 'cz',
  'Hungary': 'hu', 'Hongrie': 'hu',
  'Ireland': 'ie', 'Irlande': 'ie',
  'Luxembourg': 'lu',
  'Monaco': 'mc',
  'USA': 'us', 'États-Unis': 'us',
  'New Zealand': 'nz', 'Nouvelle-Zélande': 'nz',
  'South Africa': 'za', 'Afrique du Sud': 'za',
};

function countryFlagSrc(country: string | null): string | null {
  if (!country) return null;
  const code = COUNTRY_CODES[country];
  return code ? `/Icon/Flags/${code}.svg` : null;
}

const fetchRace = cache(async (slug: string) => {
  const { data } = await supabase
    .from('races')
    .select('*')
    .eq('slug', slug)
    .single();
  return data as Race | null;
});

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
  const race = await fetchRace(slug);

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
  const r = await fetchRace(slug);

  if (!r) notFound();

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
      <div className={`h-[50vh] min-h-[400px] ${!r.image_url ? (r.image_gradient || 'bg-gradient-to-br from-zinc-600 to-zinc-800') : ''} relative`}>
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

        <div className="absolute bottom-0 w-full px-6 md:px-10 pb-12 pt-16">
          <div className="max-w-7xl mx-auto">
            {/* Badge statut — unique, sobre */}
            {r.registration_status && (
              <div className="mb-3">
                {r.registration_status === 'open' && (
                  <span className="inline-block text-xs font-bold uppercase tracking-wider text-emerald-300 border border-emerald-400/40 px-3 py-1 rounded-full">
                    Inscriptions ouvertes
                  </span>
                )}
                {r.registration_status === 'sold_out' && (
                  <span className="inline-block text-xs font-bold uppercase tracking-wider text-red-300 border border-red-400/40 px-3 py-1 rounded-full">
                    Complet
                  </span>
                )}
                {r.registration_status === 'closed' && (
                  <span className="inline-block text-xs font-bold uppercase tracking-wider text-white/40 border border-white/20 px-3 py-1 rounded-full">
                    Inscriptions fermées
                  </span>
                )}
              </div>
            )}

            <p className="text-sm font-semibold uppercase tracking-wider text-white/80 mb-3">
              {formatDate(r.date)}
            </p>

            <h1 className="text-4xl md:text-6xl font-black text-white tracking-tight drop-shadow-sm">
              {r.name}
            </h1>

            {/* Meta row */}
            <div className="flex flex-wrap items-center gap-2 md:gap-4 mt-5 text-white/60 text-sm">
              <span className="flex items-center gap-1.5">
                {countryFlagSrc(r.country) && (
                  <Image src={countryFlagSrc(r.country)!} alt={r.country ?? ''} width={20} height={15} className="w-5 h-auto rounded-sm" />
                )}
                {r.location}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Terrain type icons */}
      <TerrainIcons swimType={r.swim_type} bikeType={r.bike_type} runType="Plat" />

      <div className="max-w-7xl mx-auto px-6 md:px-10 mt-4">

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Main content — open sections separated by lines */}
          <div className="md:col-span-2">

            {/* Format selector + KPIs + GPX + Records (réactifs) */}
            <RaceDetailBody race={r} />

            {/* Description */}
            {r.description && (
              <article className="border-t border-gray-200 pt-8 mt-8">
                <h2 className="text-xs uppercase tracking-widest text-zinc-400 font-bold mb-4">Description</h2>
                {r.tagline && (
                  <p className="text-sm font-semibold italic text-zinc-500 border-l-2 border-zinc-300 pl-3 mb-4 leading-relaxed">&ldquo;{r.tagline}&rdquo;</p>
                )}
                <p className="text-zinc-600 leading-relaxed text-sm">{r.description}</p>
              </article>
            )}

            {/* Météo — déplacée depuis sidebar */}
            {r.avg_temp_celsius && (
              <section className="border-t border-gray-200 pt-8 mt-8">
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

            {/* Infos pratiques — déplacées depuis sidebar */}
            <div className="border-t border-gray-200 pt-8 mt-8">
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

            {/* Tags — déplacés depuis sidebar */}
            {r.tags && r.tags.length > 0 && (
              <section className="border-t border-gray-200 pt-8 mt-8">
                <h3 className="text-[11px] uppercase tracking-widest text-zinc-400 font-bold mb-3">Tags</h3>
                <div className="flex flex-wrap gap-2">
                  {r.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-xs font-bold text-zinc-500 bg-gray-100 px-3 py-1.5 rounded-full"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </section>
            )}

            {/* Related Races */}
            <RelatedRaces relatedRaces={relatedRaces} />

            {/* CTA Banner */}
            <CTABanner raceSlug={r.slug} raceName={r.name} />
          </div>

          {/* Sidebar — sticky */}
          <div className="space-y-6 sticky top-20 self-start max-h-[calc(100vh-6rem)] overflow-y-auto">

            {/* Inscriptions */}
            {(r.registration_status || r.website_url || (r.formats && r.formats.length > 0)) && (
              <section className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
                {/* Statut — compact header */}
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
                  <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest">Inscriptions</span>
                  {r.registration_status === 'open' && (
                    <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-600">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                      </span>
                      Ouvertes
                    </span>
                  )}
                  {r.registration_status === 'sold_out' && (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded-full">
                      <Lock size={9} aria-hidden="true" />
                      Complet
                    </span>
                  )}
                  {r.registration_status === 'closed' && (
                    <span className="text-xs font-bold text-zinc-400">Fermées</span>
                  )}
                </div>

                {/* Liste des formats */}
                {r.formats && r.formats.length > 0 && (
                  <div className="divide-y divide-gray-50">
                    {r.formats
                      .filter((fmt, idx, arr) =>
                        arr.findIndex((f) => f.category === fmt.category && f.is_relay === fmt.is_relay) === idx
                      )
                      .map((fmt) => {
                        const fmtPrice = fmt.price ?? r.price_euros;
                        return (
                          <div key={`${fmt.category}-${fmt.is_relay}`} className="flex items-center gap-3 px-5 py-3.5">
                            <span className="flex-1 text-sm font-bold text-zinc-800">
                              {fmt.is_relay ? 'Relais' : categoryLabel(fmt.category)}
                            </span>
                            {fmtPrice && (
                              <span className="text-base font-mono font-black text-zinc-900">
                                {fmtPrice}€
                              </span>
                            )}
                            {r.website_url && r.registration_status !== 'closed' && (
                              <ChevronRight size={12} className="text-zinc-300 shrink-0" aria-hidden="true" />
                            )}
                          </div>
                        );
                      })}
                  </div>
                )}

                {/* Fallback : pas de formats mais un prix global */}
                {(!r.formats || r.formats.length === 0) && r.price_euros && (
                  <div className="flex items-center justify-between px-5 py-3.5">
                    <span className="text-sm font-bold text-zinc-800">Inscription</span>
                    <span className="text-base font-mono font-black text-zinc-900">{r.price_euros}€</span>
                  </div>
                )}

                {/* CTA S'inscrire */}
                {r.website_url && r.registration_status !== 'closed' && (
                  <div className="px-4 py-4 border-t border-gray-100">
                    <a
                      href={r.website_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-red-500 text-white text-sm font-black hover:bg-red-600 transition-colors duration-200"
                    >
                      S&apos;inscrire
                      <ArrowRight size={14} aria-hidden="true" />
                    </a>
                  </div>
                )}
              </section>
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
              </div>
            )}

            {/* CTA TriCoach */}
            <a
              href={`${TRICOACH_URL}/races/${r.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center justify-between gap-4 px-5 py-4 bg-zinc-900 text-white font-bold rounded-2xl hover:bg-zinc-800 transition-colors duration-200"
            >
              <div className="flex items-center gap-3">
                <Zap size={16} className="shrink-0" aria-hidden="true" />
                <div>
                  <p className="text-sm font-black leading-none mb-0.5">Préparer avec TriCoach</p>
                  <p className="text-xs text-white/50 font-medium">Plan d&apos;entraînement personnalisé</p>
                </div>
              </div>
              <span className="shrink-0 bg-white text-zinc-900 rounded-full w-7 h-7 flex items-center justify-center group-hover:scale-105 transition-transform duration-200">
                <ArrowRight size={14} aria-hidden="true" />
              </span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
