import { DOMParser } from '@xmldom/xmldom';
// @ts-expect-error — no type declarations for @mapbox/togeojson
import * as toGeoJSON from '@mapbox/togeojson';

interface ElevationPoint {
  distance: number; // cumulative distance in meters
  elevation: number; // altitude in meters
}

interface ParsedGPX {
  trackGeoJSON: GeoJSON.LineString;
  elevationProfile: ElevationPoint[];
}

/** Haversine distance between two points in meters */
function haversine(
  lat1: number, lon1: number,
  lat2: number, lon2: number,
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Sample every nth element to keep at most `maxPoints` */
function sampleArray<T>(arr: T[], maxPoints: number): T[] {
  if (arr.length <= maxPoints) return arr;
  const step = (arr.length - 1) / (maxPoints - 1);
  const result: T[] = [];
  for (let i = 0; i < maxPoints; i++) {
    result.push(arr[Math.round(i * step)]);
  }
  return result;
}

/**
 * Parse a GPX string into a GeoJSON LineString (for the map)
 * and an elevation profile array (for the chart).
 */
export function parseGPX(gpxString: string): ParsedGPX {
  const dom = new DOMParser().parseFromString(gpxString, 'text/xml');
  const geoJSON = toGeoJSON.gpx(dom);

  // Extract all LineString / MultiLineString coordinates
  let allCoords: number[][] = [];

  for (const feature of geoJSON.features) {
    const geom = feature.geometry;
    if (!geom) continue;

    if (geom.type === 'LineString') {
      allCoords.push(...geom.coordinates);
    } else if (geom.type === 'MultiLineString') {
      for (const segment of geom.coordinates) {
        allCoords.push(...segment);
      }
    }
  }

  if (allCoords.length === 0) {
    throw new Error('No track data found in GPX file.');
  }

  // Build elevation profile from all points (before sampling)
  const fullElevation: ElevationPoint[] = [];
  let cumDist = 0;

  for (let i = 0; i < allCoords.length; i++) {
    const [lon, lat, ele] = allCoords[i];
    if (i > 0) {
      const [prevLon, prevLat] = allCoords[i - 1];
      cumDist += haversine(prevLat, prevLon, lat, lon);
    }
    fullElevation.push({
      distance: Math.round(cumDist),
      elevation: Math.round(ele ?? 0),
    });
  }

  // Sample for map (~300 pts) and elevation (~200 pts)
  const sampledCoords = sampleArray(allCoords, 300);
  const sampledElevation = sampleArray(fullElevation, 200);

  const trackGeoJSON: GeoJSON.LineString = {
    type: 'LineString',
    coordinates: sampledCoords.map(([lon, lat, ele]) => [
      Math.round(lon * 1e6) / 1e6,
      Math.round(lat * 1e6) / 1e6,
      ...(ele != null ? [Math.round(ele)] : []),
    ]),
  };

  return { trackGeoJSON, elevationProfile: sampledElevation };
}
