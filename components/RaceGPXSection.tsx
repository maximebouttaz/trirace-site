'use client';

import { useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { MapPin, Waves, Bike, Activity } from 'lucide-react';

const RaceTrackMap = dynamic(() => import('@/components/RaceTrackMap'), { ssr: false });
const ElevationProfile = dynamic(() => import('@/components/ElevationProfile'), { ssr: false });

type Segment = 'swim' | 'bike' | 'run';

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
  swim?: { type?: string | null; isWetsuitAllowed?: boolean | null; cutoffMinutes?: number | null; timeLimitHours?: number | null };
  bike?: { type?: string | null; cutoffMinutes?: number | null; timeLimitHours?: number | null; elevationM?: number | null; distanceM?: number | null };
  run?: { cutoffMinutes?: number | null; timeLimitHours?: number | null; laps?: number | null };
}

interface RaceGPXSectionProps {
  trackGeoJSON?: SegmentedTrack | Record<string, unknown> | null;
  elevationProfile?: SegmentedElevation | Array<{ distance: number; elevation: number }> | null;
  disciplines: DisciplineData;
}

function isLegacyFormat(obj: Record<string, unknown>): boolean {
  return obj.type === 'LineString' || obj.type === 'Feature' || obj.type === 'FeatureCollection';
}

function formatCutoff(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h${m > 0 ? String(m).padStart(2, '0') : ''}`;
}

function formatDistance(meters: number): string {
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)}km` : `${meters}m`;
}

export default function RaceGPXSection({ trackGeoJSON, elevationProfile, disciplines }: RaceGPXSectionProps) {
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

  const [activeSegment, setActiveSegment] = useState<Segment>('swim');

  const activeTrack = normalizedTrack[activeSegment];
  const activeElevation = normalizedElevation?.[activeSegment];
  const activeConfig = SEGMENT_CONFIG.find((s) => s.key === activeSegment)!;
  const hasAnyGPS = Object.keys(normalizedTrack).length > 0;

  return (
    <section className="bg-gray-50 p-6 rounded-3xl border border-gray-200">
      {hasAnyGPS && (
        <h3 className="font-bold text-zinc-900 mb-4 flex items-center gap-2">
          <MapPin size={18} className="text-red-500" aria-hidden="true" /> Parcours GPS
        </h3>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        {SEGMENT_CONFIG.map((seg) => {
          const isActive = seg.key === activeSegment;
          const Icon = seg.icon;
          return (
            <button
              key={seg.key}
              onClick={() => setActiveSegment(seg.key)}
              className={`
                inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium
                border-2 transition-all
                ${isActive ? seg.activeClass : 'border-transparent text-zinc-400 hover:text-zinc-600 hover:bg-gray-100'}
              `}
            >
              <Icon size={14} aria-hidden="true" />
              {seg.label}
            </button>
          );
        })}
      </div>

      {/* Map (GPS only) */}
      {activeTrack && (
        <div className="h-64 w-full rounded-2xl overflow-hidden mb-4">
          <RaceTrackMap
            key={activeSegment}
            trackGeoJSON={activeTrack as unknown as GeoJSON.LineString}
            lineColor={activeConfig.lineColor}
          />
        </div>
      )}

      {/* Elevation profile (GPS only) */}
      {activeElevation && activeElevation.length > 0 && (
        <div className="mb-4">
          <ElevationProfile data={activeElevation} accentColor={activeConfig.lineColor} />
        </div>
      )}

      {/* Bike SVG fallback when no GPS but elevation data exists */}
      {activeSegment === 'bike' && !activeTrack && disciplines.bike?.elevationM && disciplines.bike.elevationM > 0 && (
        <div className="mb-4">
          <p className="text-xs text-zinc-400 font-bold mb-2">Profil Velo ({disciplines.bike.elevationM}m D+)</p>
          <div className="h-40 w-full relative">
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
              <div className="flex justify-between text-xs text-zinc-500 font-mono mt-2">
                <span>0km</span>
                <span>{formatDistance(disciplines.bike.distanceM)}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Discipline details */}
      <div className="border-t border-gray-200 pt-4 space-y-2">
        {activeSegment === 'swim' && (
          <>
            {disciplines.swim?.type && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-500">Type</span>
                <span className="text-sm font-bold text-zinc-900 capitalize">{disciplines.swim.type}</span>
              </div>
            )}
            {disciplines.swim?.isWetsuitAllowed != null && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-500">Combinaison</span>
                <span className="text-sm font-bold text-zinc-900">{disciplines.swim.isWetsuitAllowed ? 'Autorisée' : 'Non autorisée'}</span>
              </div>
            )}
            {disciplines.swim?.cutoffMinutes ? (
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-500">Barrière</span>
                <span className="text-sm font-mono font-bold text-zinc-900">{formatCutoff(disciplines.swim.cutoffMinutes)}</span>
              </div>
            ) : disciplines.swim?.timeLimitHours ? (
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-500">Barrière totale</span>
                <span className="text-sm font-mono font-bold text-zinc-900">{disciplines.swim.timeLimitHours}h</span>
              </div>
            ) : null}
            {!disciplines.swim?.type && disciplines.swim?.isWetsuitAllowed == null && !disciplines.swim?.cutoffMinutes && !disciplines.swim?.timeLimitHours && (
              <p className="text-sm text-zinc-400 italic">Non renseigné</p>
            )}
          </>
        )}

        {activeSegment === 'bike' && (
          <>
            {disciplines.bike?.type && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-500">Type</span>
                <span className="text-sm font-bold text-zinc-900 capitalize">{disciplines.bike.type}</span>
              </div>
            )}
            {disciplines.bike?.cutoffMinutes ? (
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-500">Barrière</span>
                <span className="text-sm font-mono font-bold text-zinc-900">{formatCutoff(disciplines.bike.cutoffMinutes)}</span>
              </div>
            ) : disciplines.bike?.timeLimitHours ? (
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-500">Barrière totale</span>
                <span className="text-sm font-mono font-bold text-zinc-900">{disciplines.bike.timeLimitHours}h</span>
              </div>
            ) : null}
            {!disciplines.bike?.type && !disciplines.bike?.cutoffMinutes && !disciplines.bike?.timeLimitHours && (
              <p className="text-sm text-zinc-400 italic">Non renseigné</p>
            )}
          </>
        )}

        {activeSegment === 'run' && (
          <>
            {disciplines.run?.laps && disciplines.run.laps > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-500">Boucles</span>
                <span className="text-sm font-bold text-zinc-900">{disciplines.run.laps} {disciplines.run.laps > 1 ? 'boucles' : 'boucle'}</span>
              </div>
            )}
            {disciplines.run?.cutoffMinutes ? (
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-500">Barrière</span>
                <span className="text-sm font-mono font-bold text-zinc-900">{formatCutoff(disciplines.run.cutoffMinutes)}</span>
              </div>
            ) : disciplines.run?.timeLimitHours ? (
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-500">Barrière totale</span>
                <span className="text-sm font-mono font-bold text-zinc-900">{disciplines.run.timeLimitHours}h</span>
              </div>
            ) : null}
            {!disciplines.run?.laps && !disciplines.run?.cutoffMinutes && !disciplines.run?.timeLimitHours && (
              <p className="text-sm text-zinc-400 italic">Non renseigné</p>
            )}
          </>
        )}
      </div>
    </section>
  );
}
