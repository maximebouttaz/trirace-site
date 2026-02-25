import { memo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { MapPin, Calendar, Mountain, Euro, Clock, Users } from 'lucide-react';
import type { Race } from '@/lib/types';
import { formatDate, priceCategory, daysUntil, registrationUrgency, isLongDistance } from '@/lib/utils';
import CompareButton from '@/components/CompareButton';
import FavoriteButton from '@/components/FavoriteButton';

function RaceCard({ race, onMouseEnter, priority = false }: { race: Race; onMouseEnter?: () => void; priority?: boolean }) {
  const longDistance = isLongDistance(race.category);
  const priceLabel = priceCategory(race.price_euros, race.category);
  const countdown = daysUntil(race.date);
  const regUrgency = registrationUrgency(race.registration_deadline);
  const hasMetaRow = (race.total_elevation != null && race.total_elevation > 0) || (longDistance && race.time_limit_hours) || race.finishers_count;

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
              priority={priority}
            />
          )}

          {/* Scrim — bottom layer */}
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/70 to-transparent" aria-hidden="true" />
          {/* Scrim — top layer */}
          <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/20 to-transparent" aria-hidden="true" />

          {/* Registration status — top-left */}
          {(() => {
            let label: string | null = null;
            let cls = '';
            let dot: string | null = null;

            if (race.registration_status === 'sold_out') {
              label = 'Complet'; cls = 'bg-red-500/90 backdrop-blur-sm text-white border border-red-400/30';
            } else if (race.registration_status === 'closed') {
              label = 'Fermé'; cls = 'bg-zinc-600/90 backdrop-blur-sm text-white border border-zinc-500/30';
            } else if (race.registration_status === 'open') {
              label = 'Ouvert'; cls = 'bg-emerald-500/90 backdrop-blur-sm text-white border border-emerald-400/30'; dot = 'bg-white animate-pulse';
            }

            if (!label) return null;
            return (
              <div className={`absolute top-3 left-3 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider z-10 ${cls}`}>
                {dot && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dot}`} />}
                {label}
              </div>
            );
          })()}

          {/* Action buttons — top-right */}
          <div className="absolute top-3 right-3 flex items-center gap-2 z-10">
            <FavoriteButton slug={race.slug} />
            <CompareButton slug={race.slug} />
          </div>

          {/* Location — bottom-right */}
          <div className="absolute bottom-3 right-3 flex items-center gap-1 z-10">
            <MapPin size={11} className="text-white/70 shrink-0" aria-hidden="true" />
            <span className="text-white/90 text-[11px] font-semibold drop-shadow">
              {race.city}{race.country !== 'France' ? `, ${race.country}` : ''}
            </span>
          </div>

        </div>

        {/* Card body */}
        <div className="px-5 pt-4 pb-5 flex-1 flex flex-col">
          {/* Zone 1 — Identity */}
          <div className="space-y-1.5 mb-3">

            {/* Formats */}
            {(() => {
              const CAT_ORDER: Record<string, number> = { XS: 0, S: 1, M: 2, L: 3, '70.3': 4, XL: 5, Ironman: 6 };
              let labels: string[];
              if (race.formats && race.formats.length > 0) {
                const normal = race.formats
                  .filter((f) => !f.is_relay)
                  .sort((a, b) => (CAT_ORDER[a.category] ?? 99) - (CAT_ORDER[b.category] ?? 99))
                  .map((f) => f.category);
                const relays = race.formats
                  .filter((f) => f.is_relay)
                  .sort((a, b) => (CAT_ORDER[a.category] ?? 99) - (CAT_ORDER[b.category] ?? 99))
                  .map((f) => `Relais ${f.category}`);
                labels = [...normal, ...relays];
              } else {
                labels = [race.category];
              }
              return (
                <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wide">
                  {race.discipline?.toLowerCase() === 'triathlon' && 'Triathlon · '}
                  {labels.join(', ')}
                </p>
              );
            })()}

            {/* Title */}
            <h3 className="font-bold text-zinc-900 text-lg tracking-tight leading-snug group-hover:text-red-600 transition-colors duration-300">
              {race.name}
            </h3>

            {/* Date + countdown + urgence — sans bulle */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1.5">
                <Calendar size={12} className="text-red-400 shrink-0" aria-hidden="true" />
                <span className="font-mono text-xs font-semibold text-zinc-400">{formatDate(race.date)}</span>
              </div>
              {countdown != null && (
                <span className="font-mono text-[11px] font-bold text-zinc-300">
                  J-{countdown}
                </span>
              )}
              {regUrgency && regUrgency.urgent && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-600">
                  Inscriptions : {regUrgency.text}
                </span>
              )}
            </div>

            {/* Prix — hauteur réservée pour éviter le CLS */}
            <div className="h-5 flex items-center gap-2 pt-0.5">
              {race.price_euros ? (
                <>
                  <div className="flex items-center gap-1 text-zinc-600">
                    <span className="text-[11px] text-zinc-400 font-normal">à partir de</span>
                    <Euro size={12} className="shrink-0" aria-hidden="true" />
                    <span className="font-mono text-xs font-bold">{race.price_euros}€</span>
                  </div>
                  {priceLabel && (
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${priceLabel.color}`}>
                      {priceLabel.label}
                    </span>
                  )}
                </>
              ) : null}
            </div>
          </div>


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

          </div>
        </div>
      </div>
    </Link>
  );
}

export default memo(RaceCard);
