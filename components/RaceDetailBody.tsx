'use client';

import { useState, useMemo } from 'react';
import { Medal } from 'lucide-react';
import type { Race } from '@/lib/types';
import FormatSelector from '@/components/FormatSelector';
import RaceGPXSection from '@/components/RaceGPXSection';

interface RaceDetailBodyProps {
  race: Race;
}

const sortByDistance = (
  a: NonNullable<Race['formats']>[number],
  b: NonNullable<Race['formats']>[number]
) => (a.total ?? 0) - (b.total ?? 0);

export default function RaceDetailBody({ race: r }: RaceDetailBodyProps) {
  const allFormats = useMemo(() => {
    const nonRelay = (r.formats?.filter((f) => !f.is_relay) ?? []).sort(sortByDistance);
    const relay = (r.formats?.filter((f) => f.is_relay) ?? []).sort(sortByDistance);
    return [...nonRelay, ...relay];
  }, [r.formats]);

  const hasMultiple = allFormats.filter((f) => !f.is_relay).length >= 2;

  const [selectedIndex, setSelectedIndex] = useState(0);

  // Données réactives selon le format sélectionné
  const selectedFormat = hasMultiple ? allFormats[selectedIndex] : null;

  // Indicateur "données partagées" — quand le format sélectionné n'a pas encore son propre GPX
  const showSharedDataNote = hasMultiple && r.track_geojson != null;

  return (
    <>
      {/* Sélecteur de format + KPI distances */}
      <section className="mb-8">
        <FormatSelector
          formats={r.formats}
          swimDistance={r.swim_distance}
          bikeDistance={r.bike_distance}
          runDistance={r.run_distance}
          totalElevation={r.total_elevation}
          priceEuros={r.price_euros}
          selectedIndex={selectedIndex}
          onSelect={setSelectedIndex}
        />
      </section>

      {/* Parcours / GPX */}
      <section className="mb-8">
        <h3 className="text-xs uppercase tracking-widest text-zinc-400 font-bold mb-4">Parcours</h3>
        {showSharedDataNote && (
          <p className="text-xs text-zinc-400 italic mb-3">
            Tracé commun à tous les formats
          </p>
        )}
        <RaceGPXSection
          trackGeoJSON={r.track_geojson}
          elevationProfile={r.elevation_profile}
          disciplines={{
            swim: {
              type: r.swim_type,
              isWetsuitAllowed: r.is_wetsuit_allowed,
              cutoffMinutes: r.swim_cutoff_minutes,
              timeLimitHours: r.time_limit_hours,
            },
            bike: {
              type: r.bike_type,
              cutoffMinutes: r.bike_cutoff_minutes,
              timeLimitHours: r.time_limit_hours,
              elevationM: selectedFormat?.elevation ?? r.bike_elevation,
              distanceM: selectedFormat?.bike ?? r.bike_distance,
            },
            run: {
              cutoffMinutes: r.run_cutoff_minutes,
              timeLimitHours: r.time_limit_hours,
              laps: r.run_laps,
            },
          }}
        />
      </section>

      {/* Records */}
      {(r.record_men || r.record_women) && (
        <section className="border-t border-gray-200 pt-8 mb-8">
          <h3 className="text-xs uppercase tracking-widest text-zinc-400 font-bold mb-4">
            Records du parcours
            {showSharedDataNote && (
              <span className="ml-2 text-[10px] text-zinc-300 font-normal normal-case tracking-normal">
                (communs à tous les formats)
              </span>
            )}
          </h3>
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
        <section className="border-t border-gray-200 pt-8 mb-8">
          <h3 className="text-xs uppercase tracking-widest text-zinc-400 font-bold mb-4">Qualification</h3>
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-100 text-zinc-700 font-bold text-sm">
            <Medal size={15} className="text-zinc-400 shrink-0" />
            Cette course qualifie pour : {r.qualification_for}
          </span>
        </section>
      )}
    </>
  );
}
