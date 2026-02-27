# Format Selector + GPX Section Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign the format selector (new pill style + title/tagline header) and the GPX section (2-column layout with clickable discipline cards).

**Architecture:** UI-only changes across 3 existing components. No new files, no DB migrations. `FormatSelector` gets a new pill style + optional header. `RaceGPXSection` gets a split layout where discipline cards replace the segment tabs. `RaceDetailBody` passes `distanceM` for swim and run.

**Tech Stack:** Next.js App Router, React 19, Tailwind CSS 4, Lucide React, TypeScript

---

### Task 1 : Ajouter `distanceM` à swim et run dans `RaceGPXSection`

**Files:**
- Modify: `components/RaceGPXSection.tsx:31-34`

**Step 1 : Étendre l'interface `DisciplineData`**

Localiser l'interface (ligne ~31) :
```ts
export interface DisciplineData {
  swim?: { type?: string | null; isWetsuitAllowed?: boolean | null; cutoffMinutes?: number | null; timeLimitHours?: number | null };
  bike?: { type?: string | null; cutoffMinutes?: number | null; timeLimitHours?: number | null; elevationM?: number | null; distanceM?: number | null };
  run?: { cutoffMinutes?: number | null; timeLimitHours?: number | null; laps?: number | null };
}
```

Remplacer par :
```ts
export interface DisciplineData {
  swim?: { type?: string | null; isWetsuitAllowed?: boolean | null; cutoffMinutes?: number | null; timeLimitHours?: number | null; distanceM?: number | null };
  bike?: { type?: string | null; cutoffMinutes?: number | null; timeLimitHours?: number | null; elevationM?: number | null; distanceM?: number | null };
  run?: { cutoffMinutes?: number | null; timeLimitHours?: number | null; laps?: number | null; distanceM?: number | null };
}
```

**Step 2 : Mettre à jour `RaceDetailBody` pour passer ces distances**

Dans `components/RaceDetailBody.tsx`, localiser le passage des disciplines à `RaceGPXSection` (ligne ~62) :
```tsx
disciplines={{
  swim: {
    type: r.swim_type,
    isWetsuitAllowed: r.is_wetsuit_allowed,
    cutoffMinutes: r.swim_cutoff_minutes,
    timeLimitHours: r.time_limit_hours,
  },
  bike: {
    type: r.bike_type,
    cutoffMinutes: r.bike_cutoff_minutes,
    timeLimitHours: r.time_limit_hours,
    elevationM: selectedFormat?.elevation ?? r.bike_elevation,
    distanceM: selectedFormat?.bike ?? r.bike_distance,
  },
  run: {
    cutoffMinutes: r.run_cutoff_minutes,
    timeLimitHours: r.time_limit_hours,
    laps: r.run_laps,
  },
}}
```

Remplacer par :
```tsx
disciplines={{
  swim: {
    type: r.swim_type,
    isWetsuitAllowed: r.is_wetsuit_allowed,
    cutoffMinutes: r.swim_cutoff_minutes,
    timeLimitHours: r.time_limit_hours,
    distanceM: selectedFormat?.swim ?? r.swim_distance,
  },
  bike: {
    type: r.bike_type,
    cutoffMinutes: r.bike_cutoff_minutes,
    timeLimitHours: r.time_limit_hours,
    elevationM: selectedFormat?.elevation ?? r.bike_elevation,
    distanceM: selectedFormat?.bike ?? r.bike_distance,
  },
  run: {
    cutoffMinutes: r.run_cutoff_minutes,
    timeLimitHours: r.time_limit_hours,
    laps: r.run_laps,
    distanceM: selectedFormat?.run ?? r.run_distance,
  },
}}
```

**Step 3 : Vérifier le build TypeScript**

```bash
npm run build 2>&1 | grep -E "error|warning" | head -20
```
Attendu : 0 erreur TypeScript.

**Step 4 : Commit**

```bash
git add components/RaceGPXSection.tsx components/RaceDetailBody.tsx
git commit -m "feat: ajouter distanceM swim/run dans DisciplineData"
```

---

### Task 2 : Refonte `RaceGPXSection` — split layout + cartes cliquables

**Files:**
- Modify: `components/RaceGPXSection.tsx`

**Step 1 : Remplacer le rendu JSX par le nouveau layout**

Remplacer l'intégralité du `return (...)` (ligne ~78 à la fin) par :

```tsx
  // Helper : sous-label par discipline
  function swimSubLabel(): string | null {
    if (!disciplines.swim) return null;
    if (disciplines.swim.type) return disciplines.swim.type.charAt(0).toUpperCase() + disciplines.swim.type.slice(1);
    return null;
  }
  function bikeSubLabel(): string | null {
    const parts: string[] = [];
    if (disciplines.bike?.type) parts.push(disciplines.bike.type.charAt(0).toUpperCase() + disciplines.bike.type.slice(1));
    if (disciplines.bike?.elevationM && disciplines.bike.elevationM > 0) parts.push(`${disciplines.bike.elevationM}m D+`);
    return parts.length > 0 ? parts.join(' · ') : null;
  }
  function runSubLabel(): string | null {
    if (disciplines.run?.laps && disciplines.run.laps > 0) {
      return `${disciplines.run.laps} ${disciplines.run.laps > 1 ? 'boucles' : 'boucle'}`;
    }
    return null;
  }

  const disciplineCards = [
    {
      key: 'swim' as Segment,
      label: 'Natation',
      icon: Waves,
      distanceM: disciplines.swim?.distanceM ?? null,
      subLabel: swimSubLabel(),
      iconBg: 'bg-blue-500',
      activeBg: 'bg-blue-50',
      activeBorder: 'border-blue-300',
      activeText: 'text-blue-700',
      activeSubText: 'text-blue-500',
    },
    {
      key: 'bike' as Segment,
      label: 'Vélo',
      icon: Bike,
      distanceM: disciplines.bike?.distanceM ?? null,
      subLabel: bikeSubLabel(),
      iconBg: 'bg-orange-500',
      activeBg: 'bg-orange-50',
      activeBorder: 'border-orange-300',
      activeText: 'text-orange-700',
      activeSubText: 'text-orange-500',
    },
    {
      key: 'run' as Segment,
      label: 'Course à pied',
      icon: Activity,
      distanceM: disciplines.run?.distanceM ?? null,
      subLabel: runSubLabel(),
      iconBg: 'bg-emerald-500',
      activeBg: 'bg-emerald-50',
      activeBorder: 'border-emerald-300',
      activeText: 'text-emerald-700',
      activeSubText: 'text-emerald-500',
    },
  ];

  return (
    <section className="bg-gray-50 p-6 rounded-3xl border border-gray-200">
      {hasAnyGPS && (
        <h3 className="font-bold text-zinc-900 mb-4 flex items-center gap-2">
          <MapPin size={18} className="text-red-500" aria-hidden="true" /> Parcours GPS
        </h3>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Colonne gauche — carte + dénivelé */}
        <div className="flex flex-col gap-3">
          {activeTrack ? (
            <div className="h-56 w-full rounded-2xl overflow-hidden">
              <RaceTrackMap
                key={activeSegment}
                trackGeoJSON={activeTrack as unknown as GeoJSON.LineString}
                lineColor={activeConfig.lineColor}
              />
            </div>
          ) : (
            <div className="h-56 w-full rounded-2xl bg-gray-200 flex items-center justify-center">
              <span className="text-sm text-zinc-400">Pas de tracé GPS</span>
            </div>
          )}

          {activeElevation && activeElevation.length > 0 && (
            <ElevationProfile data={activeElevation} accentColor={activeConfig.lineColor} />
          )}

          {/* Bike SVG fallback */}
          {activeSegment === 'bike' && !activeTrack && disciplines.bike?.elevationM && disciplines.bike.elevationM > 0 && (
            <div>
              <p className="text-xs text-zinc-400 font-bold mb-2">Profil Vélo ({disciplines.bike.elevationM}m D+)</p>
              <div className="h-32 w-full relative">
                <svg viewBox="0 0 100 30" className="w-full h-full" preserveAspectRatio="none">
                  <path d="M0 25 L 10 25 L 30 5 L 50 15 L 70 2 L 90 25 L 100 25" fill="none" stroke="#a1a1aa" strokeWidth="2" />
                  <path d="M0 25 L 10 25 L 30 5 L 50 15 L 70 2 L 90 25 L 100 25 V 30 H 0 Z" fill="url(#zinc-grad)" className="opacity-20" />
                  <defs>
                    <linearGradient id="zinc-grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#a1a1aa" stopOpacity="0.5" />
                      <stop offset="100%" stopColor="#a1a1aa" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                </svg>
                {disciplines.bike.distanceM && (
                  <div className="flex justify-between text-xs text-zinc-500 font-mono mt-1">
                    <span>0km</span>
                    <span>{formatDistance(disciplines.bike.distanceM)}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Colonne droite — cartes disciplines cliquables */}
        <div className="flex flex-col gap-3">
          {disciplineCards.map((card) => {
            const Icon = card.icon;
            const isActive = activeSegment === card.key;
            const hasTrack = !!normalizedTrack[card.key];
            return (
              <button
                key={card.key}
                onClick={() => setActiveSegment(card.key)}
                className={`
                  flex items-center gap-4 p-4 rounded-2xl border-2 text-left transition-all
                  ${isActive
                    ? `${card.activeBg} ${card.activeBorder}`
                    : 'bg-white border-gray-200 hover:border-gray-300'}
                `}
              >
                <span className={`w-11 h-11 rounded-xl ${card.iconBg} flex items-center justify-center shrink-0`}>
                  <Icon size={18} className="text-white" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className={`font-bold text-sm leading-none mb-1 ${isActive ? card.activeText : 'text-zinc-800'}`}>
                    {card.label}
                    {hasTrack && (
                      <span className={`ml-2 text-[10px] font-bold uppercase tracking-wider ${isActive ? card.activeSubText : 'text-zinc-400'}`}>GPS</span>
                    )}
                  </p>
                  <p className={`text-sm font-mono font-bold ${isActive ? card.activeText : 'text-zinc-900'}`}>
                    {card.distanceM ? formatDistance(card.distanceM) : '—'}
                    {card.subLabel && (
                      <span className={`ml-1.5 text-xs font-normal ${isActive ? card.activeSubText : 'text-zinc-400'}`}>
                        · {card.subLabel}
                      </span>
                    )}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
```

**Step 2 : Supprimer les imports inutilisés**

Les imports `useState` dans `RaceGPXSection` — vérifier qu'il est toujours utilisé (pour `activeSegment`). Supprimer `MapPin` si plus utilisé dans le JSX. (Note: `MapPin` est encore utilisé dans le titre "Parcours GPS", garder.)

**Step 3 : Vérifier visuellement**

```bash
npm run dev
```

Ouvrir une course avec formats + GPX (ex: un Ironman).
Attendu :
- Section en 2 colonnes
- Cliquer sur une carte → la map change
- Carte active mise en évidence (couleur)
- Carte sans GPS → tag "GPS" masqué
- Mobile : colonnes stackées (1 colonne)

**Step 4 : Commit**

```bash
git add components/RaceGPXSection.tsx
git commit -m "feat: refonte RaceGPXSection — split layout + cartes disciplines cliquables"
```

---

### Task 3 : Redesign pills `FormatSelector` + en-tête tagline

**Files:**
- Modify: `components/FormatSelector.tsx`
- Modify: `components/RaceDetailBody.tsx` (passer tagline)

**Step 1 : Ajouter prop `tagline` et `raceName` à `FormatSelector`**

Dans `components/FormatSelector.tsx`, étendre l'interface :
```ts
interface FormatSelectorProps {
  formats: Race['formats'];
  swimDistance: number | null;
  bikeDistance: number | null;
  runDistance: number | null;
  totalElevation: number | null;
  priceEuros: number | null;
  tagline?: string | null;       // nouveau
  selectedIndex?: number;
  onSelect?: (index: number) => void;
}
```

Ajouter `tagline` dans la déstructuration :
```ts
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
```

**Step 2 : Ajouter l'en-tête avant les pills**

Dans le JSX, remplacer le `<div>` racine et la section pills :

Ancien :
```tsx
  return (
    <div>
      {/* Pills */}
      {allFormats.length >= 1 && (
        <div className="flex gap-2 overflow-x-auto pb-3 mb-3 scrollbar-hide">
          {allFormats.map((fmt, i) => (
            hasMultiple ? (
              <button
                key={i}
                onClick={() => setSelectedIndex(i)}
                className={`shrink-0 px-4 py-2 rounded-full text-sm font-bold transition-colors ${
                  i === selectedIndex
                    ? 'bg-red-500 text-white'
                    : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                }`}
              >
                {fmt.name || categoryLabel(fmt.category)}
                {fmt.is_relay && (
                  <span className="ml-1.5 text-[10px] opacity-60 uppercase">Relais</span>
                )}
              </button>
            ) : (
              <span
                key={i}
                className="shrink-0 px-4 py-2 rounded-full text-sm font-bold bg-red-500 text-white"
              >
                {fmt.name || categoryLabel(fmt.category)}
                {fmt.is_relay && (
                  <span className="ml-1.5 text-[10px] opacity-60 uppercase">Relais</span>
                )}
              </span>
            )
          ))}
        </div>
      )}
```

Nouveau :
```tsx
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
            <div className="inline-flex gap-1 bg-gray-100 rounded-2xl p-1">
              {allFormats.map((fmt, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedIndex(i)}
                  className={`px-5 py-2 rounded-xl text-sm font-bold transition-all duration-150 ${
                    i === selectedIndex
                      ? 'bg-white shadow-sm text-zinc-900'
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
```

**Step 3 : Passer `tagline` depuis `RaceDetailBody`**

Dans `components/RaceDetailBody.tsx`, localiser le `<FormatSelector ... />` et ajouter `tagline={r.tagline}` :
```tsx
<FormatSelector
  formats={r.formats}
  swimDistance={r.swim_distance}
  bikeDistance={r.bike_distance}
  runDistance={r.run_distance}
  totalElevation={r.total_elevation}
  priceEuros={r.price_euros}
  tagline={r.tagline}
  selectedIndex={selectedIndex}
  onSelect={setSelectedIndex}
/>
```

**Step 4 : Vérifier visuellement**

```bash
npm run dev
```

Tester :
- Course avec plusieurs formats → "Choisissez votre défi" + tagline + pills grises/blanches
- Course avec 1 format → pas d'en-tête, pill unique style sobre
- Course sans tagline → titre seul, pas de description

**Step 5 : Commit**

```bash
git add components/FormatSelector.tsx components/RaceDetailBody.tsx
git commit -m "feat: redesign FormatSelector — pills Image2 + en-tête Choisissez votre défi"
```

---

### Task 4 : Vérification finale

**Step 1 : Build production**

```bash
npm run build
```
Attendu : 0 erreur TypeScript, 0 erreur ESLint.

**Step 2 : Tester les cas limites**

- Course avec 0 format (race sans `formats`) → FormatSelector affiche les KPIs race-level, pas d'en-tête
- Course avec 1 seul format → pill sobre, pas d'en-tête "Choisissez votre défi"
- Course avec formats + GPX → split layout OK, cards cliquables OK
- Course sans GPX → colonne gauche affiche "Pas de tracé GPS", cartes toujours cliquables

**Step 3 : Commit final si tout est bon**

```bash
git add .
git commit -m "chore: vérification build refonte FormatSelector + RaceGPXSection"
```

---

## Résumé des changements

| Fichier | Type | Description |
|---------|------|-------------|
| `components/RaceGPXSection.tsx` | Modify | Split 2 colonnes + cartes disciplines cliquables + `distanceM` swim/run dans interface |
| `components/FormatSelector.tsx` | Modify | Pills style Image 2 + en-tête "Choisissez votre défi" + prop `tagline` |
| `components/RaceDetailBody.tsx` | Modify | Passer `distanceM` swim/run + `tagline` vers les composants |

**Aucune migration DB. Aucun nouveau fichier.**
