# TriRace — Plateforme de courses triathlon

Site de découverte de courses triathlon en France et en Europe (~700 courses).
Permet de rechercher, filtrer, comparer et consulter les détails de chaque épreuve.

## Stack technique

- **Framework** : Next.js 16 (App Router, Turbopack), React 19, TypeScript 5
- **Style** : Tailwind CSS 4 — **thème clair (light/white)**, PostCSS
- **Backend** : Supabase (PostgreSQL) — client dans `lib/supabase.ts`
- **Carte** : Mapbox GL via `react-map-gl` (token : `NEXT_PUBLIC_MAPBOX_TOKEN`)
- **Icônes** : Lucide React
- **Fonts** : Geist Sans / Geist Mono (Vercel)
- **SEO** : ISR (revalidate: 86400), JSON-LD SportsEvent, sitemap dynamique

## Commandes

```bash
npm run dev      # serveur local http://localhost:3000
npm run build    # build production
npm run lint     # ESLint
```

## Structure du projet

```
app/
  page.tsx                  # Homepage (server component, ISR) — widget prochaine course
  layout.tsx                # Root layout, Header + Footer, metadata globales + OG image
  globals.css               # Tailwind imports + thème clair (bg-white, color: #18181b)
  not-found.tsx             # Page 404
  robots.ts                 # robots.txt
  sitemap.ts                # Sitemap XML dynamique (700 courses)
  courses/
    layout.tsx              # Metadata statique pour la page listing /courses
    page.tsx                # Liste + carte split 2/3 + 1/3 (client component, paginé)
    [slug]/page.tsx         # Détail d'une course (SSG + ISR, JSON-LD enrichi)
  carte/
    page.tsx                # Vue carte plein écran (sidebar + Mapbox)
  comparateur/
    page.tsx                # Comparateur côte à côte (max 3 courses)
  calendrier/
    page.tsx                # Vue calendrier mensuel avec navigation prev/next
  mes-courses/
    page.tsx                # Favoris persistés en localStorage
  api/
    races/
      route.ts              # GET (paginé + mode geo) / POST (dashboard)
      [id]/route.ts         # PUT / DELETE (dashboard organisateur)

components/
  Header.tsx                # Header sticky, nav desktop + hamburger mobile, 'use client'
  Footer.tsx                # Footer avec liens
  RaceCard.tsx              # Card de course — props: race, onMouseEnter? (hover → carte)
  RaceFilters.tsx           # Barre recherche + filtres catégorie + tri + gradient scroll
  AdvancedFilters.tsx       # Filtres avancés : prix, distance, dénivelé, température, région, dates
  RaceMap.tsx               # Carte Mapbox (clusters, popups, focusSlug, react-map-gl)
  RaceMapSidebar.tsx        # Sidebar de la page /carte (liste scrollable + filtres)
  RangeSlider.tsx           # Slider de plage pour les filtres avancés
  CompareButton.tsx         # Bouton ajout au comparateur (top-right sur RaceCard)
  CompareNavIndicator.tsx   # Badge dans la nav indiquant le nb de courses à comparer
  FavoriteButton.tsx        # Bouton coeur (top-left sur RaceCard), état localStorage
  NextRaceWidget.tsx        # Widget "Prochaine course" avec countdown J-X (server component)
  CTABanner.tsx             # Bannière TriCoach

lib/
  types.ts                  # Interface Race (37 propriétés)
  utils.ts                  # formatDistance, formatDate, formatDateLong, categoryLabel, categoryColor, categoryHexColor, tempLabel
  supabase.ts               # Client Supabase
  compare-context.tsx       # Context React pour la sélection de courses à comparer (max 3, URL sync)
  hooks/
    useFavorites.ts         # Hook localStorage pour les favoris (favorites, toggleFavorite, isFavorite)
```

## API Routes

### `GET /api/races`

**Mode paginé (défaut)** — retourne `{ data: Race[], total: number, page: number, totalPages: number }`

Query params supportés :
| Param | Description |
|-------|-------------|
| `page` | Numéro de page (défaut: 1) |
| `limit` | Courses par page (défaut: 24, max: 100) |
| `category` | `sprint` / `olympic` / `half` / `full` |
| `region` | Région ou département |
| `price_min` / `price_max` | Fourchette de prix en € |
| `dist_min` / `dist_max` | Distance totale en km |
| `elev_min` / `elev_max` | Dénivelé total en m |
| `date_from` / `date_to` | Plage de dates (YYYY-MM-DD) |

**Mode géo** — `?geo=true` — retourne `Race[]` avec seulement `slug, name, city, country, category, date, latitude, longitude`. Utilisé par la carte pour afficher tous les points sans surcharge réseau.

### `POST /api/races` — Créer une course (dashboard organisateur)
### `PUT /api/races/[id]` — Modifier une course (ownership check)
### `DELETE /api/races/[id]` — Supprimer une course (ownership check)

## Modèle de données — table `races`

Colonnes principales :
- **Identité** : `id`, `slug`, `name`, `date`, `location`, `city`, `department`, `region`, `country`
- **Géo** : `latitude`, `longitude`
- **Catégorie** : `discipline`, `category` (valeurs : XS, S, M, L, 70.3, XL, Ironman)
- **Distances** (en mètres) : `swim_distance`, `bike_distance`, `run_distance`, `total_distance`
- **Dénivelé** (en mètres) : `bike_elevation`, `run_elevation`, `total_elevation`
- **Pratique** : `price_euros`, `max_participants`, `time_limit_hours`
- **Contenu** : `description`, `tagline`, `image_gradient` (classe Tailwind), `image_url`, `tags` (string[])
- **Météo** : `avg_temp_celsius`, `avg_water_temp_celsius`, `avg_wind_kmh`
- **Records** : `record_men`, `record_women` (format string, ex: "7h42:15")
- **Liens** : `website_url`, `finishers_url`
- **Dashboard** : `organizer_id`, `status`, `updated_at`

### Index PostgreSQL en place
```sql
idx_races_category          ON races(category)
idx_races_date              ON races(date ASC)
idx_races_region            ON races(region)
idx_races_country           ON races(country)
idx_races_category_date     ON races(category, date ASC)
idx_races_price             ON races(price_euros) WHERE price_euros IS NOT NULL
```

## Conventions importantes

### Catégories
| Valeur DB   | Label affiché | Filtre UI  | Hex couleur carte |
|-------------|--------------|------------|-------------------|
| XS, S       | Sprint       | `sprint`   | `#3b82f6` (blue)  |
| M           | Olympique    | `olympic`  | `#10b981` (green) |
| L, 70.3     | Half / 70.3  | `half`     | `#f59e0b` (amber) |
| XL, Ironman | Ironman/XL   | `full`     | `#ef4444` (red)   |

### Design — Thème CLAIR (light mode)
Le site utilise un thème blanc depuis le commit `8e1af92`. Les conventions dans ce fichier reflètent le code réel :
- **Fond** : `bg-white` / `bg-gray-50`
- **Cartes** : `bg-gray-50 rounded-3xl border border-gray-200`
- **Texte** : `text-zinc-900` pour titres, `text-zinc-500` / `text-zinc-400` pour secondaire
- **Accents** : `red-500` / `red-600` pour la marque, hover `text-red-500`
- **Inputs** : `bg-gray-100 border-gray-200`
- **Hover** : `hover:-translate-y-1`, `hover:border-gray-300`
- **Arrondis** : `rounded-3xl` pour les cartes, `rounded-2xl` pour les sections

⚠️ Ne pas utiliser `zinc-950`, `zinc-900`, `zinc-800` — ce sont les anciennes couleurs dark.

### Utilitaires (`lib/utils.ts`)
- `formatDistance(meters)` → "1.5km" ou "400m"
- `formatDate(dateStr)` → "15 juin 2026" (fr-FR)
- `formatDateLong(dateStr)` → "dimanche 15 juin 2026"
- `categoryLabel(cat)` → "Sprint", "Olympique", "Half", "Ironman"...
- `categoryColor(cat)` → classes Tailwind pour le badge couleur (bg + text)
- `categoryHexColor(cat)` → hex string pour Mapbox (ex: `"#ef4444"`)
- `tempLabel(temp)` → `{ label: "Chaud", color: "bg-red-50 text-red-600" }`

## Architecture clé

### Page `/courses` — Split layout
La page `/courses` est un **client component** avec :
- Layout `flex h-[calc(100vh-64px)]` sur desktop
- Colonne gauche `w-2/3 overflow-y-auto` : filtres + grille `grid-cols-1 lg:grid-cols-2`
- Colonne droite `w-1/3` sticky : `<RaceMap races={geoRaces} focusSlug={focusSlug} />`
- Deux fetches séparés :
  1. Liste paginée : `/api/races?page=X&limit=24&...filtres` → `{ data, total, totalPages }`
  2. Géo carte : `/api/races?geo=true&...filtres` → déclenché uniquement sur changement de filtres
- Hover sur une RaceCard → `setFocusSlug(slug)` → `flyTo` sur la carte

### Comparateur (`/comparateur`)
- Géré par `lib/compare-context.tsx` (Context React, max 3 courses, persisté en URL)
- `CompareButton.tsx` sur chaque RaceCard (top-right)
- `CompareNavIndicator.tsx` dans le Header pour le badge compteur

### Favoris (`/mes-courses`)
- Hook `lib/hooks/useFavorites.ts` avec localStorage (clé : `trirace_favorites`)
- `FavoriteButton.tsx` sur chaque RaceCard (top-left)
- Fetch Supabase uniquement si `favorites.length > 0`

## Partenaire — TriCoach
URL : `process.env.NEXT_PUBLIC_TRICOACH_URL` (défaut: `https://tricoach.app`)
Chaque course a un lien vers `tricoach.app/races/{slug}` pour la préparation.

## Variables d'environnement (`.env.local`)
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_MAPBOX_TOKEN=      # requis pour la carte
NEXT_PUBLIC_TRICOACH_URL=      # optionnel, défaut: https://tricoach.app
```

## Points d'attention
- `app/courses/page.tsx` et `components/Header.tsx` sont des **client components** (`'use client'`)
- `app/page.tsx` et `app/courses/[slug]/page.tsx` sont des **server components** avec ISR
- `RaceMap.tsx` doit toujours être importé via `dynamic(..., { ssr: false })` (Mapbox ne supporte pas SSR)
- Ne jamais commit `.env.local`
- Les images sont des **gradients Tailwind** stockés en DB (`image_gradient`) — pas de vraies images. `image_url` existe mais est souvent null.
- Le filtre température (`tempPreset`) reste **client-side** (logique trop complexe pour SQL simple)
- La recherche texte (`search`) reste **client-side** (pas d'index full-text Supabase)
