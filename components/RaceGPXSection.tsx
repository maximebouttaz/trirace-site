'use client';

import { useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { MapPin, Waves, Bike, Activity } from 'lucide-react';

const RaceTrackMap = dynamic(() => import('@/components/RaceTrackMap'), { ssr: false });
const ElevationProfile = dynamic(() => import('@/components/ElevationProfile'), { ssr: false });

type Segment = 'swim' | 'bike' | 'run';

const SEGMENT_CONFIG: { key: Segment; label: string; icon: typeof Waves; activeClass: string; lineColor: string }[] = [
  { key: 'swim', label: 'Natation', icon: Waves, activeClass: 'border-cyan-500 text-cyan-700 bg-cyan-50', lineColor: '#06b6d4' },
  { key: 'bike', label: 'Vélo', icon: Bike, activeClass: 'border-red-500 text-red-700 bg-red-50', lineColor: '#dc2626' },
  { key: 'run', label: 'Course à pied', icon: Activity, activeClass: 'border-amber-500 text-amber-700 bg-amber-50', lineColor: '#d97706' },
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

interface RaceGPXSectionProps {
  trackGeoJSON: SegmentedTrack | Record<string, unknown>;
  elevationProfile?: SegmentedElevation | Array<{ distance: number; elevation: number }> | null;
}

/** Detect old flat format (raw GeoJSON LineString) vs new segmented format */
function isLegacyFormat(obj: Record<string, unknown>): boolean {
  return obj.type === 'LineString' || obj.type === 'Feature' || obj.type === 'FeatureCollection';
}

export default function RaceGPXSection({ trackGeoJSON, elevationProfile }: RaceGPXSectionProps) {
  // Normalize: old flat format → wrap as bike segment
  const normalizedTrack = useMemo((): SegmentedTrack => {
    if (isLegacyFormat(trackGeoJSON as Record<string, unknown>)) {
      return { bike: trackGeoJSON as Record<string, unknown> };
    }
    return trackGeoJSON as SegmentedTrack;
  }, [trackGeoJSON]);

  const normalizedElevation = useMemo((): SegmentedElevation | null => {
    if (!elevationProfile) return null;
    if (Array.isArray(elevationProfile)) {
      return { bike: elevationProfile };
    }
    return elevationProfile as SegmentedElevation;
  }, [elevationProfile]);

  const availableSegments = useMemo(() => {
    return SEGMENT_CONFIG.filter((seg) => normalizedTrack[seg.key]);
  }, [normalizedTrack]);

  const [activeSegment, setActiveSegment] = useState<Segment>(
    availableSegments[0]?.key ?? 'bike',
  );

  if (availableSegments.length === 0) return null;

  const activeTrack = normalizedTrack[activeSegment];
  const activeElevation = normalizedElevation?.[activeSegment];
  const activeConfig = SEGMENT_CONFIG.find((s) => s.key === activeSegment)!;

  return (
    <section className="bg-gray-50 p-6 rounded-3xl border border-gray-200">
      <h3 className="font-bold text-zinc-900 mb-4 flex items-center gap-2">
        <MapPin size={18} className="text-red-500" /> Parcours GPS
      </h3>

      {/* Segment tabs */}
      {availableSegments.length > 1 && (
        <div className="flex gap-2 mb-4">
          {availableSegments.map((seg) => {
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
                <Icon size={14} />
                {seg.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Map */}
      {activeTrack && (
        <div className="h-64 w-full rounded-2xl overflow-hidden mb-4">
          <RaceTrackMap
            key={activeSegment}
            trackGeoJSON={activeTrack as unknown as GeoJSON.LineString}
            lineColor={activeConfig.lineColor}
          />
        </div>
      )}

      {/* Elevation profile */}
      {activeElevation && activeElevation.length > 0 && (
        <ElevationProfile data={activeElevation} accentColor={activeConfig.lineColor} />
      )}
    </section>
  );
}
