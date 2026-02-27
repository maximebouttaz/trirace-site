# Water Temperature Auto-fill — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ajouter un bouton "Récupérer temp. eau" dans le formulaire admin qui déclenche un workflow GitHub Actions exécutant un script Python Copernicus Marine pour remplir `avg_water_temp_celsius`.

**Architecture:** Bouton admin → `POST /api/admin/water-temp/[id]` → GitHub Actions `workflow_dispatch` → `scripts/enrichers/water_temp.py` (copernicusmarine + supabase) → mise à jour directe en DB. Asynchrone : ~2-3 min, l'admin actualise la page pour voir le résultat.

**Tech Stack:** Python 3.11, `copernicusmarine` (client CMEMS officiel), `supabase` (Python), Next.js 16 App Router, TypeScript, GitHub Actions

---

### Task 1 : Créer `scripts/enrichers/water_temp.py`

**Files:**
- Create: `scripts/enrichers/water_temp.py`

**Context :**
- Package `copernicusmarine` : client officiel CMEMS, accès via env vars `CMEMS_USERNAME` / `CMEMS_PASSWORD`
- Dataset : `cmems_mod_glo_phy_my_0.083deg_P1D-m` (physique océan global, 1/12°, depuis 1993)
- Variable : `thetao` (température potentielle en °C), depth 0–1m
- Pattern identique à `weather.py` : moyenne 3 ans précédents, fenêtre ±3 jours
- Connexion Supabase : env vars `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`

**Step 1 : Créer le fichier**

```python
"""
Enrichissement température eau via Copernicus Marine (CMEMS).

Dataset : cmems_mod_glo_phy_my_0.083deg_P1D-m
Variable : thetao (°C) à la surface (depth 0-1m)
Résolution : ~9km (1/12°), historique depuis 1993

Credentials : CMEMS_USERNAME / CMEMS_PASSWORD (env vars)
Supabase    : SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (env vars)
"""
import os
import sys
import argparse
import time
from datetime import date, timedelta
from typing import Optional

import numpy as np
import copernicusmarine
from supabase import create_client

DATASET_ID    = "cmems_mod_glo_phy_my_0.083deg_P1D-m"
HISTORY_YEARS = 3
DEPTH_MAX     = 1.0   # surface uniquement
RADIUS_DEG    = 0.5   # ~55km autour du lieu


def fetch_water_temp(lat: float, lon: float, race_date: str) -> Optional[float]:
    """
    Retourne la température moyenne de l'eau sur HISTORY_YEARS années précédentes
    autour de la date de course (fenêtre ±3 jours, rayon ±RADIUS_DEG autour du lieu).
    Retourne None si aucune donnée disponible.
    """
    try:
        race_dt = date.fromisoformat(race_date)
    except (ValueError, TypeError):
        return None

    today  = date.today()
    temps  = []
    cmems_user = os.environ["CMEMS_USERNAME"]
    cmems_pass = os.environ["CMEMS_PASSWORD"]

    for years_back in range(1, HISTORY_YEARS + 1):
        target_year = race_dt.year - years_back
        if target_year < 1993:
            break

        target_date = date(target_year, race_dt.month, min(race_dt.day, 28))
        start = target_date - timedelta(days=3)
        end   = min(target_date + timedelta(days=3), today)

        if start > today:
            continue

        try:
            ds = copernicusmarine.open_dataset(
                dataset_id       = DATASET_ID,
                variables        = ["thetao"],
                minimum_latitude  = lat - RADIUS_DEG,
                maximum_latitude  = lat + RADIUS_DEG,
                minimum_longitude = lon - RADIUS_DEG,
                maximum_longitude = lon + RADIUS_DEG,
                start_datetime   = start.isoformat() + "T00:00:00",
                end_datetime     = end.isoformat()   + "T23:59:59",
                minimum_depth    = 0.0,
                maximum_depth    = DEPTH_MAX,
                username         = cmems_user,
                password         = cmems_pass,
            )

            values = ds["thetao"].values.flatten()
            valid  = values[~np.isnan(values)]
            if len(valid) > 0:
                temps.append(float(np.mean(valid)))

            ds.close()

        except Exception as e:
            print(f"  ⚠ Année {target_year} : {e}", file=sys.stderr)

        time.sleep(2)  # respecter les limites CMEMS

    if not temps:
        return None
    return round(sum(temps) / len(temps), 1)


def enrich_water_temp(supabase_client, race_id: Optional[int] = None) -> int:
    """
    Enrichit les courses sans température eau.
    Si race_id est fourni, enrichit uniquement cette course (même si déjà renseignée).
    Retourne le nombre de courses enrichies.
    """
    print("[WATER_TEMP] Démarrage enrichissement...")

    query = (
        supabase_client.table("races")
        .select("id, slug, date, latitude, longitude")
        .not_.is_("latitude", "null")
        .not_.is_("longitude", "null")
        .not_.is_("date", "null")
    )

    if race_id is not None:
        # Mode ciblé : forcer le re-calcul même si déjà renseigné
        query = query.eq("id", race_id)
    else:
        # Mode bulk : uniquement celles sans température eau
        query = query.is_("avg_water_temp_celsius", "null")

    races = query.execute().data or []
    print(f"[WATER_TEMP] {len(races)} course(s) à enrichir")

    enriched = 0
    for race in races:
        try:
            temp = fetch_water_temp(
                lat       = race["latitude"],
                lon       = race["longitude"],
                race_date = race["date"],
            )

            if temp is not None:
                supabase_client.table("races").update(
                    {"avg_water_temp_celsius": temp}
                ).eq("id", race["id"]).execute()
                enriched += 1
                print(f"  ✓ {race['slug']} → {temp}°C")
            else:
                print(f"  ⚠ {race['slug']} → aucune donnée disponible")

        except Exception as e:
            print(f"  ✗ {race['slug']} : {e}", file=sys.stderr)

    print(f"[WATER_TEMP] {enriched}/{len(races)} enrichies")
    return enriched


def main():
    parser = argparse.ArgumentParser(description="Enrichit avg_water_temp_celsius via CMEMS")
    parser.add_argument("--race-id", type=int, default=None, help="ID d'une course spécifique")
    args = parser.parse_args()

    supabase = create_client(
        os.environ["SUPABASE_URL"],
        os.environ["SUPABASE_SERVICE_ROLE_KEY"],
    )

    enrich_water_temp(supabase, race_id=args.race_id)


if __name__ == "__main__":
    main()
```

**Step 2 : Tester localement (optionnel)**

Installer les dépendances :
```bash
cd /Users/maximebouttaz/trirace-site
pip install copernicusmarine supabase numpy
```

Tester sur une course côtière (ex: Nice) :
```bash
CMEMS_USERNAME=mbouttaz \
CMEMS_PASSWORD=NFu6LfU@yfYQ3sd \
SUPABASE_URL=$(grep NEXT_PUBLIC_SUPABASE_URL .env.local | cut -d= -f2) \
SUPABASE_SERVICE_ROLE_KEY=$(grep SERVICE_ROLE .env.local | cut -d= -f2) \
python scripts/enrichers/water_temp.py --race-id 42
```
Attendu : `✓ nice-triathlon → 22.3°C` (valeurs approx.)

**Step 3 : Commit**

```bash
git add scripts/enrichers/water_temp.py
git commit -m "feat(script): enricher température eau via Copernicus Marine"
```

---

### Task 2 : Créer `.github/workflows/enrich-water-temp.yml`

**Files:**
- Create: `.github/workflows/enrich-water-temp.yml`

**Context :**
- Déclenché via `workflow_dispatch` avec input `race_id` (optionnel)
- Nécessite 4 GitHub Secrets (à ajouter dans Settings → Secrets → Actions) :
  - `CMEMS_USERNAME`
  - `CMEMS_PASSWORD`
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
- Utilise `pip cache` pour accélérer les re-runs

**Step 1 : Créer le fichier**

```yaml
name: Enrich — Température eau (Copernicus Marine)

on:
  workflow_dispatch:
    inputs:
      race_id:
        description: "ID de la course (laisser vide = toutes les courses sans temp. eau)"
        required: false
        default: ""

jobs:
  enrich:
    runs-on: ubuntu-latest
    timeout-minutes: 30

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Set up Python 3.11
        uses: actions/setup-python@v5
        with:
          python-version: "3.11"
          cache: "pip"

      - name: Install dependencies
        run: pip install copernicusmarine supabase numpy

      - name: Run water temp enricher
        env:
          CMEMS_USERNAME:          ${{ secrets.CMEMS_USERNAME }}
          CMEMS_PASSWORD:          ${{ secrets.CMEMS_PASSWORD }}
          SUPABASE_URL:            ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
        run: |
          if [ -n "${{ github.event.inputs.race_id }}" ]; then
            echo "Mode ciblé : race_id=${{ github.event.inputs.race_id }}"
            python scripts/enrichers/water_temp.py --race-id ${{ github.event.inputs.race_id }}
          else
            echo "Mode bulk : toutes les courses sans température eau"
            python scripts/enrichers/water_temp.py
          fi
```

**Step 2 : Ajouter les GitHub Secrets**

Aller sur : `https://github.com/maximebouttaz/trirace-site/settings/secrets/actions`

Ajouter :
- `CMEMS_USERNAME` = `mbouttaz`
- `CMEMS_PASSWORD` = (mot de passe CMEMS)
- `SUPABASE_URL` = (valeur de `NEXT_PUBLIC_SUPABASE_URL` dans `.env.local`)
- `SUPABASE_SERVICE_ROLE_KEY` = (clé service role Supabase, dans Settings → API)

**Step 3 : Vérifier TypeScript (rien à vérifier ici, YAML uniquement)**

**Step 4 : Commit**

```bash
git add .github/workflows/enrich-water-temp.yml
git commit -m "feat(ci): workflow GitHub Actions enrichissement température eau"
```

---

### Task 3 : Créer `app/api/admin/water-temp/[id]/route.ts`

**Files:**
- Create: `app/api/admin/water-temp/[id]/route.ts`

**Context :**
- Pattern identique à `app/api/admin/sync/trigger/route.ts` : déclenche un workflow GitHub via API
- Env vars : `GITHUB_SYNC_TOKEN` + `GITHUB_REPO` (déjà présents dans `.env.local`)
- Retourne `{ triggered: true }` immédiatement (asynchrone)

**Step 1 : Créer le fichier**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  // Auth
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', session.user.id)
    .single<{ role: string }>()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Accès refusé.' }, { status: 403 })
  }

  // Validation
  const raceId = Number(id)
  if (!raceId || isNaN(raceId)) {
    return NextResponse.json({ error: 'ID invalide.' }, { status: 400 })
  }

  // GitHub
  const token = process.env.GITHUB_SYNC_TOKEN
  const repo  = process.env.GITHUB_REPO

  if (!token || !repo) {
    return NextResponse.json(
      { error: 'GITHUB_SYNC_TOKEN ou GITHUB_REPO non configurés.' },
      { status: 503 }
    )
  }

  const res = await fetch(
    `https://api.github.com/repos/${repo}/actions/workflows/enrich-water-temp.yml/dispatches`,
    {
      method: 'POST',
      headers: {
        Authorization:           `Bearer ${token}`,
        Accept:                  'application/vnd.github+json',
        'X-GitHub-Api-Version':  '2022-11-28',
        'Content-Type':          'application/json',
      },
      body: JSON.stringify({ ref: 'main', inputs: { race_id: String(raceId) } }),
    }
  )

  if (res.status === 204) {
    return NextResponse.json({ triggered: true })
  }

  const errorBody = await res.text()
  console.error('[POST /api/admin/water-temp] GitHub API error:', res.status, errorBody)
  return NextResponse.json(
    { error: `Erreur GitHub API (${res.status}). Vérifie le token et le dépôt.` },
    { status: 502 }
  )
}
```

**Step 2 : Vérifier TypeScript**

```bash
cd /Users/maximebouttaz/trirace-site && npx tsc --noEmit 2>&1 | head -10
```
Attendu : aucune erreur.

**Step 3 : Commit**

```bash
git add app/api/admin/water-temp/[id]/route.ts
git commit -m "feat(api): POST /api/admin/water-temp/[id] — déclenche workflow GitHub Actions CMEMS"
```

---

### Task 4 : Modifier `components/admin/AdminRaceForm.tsx`

**Files:**
- Modify: `components/admin/AdminRaceForm.tsx`
- Modify: `app/admin/races/[id]/edit/EditRaceClient.tsx` (passer `raceId` prop)

**Context :**
- `AdminRaceForm` n'a pas de `raceId` prop — il faut l'ajouter (optionnel, absent sur `/admin/new`)
- La section météo actuelle (lignes ~619-659) : 3 colonnes avec temp max/min, temp eau, vent
- Nouveau layout : 2 colonnes (temp max/min + vent) + sous-bloc séparé pour temp eau
- État async : `waterTempTriggered` (boolean) affiche "En cours… actualise dans 2-3 min"
- `Loader2`, `Sparkles`, `AlertCircle` déjà importés

**Step 1 : Ajouter `raceId` prop à AdminRaceForm**

Trouver l'interface des props (vers ligne 110-118) et ajouter `raceId`:

```ts
// Avant :
interface AdminRaceFormProps {
  initialData: AdminRaceFormData
  scrapedFields?: Set<string>
  onSubmit: (data: AdminRaceFormData) => Promise<void>
  isLoading: boolean
}

// Après :
interface AdminRaceFormProps {
  initialData: AdminRaceFormData
  scrapedFields?: Set<string>
  onSubmit: (data: AdminRaceFormData) => Promise<void>
  isLoading: boolean
  raceId?: number
}
```

Mettre à jour la destructuration dans le composant :
```ts
// Avant :
export default function AdminRaceForm({ initialData, scrapedFields, onSubmit, isLoading }: AdminRaceFormProps) {

// Après :
export default function AdminRaceForm({ initialData, scrapedFields, onSubmit, isLoading, raceId }: AdminRaceFormProps) {
```

**Step 2 : Ajouter les états water temp**

Après les états `weatherLoading` / `weatherError` (lignes ~164-165) :

```ts
const [waterTempLoading,   setWaterTempLoading]   = useState(false)
const [waterTempError,     setWaterTempError]     = useState<string | null>(null)
const [waterTempTriggered, setWaterTempTriggered] = useState(false)
```

**Step 3 : Ajouter la fonction `fetchWaterTemp`**

Après la fonction `fetchWeather` existante (vers ligne ~303) :

```ts
async function fetchWaterTemp() {
  if (!raceId) return
  setWaterTempLoading(true)
  setWaterTempError(null)
  setWaterTempTriggered(false)
  try {
    const res = await fetch(`/api/admin/water-temp/${raceId}`, { method: 'POST' })
    const data = await res.json()
    if (!res.ok) {
      setWaterTempError(data.error ?? 'Erreur lors du déclenchement.')
      return
    }
    setWaterTempTriggered(true)
  } catch {
    setWaterTempError('Impossible de contacter l\'API.')
  } finally {
    setWaterTempLoading(false)
  }
}
```

**Step 4 : Restructurer la section Météo dans le JSX**

Remplacer la section Météo complète (lignes ~619-659) par :

```tsx
{/* Section 6: Meteo */}
<section className="bg-gray-50 rounded-2xl border border-gray-200 p-6 space-y-4">
  <div className="flex items-center justify-between">
    <h3 className="text-base font-semibold text-zinc-900">Météo typique</h3>
    <button
      type="button"
      onClick={fetchWeather}
      disabled={weatherLoading || !form.latitude || !form.longitude || !form.date}
      title="Renseignez la date et les coordonnées GPS d'abord"
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-50 text-violet-700 text-xs font-semibold hover:bg-violet-100 disabled:opacity-40 transition-colors"
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
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    <div>
      <FieldLabel label="Temp. max (°C)" field="avg_temp_high_celsius" />
      <input type="number" step="0.1" className={inputClass} value={form.avg_temp_high_celsius} onChange={(e) => set('avg_temp_high_celsius', e.target.value)} placeholder="28" />
      <FieldLabel label="Temp. min (°C)" field="avg_temp_low_celsius" />
      <input type="number" step="0.1" className={inputClass} value={form.avg_temp_low_celsius} onChange={(e) => set('avg_temp_low_celsius', e.target.value)} placeholder="18" />
    </div>
    <div>
      <FieldLabel label="Vent moyen (km/h)" field="avg_wind_kmh" />
      <input type="number" step="0.1" className={inputClass} value={form.avg_wind_kmh} onChange={(e) => set('avg_wind_kmh', e.target.value)} placeholder="15" />
    </div>
  </div>

  {/* Sous-bloc température eau */}
  <div className="border-t border-gray-200 pt-4">
    <div className="flex items-center justify-between mb-3">
      <p className="text-sm font-semibold text-zinc-700">Température de l'eau</p>
      {raceId && (
        <button
          type="button"
          onClick={fetchWaterTemp}
          disabled={waterTempLoading}
          title="Déclenche un calcul via Copernicus Marine (~2-3 min)"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-50 text-violet-700 text-xs font-semibold hover:bg-violet-100 disabled:opacity-40 transition-colors"
        >
          {waterTempLoading
            ? <Loader2 size={12} className="animate-spin" />
            : <Sparkles size={12} />
          }
          {waterTempLoading ? 'Déclenchement…' : 'Récupérer temp. eau'}
        </button>
      )}
    </div>
    {waterTempError && (
      <p className="flex items-center gap-1.5 text-xs text-red-500 mb-2">
        <AlertCircle size={12} />
        {waterTempError}
      </p>
    )}
    {waterTempTriggered && (
      <p className="text-xs text-violet-600 mb-2">
        ✓ Calcul déclenché — actualise la page dans 2-3 min pour voir le résultat.
      </p>
    )}
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <FieldLabel label="Temp. eau (°C)" field="avg_water_temp_celsius" />
        <input type="number" step="0.1" className={inputClass} value={form.avg_water_temp_celsius} onChange={(e) => set('avg_water_temp_celsius', e.target.value)} placeholder="18" />
      </div>
    </div>
  </div>
</section>
```

**Step 5 : Passer `raceId` depuis `EditRaceClient.tsx`**

Dans `app/admin/races/[id]/edit/EditRaceClient.tsx`, modifier le rendu d'`AdminRaceForm` (ligne ~230) :

```tsx
// Avant :
<AdminRaceForm
  initialData={{ ...EMPTY_FORM_DATA, ...formData }}
  scrapedFields={scrapedFields}
  onSubmit={handleSubmit}
  isLoading={saving}
/>

// Après :
<AdminRaceForm
  initialData={{ ...EMPTY_FORM_DATA, ...formData }}
  scrapedFields={scrapedFields}
  onSubmit={handleSubmit}
  isLoading={saving}
  raceId={race.id}
/>
```

**Step 6 : Vérifier TypeScript**

```bash
cd /Users/maximebouttaz/trirace-site && npx tsc --noEmit 2>&1 | head -10
```
Attendu : aucune erreur.

**Step 7 : Tester visuellement**

- Aller sur `/admin/races/[id]/edit` pour une course existante
- Vérifier que le sous-bloc "Température de l'eau" apparaît avec son bouton
- Cliquer "Récupérer temp. eau" → vérifier le message "✓ Calcul déclenché…"
- Aller sur `/admin/new` → vérifier que le bouton n'apparaît PAS (pas de `raceId`)

**Step 8 : Commit**

```bash
git add components/admin/AdminRaceForm.tsx app/admin/races/[id]/edit/EditRaceClient.tsx
git commit -m "feat(admin): bouton async température eau via Copernicus Marine"
```
