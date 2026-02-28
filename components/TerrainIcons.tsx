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

/* ——— Swim : lac, mer, ocean, riviere, baie ——— */
const SWIM_MAP: Record<string, { img: string; label: string }> = {
  lac:     { img: '/Icon/lake.svg',   label: 'Lac' },
  lake:    { img: '/Icon/lake.svg',   label: 'Lac' },
  mer:     { img: '/Icon/ocean.svg',  label: 'Mer' },
  ocean:   { img: '/Icon/ocean.svg',  label: 'Océan' },
  riviere: { img: '/Icon/river.svg',  label: 'Rivière' },
  river:   { img: '/Icon/river.svg',  label: 'Rivière' },
  baie:    { img: '/Icon/bay.svg',    label: 'Baie' },
  bay:     { img: '/Icon/bay.svg',    label: 'Baie' },
};

/* ——— Bike & Run : flat, hilly, rolling ——— */
const TERRAIN_MAP: Record<string, { img: string; label: string }> = {
  flat:    { img: '/Icon/flat_0.svg',    label: 'Plat' },
  hilly:   { img: '/Icon/hilly.svg',     label: 'Vallonné' },
  rolling: { img: '/Icon/rolling_0.svg', label: 'Roulant' },
};

export default function TerrainIcons({ swimType, bikeType, runType }: TerrainIconsProps) {
  const swim  = swimType  ? SWIM_MAP[swimType.toLowerCase()]    : null;
  const bike  = bikeType  ? TERRAIN_MAP[bikeType.toLowerCase()] : null;
  const run   = runType   ? TERRAIN_MAP[runType.toLowerCase()]  : null;

  if (!swim && !bike && !run) return null;

  return (
    <div className="flex items-center justify-start gap-8 md:gap-12 pb-6 pt-2">
      {swim && (
        <div className="flex items-center gap-3">
          <Image src={swim.img} alt={swim.label} width={48} height={48} className="w-12 h-12 opacity-60" />
          <div>
            <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">Swim</p>
            <p className="text-sm font-bold text-zinc-700">{swim.label}</p>
          </div>
        </div>
      )}
      {bike && (
        <div className="flex items-center gap-3">
          <Image src={bike.img} alt={bike.label} width={48} height={48} className="w-12 h-12 opacity-60" />
          <div>
            <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">Bike</p>
            <p className="text-sm font-bold text-zinc-700">{bike.label}</p>
          </div>
        </div>
      )}
      {run && (
        <div className="flex items-center gap-3">
          <Image src={run.img} alt={run.label} width={48} height={48} className="w-12 h-12 opacity-60" />
          <div>
            <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">Run</p>
            <p className="text-sm font-bold text-zinc-700">{run.label}</p>
          </div>
        </div>
      )}
    </div>
  );
}
