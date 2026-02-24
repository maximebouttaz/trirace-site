/**
 * Géocode les courses sans coordonnées GPS dans Supabase.
 *
 * - Utilise Mapbox Geocoding API si NEXT_PUBLIC_MAPBOX_TOKEN est défini (10 req/s en parallèle)
 * - Fallback sur Photon (OpenStreetMap, sans clé, 5 req/s)
 * - Groupe par villes uniques pour éviter les requêtes dupliquées
 * - Met à jour toutes les courses d'une ville en une seule requête SQL
 *
 * Usage : npx tsx scripts/geocode.ts
 * Requis : SUPABASE_SERVICE_KEY dans .env.local (pour bypasser la RLS)
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load .env.local manually (dotenv not required)
try {
  const envPath = resolve(process.cwd(), '.env.local');
  const lines = readFileSync(envPath, 'utf-8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (key && !(key in process.env)) process.env[key] = value;
  }
} catch {}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ SUPABASE_URL et SUPABASE_SERVICE_KEY requis dans .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// --- Geocoding ---

async function geocodeMapbox(city: string, country: string): Promise<{ lat: number; lng: number } | null> {
  const query = encodeURIComponent(`${city}, ${country}`);
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${query}.json?access_token=${MAPBOX_TOKEN}&types=place,locality,municipality&limit=1&language=fr`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    const f = data.features?.[0];
    if (f) return { lat: f.center[1], lng: f.center[0] };
  } catch {}
  return null;
}

async function geocodePhoton(city: string, country: string): Promise<{ lat: number; lng: number } | null> {
  const query = encodeURIComponent(`${city}, ${country}`);
  const url = `https://photon.komoot.io/api/?q=${query}&limit=1&lang=fr`;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'TriRace/1.0' } });
    const data = await res.json();
    const f = data.features?.[0];
    if (f) return { lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0] };
  } catch {}
  return null;
}

async function geocode(city: string, country: string) {
  // Try Photon first (no rate limit), fallback to Mapbox
  const photon = await geocodePhoton(city, country);
  if (photon) return photon;
  if (MAPBOX_TOKEN) return geocodeMapbox(city, country);
  return null;
}

// --- Concurrency helper ---

async function runBatches<T>(
  items: T[],
  fn: (item: T, index: number) => Promise<void>,
  concurrency: number
): Promise<void> {
  for (let i = 0; i < items.length; i += concurrency) {
    await Promise.all(items.slice(i, i + concurrency).map((item, j) => fn(item, i + j)));
  }
}

// --- Main ---

async function main() {
  const { data: races, error } = await supabase
    .from('races')
    .select('id, city, country')
    .is('latitude', null)
    .limit(5000);

  if (error || !races) {
    console.error('❌ Erreur Supabase:', error?.message);
    process.exit(1);
  }

  if (races.length === 0) {
    console.log('✓ Toutes les courses sont déjà géocodées.');
    return;
  }

  // Group by unique city+country to avoid duplicate requests
  const cityMap = new Map<string, number[]>();
  for (const r of races) {
    const key = `${r.city}||${r.country}`;
    if (!cityMap.has(key)) cityMap.set(key, []);
    cityMap.get(key)!.push(r.id);
  }

  const entries = [...cityMap.entries()];
  const uniqueCount = entries.length;
  const provider = 'Photon (OpenStreetMap)';
  const concurrency = 5;

  console.log(`📍 ${races.length} courses sans coordonnées`);
  console.log(`🌍 ${uniqueCount} villes uniques à géocoder (${provider}, ${concurrency} en parallèle)`);
  console.log('');

  let done = 0;
  let failed = 0;

  await runBatches(
    entries,
    async ([key, ids]) => {
      const [city, country] = key.split('||');
      const coords = await geocode(city, country);

      if (coords) {
        const { error: updateError } = await supabase
          .from('races')
          .update({ latitude: coords.lat, longitude: coords.lng })
          .in('id', ids);

        if (!updateError) {
          done += ids.length;
        } else {
          failed += ids.length;
        }
      } else {
        failed += ids.length;
      }

      process.stdout.write(
        `\r  ✓ ${done} géocodées  ✗ ${failed} échouées  (${done + failed}/${races.length} traitées)   `
      );
    },
    concurrency
  );

  console.log(`\n\n✓ Terminé : ${done} courses géocodées, ${failed} sans résultat.`);
}

main().catch((e) => {
  console.error('❌', e);
  process.exit(1);
});
