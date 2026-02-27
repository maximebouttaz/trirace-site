'use client';

import { useState, useMemo } from 'react';
import { Medal, Waves, Bike, Activity } from 'lucide-react';
import type { Race } from '@/lib/types';
import FormatSelector from '@/components/FormatSelector';
import RaceGPXSection, { type Segment } from '@/components/RaceGPXSection';

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
  const [activeSegment, setActiveSegment] = useState<Segment>('swim');

  // Données réactives selon le format sélectionné
  const selectedFormat = hasMultiple ? allFormats[selectedIndex] : null;

  // Indicateur "données partagées" — quand le format sélectionné n'a pas encore son propre GPX
  const showSharedDataNote = hasMultiple && r.track_geojson != null;

  // Discipline cards data
  const swimDist = selectedFormat?.swim ?? r.swim_distance;
  const bikeDist = selectedFormat?.bike ?? r.bike_distance;
  const runDist = selectedFormat?.run ?? r.run_distance;
  const bikeElev = selectedFormat?.elevation ?? r.bike_elevation;

  function fmtDist(meters: number): string {
    return meters >= 1000 ? `${(meters / 1000).toFixed(1)}km` : `${meters}m`;
  }

  const disciplineCards = [
    {
      key: 'swim' as Segment, label: 'Natation', icon: Waves,
      distanceM: swimDist, subLabel: r.swim_type ? r.swim_type.charAt(0).toUpperCase() + r.swim_type.slice(1) : null,
      iconBg: 'bg-blue-500', activeBg: 'bg-blue-50', activeBorder: 'border-blue-300',
      activeText: 'text-blue-700', activeSubText: 'text-blue-500',
    },
    {
      key: 'bike' as Segment, label: 'Vélo', icon: Bike,
      distanceM: bikeDist,
      subLabel: [r.bike_type ? r.bike_type.charAt(0).toUpperCase() + r.bike_type.slice(1) : null, bikeElev && bikeElev > 0 ? `${bikeElev}m D+` : null].filter(Boolean).join(' · ') || null,
      iconBg: 'bg-orange-500', activeBg: 'bg-orange-50', activeBorder: 'border-orange-300',
      activeText: 'text-orange-700', activeSubText: 'text-orange-500',
    },
    {
      key: 'run' as Segment, label: 'Course à pied', icon: Activity,
      distanceM: runDist,
      subLabel: r.run_laps && r.run_laps > 0 ? `${r.run_laps} ${r.run_laps > 1 ? 'boucles' : 'boucle'}` : null,
      iconBg: 'bg-emerald-500', activeBg: 'bg-emerald-50', activeBorder: 'border-emerald-300',
      activeText: 'text-emerald-700', activeSubText: 'text-emerald-500',
    },
  ];

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
          tagline={r.tagline}
          selectedIndex={selectedIndex}
          onSelect={setSelectedIndex}
        />
      </section>

      {/* Parcours — onglets disciplines connectés au contenu GPS */}
      <section className="mb-8">


        {/* Onglets disciplines */}
        <div className="flex border-b border-gray-200">
          {disciplineCards.map((card) => {
            const Icon = card.icon;
            const isActive = activeSegment === card.key;
            return (
              <button
                key={card.key}
                onClick={() => setActiveSegment(card.key)}
                className={`flex-1 flex flex-col items-center text-center px-2 py-3 transition-all border border-transparent ${
                  isActive
                    ? 'bg-gray-50 border-gray-200 border-b-gray-50 rounded-t-2xl -mb-px z-10'
                    : 'hover:bg-gray-50/50'
                }`}
              >
                <Icon size={16} className={isActive ? 'text-zinc-700 mb-1.5' : 'text-zinc-400 mb-1.5'} aria-hidden="true" />
                <p className={`text-base sm:text-lg font-mono font-black leading-none ${isActive ? 'text-zinc-900' : 'text-zinc-400'}`}>
                  {card.distanceM ? fmtDist(card.distanceM) : '—'}
                </p>
                <p className={`text-[10px] font-bold uppercase tracking-widest mt-1 ${isActive ? 'text-zinc-600' : 'text-zinc-400'}`}>
                  {card.label}
                </p>
                {card.subLabel && (
                  <p className={`text-[10px] mt-0.5 ${isActive ? 'text-zinc-500' : 'text-zinc-300'}`}>{card.subLabel}</p>
                )}
              </button>
            );
          })}
        </div>

        {/* Contenu GPS — connecté aux onglets */}
        <div className="bg-gray-50 border-x border-b border-gray-200 rounded-b-3xl p-5">
          <RaceGPXSection
            trackGeoJSON={r.track_geojson}
            elevationProfile={r.elevation_profile}
            activeSegment={activeSegment}
            onSegmentChange={setActiveSegment}
            hideDisciplineButtons
            noOuterWrapper
            disciplines={{
              swim: {
                type: r.swim_type,
                isWetsuitAllowed: r.is_wetsuit_allowed,
                cutoffMinutes: r.swim_cutoff_minutes,
                timeLimitHours: r.time_limit_hours,
                distanceM: selectedFormat?.swim ?? r.swim_distance,
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
                distanceM: selectedFormat?.run ?? r.run_distance,
              },
            }}
          />
        </div>
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
