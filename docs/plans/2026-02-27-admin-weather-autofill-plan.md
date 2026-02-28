# Admin Weather Auto-fill — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ajouter un bouton "Récupérer la météo historique" dans le formulaire admin qui appelle Open-Meteo et remplit automatiquement avg_temp_high_celsius, avg_temp_low_celsius et avg_wind_kmh.

**Architecture:** Route API `GET /api/admin/weather` protégée par session admin qui appelle Open-Meteo Archive API (moyenne sur 3 ans) et retourne les 3 champs météo. Bouton dans AdminRaceForm avec état loading/erreur.

**Tech Stack:** Next.js 16 App Router, TypeScript, Supabase Auth, Open-Meteo Archive API (gratuit, sans clé)

---

### Task 1: Créer la route API `/api/admin/weather`

**Files:**
- Create: `app/api/admin/weather/route.ts`

**Context:**
- Open-Meteo Archive API : `https://archive-api.open-meteo.com/v1/archive`
- Params : `latitude`, `longitude`, `start_date`, `end_date`, `daily=temperature_2m_max,temperature_2m_min,windspeed_10m_max`, `timezone=auto`
- Logique : moyenne sur les 3 dernières années à ±3 jours autour de la date de course
- Auth : vérifier session via `createClient` de `@/lib/supabase-server`

**Step 1: Créer le fichier**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

const OPEN_METEO_BASE = 'https://archive-api.open-meteo.com/v1/archive'

function shiftYear(dateStr: string, years: number): string {
  const d = new Date(dateStr)
  d.setFullYear(d.getFullYear() + years)
  return d.toISOString().slice(0, 10)
}

async function fetchWeatherForDate(
  lat: number,
  lng: number,
  date: string
): Promise<{ tempHigh: number | null; tempLow: number | null; wind: number | null }> {
  // ±3 jours autour de la date
  const start = new Date(date)
  start.setDate(start.getDate() - 3)
  const end = new Date(date)
  end.setDate(end.getDate() + 3)

  const url =
    `${OPEN_METEO_BASE}?latitude=${lat}&longitude=${lng}` +
    `&start_date=${start.toISOString().slice(0, 10)}` +
    `&end_date=${end.toISOString().slice(0, 10)}` +
    `&daily=temperature_2m_max,temperature_2m_min,windspeed_10m_max` +
    `&timezone=auto`

  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'TriRace/1.0' } })
    if (!res.ok) return { tempHigh: null, tempLow: null, wind: null }
    const data = await res.json()
    const highs: number[] = (data.daily?.temperature_2m_max ?? []).filter((v: unknown) => v != null)
    const lows: number[]  = (data.daily?.temperature_2m_min ?? []).filter((v: unknown) => v != null)
    const winds: number[] = (data.daily?.windspeed_10m_max  ?? []).filter((v: unknown) => v != null)
    const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : null
    return { tempHigh: avg(highs), tempLow: avg(lows), wind: avg(winds) }
  } catch {
    return { tempHigh: null, tempLow: null, wind: null }
  }
}

export async function GET(request: NextRequest) {
  // Auth
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 })
  }

  // Params
  const { searchParams } = new URL(request.url)
  const lat  = parseFloat(searchParams.get('lat')  ?? '')
  const lng  = parseFloat(searchParams.get('lng')  ?? '')
  const date = searchParams.get('date') ?? ''

  if (isNaN(lat) || isNaN(lng) || !date.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return NextResponse.json(
      { error: 'Paramètres invalides. Requis : lat, lng, date (YYYY-MM-DD).' },
      { status: 400 }
    )
  }

  // Moyenne sur 3 années précédentes
  const years = [-1, -2, -3]
  const results = await Promise.all(
    years.map((offset) => fetchWeatherForDate(lat, lng, shiftYear(date, offset)))
  )

  const validHighs = results.map((r) => r.tempHigh).filter((v): v is number => v !== null)
  const validLows  = results.map((r) => r.tempLow).filter((v): v is number => v !== null)
  const validWinds = results.map((r) => r.wind).filter((v): v is number => v !== null)

  const avg = (arr: number[]) =>
    arr.length > 0 ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : null

  const tempHigh = avg(validHighs)
  const tempLow  = avg(validLows)
  const wind     = avg(validWinds)

  if (tempHigh === null && tempLow === null && wind === null) {
    return NextResponse.json(
      { error: 'Aucune donnée météo disponible pour cette localisation et cette date.' },
      { status: 503 }
    )
  }

  return NextResponse.json({
    avg_temp_high_celsius: tempHigh,
    avg_temp_low_celsius:  tempLow,
    avg_wind_kmh:          wind,
  })
}
```

**Step 2: Vérifier TypeScript**

```bash
cd /Users/maximebouttaz/trirace-site && npx tsc --noEmit 2>&1 | head -10
```
Attendu : aucune erreur.

**Step 3: Tester manuellement**

```bash
# Démarrer le serveur si pas déjà lancé
# Puis tester (remplacer le cookie par un vrai token de session admin) :
curl "http://localhost:3000/api/admin/weather?lat=43.7&lng=7.2&date=2026-06-15"
```
Attendu : `{"avg_temp_high_celsius":26.5,"avg_temp_low_celsius":18.2,"avg_wind_kmh":12.1}` (valeurs approx.)

**Step 4: Commit**

```bash
git add app/api/admin/weather/route.ts
git commit -m "feat(api): GET /api/admin/weather — fetch historical weather from Open-Meteo"
```

---

### Task 2: Ajouter le bouton dans AdminRaceForm

**Files:**
- Modify: `components/admin/AdminRaceForm.tsx`

**Context:**
- Le composant est 'use client', il a déjà `useState`, `Loader2`, `AlertCircle` importés
- `form.latitude`, `form.longitude`, `form.date` sont les champs à vérifier
- Les champs à remplir : `avg_temp_high_celsius`, `avg_temp_low_celsius`, `avg_wind_kmh`
- La fonction `set(field, value)` met à jour l'état du formulaire

**Step 1: Ajouter l'état local weather**

Après les autres `useState` existants dans le composant, ajouter :

```ts
const [weatherLoading, setWeatherLoading] = useState(false)
const [weatherError, setWeatherError] = useState<string | null>(null)
```

**Step 2: Ajouter la fonction fetchWeather**

```ts
async function fetchWeather() {
  if (!form.latitude || !form.longitude || !form.date) {
    setWeatherError('Renseignez la date et les coordonnées GPS d\'abord.')
    return
  }
  setWeatherLoading(true)
  setWeatherError(null)
  try {
    const res = await fetch(
      `/api/admin/weather?lat=${form.latitude}&lng=${form.longitude}&date=${form.date}`
    )
    const data = await res.json()
    if (!res.ok) {
      setWeatherError(data.error ?? 'Erreur lors de la récupération de la météo.')
      return
    }
    if (data.avg_temp_high_celsius != null) set('avg_temp_high_celsius', String(data.avg_temp_high_celsius))
    if (data.avg_temp_low_celsius  != null) set('avg_temp_low_celsius',  String(data.avg_temp_low_celsius))
    if (data.avg_wind_kmh          != null) set('avg_wind_kmh',          String(data.avg_wind_kmh))
  } catch {
    setWeatherError('Impossible de contacter l\'API météo.')
  } finally {
    setWeatherLoading(false)
  }
}
```

**Step 3: Modifier la section Météo dans le JSX**

Remplacer :
```tsx
<section className="bg-gray-50 rounded-2xl border border-gray-200 p-6 space-y-4">
  <h3 className="text-base font-semibold text-zinc-900">Meteo moyenne</h3>
```

Par :
```tsx
<section className="bg-gray-50 rounded-2xl border border-gray-200 p-6 space-y-4">
  <div className="flex items-center justify-between">
    <h3 className="text-base font-semibold text-zinc-900">Météo typique</h3>
    <button
      type="button"
      onClick={fetchWeather}
      disabled={weatherLoading}
      className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-zinc-600 hover:text-zinc-900 hover:border-gray-300 transition-colors disabled:opacity-50"
    >
      {weatherLoading
        ? <Loader2 size={12} className="animate-spin" />
        : <Sparkles size={12} />
      }
      {weatherLoading ? 'Chargement…' : 'Récupérer la météo'}
    </button>
  </div>
  {weatherError && (
    <p className="flex items-center gap-1.5 text-xs text-red-500">
      <AlertCircle size={12} />
      {weatherError}
    </p>
  )}
```

Note : `Sparkles` est déjà importé dans le fichier (ligne 4).

**Step 4: Vérifier TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -10
```
Attendu : aucune erreur.

**Step 5: Tester visuellement**

- Aller sur `/admin/races/[id]/edit` pour une course avec lat/lng/date
- Cliquer "Récupérer la météo"
- Vérifier que les champs se remplissent
- Tester sans date → vérifier le message d'erreur

**Step 6: Commit**

```bash
git add components/admin/AdminRaceForm.tsx
git commit -m "feat(admin): bouton auto-fill météo historique via Open-Meteo"
```
