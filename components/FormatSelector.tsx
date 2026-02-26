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
      {hasMultiple && (
        <div className="flex gap-2 overflow-x-auto pb-3 mb-3 scrollbar-hide">
          {allFormats.map((fmt, i) => (
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
          ))}
        </div>
      )}

      {/* KPI cards */}
      <div className={`grid grid-cols-2 ${showPrice ? 'md:grid-cols-5' : 'md:grid-cols-4'} gap-3`}>
        {swim != null && swim > 0 && (
          <div className="bg-white rounded-2xl shadow-lg p-6 text-center hover:shadow-xl transition-shadow">
            <Waves size={20} className="text-zinc-400 mx-auto mb-3" aria-hidden="true" />
            <p className="text-3xl font-mono font-black text-zinc-900 leading-none">{formatDistance(swim)}</p>
            <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mt-1.5">Natation</p>
          </div>
        )}
        {bike != null && bike > 0 && (
          <div className="bg-white rounded-2xl shadow-lg p-6 text-center hover:shadow-xl transition-shadow">
            <Bike size={20} className="text-zinc-400 mx-auto mb-3" aria-hidden="true" />
            <p className="text-3xl font-mono font-black text-zinc-900 leading-none">{formatDistance(bike)}</p>
            <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mt-1.5">Velo</p>
          </div>
        )}
        {run != null && run > 0 && (
          <div className="bg-white rounded-2xl shadow-lg p-6 text-center hover:shadow-xl transition-shadow">
            <Activity size={20} className="text-zinc-400 mx-auto mb-3" aria-hidden="true" />
            <p className="text-3xl font-mono font-black text-zinc-900 leading-none">{formatDistance(run)}</p>
            <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mt-1.5">Course</p>
          </div>
        )}
        {elevation != null && elevation > 0 && (
          <div className="bg-white rounded-2xl shadow-lg p-6 text-center hover:shadow-xl transition-shadow">
            <Mountain size={20} className="text-zinc-400 mx-auto mb-3" aria-hidden="true" />
            <p className="text-3xl font-mono font-black text-zinc-900 leading-none">{elevation}m</p>
            <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mt-1.5">Denivele D+</p>
          </div>
        )}
        {showPrice && (
          <div className="bg-white rounded-2xl shadow-lg p-6 text-center hover:shadow-xl transition-shadow">
            <Euro size={20} className="text-zinc-400 mx-auto mb-3" aria-hidden="true" />
            <p className="text-3xl font-mono font-black text-zinc-900 leading-none">{price}&euro;</p>
            <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mt-1.5">Inscription</p>
          </div>
        )}
      </div>
    </div>
  );
}
