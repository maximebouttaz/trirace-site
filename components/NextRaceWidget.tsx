import Link from 'next/link';
import { ArrowRight, MapPin, Waves, Bike, Activity, Calendar } from 'lucide-react';
import type { Race } from '@/lib/types';
import { formatDistance, formatDate, categoryLabel, categoryColor } from '@/lib/utils';

function computeCountdown(dateStr: string): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const race = new Date(dateStr + 'T00:00:00');
  const diff = Math.round((race.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diff === 0) return "Aujourd'hui !";
  if (diff === 1) return 'Demain !';
  return `J-${diff}`;
}

export default function NextRaceWidget({ race }: { race: Race }) {
  const countdown = race.date ? computeCountdown(race.date) : null;

  return (
    <section className="max-w-7xl mx-auto px-6 md:px-10 py-8">
      <div className="relative overflow-hidden rounded-3xl border border-gray-200 bg-gray-50">
        {/* Background gradient accent */}
        <div className={`absolute inset-0 opacity-10 ${race.image_gradient || 'bg-gradient-to-br from-red-500 to-orange-500'}`} />

        <div className="relative p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center gap-6">
          {/* Countdown badge */}
          <div className="shrink-0 flex flex-col items-center justify-center w-24 h-24 rounded-2xl bg-gradient-to-br from-red-500 to-orange-500 text-white shadow-lg shadow-red-500/20">
            {countdown && countdown.startsWith('J-') ? (
              <>
                <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">dans</span>
                <span className="text-3xl font-black font-mono leading-none mt-0.5">
                  {countdown.replace('J-', '')}
                </span>
                <span className="text-xs font-bold mt-1 opacity-90">jours</span>
              </>
            ) : (
              <span className="text-sm font-black text-center leading-tight px-2">{countdown}</span>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-bold text-red-500 uppercase tracking-wider">Prochaine course</span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${categoryColor(race.category)}`}>
                {categoryLabel(race.category)}
              </span>
            </div>
            <h3 className="text-xl md:text-2xl font-black text-zinc-900 leading-tight mb-2">
              {race.name}
            </h3>
            <div className="flex flex-wrap items-center gap-4 text-sm text-zinc-500 mb-4">
              <div className="flex items-center gap-1.5">
                <MapPin size={13} className="text-zinc-400" />
                <span>{race.city}, {race.country}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Calendar size={13} className="text-red-400" />
                <span className="font-semibold text-zinc-700">{formatDate(race.date)}</span>
              </div>
            </div>
            {/* Distances */}
            <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-400">
              {race.swim_distance && (
                <div className="flex items-center gap-1">
                  <Waves size={12} className="text-cyan-500" />
                  <span className="font-mono font-bold text-zinc-600">{formatDistance(race.swim_distance)}</span>
                </div>
              )}
              {race.bike_distance && (
                <div className="flex items-center gap-1">
                  <Bike size={12} className="text-red-500" />
                  <span className="font-mono font-bold text-zinc-600">{formatDistance(race.bike_distance)}</span>
                </div>
              )}
              {race.run_distance && (
                <div className="flex items-center gap-1">
                  <Activity size={12} className="text-amber-500" />
                  <span className="font-mono font-bold text-zinc-600">{formatDistance(race.run_distance)}</span>
                </div>
              )}
            </div>
          </div>

          {/* CTA */}
          <Link
            href={`/courses/${race.slug}`}
            className="shrink-0 flex items-center gap-2 px-5 py-3 bg-zinc-900 text-white text-sm font-bold rounded-xl hover:bg-zinc-800 transition-all whitespace-nowrap"
          >
            Voir la course
            <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </section>
  );
}
