'use client';

import { X, Thermometer } from 'lucide-react';
import RangeSlider from '@/components/RangeSlider';

export type TempPreset = 'hot' | 'pleasant' | 'cool' | 'cold' | null;

const TEMP_PRESETS: { key: TempPreset; label: string; icon: string }[] = [
  { key: 'hot', label: 'Chaud', icon: '🔥' },
  { key: 'pleasant', label: 'Agréable', icon: '☀️' },
  { key: 'cool', label: 'Frais', icon: '🌤️' },
  { key: 'cold', label: 'Froid', icon: '❄️' },
];

export interface AdvancedFiltersState {
  priceRange: [number, number];
  distanceRange: [number, number];
  elevationRange: [number, number];
  tempPreset: TempPreset;
  region: string;
  dateFrom: string;
  dateTo: string;
  swimType: string;
  wetsuit: boolean | null;
  label: string;
}

export const DEFAULT_ADVANCED: AdvancedFiltersState = {
  priceRange: [0, 500],
  distanceRange: [0, 250],
  elevationRange: [0, 5000],
  tempPreset: null,
  region: '',
  dateFrom: '',
  dateTo: '',
  swimType: '',
  wetsuit: null,
  label: '',
};

export function countActiveAdvanced(s: AdvancedFiltersState): number {
  let n = 0;
  if (s.priceRange[0] !== 0 || s.priceRange[1] !== 500) n++;
  if (s.distanceRange[0] !== 0 || s.distanceRange[1] !== 250) n++;
  if (s.elevationRange[0] !== 0 || s.elevationRange[1] !== 5000) n++;
  if (s.tempPreset) n++;
  if (s.region) n++;
  if (s.dateFrom || s.dateTo) n++;
  if (s.swimType) n++;
  if (s.wetsuit !== null) n++;
  if (s.label) n++;
  return n;
}

export default function AdvancedFilters({
  open,
  filters,
  onChange,
  onClear,
  regions,
}: {
  open: boolean;
  filters: AdvancedFiltersState;
  onChange: (f: AdvancedFiltersState) => void;
  onClear: () => void;
  regions: string[];
}) {
  const set = <K extends keyof AdvancedFiltersState>(key: K, val: AdvancedFiltersState[K]) =>
    onChange({ ...filters, [key]: val });

  return (
    <div
      className="grid transition-all duration-300 ease-in-out"
      style={{ gridTemplateRows: open ? '1fr' : '0fr' }}
    >
      <div className="overflow-hidden">
        <div className="pt-4 pb-2">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Price */}
            <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3 block">
                Prix
              </label>
              <RangeSlider
                min={0}
                max={500}
                step={10}
                value={filters.priceRange}
                onChange={(v) => set('priceRange', v)}
                formatLabel={(v) => `${v}€`}
              />
            </div>

            {/* Distance */}
            <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3 block">
                Distance totale
              </label>
              <RangeSlider
                min={0}
                max={250}
                step={5}
                value={filters.distanceRange}
                onChange={(v) => set('distanceRange', v)}
                formatLabel={(v) => `${v}km`}
              />
            </div>

            {/* Elevation */}
            <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3 block">
                Dénivelé
              </label>
              <RangeSlider
                min={0}
                max={5000}
                step={100}
                value={filters.elevationRange}
                onChange={(v) => set('elevationRange', v)}
                formatLabel={(v) => `${v}m`}
              />
            </div>

            {/* Temperature */}
            <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Thermometer size={12} />
                Température
              </label>
              <div className="flex flex-wrap gap-2">
                {TEMP_PRESETS.map((p) => (
                  <button
                    key={p.key}
                    onClick={() => set('tempPreset', filters.tempPreset === p.key ? null : p.key)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      filters.tempPreset === p.key
                        ? 'bg-zinc-900 text-white shadow-md'
                        : 'bg-white border border-gray-200 text-zinc-500 hover:bg-gray-100'
                    }`}
                  >
                    <span aria-hidden="true">{p.icon}</span> {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Region */}
            <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3 block">
                Région / Département
              </label>
              <select
                value={filters.region}
                onChange={(e) => set('region', e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-sm bg-white border border-gray-200 text-zinc-700 focus:ring-2 focus:ring-red-500/30 focus:border-red-500/50 outline-none transition appearance-none cursor-pointer"
              >
                <option value="">Toutes les régions</option>
                {regions.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            {/* Date range */}
            <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3 block">
                Période
              </label>
              <div className="flex gap-2">
                <input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) => set('dateFrom', e.target.value)}
                  className="flex-1 px-3 py-2 rounded-xl text-sm bg-white border border-gray-200 text-zinc-700 focus:ring-2 focus:ring-red-500/30 focus:border-red-500/50 outline-none transition"
                />
                <input
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) => set('dateTo', e.target.value)}
                  className="flex-1 px-3 py-2 rounded-xl text-sm bg-white border border-gray-200 text-zinc-700 focus:ring-2 focus:ring-red-500/30 focus:border-red-500/50 outline-none transition"
                />
              </div>
            </div>

            {/* Swim type */}
            <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3 block">
                Type de natation
              </label>
              <select
                value={filters.swimType}
                onChange={(e) => set('swimType', e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-sm bg-white border border-gray-200 text-zinc-700 focus:ring-2 focus:ring-red-500/30 focus:border-red-500/50 outline-none transition appearance-none cursor-pointer"
              >
                <option value="">Toutes</option>
                <option value="lac">Lac</option>
                <option value="mer">Mer</option>
                <option value="rivière">Rivière</option>
                <option value="piscine">Piscine</option>
                <option value="open water">Open water</option>
              </select>
            </div>

            {/* Wetsuit */}
            <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3 block">
                Règles de course
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() =>
                    set('wetsuit', filters.wetsuit === true ? null : true)
                  }
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    filters.wetsuit === true
                      ? 'bg-zinc-900 text-white shadow-md'
                      : 'bg-white border border-gray-200 text-zinc-500 hover:bg-gray-100'
                  }`}
                >
                  Combinaison autorisée
                </button>
              </div>
            </div>

            {/* Label */}
            <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3 block">
                Label
              </label>
              <select
                value={filters.label}
                onChange={(e) => set('label', e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-sm bg-white border border-gray-200 text-zinc-700 focus:ring-2 focus:ring-red-500/30 focus:border-red-500/50 outline-none transition appearance-none cursor-pointer"
              >
                <option value="">Tous</option>
                <option value="Ironman">Ironman</option>
                <option value="Challenge">Challenge</option>
                <option value="70.3">70.3</option>
                <option value="FFTRI">FFTRI</option>
                <option value="Triworld">Triworld</option>
              </select>
            </div>
          </div>

          {/* Clear button */}
          <div className="mt-4 flex justify-end">
            <button
              onClick={onClear}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-zinc-500 hover:text-zinc-900 hover:bg-gray-100 transition"
            >
              <X size={14} />
              Tout effacer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
