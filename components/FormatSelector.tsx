'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Waves, Bike, Activity, Mountain, Euro } from 'lucide-react';
import type { Race } from '@/lib/types';
import { formatDistance, categoryLabel } from '@/lib/utils';

type Format = NonNullable<Race['formats']>[number];

interface FormatSelectorProps {
  formats: Race['formats'];
  swimDistance: number | null;
  bikeDistance: number | null;
  runDistance: number | null;
  totalElevation: number | null;
  priceEuros: number | null;
  tagline?: string | null;
  // Nouveaux — optionnels pour rétro-compatibilité
  selectedIndex?: number;
  onSelect?: (index: number) => void;
}

export default function FormatSelector({
  formats,
  swimDistance,
  bikeDistance,
  runDistance,
  totalElevation,
  priceEuros,
  tagline,
  selectedIndex: controlledIndex,
  onSelect,
}: FormatSelectorProps) {
  const sortByDistance = (a: Format, b: Format) => (a.total ?? 0) - (b.total ?? 0);
  const nonRelayFormats = (formats?.filter((f) => !f.is_relay) ?? []).sort(sortByDistance);
  const hasMultiple = nonRelayFormats.length >= 2;
  const relayFormats = (formats?.filter((f) => f.is_relay) ?? []).sort(sortByDistance);
  const allFormats = [...nonRelayFormats, ...relayFormats];

  const [internalIndex, setInternalIndex] = useState(0);
  const selectedIndex = controlledIndex ?? internalIndex;
  const setSelectedIndex = (i: number) => {
    setInternalIndex(i);
    onSelect?.(i);
  };

  // Liquid pill indicator — two-phase stretch & settle
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const pillRef = useRef<HTMLDivElement>(null);
  const prevIndexRef = useRef(selectedIndex);
  const isFirstRender = useRef(true);
  const settleTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const getButtonRect = useCallback((index: number) => {
    const btn = buttonRefs.current[index];
    const container = containerRef.current;
    if (!btn || !container) return null;
    const cRect = container.getBoundingClientRect();
    const bRect = btn.getBoundingClientRect();
    return { left: bRect.left - cRect.left, width: bRect.width };
  }, []);

  // Initial position (no animation)
  useEffect(() => {
    const rect = getButtonRect(selectedIndex);
    if (rect && pillRef.current) {
      pillRef.current.style.transition = 'none';
      pillRef.current.style.left = `${rect.left}px`;
      pillRef.current.style.width = `${rect.width}px`;
      isFirstRender.current = false;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Liquid animation on index change
  useEffect(() => {
    if (isFirstRender.current) return;
    const prev = prevIndexRef.current;
    prevIndexRef.current = selectedIndex;
    if (prev === selectedIndex) return;

    const pill = pillRef.current;
    if (!pill) return;

    const prevRect = getButtonRect(prev);
    const nextRect = getButtonRect(selectedIndex);
    if (!prevRect || !nextRect) return;

    // Phase 1: stretch — pill expands to cover both old & new positions
    const stretchLeft = Math.min(prevRect.left, nextRect.left);
    const stretchRight = Math.max(prevRect.left + prevRect.width, nextRect.left + nextRect.width);
    pill.style.transition = 'left 180ms cubic-bezier(0.4, 0, 0.2, 1), width 180ms cubic-bezier(0.4, 0, 0.2, 1)';
    pill.style.left = `${stretchLeft}px`;
    pill.style.width = `${stretchRight - stretchLeft}px`;

    // Phase 2: settle — pill contracts to the target
    clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => {
      pill.style.transition = 'left 260ms cubic-bezier(0.0, 0.7, 0.3, 1), width 260ms cubic-bezier(0.0, 0.7, 0.3, 1)';
      pill.style.left = `${nextRect.left}px`;
      pill.style.width = `${nextRect.width}px`;
    }, 160);

    return () => clearTimeout(settleTimer.current);
  }, [selectedIndex, getButtonRect]);

  // Recalculate on resize
  useEffect(() => {
    const onResize = () => {
      const rect = getButtonRect(selectedIndex);
      if (rect && pillRef.current) {
        pillRef.current.style.transition = 'none';
        pillRef.current.style.left = `${rect.left}px`;
        pillRef.current.style.width = `${rect.width}px`;
      }
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [selectedIndex, getButtonRect]);

  // Resolve displayed values
  let swim: number | null;
  let bike: number | null;
  let run: number | null;
  let elevation: number | null;
  let price: number | null;

  if (hasMultiple && allFormats[selectedIndex]) {
    const fmt = allFormats[selectedIndex];
    swim = fmt.swim;
    bike = fmt.bike;
    run = fmt.run;
    elevation = fmt.elevation ?? totalElevation;
    price = fmt.price;
  } else if (allFormats.length === 1) {
    const fmt = allFormats[0];
    swim = fmt.swim ?? swimDistance;
    bike = fmt.bike ?? bikeDistance;
    run = fmt.run ?? runDistance;
    elevation = fmt.elevation ?? totalElevation;
    price = fmt.price ?? priceEuros;
  } else {
    swim = swimDistance;
    bike = bikeDistance;
    run = runDistance;
    elevation = totalElevation;
    price = priceEuros;
  }

  const showPrice = hasMultiple && price != null;

  return (
    <div>
      {/* En-tête — affiché seulement si plusieurs formats non-relay */}
      {hasMultiple && (
        <div className="mb-6">
          <h2 className="text-2xl font-black text-zinc-900 mb-2">Choisissez votre défi</h2>
          {tagline && (
            <p className="text-sm text-zinc-500 leading-relaxed">{tagline}</p>
          )}
        </div>
      )}

      {/* Pills — nouveau style unifié */}
      {allFormats.length >= 1 && (
        <div className="mb-5">
          {hasMultiple ? (
            <div
              ref={containerRef}
              className="relative inline-flex gap-1 bg-gray-100 rounded-2xl p-1 max-w-full overflow-x-auto scrollbar-hide"
            >
              {/* Liquid sliding indicator */}
              <div
                ref={pillRef}
                className="absolute top-1 h-[calc(100%-8px)] bg-white rounded-xl shadow-sm pointer-events-none"
              />
              {allFormats.map((fmt, i) => (
                <button
                  key={i}
                  ref={(el) => { buttonRefs.current[i] = el; }}
                  onClick={() => setSelectedIndex(i)}
                  className={`relative z-10 px-3 sm:px-5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-colors duration-200 whitespace-nowrap ${
                    i === selectedIndex
                      ? 'text-zinc-900'
                      : 'text-zinc-500 hover:text-zinc-700'
                  }`}
                >
                  {fmt.name || categoryLabel(fmt.category)}
                  {fmt.is_relay && (
                    <span className="ml-1.5 text-[10px] opacity-60 uppercase">Relais</span>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <span className="inline-block px-5 py-2 rounded-xl text-sm font-bold bg-white border border-gray-200 text-zinc-700 shadow-sm">
              {allFormats[0]?.name || categoryLabel(allFormats[0]?.category)}
              {allFormats[0]?.is_relay && (
                <span className="ml-1.5 text-[10px] opacity-60 uppercase">Relais</span>
              )}
            </span>
          )}
        </div>
      )}

      {/* Stats secondaires — dénivelé + prix */}
      {((elevation != null && elevation > 0) || showPrice) && (
        <div className="flex gap-8 mt-1">
          {elevation != null && elevation > 0 && (
            <div>
              <p className="text-2xl font-mono font-black text-zinc-900 leading-none">{elevation}<span className="text-base">m</span></p>
              <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mt-1">Dénivelé D+</p>
            </div>
          )}
          {showPrice && (
            <div>
              <p className="text-2xl font-mono font-black text-zinc-900 leading-none">{price}<span className="text-base">€</span></p>
              <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mt-1">Inscription</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
