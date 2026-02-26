# Race Detail Page Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refondre la page détail course pour hiérarchiser l'information — format/prix/dispo en premier, sidebar réduite à l'inscription, sélecteur de format dans le corps qui pilote distances + GPX + records.

**Architecture:** Un nouveau composant client `RaceDetailBody` porte l'état `selectedFormatIndex` et synchronise les KPI distances, le GPX et les records selon le format choisi. `FormatSelector` passe en mode contrôlé (props `selectedIndex` + `onSelect`). Le reste de la page (`app/courses/[slug]/page.tsx`) reste server component avec ISR.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5, Tailwind CSS 4, Lucide React

---

### Task 1 : Simplifier le hero

**Fichier modifié :**
- `app/courses/[slug]/page.tsx` (lignes 207–249, bloc badges du hero)

**Ce qu'on supprime :**
- Le bloc `div.flex.flex-wrap` contenant les badges catégorie (Sprint, Ironman…), badge `r.label`, et les badges `registration_status` colorés (emerald, red, zinc)

**Ce qu'on conserve / ajoute :**
- Un seul badge sobre **au-dessus du `h1`**, seulement si `r.registration_status` est non-null :
  - `open` → petit badge texte `Inscriptions ouvertes` (vert discret)
  - `sold_out` → `Complet` (rouge discret)
  - `closed` → `Inscriptions fermées` (gris discret)
- Le `h1`, le tagline et la meta-row date/lieu restent inchangés.

**Code à remplacer (lignes 208–249) :**

```tsx
{/* Badge statut — unique, sobre */}
{r.registration_status && (
  <div className="mb-3">
    {r.registration_status === 'open' && (
      <span className="inline-block text-xs font-bold uppercase tracking-wider text-emerald-300 border border-emerald-400/40 px-3 py-1 rounded-full">
        Inscriptions ouvertes
      </span>
    )}
    {r.registration_status === 'sold_out' && (
      <span className="inline-block text-xs font-bold uppercase tracking-wider text-red-300 border border-red-400/40 px-3 py-1 rounded-full">
        Complet
      </span>
    )}
    {r.registration_status === 'closed' && (
      <span className="inline-block text-xs font-bold uppercase tracking-wider text-white/40 border border-white/20 px-3 py-1 rounded-full">
        Inscriptions fermées
      </span>
    )}
  </div>
)}

<h1 className="text-4xl md:text-6xl font-black text-white tracking-tight drop-shadow-sm">
  {r.name}
</h1>
```

**Supprimer aussi** le bloc `FormatSelector` overlap (lignes 286–295) :
```tsx
{/* KPI Distances — overlapping hero */}
<div className="max-w-7xl mx-auto px-6 md:px-10 -mt-16 relative z-10">
  <FormatSelector ... />
</div>
```

Et supprimer l'import `FormatSelector` de la page (il sera utilisé dans `RaceDetailBody`).

**Vérification :** `npm run build` sans erreur. La page s'affiche avec le hero simplifié.

**Commit :**
```bash
git add app/courses/[slug]/page.tsx
git commit -m "refactor(race-detail): simplify hero — single status badge, remove category labels"
```

---

### Task 2 : Passer `FormatSelector` en mode contrôlé

**Fichier modifié :**
- `components/FormatSelector.tsx`

**Objectif :** Permettre à un composant parent de contrôler `selectedIndex` et d'être notifié du changement, sans casser le mode autonome existant.

**Props à ajouter :**
```tsx
interface FormatSelectorProps {
  formats: Race['formats'];
  swimDistance: number | null;
  bikeDistance: number | null;
  runDistance: number | null;
  totalElevation: number | null;
  priceEuros: number | null;
  // Nouveaux — optionnels pour rétro-compatibilité
  selectedIndex?: number;
  onSelect?: (index: number) => void;
}
```

**Modifier la gestion d'état** (ligne 33) :
```tsx
const [internalIndex, setInternalIndex] = useState(0);
const selectedIndex = props.selectedIndex ?? internalIndex;
const setSelectedIndex = (i: number) => {
  setInternalIndex(i);
  props.onSelect?.(i);
};
```

Remplacer les occurrences de `selectedIndex` et `setSelectedIndex` dans le JSX par ces nouvelles variables. Le reste du composant est inchangé.

**Vérification :** `npm run build` sans erreur. La page fonctionne comme avant (mode autonome).

**Commit :**
```bash
git add components/FormatSelector.tsx
git commit -m "refactor(FormatSelector): add controlled mode with selectedIndex + onSelect props"
```

---

### Task 3 : Créer `RaceDetailBody` — composant client pivot

**Fichier créé :**
- `components/RaceDetailBody.tsx`

**Ce composant reçoit toute la race en props et gère l'état `selectedFormatIndex`.**

```tsx
'use client';

import { useState, useMemo } from 'react';
import { Medal } from 'lucide-react';
import type { Race } from '@/lib/types';
import FormatSelector from '@/components/FormatSelector';
import RaceGPXSection from '@/components/RaceGPXSection';

interface RaceDetailBodyProps {
  race: Race;
}

export default function RaceDetailBody({ race: r }: RaceDetailBodyProps) {
  const sortByDistance = (
    a: NonNullable<Race['formats']>[number],
    b: NonNullable<Race['formats']>[number]
  ) => (a.total ?? 0) - (b.total ?? 0);

  const allFormats = useMemo(() => {
    const nonRelay = (r.formats?.filter((f) => !f.is_relay) ?? []).sort(sortByDistance);
    const relay = (r.formats?.filter((f) => f.is_relay) ?? []).sort(sortByDistance);
    return [...nonRelay, ...relay];
  }, [r.formats]);

  const hasMultiple = allFormats.filter((f) => !f.is_relay).length >= 2;

  const [selectedIndex, setSelectedIndex] = useState(0);

  // Données réactives selon le format sélectionné
  const selectedFormat = hasMultiple ? allFormats[selectedIndex] : null;

  // Indicateur "données partagées" — quand le format sélectionné n'a pas encore son propre GPX
  const showSharedDataNote = hasMultiple && r.track_geojson != null;

  return (
    <>
      {/* Sélecteur de format + KPI distances */}
      <section className="mb-8">
        <FormatSelector
          formats={r.formats}
          swimDistance={r.swim_distance}
          bikeDistance={r.bike_distance}
          runDistance={r.run_distance}
          totalElevation={r.total_elevation}
          priceEuros={r.price_euros}
          selectedIndex={selectedIndex}
          onSelect={setSelectedIndex}
        />
      </section>

      {/* Parcours / GPX */}
      <section className="mb-8">
        <h3 className="text-xs uppercase tracking-widest text-zinc-400 font-bold mb-4">Parcours</h3>
        {showSharedDataNote && (
          <p className="text-xs text-zinc-400 italic mb-3">
            Tracé commun à tous les formats
          </p>
        )}
        <RaceGPXSection
          trackGeoJSON={r.track_geojson}
          elevationProfile={r.elevation_profile}
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
        />
      </section>

      {/* Records */}
      {(r.record_men || r.record_women) && (
        <section className="border-t border-gray-200 pt-8 mb-8">
          <h3 className="text-xs uppercase tracking-widest text-zinc-400 font-bold mb-4">
            Records du parcours
            {showSharedDataNote && (
              <span className="ml-2 text-[10px] text-zinc-300 font-normal normal-case tracking-normal">
                (communs à tous les formats)
              </span>
            )}
          </h3>
          <div>
            {r.record_men && (
              <div className="flex items-center justify-between border-b border-gray-100 py-3">
                <span className="text-sm text-zinc-500">Hommes</span>
                <span className="text-sm font-mono font-black text-zinc-900">{r.record_men}</span>
              </div>
            )}
            {r.record_women && (
              <div className="flex items-center justify-between border-b border-gray-100 py-3">
                <span className="text-sm text-zinc-500">Femmes</span>
                <span className="text-sm font-mono font-black text-zinc-900">{r.record_women}</span>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Qualification */}
      {r.qualification_for && (
        <section className="border-t border-gray-200 pt-8 mb-8">
          <h3 className="text-xs uppercase tracking-widest text-zinc-400 font-bold mb-4">Qualification</h3>
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-100 text-zinc-700 font-bold text-sm">
            <Medal size={15} className="text-zinc-400 shrink-0" />
            Cette course qualifie pour : {r.qualification_for}
          </span>
        </section>
      )}
    </>
  );
}
```

**Vérification :** `npm run build` sans erreur TypeScript.

**Commit :**
```bash
git add components/RaceDetailBody.tsx
git commit -m "feat(race-detail): create RaceDetailBody client component with format state"
```

---

### Task 4 : Réorganiser `page.tsx` — colonne principale + sidebar

**Fichier modifié :**
- `app/courses/[slug]/page.tsx`

**Objectif :** Intégrer `RaceDetailBody` dans la colonne principale et déplacer météo/infos pratiques/tags/liens depuis la sidebar vers la colonne principale.

**Imports à ajouter/modifier :**
```tsx
// Ajouter
import RaceDetailBody from '@/components/RaceDetailBody';
// Supprimer (remplacé)
// import FormatSelector from '@/components/FormatSelector';
```

**Nouvelle structure de la colonne principale (remplace le contenu actuel entre les lignes 322 et 401) :**

```tsx
<div className="md:col-span-2">
  {/* CTA TriCoach */}
  <div className="mb-8">
    {/* ... garder le CTA TriCoach existant ... */}
  </div>

  {/* Format selector + KPIs + GPX + Records (réactifs) */}
  <RaceDetailBody race={r} />

  {/* Description */}
  {r.description && (
    <article className="border-t border-gray-200 pt-8 mt-8">
      <h2 className="text-xs uppercase tracking-widest text-zinc-400 font-bold mb-4">Description</h2>
      {r.tagline && (
        <p className="text-sm font-semibold italic text-zinc-500 border-l-2 border-zinc-300 pl-3 mb-4 leading-relaxed">&ldquo;{r.tagline}&rdquo;</p>
      )}
      <p className="text-zinc-600 leading-relaxed text-sm">{r.description}</p>
    </article>
  )}

  {/* Météo — déplacée ici depuis sidebar */}
  {r.avg_temp_celsius && (
    <section className="border-t border-gray-200 pt-8 mt-8">
      {/* ... reprendre le bloc Weather existant de la sidebar ... */}
    </section>
  )}

  {/* Infos pratiques — déplacées ici depuis sidebar */}
  <section className="border-t border-gray-200 pt-8 mt-8">
    {/* ... reprendre le bloc Infos pratiques existant de la sidebar ... */}
  </section>

  {/* Tags — déplacés ici depuis sidebar */}
  {r.tags && r.tags.length > 0 && (
    <section className="border-t border-gray-200 pt-8 mt-8">
      {/* ... reprendre le bloc Tags existant ... */}
    </section>
  )}

  {/* Courses similaires */}
  <RelatedRaces relatedRaces={relatedRaces} />

  {/* CTA Banner */}
  <CTABanner raceSlug={r.slug} raceName={r.name} />
</div>
```

**Nouvelle sidebar (remplacer tout le contenu) :**

```tsx
<div className="space-y-6 sticky top-20 self-start max-h-[calc(100vh-6rem)] overflow-y-auto">
  {/* Bloc inscription uniquement */}
  {(r.registration_status || r.website_url || (r.formats && r.formats.length > 0)) && (
    <section className="rounded-2xl border border-gray-200 overflow-hidden">
      {/* Statut global */}
      {r.registration_status === 'open' && (
        <div className="flex items-center gap-2.5 px-5 py-3.5 bg-emerald-50 border-b border-emerald-100">
          <TicketCheck size={15} className="text-emerald-600 shrink-0" />
          <span className="text-sm font-bold text-emerald-700">Inscriptions ouvertes</span>
        </div>
      )}
      {r.registration_status === 'sold_out' && (
        <div className="flex items-center gap-2.5 px-5 py-3.5 bg-red-50 border-b border-red-100">
          <Lock size={15} className="text-red-500 shrink-0" />
          <span className="text-sm font-bold text-red-600">Complet</span>
        </div>
      )}
      {r.registration_status === 'closed' && (
        <div className="flex items-center gap-2.5 px-5 py-3.5 bg-gray-100 border-b border-gray-200">
          <Lock size={15} className="text-zinc-400 shrink-0" />
          <span className="text-sm font-bold text-zinc-500">Inscriptions fermées</span>
        </div>
      )}

      {/* Liste des formats avec prix */}
      {r.formats && r.formats.length > 0 && (
        <div className="divide-y divide-gray-100">
          {r.formats
            .filter((fmt, idx, arr) =>
              arr.findIndex((f) => f.category === fmt.category && f.is_relay === fmt.is_relay) === idx
            )
            .map((fmt) => {
              const fmtPrice = fmt.price ?? r.price_euros;
              return (
                <div key={`${fmt.category}-${fmt.is_relay}`} className="flex items-center justify-between gap-3 px-5 py-3">
                  <span className="text-sm font-bold text-zinc-800">
                    {fmt.is_relay ? 'Relais' : categoryLabel(fmt.category)}
                  </span>
                  <div className="flex items-center gap-3">
                    {fmtPrice && (
                      <span className="text-sm font-mono font-bold text-zinc-900">{fmtPrice}€</span>
                    )}
                    {r.website_url && (
                      <a href={r.website_url} target="_blank" rel="noopener noreferrer"
                         className="text-zinc-300 hover:text-zinc-600 transition-colors"
                         aria-label={`S'inscrire — ${fmt.is_relay ? 'Relais' : categoryLabel(fmt.category)}`}>
                        <ArrowRight size={14} />
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      )}

      {/* Fallback sans formats */}
      {(!r.formats || r.formats.length === 0) && r.price_euros && (
        <div className="flex items-center justify-between px-5 py-3">
          <span className="text-sm font-bold text-zinc-800">Inscription</span>
          <span className="text-sm font-mono font-bold text-zinc-900">{r.price_euros}€</span>
        </div>
      )}

      {/* CTA */}
      {r.website_url && r.registration_status !== 'closed' && (
        <div className="px-5 py-4 border-t border-gray-100">
          <a href={r.website_url} target="_blank" rel="noopener noreferrer"
             className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-zinc-900 text-white text-sm font-bold hover:bg-zinc-800 transition-colors">
            S&apos;inscrire
            <ArrowRight size={14} />
          </a>
        </div>
      )}
    </section>
  )}

  {/* Liens officiels */}
  {(r.website_url || r.finishers_url) && (
    <div className="bg-gray-50/50 rounded-2xl p-5 space-y-2">
      <h3 className="text-[11px] uppercase tracking-widest text-zinc-400 font-bold mb-3">Liens</h3>
      {r.website_url && (
        <a href={r.website_url} target="_blank" rel="noopener noreferrer"
           className="flex items-center justify-between gap-2 px-4 py-3 bg-white rounded-xl text-sm font-bold text-zinc-500 hover:text-zinc-900 transition-colors">
          <span className="flex items-center gap-2"><ExternalLink size={14} /> Site officiel</span>
          <ArrowRight size={14} className="text-zinc-300" />
        </a>
      )}
      {r.finishers_url && (
        <a href={r.finishers_url} target="_blank" rel="noopener noreferrer"
           className="flex items-center justify-between gap-2 px-4 py-3 bg-white rounded-xl text-sm font-bold text-zinc-500 hover:text-zinc-900 transition-colors">
          <span className="flex items-center gap-2"><ExternalLink size={14} /> Voir sur Finishers</span>
          <ArrowRight size={14} className="text-zinc-300" />
        </a>
      )}
    </div>
  )}
</div>
```

**Supprimer les imports devenus inutiles** dans `page.tsx` : `Wind`, `Sun`, `Waves`, `Bike`, `Activity`, `Euro` (ils passent dans les sous-composants).

**Vérification :** `npm run lint && npm run build` sans erreur.

**Commit :**
```bash
git add app/courses/[slug]/page.tsx components/RaceDetailBody.tsx
git commit -m "feat(race-detail): reorganize layout — inline body with RaceDetailBody, sidebar inscription-only"
```

---

### Task 5 : Vérification visuelle et ajustements

**Checklist manuelle sur `http://localhost:3000/courses/[un-slug-avec-plusieurs-formats]` :**

- [ ] Hero : un seul badge statut sobre au-dessus du titre, tagline + date/lieu visibles
- [ ] Body : sélecteur de format visible en haut du contenu principal (sans flottement sur hero)
- [ ] Clic sur un format → KPI distances mises à jour
- [ ] GPX section visible sous les KPIs
- [ ] Records visibles sous le GPX
- [ ] Description, météo, infos pratiques dans la colonne principale après les records
- [ ] Sidebar : uniquement le bloc inscription + liens
- [ ] Sidebar sticky fonctionne sur scroll

**Tester aussi sur une course sans formats multiples** (un seul format) : les KPI s'affichent sans les tabs.

**Si ajustements nécessaires :** modifier directement `RaceDetailBody.tsx` ou `page.tsx`.

**Commit final :**
```bash
git add -A
git commit -m "fix(race-detail): visual adjustments after reorganization"
```

---

## Évolutions futures (hors scope)

- Ajouter `gpx_url` / `track_geojson` et `record_men` / `record_women` par format dans la DB
- Passer ces données à `RaceDetailBody` et les utiliser conditionnellement selon `selectedFormat`
- Supprimer l'indicateur "données partagées" une fois les données par format disponibles
