'use client';

import { useState } from 'react';
import { Waves, Bike, Activity, Mountain, Euro } from 'lucide-react';
import type { Race } from '@/lib/types';
import { formatDistance, categoryLabel } from '@/lib/utils';

type Format = NonNullable<Race['formats']>[number];

interface FormatSelectorProps {
  formats: Race['formats'];
  swimDistance: number | null;
  bikeDistance: number | null;
  runDistance: number | null;
  totalElevation: number | null;
  priceEuros: number | null;
  tagline?: string | null;
  // Nouveaux — optionnels pour rétro-compatibilité
  selectedIndex?: number;
  onSelect?: (index: number) => void;
}

export default function FormatSelector({
  formats,
  swimDistance,
  bikeDistance,
  runDistance,
  totalElevation,
  priceEuros,
  tagline,
  selectedIndex: controlledIndex,
  onSelect,
}: FormatSelectorProps) {
  const sortByDistance = (a: Format, b: Format) => (a.total ?? 0) - (b.total ?? 0);
  const nonRelayFormats = (formats?.filter((f) => !f.is_relay) ?? []).sort(sortByDistance);
  const hasMultiple = nonRelayFormats.length >= 2;
  const relayFormats = (formats?.filter((f) => f.is_relay) ?? []).sort(sortByDistance);
  const allFormats = [...nonRelayFormats, ...relayFormats];

  const [internalIndex, setInternalIndex] = useState(0);
  const selectedIndex = controlledIndex ?? internalIndex;
  const setSelectedIndex = (i: number) => {
    setInternalIndex(i);
    onSelect?.(i);
  };

  // Resolve displayed values
  let swim: number | null;
  let bike: number | null;
  let run: number | null;
  let elevation: number | null;
  let price: number | null;

  if (hasMultiple && allFormats[selectedIndex]) {
    const fmt = allFormats[selectedIndex];
    swim = fmt.swim;
    bike = fmt.bike;
    run = fmt.run;
    elevation = fmt.elevation ?? totalElevation;
    price = fmt.price;
  } else if (allFormats.length === 1) {
    const fmt = allFormats[0];
    swim = fmt.swim ?? swimDistance;
    bike = fmt.bike ?? bikeDistance;
    run = fmt.run ?? runDistance;
    elevation = fmt.elevation ?? totalElevation;
    price = fmt.price ?? priceEuros;
  } else {
    swim = swimDistance;
    bike = bikeDistance;
    run = runDistance;
    elevation = totalElevation;
    price = priceEuros;
  }

  const showPrice = hasMultiple && price != null;

  return (
    <div>
      {/* En-tête — affiché seulement si plusieurs formats non-relay */}
      {hasMultiple && (
        <div className="mb-6">
          <h2 className="text-2xl font-black text-zinc-900 mb-2">Choisissez votre défi</h2>
          {tagline && (
            <p className="text-sm text-zinc-500 leading-relaxed">{tagline}</p>
          )}
        </div>
      )}

      {/* Pills — nouveau style unifié */}
      {allFormats.length >= 1 && (
        <div className="mb-5">
          {hasMultiple ? (
            <div className="inline-flex gap-1 bg-gray-100 rounded-2xl p-1">
              {allFormats.map((fmt, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedIndex(i)}
                  className={`px-5 py-2 rounded-xl text-sm font-bold transition-all duration-150 ${
                    i === selectedIndex
                      ? 'bg-white shadow-sm text-zinc-900'
                      : 'text-zinc-500 hover:text-zinc-700'
                  }`}
                >
                  {fmt.name || categoryLabel(fmt.category)}
                  {fmt.is_relay && (
                    <span className="ml-1.5 text-[10px] opacity-60 uppercase">Relais</span>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <span className="inline-block px-5 py-2 rounded-xl text-sm font-bold bg-white border border-gray-200 text-zinc-700 shadow-sm">
              {allFormats[0]?.name || categoryLabel(allFormats[0]?.category)}
              {allFormats[0]?.is_relay && (
                <span className="ml-1.5 text-[10px] opacity-60 uppercase">Relais</span>
              )}
            </span>
          )}
        </div>
      )}

      {/* KPI — barre disciplines tricolore */}
      {((swim != null && swim > 0) || (bike != null && bike > 0) || (run != null && run > 0)) && (
        <div className="rounded-2xl overflow-hidden border border-gray-100 flex">
          {swim != null && swim > 0 && (
            <div className={`flex-1 bg-blue-50 px-4 py-5 text-center${(bike != null && bike > 0) || (run != null && run > 0) ? ' border-r border-white' : ''}`}>
              <Waves size={15} className="text-blue-400 mx-auto mb-2.5" aria-hidden="true" />
              <p className="text-2xl font-mono font-black text-zinc-900 leading-none">{formatDistance(swim)}</p>
              <p className="text-[10px] text-blue-400 font-bold uppercase tracking-widest mt-1.5">Natation</p>
            </div>
          )}
          {bike != null && bike > 0 && (
            <div className={`flex-1 bg-amber-50 px-4 py-5 text-center${run != null && run > 0 ? ' border-r border-white' : ''}`}>
              <Bike size={15} className="text-amber-500 mx-auto mb-2.5" aria-hidden="true" />
              <p className="text-2xl font-mono font-black text-zinc-900 leading-none">{formatDistance(bike)}</p>
              <p className="text-[10px] text-amber-500 font-bold uppercase tracking-widest mt-1.5">Vélo</p>
            </div>
          )}
          {run != null && run > 0 && (
            <div className="flex-1 bg-red-50 px-4 py-5 text-center">
              <Activity size={15} className="text-red-400 mx-auto mb-2.5" aria-hidden="true" />
              <p className="text-2xl font-mono font-black text-zinc-900 leading-none">{formatDistance(run)}</p>
              <p className="text-[10px] text-red-400 font-bold uppercase tracking-widest mt-1.5">Course</p>
            </div>
          )}
        </div>
      )}

      {/* Stats secondaires — dénivelé + prix */}
      {((elevation != null && elevation > 0) || showPrice) && (
        <div className="flex gap-2.5 mt-2.5">
          {elevation != null && elevation > 0 && (
            <div className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3 flex-1">
              <Mountain size={14} className="text-zinc-400 shrink-0" aria-hidden="true" />
              <div>
                <p className="text-base font-mono font-black text-zinc-900 leading-none">{elevation}m</p>
                <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mt-0.5">Dénivelé D+</p>
              </div>
            </div>
          )}
          {showPrice && (
            <div className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3 flex-1">
              <Euro size={14} className="text-zinc-400 shrink-0" aria-hidden="true" />
              <div>
                <p className="text-base font-mono font-black text-zinc-900 leading-none">{price}€</p>
                <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mt-0.5">Inscription</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
