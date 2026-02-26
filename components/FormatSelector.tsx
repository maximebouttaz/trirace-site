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
      {/* Pills */}
      {allFormats.length >= 1 && (
        <div className="flex gap-2 overflow-x-auto pb-3 mb-3 scrollbar-hide">
          {allFormats.map((fmt, i) => (
            hasMultiple ? (
              <button
                key={i}
                onClick={() => setSelectedIndex(i)}
                className={`shrink-0 px-4 py-2 rounded-full text-sm font-bold transition-colors ${
                  i === selectedIndex
                    ? 'bg-red-500 text-white'
                    : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                }`}
              >
                {fmt.name || categoryLabel(fmt.category)}
                {fmt.is_relay && (
                  <span className="ml-1.5 text-[10px] opacity-60 uppercase">Relais</span>
                )}
              </button>
            ) : (
              <span
                key={i}
                className="shrink-0 px-4 py-2 rounded-full text-sm font-bold bg-red-500 text-white"
              >
                {fmt.name || categoryLabel(fmt.category)}
                {fmt.is_relay && (
                  <span className="ml-1.5 text-[10px] opacity-60 uppercase">Relais</span>
                )}
              </span>
            )
          ))}
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
