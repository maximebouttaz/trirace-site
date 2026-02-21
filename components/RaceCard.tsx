import Link from 'next/link';
import { MapPin, Calendar, Waves, Bike, Activity, Mountain, Euro } from 'lucide-react';
import type { Race } from '@/lib/types';
import { formatDistance, formatDate, categoryLabel, categoryColor } from '@/lib/utils';

export default function RaceCard({ race }: { race: Race }) {
  return (
    <Link href={`/courses/${race.slug}`}>
      <div className="group bg-gray-50 rounded-3xl overflow-hidden border border-gray-200 hover:border-gray-300 hover:shadow-xl hover:shadow-black/10 transition-all cursor-pointer h-full flex flex-col hover:-translate-y-1 duration-300">
        {/* Image header */}
        <div className={`h-36 ${race.image_gradient || 'bg-gradient-to-br from-gray-400 to-gray-600'} relative`}>
          <div className={`absolute bottom-3 left-3 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${categoryColor(race.category)}`}>
            {categoryLabel(race.category)}
          </div>
          <div className="absolute bottom-3 right-3 flex items-center gap-1.5">
            {race.total_distance != null && race.total_distance > 0 && (
              <div className="bg-black/60 backdrop-blur text-white text-[10px] font-bold px-2 py-1 rounded-lg">
                {formatDistance(race.total_distance)}
              </div>
            )}
            {race.country !== 'France' && (
              <div className="bg-black/60 backdrop-blur text-zinc-300 text-[10px] font-bold px-2 py-1 rounded-lg">
                {race.country}
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-5 flex-1 flex flex-col">
          <div className="flex items-center gap-1.5 text-xs text-zinc-400 mb-1.5">
            <MapPin size={12} />
            <span>{race.city}, {race.country}</span>
          </div>

          <h3 className="font-bold text-zinc-900 text-lg leading-tight mb-2 group-hover:text-red-500 transition-all duration-300">
            {race.name}
          </h3>

          <div className="flex items-center gap-2 mb-4">
            <div className="flex items-center gap-1.5 bg-gray-100 rounded-lg px-2.5 py-1">
              <Calendar size={12} className="text-red-400" />
              <span className="font-mono text-xs font-semibold text-zinc-700">{formatDate(race.date)}</span>
            </div>
          </div>

          {/* Distances */}
          <div className="flex items-center gap-4 text-xs text-zinc-400 mb-3">
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

          {/* Elevation + Price */}
          <div className="flex items-center gap-4 text-xs text-zinc-400 mb-4">
            {race.total_elevation != null && race.total_elevation > 0 && (
              <div className="flex items-center gap-1">
                <Mountain size={12} />
                <span className="font-mono">{race.total_elevation}m D+</span>
              </div>
            )}
            {race.price_euros && (
              <div className="flex items-center gap-1">
                <Euro size={12} />
                <span className="font-mono">{race.price_euros}€</span>
              </div>
            )}
          </div>

          {/* Tags */}
          {race.tags && race.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-auto">
              {race.tags.slice(0, 3).map((tag) => (
                <span key={tag} className="inline-flex items-center gap-1.5 text-[10px] font-bold text-zinc-600 bg-gray-100 border border-gray-200/50 px-2.5 py-1 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
