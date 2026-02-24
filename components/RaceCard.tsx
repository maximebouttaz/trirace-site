import Link from 'next/link';
import Image from 'next/image';
import { MapPin, Calendar, Waves, Bike, Activity, Mountain, Euro, Thermometer, Ban, Trophy, Clock, Users, Droplets } from 'lucide-react';
import type { Race } from '@/lib/types';
import { formatDistance, formatDate, categoryLabel, categoryDotColor, tempLabel, difficultyLabel, priceCategory, idealPourTags, daysUntil, registrationUrgency, isLongDistance } from '@/lib/utils';
import CompareButton from '@/components/CompareButton';
import FavoriteButton from '@/components/FavoriteButton';

const SWIM_TYPE_STYLE: Record<string, string> = {
  'mer': 'bg-blue-100 text-blue-700',
  'open water': 'bg-blue-100 text-blue-700',
  'lac': 'bg-cyan-100 text-cyan-700',
  'étang': 'bg-cyan-100 text-cyan-700',
  'rivière': 'bg-teal-100 text-teal-700',
  'piscine': 'bg-indigo-100 text-indigo-700',
};

export default function RaceCard({ race, onMouseEnter }: { race: Race; onMouseEnter?: () => void }) {
  const disciplines: { icon: typeof Waves; value: number | null; label: string; color: string }[] = [];
  if (race.swim_distance) disciplines.push({ icon: Waves, value: race.swim_distance, label: 'Nata', color: 'text-cyan-500' });
  if (race.bike_distance) disciplines.push({ icon: Bike, value: race.bike_distance, label: 'Vélo', color: 'text-red-500' });
  if (race.run_distance) disciplines.push({ icon: Activity, value: race.run_distance, label: 'Course', color: 'text-amber-500' });

  const longDistance = isLongDistance(race.category);
  const difficulty = longDistance ? difficultyLabel(race) : null;
  const priceLabel = priceCategory(race.price_euros, race.category);
  const idealTags = longDistance ? idealPourTags(race) : [];
  const countdown = daysUntil(race.date);
  const regUrgency = registrationUrgency(race.registration_deadline);
  const hasMetaRow = (race.total_elevation != null && race.total_elevation > 0) || race.price_euros || (longDistance && race.time_limit_hours) || race.finishers_count;

  return (
    <Link href={`/courses/${race.slug}`} className="block h-full">
      <div
        className="group relative bg-white rounded-2xl overflow-hidden shadow-md shadow-black/5 ring-1 ring-gray-200/60 hover:shadow-xl hover:shadow-black/10 hover:ring-gray-300/80 transition-all duration-300 ease-out cursor-pointer h-full flex flex-col hover:-translate-y-1"
        onMouseEnter={onMouseEnter}
      >
        {/* Hover accent line */}
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-red-500 to-orange-500 scale-x-0 group-hover:scale-x-100 transition-transform duration-300 ease-out origin-left z-10" />

        {/* Image / gradient header */}
        <div
          className={`relative h-48 shrink-0 ${!race.image_url ? (race.image_gradient || 'bg-gradient-to-br from-gray-400 to-gray-600') : ''}`}
        >
          {race.image_url && (
            <Image
              src={race.image_url}
              alt={race.name}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 25vw"
            />
          )}

          {/* Scrim — bottom layer */}
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/70 to-transparent" aria-hidden="true" />
          {/* Scrim — top layer */}
          <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/20 to-transparent" aria-hidden="true" />

          {/* Action buttons top-right */}
          <div className="absolute top-3 right-3 flex items-center gap-2 opacity-70 group-hover:opacity-100 transition-opacity duration-200">
            <FavoriteButton slug={race.slug} />
            <CompareButton slug={race.slug} />
          </div>

          {/* Category + label badges bottom-left */}
          <div className="absolute bottom-3 left-3 flex items-center gap-1.5 flex-wrap">
            <span className="inline-flex items-center gap-1.5 bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider shadow-sm text-zinc-800">
              <span className={`w-2 h-2 rounded-full ${categoryDotColor(race.category)}`} />
              {categoryLabel(race.category)}
            </span>
            {race.label && (
              <span className="bg-amber-50/90 backdrop-blur-md text-amber-700 ring-1 ring-amber-200/50 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider shadow-sm">
                {race.label}
              </span>
            )}
            {race.qualification_for && (
              <span className="bg-amber-50/90 backdrop-blur-md text-amber-700 ring-1 ring-amber-200/50 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider shadow-sm flex items-center gap-1">
                <Trophy size={9} aria-hidden="true" /> WC
              </span>
            )}
            {difficulty && (
              <span className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider backdrop-blur-md shadow-sm ${difficulty.color}`}>
                {difficulty.label}
              </span>
            )}
          </div>

          {/* Distance + country chips bottom-right */}
          <div className="absolute bottom-3 right-3 flex items-center gap-1.5">
            {race.total_distance != null && race.total_distance > 0 && (
              <span className="bg-white/95 backdrop-blur-md text-zinc-900 text-xs font-mono font-black px-3 py-1.5 rounded-full shadow-sm">
                {formatDistance(race.total_distance)}
              </span>
            )}
            {race.country !== 'France' && (
              <span className="bg-white/90 backdrop-blur-md text-zinc-700 text-[10px] font-bold px-3 py-1.5 rounded-full shadow-sm">
                {race.country}
              </span>
            )}
          </div>
        </div>

        {/* Card body */}
        <div className="px-5 pt-4 pb-5 flex-1 flex flex-col">
          {/* Zone 1 — Identity */}
          <div className="space-y-1.5 mb-3">
            {/* Location + temperature */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-400 min-w-0">
                <MapPin size={12} className="shrink-0" aria-hidden="true" />
                <span className="truncate">{race.city}{race.country !== 'France' ? `, ${race.country}` : ''}</span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {race.avg_temp_celsius != null && (() => {
                  const t = tempLabel(race.avg_temp_celsius);
                  return (
                    <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${t.color}`}>
                      <Thermometer size={10} aria-hidden="true" />
                      {race.avg_temp_celsius}°C
                    </span>
                  );
                })()}
                {race.avg_water_temp_celsius != null && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-50 text-cyan-600">
                    <Droplets size={10} aria-hidden="true" />
                    {race.avg_water_temp_celsius}°C
                  </span>
                )}
              </div>
            </div>

            {/* Title */}
            <h3 className="font-bold text-zinc-900 text-lg tracking-tight leading-snug group-hover:text-red-600 transition-colors duration-300">
              {race.name}
            </h3>

            {/* Date pill + countdown */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-100 rounded-full px-2.5 py-1 w-fit">
                <Calendar size={12} className="text-red-400 shrink-0" aria-hidden="true" />
                <span className="font-mono text-xs font-semibold text-zinc-700">{formatDate(race.date)}</span>
              </div>
              {countdown != null && (
                <span className="font-mono text-[10px] font-bold px-2 py-1 rounded-full bg-gray-50 border border-gray-100 text-zinc-400">
                  J-{countdown}
                </span>
              )}
              {regUrgency && regUrgency.urgent && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-600">
                  Inscriptions: {regUrgency.text}
                </span>
              )}
            </div>
          </div>

          {/* Zone 2 — Distances */}
          {disciplines.length >= 2 ? (
            <div className="bg-gray-50 rounded-xl px-4 py-3 mb-3">
              <div className={`grid ${disciplines.length === 2 ? 'grid-cols-2' : 'grid-cols-3'} divide-x divide-gray-200`}>
                {disciplines.map(({ icon: Icon, value, label, color }) => (
                  <div key={label} className="flex flex-col items-center gap-1">
                    <Icon size={14} className={color} aria-hidden="true" />
                    <span className="font-mono text-sm font-bold text-zinc-800">{formatDistance(value)}</span>
                    <span className="text-[9px] text-zinc-400 uppercase font-semibold tracking-wide">{label}</span>
                  </div>
                ))}
              </div>
              {/* Swim type + wetsuit info */}
              {(race.swim_type || race.is_wetsuit_allowed === false) && (
                <div className="flex items-center justify-center gap-2 mt-2 pt-2 border-t border-gray-200">
                  {race.swim_type && (
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${SWIM_TYPE_STYLE[race.swim_type] ?? 'bg-gray-100 text-gray-500'}`}>
                      {race.swim_type}
                    </span>
                  )}
                  {race.is_wetsuit_allowed === false && (
                    <span className="flex items-center gap-0.5 text-red-500 text-[9px] font-bold" title="Combinaison non autorisée">
                      <Ban size={10} aria-hidden="true" /> Sans combi
                    </span>
                  )}
                </div>
              )}
            </div>
          ) : disciplines.length === 1 ? (
            <div className="flex items-center gap-2 text-xs mb-3">
              {disciplines.map(({ icon: Icon, value, color }) => (
                <div key={value} className="flex items-center gap-1">
                  <Icon size={12} className={`${color} shrink-0`} aria-hidden="true" />
                  <span className="font-mono font-bold text-zinc-600">{formatDistance(value)}</span>
                </div>
              ))}
            </div>
          ) : null}

          {/* Mini elevation profile — long distance only */}
          {longDistance && race.bike_elevation != null && race.bike_elevation > 0 && (
            <div className="h-8 w-full relative mb-3">
              <svg viewBox="0 0 120 24" className="w-full h-full" preserveAspectRatio="none">
                <defs>
                  <linearGradient id={`eg-${race.slug}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#dc2626" stopOpacity="0.15" />
                    <stop offset="100%" stopColor="#dc2626" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d="M0 22 L8 22 L20 8 L35 16 L50 4 L65 14 L80 6 L95 18 L110 12 L120 22" fill="none" stroke="#dc2626" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M0 22 L8 22 L20 8 L35 16 L50 4 L65 14 L80 6 L95 18 L110 12 L120 22 V24 H0 Z" fill={`url(#eg-${race.slug})`} />
              </svg>
              <span className="absolute right-0 bottom-0 text-[9px] font-mono font-bold text-zinc-400">{race.bike_elevation}m D+ velo</span>
            </div>
          )}

          {/* Zone 3 — Footer */}
          <div className="border-t border-gray-100 pt-3 mt-auto">
            {/* Meta row — elevation, price, time limit, finishers */}
            {hasMetaRow && (
              <div className="flex items-center gap-4 text-xs text-zinc-400 flex-wrap mb-2">
                {race.total_elevation != null && race.total_elevation > 0 && (
                  <div className="flex items-center gap-1">
                    <Mountain size={12} aria-hidden="true" />
                    <span className="font-mono">{race.total_elevation}m D+</span>
                  </div>
                )}
                {race.price_euros && (
                  <div className="flex items-center gap-1">
                    <Euro size={12} aria-hidden="true" />
                    <span className="font-mono">{race.price_euros}€</span>
                    {priceLabel && (
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${priceLabel.color}`}>
                        {priceLabel.label}
                      </span>
                    )}
                  </div>
                )}
                {longDistance && race.time_limit_hours && (
                  <div className="flex items-center gap-1">
                    <Clock size={12} aria-hidden="true" />
                    <span className="font-mono">{race.time_limit_hours}h</span>
                  </div>
                )}
                {race.finishers_count && (
                  <div className="flex items-center gap-1">
                    <Users size={12} aria-hidden="true" />
                    <span className="font-mono">{race.finishers_count.toLocaleString('fr-FR')}</span>
                  </div>
                )}
              </div>
            )}

            {/* Tags */}
            {(() => {
              const allTags: string[] = [];
              if (race.formats && race.formats.length > 1) {
                allTags.push(`+${race.formats.length - 1} format${race.formats.length > 2 ? 's' : ''}`);
              }
              if (longDistance && idealTags.length > 0) {
                allTags.push(...idealTags.slice(0, 3));
              } else if (race.tags && race.tags.length > 0) {
                allTags.push(...race.tags.slice(0, 3));
              }
              if (allTags.length === 0) return null;
              return (
                <div className="flex flex-wrap gap-1.5">
                  {allTags.map((tag) => (
                    <span
                      key={tag}
                      className="text-[10px] font-semibold text-zinc-400 bg-gray-50 px-2.5 py-1 rounded-full"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              );
            })()}
          </div>
        </div>
      </div>
    </Link>
  );
}
