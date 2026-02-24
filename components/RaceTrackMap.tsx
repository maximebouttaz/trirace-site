'use client';

import { useRef, useEffect } from 'react';
import Map, { Source, Layer, NavigationControl } from 'react-map-gl/mapbox';
import type { MapRef } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';

interface RaceTrackMapProps {
  trackGeoJSON: GeoJSON.LineString;
  lineColor?: string;
}

export default function RaceTrackMap({ trackGeoJSON, lineColor = '#dc2626' }: RaceTrackMapProps) {
  const mapRef = useRef<MapRef>(null);

  // Fit bounds to the track on mount
  useEffect(() => {
    if (!mapRef.current || !trackGeoJSON.coordinates.length) return;

    let minLng = Infinity, maxLng = -Infinity;
    let minLat = Infinity, maxLat = -Infinity;

    for (const coord of trackGeoJSON.coordinates) {
      const [lng, lat] = coord;
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }

    mapRef.current.fitBounds(
      [[minLng, minLat], [maxLng, maxLat]],
      { padding: 40, duration: 0 },
    );
  }, [trackGeoJSON]);

  if (!MAPBOX_TOKEN) {
    return (
      <div className="h-full w-full rounded-2xl bg-gray-100 flex items-center justify-center">
        <p className="text-zinc-400 text-sm text-center px-8">
          Ajoutez <code className="bg-gray-200 px-1 rounded">NEXT_PUBLIC_MAPBOX_TOKEN</code> dans <code className="bg-gray-200 px-1 rounded">.env.local</code>
        </p>
      </div>
    );
  }

  const startCoord = trackGeoJSON.coordinates[0];
  const endCoord = trackGeoJSON.coordinates[trackGeoJSON.coordinates.length - 1];

  const markersGeoJSON: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: { type: 'start' },
        geometry: { type: 'Point', coordinates: startCoord.slice(0, 2) },
      },
      {
        type: 'Feature',
        properties: { type: 'end' },
        geometry: { type: 'Point', coordinates: endCoord.slice(0, 2) },
      },
    ],
  };

  return (
    <Map
      ref={mapRef}
      initialViewState={{
        longitude: startCoord[0],
        latitude: startCoord[1],
        zoom: 11,
      }}
      style={{ width: '100%', height: '100%' }}
      mapStyle="mapbox://styles/mapbox/outdoors-v12"
      mapboxAccessToken={MAPBOX_TOKEN}
    >
      <NavigationControl position="top-right" />

      {/* Track line */}
      <Source id="track" type="geojson" data={trackGeoJSON}>
        <Layer
          id="track-line"
          type="line"
          paint={{
            'line-color': lineColor,
            'line-width': 3,
            'line-opacity': 0.85,
          }}
          layout={{
            'line-join': 'round',
            'line-cap': 'round',
          }}
        />
      </Source>

      {/* Start / End markers */}
      <Source id="markers" type="geojson" data={markersGeoJSON}>
        <Layer
          id="marker-start"
          type="circle"
          filter={['==', ['get', 'type'], 'start']}
          paint={{
            'circle-color': '#16a34a',
            'circle-radius': 7,
            'circle-stroke-width': 2,
            'circle-stroke-color': '#ffffff',
          }}
        />
        <Layer
          id="marker-end"
          type="circle"
          filter={['==', ['get', 'type'], 'end']}
          paint={{
            'circle-color': '#dc2626',
            'circle-radius': 7,
            'circle-stroke-width': 2,
            'circle-stroke-color': '#ffffff',
          }}
        />
      </Source>
    </Map>
  );
}
