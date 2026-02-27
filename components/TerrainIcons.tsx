/**
 * Terrain type icons for swim, bike, and run disciplines.
 * Uses SVG files from public/Icon/.
 * Displayed between the hero and the main content on the race detail page.
 */

import Image from 'next/image';

interface TerrainIconsProps {
  swimType?: string | null;
  bikeType?: string | null;
  runType?: string | null;
}

/* ——— Mappings type → image path ——— */

const SWIM_IMAGES: Record<string, string> = {
  'Mer': '/Icon/ocean.svg',
  'Ocean': '/Icon/ocean.svg',
  'Océan': '/Icon/ocean.svg',
  'Lac': '/Icon/lake.svg',
  'Lake': '/Icon/lake.svg',
  'Rivière': '/Icon/river.svg',
  'River': '/Icon/river.svg',
  'Baie': '/Icon/bay.svg',
  'Bay': '/Icon/bay.svg',
};

const SWIM_LABELS: Record<string, string> = {
  'Mer': 'Mer',
  'Ocean': 'Océan',
  'Océan': 'Océan',
  'Lac': 'Lac',
  'Lake': 'Lac',
  'Rivière': 'Rivière',
  'River': 'Rivière',
  'Baie': 'Baie',
  'Bay': 'Baie',
};

const BIKE_IMAGES: Record<string, string> = {
  'Route': '/Icon/rolling_0.svg',
  'Roulant': '/Icon/rolling_0.svg',
  'Rolling': '/Icon/rolling_0.svg',
  'Plat': '/Icon/flat_0.svg',
  'Flat': '/Icon/flat_0.svg',
  'Vallonné': '/Icon/hilly.svg',
  'Vallonne': '/Icon/hilly.svg',
  'Hilly': '/Icon/hilly.svg',
  'Montagne': '/Icon/hilly.svg',
  'Mountain': '/Icon/hilly.svg',
};

const BIKE_LABELS: Record<string, string> = {
  'Route': 'Route',
  'Roulant': 'Roulant',
  'Rolling': 'Roulant',
  'Montagne': 'Montagne',
  'Mountain': 'Montagne',
  'Vallonné': 'Vallonné',
  'Vallonne': 'Vallonné',
  'Hilly': 'Vallonné',
  'Plat': 'Plat',
  'Flat': 'Plat',
};

const RUN_IMAGES = BIKE_IMAGES;
const RUN_LABELS = BIKE_LABELS;

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

export default function TerrainIcons({ swimType, bikeType, runType }: TerrainIconsProps) {
  const swimKey = swimType ? capitalize(swimType) : null;
  const bikeKey = bikeType ? capitalize(bikeType) : null;
  const runKey = runType ? capitalize(runType) : null;
  const swimImg = swimKey ? SWIM_IMAGES[swimKey] : null;
  const bikeImg = bikeKey ? BIKE_IMAGES[bikeKey] : null;
  const runImg = runKey ? RUN_IMAGES[runKey] : null;

  if (!swimImg && !bikeImg && !runImg) return null;

  return (
    <div className="flex items-center justify-center gap-8 md:gap-12 py-6">
      {swimImg && (
        <div className="flex items-center gap-3">
          <Image src={swimImg} alt={swimType ?? 'Swim'} width={48} height={48} className="w-12 h-12 opacity-60" />
          <div>
            <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">Swim</p>
            <p className="text-sm font-bold text-zinc-700">{SWIM_LABELS[swimKey!] ?? swimType}</p>
          </div>
        </div>
      )}

      {bikeImg && (
        <div className="flex items-center gap-3">
          <Image src={bikeImg} alt={bikeType ?? 'Bike'} width={48} height={48} className="w-12 h-12 opacity-60" />
          <div>
            <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">Bike</p>
            <p className="text-sm font-bold text-zinc-700">{BIKE_LABELS[bikeKey!] ?? bikeType}</p>
          </div>
        </div>
      )}

      {runImg && (
        <div className="flex items-center gap-3">
          <Image src={runImg} alt={runType ?? 'Run'} width={48} height={48} className="w-12 h-12 opacity-60" />
          <div>
            <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">Run</p>
            <p className="text-sm font-bold text-zinc-700">{RUN_LABELS[runKey!] ?? runType}</p>
          </div>
        </div>
      )}
    </div>
  );
}
