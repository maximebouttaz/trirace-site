'use client';

import { useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { MapPin, Waves, Bike, Activity } from 'lucide-react';

const RaceTrackMap = dynamic(() => import('@/components/RaceTrackMap'), { ssr: false });
const ElevationProfile = dynamic(() => import('@/components/ElevationProfile'), { ssr: false });

export type Segment = 'swim' | 'bike' | 'run';

const SEGMENT_CONFIG: { key: Segment; label: string; icon: typeof Waves; activeClass: string; lineColor: string }[] = [
  { key: 'swim', label: 'Natation',      icon: Waves,    activeClass: 'border-cyan-500 text-cyan-700 bg-cyan-50',   lineColor: '#06b6d4' },
  { key: 'bike', label: 'Vélo',          icon: Bike,     activeClass: 'border-red-500 text-red-700 bg-red-50',     lineColor: '#dc2626' },
  { key: 'run',  label: 'Course à pied', icon: Activity, activeClass: 'border-amber-500 text-amber-700 bg-amber-50', lineColor: '#d97706' },
];

interface SegmentedTrack {
  swim?: Record<string, unknown>;
  bike?: Record<string, unknown>;
  run?: Record<string, unknown>;
}

interface SegmentedElevation {
  swim?: Array<{ distance: number; elevation: number }>;
  bike?: Array<{ distance: number; elevation: number }>;
  run?: Array<{ distance: number; elevation: number }>;
}

export interface DisciplineData {
  swim?: { type?: string | null; isWetsuitAllowed?: boolean | null; cutoffMinutes?: number | null; timeLimitHours?: number | null; distanceM?: number | null };
  bike?: { type?: string | null; cutoffMinutes?: number | null; timeLimitHours?: number | null; elevationM?: number | null; distanceM?: number | null };
  run?: { cutoffMinutes?: number | null; timeLimitHours?: number | null; laps?: number | null; distanceM?: number | null };
}

interface RaceGPXSectionProps {
  trackGeoJSON?: SegmentedTrack | Record<string, unknown> | null;
  elevationProfile?: SegmentedElevation | Array<{ distance: number; elevation: number }> | null;
  disciplines: DisciplineData;
  activeSegment?: Segment;
  onSegmentChange?: (segment: Segment) => void;
  /** Hide the discipline buttons (rendered externally) */
  hideDisciplineButtons?: boolean;
  /** Skip outer container — parent provides its own wrapper */
  noOuterWrapper?: boolean;
}

function isLegacyFormat(obj: Record<string, unknown>): boolean {
  return obj.type === 'LineString' || obj.type === 'Feature' || obj.type === 'FeatureCollection';
}


function formatDistance(meters: number): string {
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)}km` : `${meters}m`;
}

export default function RaceGPXSection({ trackGeoJSON, elevationProfile, disciplines, activeSegment: controlledSegment, onSegmentChange, hideDisciplineButtons, noOuterWrapper }: RaceGPXSectionProps) {
  const normalizedTrack = useMemo((): SegmentedTrack => {
    if (!trackGeoJSON) return {};
    if (isLegacyFormat(trackGeoJSON as Record<string, unknown>)) {
      return { bike: trackGeoJSON as Record<string, unknown> };
    }
    return trackGeoJSON as SegmentedTrack;
  }, [trackGeoJSON]);

  const normalizedElevation = useMemo((): SegmentedElevation | null => {
    if (!elevationProfile) return null;
    if (Array.isArray(elevationProfile)) return { bike: elevationProfile };
    return elevationProfile as SegmentedElevation;
  }, [elevationProfile]);

  const [internalSegment, setInternalSegment] = useState<Segment>('swim');
  const activeSegment = controlledSegment ?? internalSegment;
  const setActiveSegment = (s: Segment) => {
    setInternalSegment(s);
    onSegmentChange?.(s);
  };

  const activeTrack = normalizedTrack[activeSegment];
  const activeElevation = normalizedElevation?.[activeSegment];
  const activeConfig = SEGMENT_CONFIG.find((s) => s.key === activeSegment)!;
  const hasAnyGPS = Object.keys(normalizedTrack).length > 0;

  // Helper : sous-label par discipline
  function swimSubLabel(): string | null {
    if (!disciplines.swim) return null;
    if (disciplines.swim.type) return disciplines.swim.type.charAt(0).toUpperCase() + disciplines.swim.type.slice(1);
    return null;
  }
  function bikeSubLabel(): string | null {
    const parts: string[] = [];
    if (disciplines.bike?.type) parts.push(disciplines.bike.type.charAt(0).toUpperCase() + disciplines.bike.type.slice(1));
    if (disciplines.bike?.elevationM && disciplines.bike.elevationM > 0) parts.push(`${disciplines.bike.elevationM}m D+`);
    return parts.length > 0 ? parts.join(' · ') : null;
  }
  function runSubLabel(): string | null {
    if (disciplines.run?.laps && disciplines.run.laps > 0) {
      return `${disciplines.run.laps} ${disciplines.run.laps > 1 ? 'boucles' : 'boucle'}`;
    }
    return null;
  }

  const disciplineCards = [
    {
      key: 'swim' as Segment,
      label: 'Natation',
      icon: Waves,
      distanceM: disciplines.swim?.distanceM ?? null,
      subLabel: swimSubLabel(),
      iconBg: 'bg-blue-500',
      activeBg: 'bg-blue-50',
      activeBorder: 'border-blue-300',
      activeText: 'text-blue-700',
      activeSubText: 'text-blue-500',
    },
    {
      key: 'bike' as Segment,
      label: 'Vélo',
      icon: Bike,
      distanceM: disciplines.bike?.distanceM ?? null,
      subLabel: bikeSubLabel(),
      iconBg: 'bg-orange-500',
      activeBg: 'bg-orange-50',
      activeBorder: 'border-orange-300',
      activeText: 'text-orange-700',
      activeSubText: 'text-orange-500',
    },
    {
      key: 'run' as Segment,
      label: 'Course à pied',
      icon: Activity,
      distanceM: disciplines.run?.distanceM ?? null,
      subLabel: runSubLabel(),
      iconBg: 'bg-emerald-500',
      activeBg: 'bg-emerald-50',
      activeBorder: 'border-emerald-300',
      activeText: 'text-emerald-700',
      activeSubText: 'text-emerald-500',
    },
  ];

  const innerContent = (
    <>
      {hasAnyGPS && !noOuterWrapper && (
        <h3 className="font-bold text-zinc-900 mb-4 flex items-center gap-2">
          <MapPin size={18} className="text-red-500" aria-hidden="true" /> Parcours GPS
        </h3>
      )}

      <div className={hideDisciplineButtons ? 'space-y-3' : 'grid grid-cols-1 md:grid-cols-2 gap-5'}>
        {/* Colonne gauche — carte + dénivelé */}
        <div className="flex flex-col gap-3">
          {activeTrack ? (
            <div className="h-56 w-full rounded-2xl overflow-hidden">
              <RaceTrackMap
                key={activeSegment}
                trackGeoJSON={activeTrack as unknown as GeoJSON.LineString}
                lineColor={activeConfig.lineColor}
              />
            </div>
          ) : (
            <div className="h-56 w-full rounded-2xl bg-gray-200 flex items-center justify-center">
              <span className="text-sm text-zinc-400">Pas de tracé GPS</span>
            </div>
          )}

          {activeElevation && activeElevation.length > 0 && (
            <ElevationProfile data={activeElevation} accentColor={activeConfig.lineColor} />
          )}

          {/* Bike SVG fallback */}
          {activeSegment === 'bike' && !activeTrack && disciplines.bike?.elevationM && disciplines.bike.elevationM > 0 && (
            <div>
              <p className="text-xs text-zinc-400 font-bold mb-2">Profil Vélo ({disciplines.bike.elevationM}m D+)</p>
              <div className="h-32 w-full relative">
                <svg viewBox="0 0 100 30" className="w-full h-full" preserveAspectRatio="none">
                  <path d="M0 25 L 10 25 L 30 5 L 50 15 L 70 2 L 90 25 L 100 25" fill="none" stroke="#a1a1aa" strokeWidth="2" />
                  <path d="M0 25 L 10 25 L 30 5 L 50 15 L 70 2 L 90 25 L 100 25 V 30 H 0 Z" fill="url(#zinc-grad)" className="opacity-20" />
                  <defs>
                    <linearGradient id="zinc-grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#a1a1aa" stopOpacity="0.5" />
                      <stop offset="100%" stopColor="#a1a1aa" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                </svg>
                {disciplines.bike.distanceM && (
                  <div className="flex justify-between text-xs text-zinc-500 font-mono mt-1">
                    <span>0km</span>
                    <span>{formatDistance(disciplines.bike.distanceM)}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Colonne droite — cartes disciplines cliquables */}
        {!hideDisciplineButtons && (
          <div className="flex flex-col gap-3">
            {disciplineCards.map((card) => {
              const Icon = card.icon;
              const isActive = activeSegment === card.key;
              const hasTrack = !!normalizedTrack[card.key];
              return (
                <button
                  key={card.key}
                  onClick={() => setActiveSegment(card.key)}
                  className={`
                    flex items-center gap-4 p-4 rounded-2xl border-2 text-left transition-all
                    ${isActive
                      ? `${card.activeBg} ${card.activeBorder}`
                      : 'bg-white border-gray-200 hover:border-gray-300'}
                  `}
                >
                  <span className={`w-11 h-11 rounded-xl ${card.iconBg} flex items-center justify-center shrink-0`}>
                    <Icon size={18} className="text-white" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className={`font-bold text-sm leading-none mb-1 ${isActive ? card.activeText : 'text-zinc-800'}`}>
                      {card.label}
                      {hasTrack && (
                        <span className={`ml-2 text-[10px] font-bold uppercase tracking-wider ${isActive ? card.activeSubText : 'text-zinc-400'}`}>GPS</span>
                      )}
                    </p>
                    <p className={`text-sm font-mono font-bold ${isActive ? card.activeText : 'text-zinc-900'}`}>
                      {card.distanceM ? formatDistance(card.distanceM) : '—'}
                      {card.subLabel && (
                        <span className={`ml-1.5 text-xs font-normal ${isActive ? card.activeSubText : 'text-zinc-400'}`}>
                          · {card.subLabel}
                        </span>
                      )}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </>
  );

  if (noOuterWrapper) return innerContent;

  return (
    <section className="bg-gray-50 p-6 rounded-3xl border border-gray-200">
      {innerContent}
    </section>
  );
}
