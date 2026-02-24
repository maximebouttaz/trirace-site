'use client';

import { Suspense, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Search, Map, List, ChevronLeft, ChevronRight } from 'lucide-react';
import RaceCard from '@/components/RaceCard';
import RaceFilters, { type CategoryFilter, type SortOption } from '@/components/RaceFilters';
import AdvancedFilters, {
  type AdvancedFiltersState,
  DEFAULT_ADVANCED,
  countActiveAdvanced,
} from '@/components/AdvancedFilters';
import type { Race } from '@/lib/types';

const PAGE_SIZE = 24;

const RaceMap = dynamic(() => import('@/components/RaceMap'), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full bg-gray-100 animate-pulse flex items-center justify-center">
      <span className="text-zinc-400 text-sm">Chargement de la carte...</span>
    </div>
  ),
});

export default function CoursesPage() {
  return (
    <Suspense fallback={
      <div className="px-6 md:px-10 py-10">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold text-zinc-900 mb-2">Toutes les courses</h1>
          <p className="text-zinc-400 text-sm">Chargement...</p>
        </div>
      </div>
    }>
      <CoursesContent />
    </Suspense>
  );
}

function buildFilterParams(
  activeCategory: CategoryFilter,
  advanced: AdvancedFiltersState,
  search: string = '',
  sort: SortOption = 'date_asc',
): URLSearchParams {
  const params = new URLSearchParams();
  if (activeCategory !== 'all') params.set('category', activeCategory);
  if (advanced.region) params.set('region', advanced.region);
  if (advanced.priceRange[0] !== 0) params.set('price_min', String(advanced.priceRange[0]));
  if (advanced.priceRange[1] !== 500) params.set('price_max', String(advanced.priceRange[1]));
  if (advanced.distanceRange[0] !== 0) params.set('dist_min', String(advanced.distanceRange[0]));
  if (advanced.distanceRange[1] !== 250) params.set('dist_max', String(advanced.distanceRange[1]));
  if (advanced.elevationRange[0] !== 0) params.set('elev_min', String(advanced.elevationRange[0]));
  if (advanced.elevationRange[1] !== 5000) params.set('elev_max', String(advanced.elevationRange[1]));
  if (advanced.dateFrom) params.set('date_from', advanced.dateFrom);
  if (advanced.dateTo) params.set('date_to', advanced.dateTo);
  if (advanced.tempPreset) params.set('temp', advanced.tempPreset);
  if (advanced.swimType) params.set('swim_type', advanced.swimType);
  if (advanced.wetsuit) params.set('wetsuit', 'true');
  if (advanced.label) params.set('label', advanced.label);
  if (search.trim()) params.set('search', search.trim());
  if (sort !== 'date_asc') params.set('sort', sort);
  return params;
}

function Pagination({
  page,
  totalPages,
  total,
  pageSize,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onPageChange: (p: number) => void;
}) {
  if (totalPages <= 1) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  // Up to 5 page numbers centered around current page
  const half = 2;
  let start = Math.max(1, page - half);
  let end = Math.min(totalPages, page + half);
  if (end - start < 4) {
    if (start === 1) end = Math.min(totalPages, start + 4);
    else start = Math.max(1, end - 4);
  }
  const pages: number[] = [];
  for (let i = start; i <= end; i++) pages.push(i);

  return (
    <div className="flex flex-col items-center gap-4 py-6 border-t border-gray-200 mt-2">
      <p className="text-xs text-zinc-500">
        Affichage de <span className="font-semibold text-zinc-700">{from}</span> à{' '}
        <span className="font-semibold text-zinc-700">{to}</span> sur{' '}
        <span className="font-semibold text-zinc-700">{total}</span> courses
      </p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          aria-label="Page précédente"
          className="flex items-center justify-center w-8 h-8 rounded-lg border border-gray-200 text-zinc-500 hover:border-gray-300 hover:text-zinc-900 transition disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronLeft size={15} />
        </button>

        {start > 1 && (
          <>
            <button
              onClick={() => onPageChange(1)}
              className="w-8 h-8 rounded-lg border border-gray-200 text-sm font-semibold text-zinc-600 hover:border-gray-300 hover:text-zinc-900 transition"
            >
              1
            </button>
            {start > 2 && <span className="px-1 text-zinc-400 text-sm select-none">…</span>}
          </>
        )}

        {pages.map((p) => (
          <button
            key={p}
            onClick={() => onPageChange(p)}
            className={`w-8 h-8 rounded-lg border text-sm font-semibold transition ${
              p === page
                ? 'bg-zinc-900 border-zinc-900 text-white'
                : 'border-gray-200 text-zinc-600 hover:border-gray-300 hover:text-zinc-900'
            }`}
          >
            {p}
          </button>
        ))}

        {end < totalPages && (
          <>
            {end < totalPages - 1 && <span className="px-1 text-zinc-400 text-sm select-none">…</span>}
            <button
              onClick={() => onPageChange(totalPages)}
              className="w-8 h-8 rounded-lg border border-gray-200 text-sm font-semibold text-zinc-600 hover:border-gray-300 hover:text-zinc-900 transition"
            >
              {totalPages}
            </button>
          </>
        )}

        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          aria-label="Page suivante"
          className="flex items-center justify-center w-8 h-8 rounded-lg border border-gray-200 text-zinc-500 hover:border-gray-300 hover:text-zinc-900 transition disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronRight size={15} />
        </button>
      </div>
    </div>
  );
}

function CoursesContent() {
  const searchParams = useSearchParams();
  const scrollRef = useRef<HTMLDivElement>(null);

  // — Paginated list state —
  const [races, setRaces] = useState<Race[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // — Geo state for map (full filtered set, independent of page) —
  const [geoRaces, setGeoRaces] = useState<Race[]>([]);
  const [focusSlug, setFocusSlug] = useState<string | null>(null);

  // — UI state —
  const [search, setSearch] = useState(() => searchParams.get('search') || '');
  const [showMap, setShowMap] = useState(false);
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>(() => {
    const param = searchParams.get('category');
    const valid: CategoryFilter[] = ['all', 'l', 'half', 'xl', 'ironman'];
    return valid.includes(param as CategoryFilter) ? (param as CategoryFilter) : 'all';
  });
  const [sort, setSort] = useState<SortOption>(() => {
    const s = searchParams.get('sort');
    const valid: SortOption[] = ['date_asc', 'date_desc', 'price_asc', 'elevation_desc'];
    return valid.includes(s as SortOption) ? (s as SortOption) : 'date_asc';
  });
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [advanced, setAdvanced] = useState<AdvancedFiltersState>(() => {
    const p = searchParams;
    return {
      priceRange: [Number(p.get('priceMin')) || 0, Number(p.get('priceMax')) || 500],
      distanceRange: [Number(p.get('distMin')) || 0, Number(p.get('distMax')) || 250],
      elevationRange: [Number(p.get('elevMin')) || 0, Number(p.get('elevMax')) || 5000],
      tempPreset: (p.get('temp') as AdvancedFiltersState['tempPreset']) || null,
      region: p.get('region') || '',
      dateFrom: p.get('dateFrom') || '',
      dateTo: p.get('dateTo') || '',
      swimType: p.get('swimType') || '',
      wetsuit: p.get('wetsuit') ? p.get('wetsuit') === 'true' : null,
      label: p.get('label') || '',
    };
  });

  // — Debounced values for API calls (avoids excessive requests during slider drag / typing) —
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const [debouncedAdvanced, setDebouncedAdvanced] = useState<AdvancedFiltersState>(advanced);

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedAdvanced(advanced); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [advanced]);

  // Sync filters to URL
  useEffect(() => {
    const params = new URLSearchParams();
    if (activeCategory !== 'all') params.set('category', activeCategory);
    if (sort !== 'date_asc') params.set('sort', sort);
    if (search.trim()) params.set('search', search.trim());
    if (advanced.priceRange[0] !== 0) params.set('priceMin', String(advanced.priceRange[0]));
    if (advanced.priceRange[1] !== 500) params.set('priceMax', String(advanced.priceRange[1]));
    if (advanced.distanceRange[0] !== 0) params.set('distMin', String(advanced.distanceRange[0]));
    if (advanced.distanceRange[1] !== 250) params.set('distMax', String(advanced.distanceRange[1]));
    if (advanced.elevationRange[0] !== 0) params.set('elevMin', String(advanced.elevationRange[0]));
    if (advanced.elevationRange[1] !== 5000) params.set('elevMax', String(advanced.elevationRange[1]));
    if (advanced.tempPreset) params.set('temp', advanced.tempPreset);
    if (advanced.region) params.set('region', advanced.region);
    if (advanced.dateFrom) params.set('dateFrom', advanced.dateFrom);
    if (advanced.dateTo) params.set('dateTo', advanced.dateTo);
    if (advanced.swimType) params.set('swimType', advanced.swimType);
    if (advanced.wetsuit) params.set('wetsuit', 'true');
    if (advanced.label) params.set('label', advanced.label);
    const qs = params.toString();
    window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname);
  }, [activeCategory, sort, search, advanced]);

  // Fetch paginated list — triggers on debounced filter OR page OR sort change
  useEffect(() => {
    async function fetchList() {
      setLoading(true);
      setError(false);

      const params = buildFilterParams(activeCategory, debouncedAdvanced, debouncedSearch, sort);
      params.set('page', String(page));
      params.set('limit', String(PAGE_SIZE));

      const res = await fetch(`/api/races?${params.toString()}`);
      if (!res.ok) {
        setError(true);
        setLoading(false);
        return;
      }

      const json = await res.json();

      if (Array.isArray(json)) {
        setRaces(json as Race[]);
        setTotal(json.length);
        setTotalPages(1);
      } else {
        setRaces((json.data ?? []) as Race[]);
        setTotal(json.total ?? 0);
        setTotalPages(json.totalPages ?? 1);
      }

      setLoading(false);
      scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    }
    fetchList();
  }, [activeCategory, debouncedAdvanced, page, debouncedSearch, sort]);

  // Fetch geo races — uses debounced filters, no pagination, no sort
  useEffect(() => {
    async function fetchGeo() {
      const params = buildFilterParams(activeCategory, debouncedAdvanced, debouncedSearch);
      params.set('geo', 'true');
      const res = await fetch(`/api/races?${params.toString()}`);
      if (!res.ok) return;
      const json = await res.json();
      setGeoRaces(Array.isArray(json) ? (json as Race[]) : ((json.data ?? []) as Race[]));
    }
    fetchGeo();
  }, [activeCategory, debouncedAdvanced, debouncedSearch]);

  // Reset page to 1 when filters change
  const handleCategoryChange = useCallback((cat: CategoryFilter) => {
    setPage(1);
    setActiveCategory(cat);
  }, []);

  const handleSortChange = useCallback((s: SortOption) => {
    setPage(1);
    setSort(s);
  }, []);

  // Slider-triggered: only update visual state immediately; debounce effect resets page + fires API
  const handleAdvancedChange = useCallback((next: AdvancedFiltersState) => {
    setAdvanced(next);
  }, []);

  const handleClearAdvanced = useCallback(() => {
    setAdvanced(DEFAULT_ADVANCED);
    setDebouncedAdvanced(DEFAULT_ADVANCED); // skip debounce for instant clear
    setPage(1);
  }, []);

  // Extract unique regions from geo set (full filtered set, not just current page)
  const regions = useMemo(() => {
    const set = new Set<string>();
    geoRaces.forEach((r) => {
      if (r.region) set.add(r.region);
      if (r.department) set.add(r.department);
    });
    return [...set].sort((a, b) => a.localeCompare(b, 'fr'));
  }, [geoRaces]);

  // All filtering and sorting is now server-side; races is already the final result
  const filtered = races;

  const activeAdvancedCount = countActiveAdvanced(advanced);

  const filtersAndHeader = (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-900 mb-1">Toutes les courses</h1>
        <p className="text-zinc-500 text-sm">
          {loading
            ? 'Chargement...'
            : `${total} course${total !== 1 ? 's' : ''} trouvée${total !== 1 ? 's' : ''}`}
        </p>
      </div>

      <div className="mb-6">
        <RaceFilters
          search={search}
          onSearchChange={setSearch}
          activeCategory={activeCategory}
          onCategoryChange={handleCategoryChange}
          sort={sort}
          onSortChange={handleSortChange}
          count={total}
          advancedOpen={advancedOpen}
          onToggleAdvanced={() => setAdvancedOpen(o => !o)}
          activeAdvancedCount={activeAdvancedCount}
        />
        <AdvancedFilters
          open={advancedOpen}
          filters={advanced}
          onChange={handleAdvancedChange}
          onClear={handleClearAdvanced}
          regions={regions}
        />
      </div>
    </>
  );

  const racesList = error ? (
    <div className="text-center py-20">
      <p className="text-zinc-500 text-sm">Impossible de charger les courses. Réessaie dans quelques instants.</p>
      <button
        onClick={() => window.location.reload()}
        className="mt-4 px-4 py-2 rounded-xl bg-gray-50 border border-gray-200 text-sm text-zinc-500 hover:border-gray-300 transition"
      >
        Réessayer
      </button>
    </div>
  ) : loading ? (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="animate-pulse bg-white rounded-2xl overflow-hidden shadow-md shadow-black/5 ring-1 ring-gray-200/60">
          <div className="h-48 bg-gray-100" />
          <div className="px-5 pt-4 pb-5 space-y-3">
            <div className="h-3 w-24 bg-gray-200 rounded" />
            <div className="h-5 w-3/4 bg-gray-200 rounded" />
            <div className="h-3 w-32 bg-gray-200 rounded" />
            <div className="bg-gray-100 rounded-xl h-16" />
            <div className="flex gap-4 pt-2 border-t border-gray-100">
              <div className="h-3 w-12 bg-gray-200 rounded" />
              <div className="h-3 w-12 bg-gray-200 rounded" />
              <div className="h-3 w-12 bg-gray-200 rounded" />
            </div>
          </div>
        </div>
      ))}
    </div>
  ) : filtered.length === 0 ? (
    <div className="text-center py-20">
      <Search size={48} className="mx-auto text-zinc-300 mb-4" />
      <h3 className="font-bold text-zinc-900 text-lg">Aucune course trouvée</h3>
      <p className="text-zinc-500 text-sm mt-2">Essaie un autre filtre ou une autre recherche.</p>
    </div>
  ) : (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filtered.map((race) => (
          <RaceCard
            key={race.id}
            race={race}
            onMouseEnter={() => setFocusSlug(race.slug)}
          />
        ))}
      </div>
      <Pagination
        page={page}
        totalPages={totalPages}
        total={total}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
      />
    </>
  );

  return (
    <>
      {/* Mobile toggle */}
      <div className="md:hidden flex items-center gap-2 px-4 py-2 bg-white border-b border-gray-200">
        <button
          onClick={() => setShowMap(false)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition ${
            !showMap ? 'bg-zinc-900 text-white' : 'text-zinc-500 hover:text-zinc-900'
          }`}
        >
          <List size={14} />
          Liste{!loading && total > 0 && ` (${total})`}
        </button>
        <button
          onClick={() => setShowMap(true)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition ${
            showMap ? 'bg-zinc-900 text-white' : 'text-zinc-500 hover:text-zinc-900'
          }`}
        >
          <Map size={14} />
          Carte
        </button>
      </div>

      {/* Desktop split layout */}
      <div className="hidden md:flex h-[calc(100vh-64px)]">
        {/* Left — 2/3 — scrollable */}
        <div ref={scrollRef} className="w-2/3 overflow-y-auto px-6 py-8 border-r border-gray-200">
          {filtersAndHeader}
          {racesList}
        </div>

        {/* Right — 1/3 — sticky map */}
        <div className="w-1/3 shrink-0">
          <RaceMap races={geoRaces} focusSlug={focusSlug} />
        </div>
      </div>

      {/* Mobile — list or map */}
      <div className="md:hidden">
        {showMap ? (
          <div className="h-[calc(100vh-64px-44px)]">
            <RaceMap races={geoRaces} focusSlug={focusSlug} />
          </div>
        ) : (
          <div className="px-4 py-6 pb-24">
            {filtersAndHeader}
            {racesList}
          </div>
        )}
      </div>
    </>
  );
}
