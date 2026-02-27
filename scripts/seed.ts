/**
 * Seed — Insère les courses depuis scripts/data/races.json dans Supabase.
 *
 * Usage :
 *   npx tsx scripts/seed.ts
 *   npx tsx scripts/seed.ts --clear   # vide la table avant l'insertion
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ SUPABASE_URL et SUPABASE_SERVICE_KEY requis.');
  console.error('   Définis-les dans scripts/.env ou .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Colonnes valides de la table races
const VALID_COLUMNS = new Set([
  'slug', 'name', 'date', 'location', 'city', 'department', 'region', 'country',
  'latitude', 'longitude', 'discipline', 'category',
  'swim_distance', 'bike_distance', 'run_distance', 'total_distance',
  'bike_elevation', 'run_elevation', 'total_elevation',
  'price_euros', 'max_participants', 'time_limit_hours',
  'description', 'tagline', 'image_gradient', 'image_url',
  'avg_temp_high_celsius', 'avg_temp_low_celsius', 'avg_water_temp_celsius', 'avg_wind_kmh',
  'record_men', 'record_women', 'tags',
  'website_url', 'finishers_url', 'status',
]);

// Gradients Tailwind pour les catégories
const GRADIENTS: Record<string, string[]> = {
  XS: [
    'bg-gradient-to-br from-zinc-400 to-zinc-600',
    'bg-gradient-to-br from-slate-400 to-slate-600',
  ],
  S: [
    'bg-gradient-to-br from-amber-400 to-orange-600',
    'bg-gradient-to-br from-yellow-400 to-amber-600',
    'bg-gradient-to-br from-orange-400 to-red-500',
  ],
  M: [
    'bg-gradient-to-br from-emerald-400 to-teal-600',
    'bg-gradient-to-br from-green-400 to-emerald-600',
    'bg-gradient-to-br from-teal-400 to-cyan-600',
  ],
  L: [
    'bg-gradient-to-br from-indigo-400 to-blue-600',
    'bg-gradient-to-br from-blue-400 to-indigo-600',
  ],
  '70.3': [
    'bg-gradient-to-br from-blue-500 to-purple-600',
    'bg-gradient-to-br from-sky-400 to-blue-600',
  ],
  XL: [
    'bg-gradient-to-br from-purple-500 to-pink-600',
    'bg-gradient-to-br from-violet-400 to-purple-600',
  ],
  Ironman: [
    'bg-gradient-to-br from-red-500 to-rose-700',
    'bg-gradient-to-br from-red-600 to-orange-500',
    'bg-gradient-to-br from-rose-500 to-red-700',
  ],
};

function assignGradient(category: string, index: number): string {
  const options = GRADIENTS[category] || GRADIENTS.M;
  return options[index % options.length];
}

async function main() {
  const clearFirst = process.argv.includes('--clear');

  // Lire le JSON
  const dataPath = join(__dirname, 'data', 'races.json');
  let races: Record<string, unknown>[];
  try {
    races = JSON.parse(readFileSync(dataPath, 'utf-8'));
  } catch {
    console.error(`❌ Impossible de lire ${dataPath}`);
    console.error('   Lance d\'abord : python3 scripts/export_json.py');
    process.exit(1);
  }

  console.log(`📦 ${races.length} courses à insérer depuis races.json`);

  if (clearFirst) {
    console.log('🗑️  Suppression des courses existantes...');
    const { error } = await supabase.from('races').delete().neq('id', 0);
    if (error) {
      console.error('❌ Erreur suppression :', error.message);
      process.exit(1);
    }
  }

  let inserted = 0;
  let updated = 0;
  let errors = 0;

  // Insérer par batch de 50
  const BATCH_SIZE = 50;
  for (let i = 0; i < races.length; i += BATCH_SIZE) {
    const batch = races.slice(i, i + BATCH_SIZE).map((race, batchIdx) => {
      // Filtrer les colonnes invalides
      const clean: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(race)) {
        if (VALID_COLUMNS.has(k) && v !== null && v !== undefined) {
          clean[k] = v;
        }
      }

      // Assigner un gradient si absent
      if (!clean.image_gradient) {
        clean.image_gradient = assignGradient(
          (clean.category as string) || 'M',
          i + batchIdx
        );
      }

      // S'assurer du status published
      if (!clean.status) {
        clean.status = 'published';
      }

      return clean;
    });

    const { data, error } = await supabase
      .from('races')
      .upsert(batch, { onConflict: 'slug' })
      .select('id');

    if (error) {
      console.error(`  ✗ Batch ${i}-${i + batch.length}: ${error.message}`);
      errors += batch.length;
    } else {
      const count = data?.length || batch.length;
      inserted += count;
      process.stdout.write(`\r  ✓ ${inserted} courses traitées...`);
    }
  }

  console.log(`\n\n${'='.repeat(50)}`);
  console.log(`  ✓ ${inserted} courses insérées/mises à jour`);
  if (errors > 0) console.log(`  ✗ ${errors} erreurs`);
  console.log(`${'='.repeat(50)}`);
}

main().catch((e) => {
  console.error('❌ Erreur fatale :', e);
  process.exit(1);
});
