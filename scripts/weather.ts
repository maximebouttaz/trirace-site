/**
 * Enrichit les courses TriRace avec des données météo historiques via Open-Meteo Archive API.
 *
 * - Remplit avg_temp_celsius et avg_wind_kmh pour chaque course ayant latitude + longitude + date
 * - Si la date est dans le futur, calcule la moyenne sur les 3 dernières années à la même date
 * - avg_water_temp_celsius est laissé NULL (pas d'API fiable gratuite)
 * - Traitement par batch de 10 en parallèle (Open-Meteo est généreux)
 *
 * Usage : npx tsx scripts/weather.ts
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

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ SUPABASE_URL et SUPABASE_SERVICE_KEY requis dans .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// --- Open-Meteo ---

const OPEN_METEO_BASE = 'https://archive-api.open-meteo.com/v1/archive';

interface OpenMeteoResponse {
  daily: {
    time: string[];
    temperature_2m_mean: (number | null)[];
    windspeed_10m_max: (number | null)[];
  };
}

/**
 * Fetches temperature_2m_mean and windspeed_10m_max for a given date and location.
 * Returns null values if the API call fails or data is missing.
 */
async function fetchWeatherForDate(
  lat: number,
  lng: number,
  date: string // YYYY-MM-DD
): Promise<{ temp: number | null; wind: number | null }> {
  const url =
    `${OPEN_METEO_BASE}` +
    `?latitude=${lat}` +
    `&longitude=${lng}` +
    `&start_date=${date}` +
    `&end_date=${date}` +
    `&daily=temperature_2m_mean,windspeed_10m_max` +
    `&timezone=Europe%2FParis`;

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'TriRace/1.0 (trirace.fr)' },
    });

    if (!res.ok) return { temp: null, wind: null };

    const data: OpenMeteoResponse = await res.json();
    const temp = data.daily?.temperature_2m_mean?.[0] ?? null;
    const wind = data.daily?.windspeed_10m_max?.[0] ?? null;

    return { temp, wind };
  } catch {
    return { temp: null, wind: null };
  }
}

/**
 * Returns the date string YYYY-MM-DD shifted by the given number of years (negative = past).
 */
function shiftYear(date: string, years: number): string {
  const d = new Date(date);
  d.setFullYear(d.getFullYear() + years);
  return d.toISOString().slice(0, 10);
}

/**
 * For a past date, fetches weather directly.
 * For a future date, averages over the 3 preceding years at the same calendar date.
 *
 * Open-Meteo archive only covers up to ~5 days ago, so any date after
 * TODAY_MINUS_5 is considered "future" and handled with historical averaging.
 */
async function getWeather(
  lat: number,
  lng: number,
  date: string // YYYY-MM-DD
): Promise<{ temp: number | null; wind: number | null }> {
  const today = new Date();
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() - 5); // archive lag ~5 days

  const raceDate = new Date(date);

  if (raceDate <= cutoff) {
    // Past date: fetch directly
    return fetchWeatherForDate(lat, lng, date);
  }

  // Future date: average over the last 3 years at the same calendar date
  const years = [-1, -2, -3];
  const results = await Promise.all(
    years.map((offset) => fetchWeatherForDate(lat, lng, shiftYear(date, offset)))
  );

  const validTemps = results.map((r) => r.temp).filter((v): v is number => v !== null);
  const validWinds = results.map((r) => r.wind).filter((v): v is number => v !== null);

  const avg = (arr: number[]) =>
    arr.length > 0 ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : null;

  return {
    temp: avg(validTemps),
    wind: avg(validWinds),
  };
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

interface RaceRow {
  id: number;
  slug: string;
  date: string;
  latitude: number;
  longitude: number;
}

async function main() {
  // Fetch courses with geo + date but without weather data yet
  const { data: races, error } = await supabase
    .from('races')
    .select('id, slug, date, latitude, longitude')
    .not('latitude', 'is', null)
    .not('longitude', 'is', null)
    .not('date', 'is', null)
    .is('avg_temp_celsius', null)
    .limit(5000);

  if (error || !races) {
    console.error('❌ Erreur Supabase:', error?.message);
    process.exit(1);
  }

  if (races.length === 0) {
    console.log('✓ Toutes les courses éligibles ont déjà des données météo.');
    return;
  }

  const total = races.length;
  console.log(`🌤  ${total} courses à enrichir avec la météo`);
  console.log(`📡 Source : Open-Meteo Archive API (gratuite, sans clé)`);
  console.log(`⚡ Concurrence : 10 requêtes en parallèle`);
  console.log('');

  let done = 0;
  let failed = 0;

  const CONCURRENCY = 10;

  await runBatches(
    races as RaceRow[],
    async (race) => {
      const { temp, wind } = await getWeather(race.latitude, race.longitude, race.date);

      if (temp === null && wind === null) {
        failed++;
        process.stdout.write(
          `\r  ✓ ${done} enrichies  ✗ ${failed} échouées  (${done + failed}/${total} traitées)   `
        );
        return;
      }

      const updatePayload: Record<string, number | null> = {
        avg_temp_celsius: temp,
        avg_wind_kmh: wind,
      };

      const { error: updateError } = await supabase
        .from('races')
        .update(updatePayload)
        .eq('id', race.id);

      if (updateError) {
        failed++;
      } else {
        done++;
      }

      process.stdout.write(
        `\r  ✓ ${done} enrichies  ✗ ${failed} échouées  (${done + failed}/${total} traitées)   `
      );
    },
    CONCURRENCY
  );

  console.log(`\n\n✓ Terminé : ${done} courses enrichies, ${failed} sans résultat.`);
}

main().catch((e) => {
  console.error('❌', e);
  process.exit(1);
});
