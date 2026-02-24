'use client';

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

interface CompareContextValue {
  slugs: string[];
  addRace: (slug: string) => void;
  removeRace: (slug: string) => void;
  clearAll: () => void;
  isSelected: (slug: string) => boolean;
  isFull: boolean;
}

const CompareContext = createContext<CompareContextValue | null>(null);

const MAX_COMPARE = 3;

export function CompareProvider({ children }: { children: ReactNode }) {
  const [slugs, setSlugs] = useState<string[]>([]);

  const addRace = useCallback((slug: string) => {
    setSlugs((prev) => {
      if (prev.includes(slug) || prev.length >= MAX_COMPARE) return prev;
      return [...prev, slug];
    });
  }, []);

  const removeRace = useCallback((slug: string) => {
    setSlugs((prev) => prev.filter((s) => s !== slug));
  }, []);

  const clearAll = useCallback(() => setSlugs([]), []);

  const isSelected = useCallback(
    (slug: string) => slugs.includes(slug),
    [slugs]
  );

  return (
    <CompareContext.Provider
      value={{ slugs, addRace, removeRace, clearAll, isSelected, isFull: slugs.length >= MAX_COMPARE }}
    >
      {children}
    </CompareContext.Provider>
  );
}

export function useCompare() {
  const ctx = useContext(CompareContext);
  if (!ctx) throw new Error('useCompare must be used within CompareProvider');
  return ctx;
}
