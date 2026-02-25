'use client';

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import Map, { Source, Layer, Popup, NavigationControl } from 'react-map-gl/mapbox';
import type { MapRef, MapMouseEvent } from 'react-map-gl/mapbox';
import type { Race } from '@/lib/types';
import { formatDistance, formatDate, categoryLabel, categoryHexColor } from '@/lib/utils';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';

/** Threshold in degrees (~100m) to group races at the same location */
const SAME_LOCATION_THRESHOLD = 0.001;

export default function RaceMap({
  races,
  focusSlug,
}: {
  races: Race[];
  focusSlug?: string | null;
}) {
  const mapRef = useRef<MapRef>(null);
  const [popupRaces, setPopupRaces] = useState<Race[]>([]);
  const [popupIndex, setPopupIndex] = useState(0);

  const currentRace = popupRaces[popupIndex] ?? null;

  /** Find all races near given coordinates */
  const getRacesAtLocation = useCallback(
    (lat: number, lng: number) => {
      return races.filter(
        (r) =>
          r.latitude != null &&
          r.longitude != null &&
          Math.abs(r.latitude - lat) < SAME_LOCATION_THRESHOLD &&
          Math.abs(r.longitude - lng) < SAME_LOCATION_THRESHOLD
      );
    },
    [races]
  );

  // Build GeoJSON from races
  const geojson = useMemo(
    () => ({
      type: 'FeatureCollection' as const,
      features: races
        .filter((r) => r.latitude != null && r.longitude != null)
        .map((r) => ({
          type: 'Feature' as const,
          properties: {
            slug: r.slug,
            name: r.name,
            category: r.category,
            date: r.date,
            city: r.city,
            country: r.country,
            total_distance: r.total_distance,
            color: categoryHexColor(r.category),
          },
          geometry: {
            type: 'Point' as const,
            coordinates: [r.longitude!, r.latitude!],
          },
        })),
    }),
    [races]
  );

  // Focus on slug when it changes
  useEffect(() => {
    if (focusSlug && mapRef.current) {
      const race = races.find((r) => r.slug === focusSlug);
      if (race?.latitude && race?.longitude) {
        mapRef.current.flyTo({
          center: [race.longitude, race.latitude],
          zoom: 10,
          duration: 1000,
        });
        const nearby = getRacesAtLocation(race.latitude, race.longitude);
        const idx = nearby.findIndex((r) => r.slug === focusSlug);
        setPopupRaces(nearby);
        setPopupIndex(idx >= 0 ? idx : 0);
      }
    }
  }, [focusSlug, races, getRacesAtLocation]);

  const handleClick = useCallback(
    (e: MapMouseEvent) => {
      const feature = e.features?.[0];
      if (!feature) {
        setPopupRaces([]);
        setPopupIndex(0);
        return;
      }

      // Cluster click → zoom in
      if (feature.properties?.cluster) {
        const clusterId = feature.properties.cluster_id;
        const source = mapRef.current?.getSource('races') as any;
        source?.getClusterExpansionZoom(clusterId, (err: any, zoom: number) => {
          if (!err && mapRef.current) {
            mapRef.current.flyTo({
              center: (feature.geometry as any).coordinates,
              zoom,
              duration: 500,
            });
          }
        });
        return;
      }

      // Single point → find all races at this location
      const slug = feature.properties?.slug;
      const race = races.find((r) => r.slug === slug);
      if (race?.latitude != null && race?.longitude != null) {
        const nearby = getRacesAtLocation(race.latitude, race.longitude);
        const idx = nearby.findIndex((r) => r.slug === slug);
        setPopupRaces(nearby);
        setPopupIndex(idx >= 0 ? idx : 0);
      }
    },
    [races, getRacesAtLocation]
  );

  if (!MAPBOX_TOKEN) {
    return (
      <div className="h-full w-full rounded-2xl bg-gray-100 flex items-center justify-center">
        <p className="text-zinc-400 text-sm text-center px-8">
          Ajoutez <code className="bg-gray-200 px-1 rounded">NEXT_PUBLIC_MAPBOX_TOKEN</code> dans <code className="bg-gray-200 px-1 rounded">.env.local</code>
        </p>
      </div>
    );
  }

  return (
    <Map
      ref={mapRef}
      initialViewState={{
        longitude: 2.2,
        latitude: 46.6,
        zoom: 5.5,
      }}
      style={{ width: '100%', height: '100%' }}
      mapStyle="mapbox://styles/mapbox/light-v11"
      mapboxAccessToken={MAPBOX_TOKEN}
      interactiveLayerIds={['clusters', 'unclustered-point']}
      onClick={handleClick}
    >
      <NavigationControl position="top-right" />

      <Source
        id="races"
        type="geojson"
        data={geojson}
        cluster={true}
        clusterMaxZoom={14}
        clusterRadius={50}
      >
        {/* Cluster circles */}
        <Layer
          id="clusters"
          type="circle"
          filter={['has', 'point_count']}
          paint={{
            'circle-color': '#ef4444',
            'circle-radius': ['step', ['get', 'point_count'], 18, 10, 24, 50, 32],
            'circle-opacity': 0.9,
            'circle-stroke-width': 2,
            'circle-stroke-color': '#ffffff',
          }}
        />

        {/* Cluster count labels */}
        <Layer
          id="cluster-count"
          type="symbol"
          filter={['has', 'point_count']}
          layout={{
            'text-field': '{point_count_abbreviated}',
            'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
            'text-size': 13,
          }}
          paint={{
            'text-color': '#ffffff',
          }}
        />

        {/* Individual points */}
        <Layer
          id="unclustered-point"
          type="circle"
          filter={['!', ['has', 'point_count']]}
          paint={{
            'circle-color': ['get', 'color'],
            'circle-radius': 7,
            'circle-stroke-width': 2,
            'circle-stroke-color': '#ffffff',
          }}
        />
      </Source>

      {currentRace && currentRace.latitude && currentRace.longitude && (
        <Popup
          latitude={currentRace.latitude}
          longitude={currentRace.longitude}
          onClose={() => {
            setPopupRaces([]);
            setPopupIndex(0);
          }}
          closeOnClick={false}
          anchor="bottom"
          offset={12}
        >
          <div className="min-w-[220px]">
            <div className="font-bold text-zinc-900 text-sm mb-1">{currentRace.name}</div>
            <div className="flex items-center gap-2 mb-2">
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  currentRace.category === 'Ironman'
                    ? 'bg-red-100 text-red-700'
                    : currentRace.category === 'M'
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-blue-100 text-blue-700'
                }`}
              >
                {categoryLabel(currentRace.category)}
              </span>
              <span className="text-xs text-zinc-500">{formatDate(currentRace.date)}</span>
            </div>
            <div className="text-xs text-zinc-500 mb-2">
              {currentRace.city}, {currentRace.country}
            </div>
            {currentRace.total_distance && (
              <div className="text-xs text-zinc-600 mb-2">
                Distance : {formatDistance(currentRace.total_distance)}
              </div>
            )}
            <Link
              href={`/courses/${currentRace.slug}`}
              className="inline-block text-xs font-bold text-red-500 hover:text-red-600"
            >
              Voir la fiche →
            </Link>

            {/* Pagination */}
            {popupRaces.length > 1 && (
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-200 -mx-1">
                <button
                  onClick={() => setPopupIndex((i) => (i - 1 + popupRaces.length) % popupRaces.length)}
                  className="p-1 rounded-lg hover:bg-gray-100 text-zinc-400 hover:text-zinc-700 transition"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="text-[11px] font-mono text-zinc-400">
                  {popupIndex + 1} / {popupRaces.length}
                </span>
                <button
                  onClick={() => setPopupIndex((i) => (i + 1) % popupRaces.length)}
                  className="p-1 rounded-lg hover:bg-gray-100 text-zinc-400 hover:text-zinc-700 transition"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </div>
        </Popup>
      )}
    </Map>
  );
}
