# Météo "Conditions le jour J" — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remplacer `avg_temp_celsius` par `avg_temp_high_celsius` + `avg_temp_low_celsius` et redesigner la section météo en "Conditions le jour J" avec 3 cards (plage de temp, eau, vent).

**Architecture:** Migration DB → mise à jour types/utils → mise à jour scripts météo et scrapers → mise à jour routes API + admin → refonte UI page détail.

**Tech Stack:** Next.js 16, Supabase PostgreSQL, TypeScript, Tailwind CSS 4, Open-Meteo Archive API

---

### Task 1: Migration Supabase

**Files:**
- Create: `supabase/migrations/20260227000000_replace_avg_temp_celsius.sql`

**Step 1: Écrire la migration**

```sql
-- Ajouter les nouvelles colonnes
ALTER TABLE races
  ADD COLUMN IF NOT EXISTS avg_temp_high_celsius NUMERIC(4,1),
  ADD COLUMN IF NOT EXISTS avg_temp_low_celsius  NUMERIC(4,1);

-- Migrer les données existantes (avg devient high, low = high - 8°C comme approximation)
UPDATE races
SET
  avg_temp_high_celsius = avg_temp_celsius,
  avg_temp_low_celsius  = avg_temp_celsius - 8
WHERE avg_temp_celsius IS NOT NULL;

-- Supprimer l'ancienne colonne
ALTER TABLE races DROP COLUMN IF EXISTS avg_temp_celsius;
```

**Step 2: Appliquer dans Supabase Dashboard**
- Aller dans Supabase → SQL Editor
- Coller et exécuter la migration
- Vérifier que les colonnes existent : `SELECT avg_temp_high_celsius, avg_temp_low_celsius FROM races LIMIT 3;`

**Step 3: Commit**

```bash
git add supabase/migrations/20260227000000_replace_avg_temp_celsius.sql
git commit -m "feat(db): replace avg_temp_celsius with avg_temp_high/low_celsius"
```

---

### Task 2: Mise à jour `lib/types.ts`

**Files:**
- Modify: `lib/types.ts:29`

**Step 1: Remplacer le champ**

Remplacer :
```ts
avg_temp_celsius: number | null;
```
Par :
```ts
avg_temp_high_celsius: number | null;
avg_temp_low_celsius: number | null;
```

**Step 2: Vérifier compilation**

```bash
npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add lib/types.ts
git commit -m "feat(types): replace avg_temp_celsius with avg_temp_high/low_celsius"
```

---

### Task 3: Mise à jour `lib/utils.ts`

**Files:**
- Modify: `lib/utils.ts`

**Step 1: Mettre à jour `tempLabel`**

Remplacer la signature pour utiliser `high` comme référence :
```ts
export function tempLabel(temp: number | null): { label: string; color: string } {
```
→ pas besoin de changer la signature, elle prend toujours un `number | null`.
L'appelant passera maintenant `avg_temp_high_celsius`.

**Step 2: Mettre à jour `difficultyLabel`**

```ts
export function difficultyLabel(race: { total_elevation?: number | null; avg_temp_high_celsius?: number | null }): { label: string; color: string } | null {
  const elev = race.total_elevation;
  const temp = race.avg_temp_high_celsius;
  if (elev == null) return null;
  if (elev > 2500 || (temp != null && temp >= 35)) return { label: 'Extrême', color: 'bg-red-50 text-red-600' };
  if (elev >= 1500) return { label: 'Difficile', color: 'bg-orange-50 text-orange-600' };
  if (elev >= 500) return { label: 'Exigeant', color: 'bg-amber-50 text-amber-600' };
  return { label: 'Facile', color: 'bg-emerald-50 text-emerald-600' };
}
```

**Step 3: Mettre à jour `idealPourTags`**

```ts
if (race.avg_temp_high_celsius != null && race.avg_temp_high_celsius >= 28) tags.push('Destination soleil');
```

**Step 4: Vérifier compilation**

```bash
npx tsc --noEmit
```

**Step 5: Commit**

```bash
git add lib/utils.ts
git commit -m "feat(utils): use avg_temp_high_celsius in tempLabel, difficultyLabel, idealPourTags"
```

---

### Task 4: Mise à jour `scripts/weather.ts`

**Files:**
- Modify: `scripts/weather.ts`

**Step 1: Mettre à jour l'interface Open-Meteo**

```ts
interface OpenMeteoResponse {
  daily: {
    time: string[];
    temperature_2m_max: (number | null)[];
    temperature_2m_min: (number | null)[];
    windspeed_10m_max: (number | null)[];
  };
}
```

**Step 2: Mettre à jour l'URL de l'API**

Remplacer `temperature_2m_mean` par `temperature_2m_max,temperature_2m_min` dans l'URL de fetch :
```ts
`&daily=temperature_2m_max,temperature_2m_min,windspeed_10m_max`
```

**Step 3: Mettre à jour `fetchWeatherForDate`**

```ts
async function fetchWeatherForDate(
  lat: number,
  lng: number,
  date: string
): Promise<{ tempHigh: number | null; tempLow: number | null; wind: number | null }> {
  // ...
  const tempHigh = data.daily?.temperature_2m_max?.[0] ?? null;
  const tempLow = data.daily?.temperature_2m_min?.[0] ?? null;
  const wind = data.daily?.windspeed_10m_max?.[0] ?? null;
  return { tempHigh, wind, tempLow };
}
```

**Step 4: Mettre à jour `main()`**

- Remplacer `.is('avg_temp_celsius', null)` par `.is('avg_temp_high_celsius', null)`
- Mettre à jour `updatePayload` :
```ts
const updatePayload = {
  avg_temp_high_celsius: tempHigh,
  avg_temp_low_celsius: tempLow,
  avg_wind_kmh: wind,
};
```

**Step 5: Commit**

```bash
git add scripts/weather.ts
git commit -m "feat(scripts): weather.ts uses avg_temp_high/low_celsius (Open-Meteo max+min)"
```

---

### Task 5: Mise à jour `scripts/enrichers/weather.py`

**Files:**
- Modify: `scripts/enrichers/weather.py`

**Step 1: Changer les paramètres Open-Meteo**

```python
params = {
    "latitude": lat,
    "longitude": lon,
    "start_date": window_start.isoformat(),
    "end_date": min(window_end, today).isoformat(),
    "daily": "temperature_2m_max,temperature_2m_min,wind_speed_10m_max",
    "wind_speed_unit": "kmh",
    "timezone": "auto",
}
```

**Step 2: Collecter high/low séparément**

```python
temps_high = []
temps_low = []
# ...
high_list = [t for t in (daily.get("temperature_2m_max") or []) if t is not None]
low_list  = [t for t in (daily.get("temperature_2m_min") or []) if t is not None]
if high_list:
    temps_high.append(sum(high_list) / len(high_list))
if low_list:
    temps_low.append(sum(low_list) / len(low_list))
```

**Step 3: Mettre à jour le résultat retourné**

```python
result = {
    "avg_temp_high_celsius": round(sum(temps_high) / len(temps_high), 1) if temps_high else None,
    "avg_temp_low_celsius":  round(sum(temps_low)  / len(temps_low),  1) if temps_low  else None,
    "avg_wind_kmh": round(sum(winds) / len(winds), 1) if winds else None,
}
```

**Step 4: Mettre à jour le filtre Supabase**

```python
.is_("avg_temp_high_celsius", "null")
```

**Step 5: Commit**

```bash
git add scripts/enrichers/weather.py
git commit -m "feat(scripts): weather.py uses avg_temp_high/low_celsius"
```

---

### Task 6: Mise à jour des scrapers

**Files:**
- Modify: `lib/scrapers/ironman.ts`
- Modify: `lib/scrapers/generic.ts`
- Modify: `lib/scrapers/finishers.ts`
- Modify: `lib/scrapers/milesrepublic.ts`
- Modify: `lib/scrape-fields.ts`

**Step 1: Dans chaque scraper, remplacer `avg_temp_celsius: null` par**

```ts
avg_temp_high_celsius: null,
avg_temp_low_celsius: null,
```

Pour `ironman.ts` spécifiquement, ligne ~1086, remplacer :
```ts
result.avg_temp_celsius = Math.round(celsius * 10) / 10
```
Par :
```ts
result.avg_temp_high_celsius = Math.round(celsius * 10) / 10
// avg_temp_low_celsius reste null (sera rempli par le script weather)
```

Et ligne ~1298 :
```ts
if (guide.avg_temp_celsius !== null) result.avg_temp_celsius = guide.avg_temp_celsius
```
Par :
```ts
if (guide.avg_temp_high_celsius !== null) result.avg_temp_high_celsius = guide.avg_temp_high_celsius
```

**Step 2: Dans `lib/scrape-fields.ts`, remplacer**

```ts
avg_temp_celsius: number | null
// et dans le tableau :
{ key: 'avg_temp_celsius', label: 'Temp. air (°C)' },
```
Par :
```ts
avg_temp_high_celsius: number | null
avg_temp_low_celsius:  number | null
// dans le tableau :
{ key: 'avg_temp_high_celsius', label: 'Temp. max (°C)' },
{ key: 'avg_temp_low_celsius',  label: 'Temp. min (°C)' },
```

**Step 3: Vérifier compilation**

```bash
npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add lib/scrapers/ lib/scrape-fields.ts
git commit -m "feat(scrapers): replace avg_temp_celsius with avg_temp_high/low_celsius"
```

---

### Task 7: Mise à jour des routes API

**Files:**
- Modify: `app/api/races/route.ts`
- Modify: `app/api/races/[id]/route.ts`
- Modify: `app/api/admin/races/[id]/route.ts`
- Modify: `app/api/admin/races/route.ts`
- Modify: `app/api/admin/catalog/add/route.ts`

**Step 1: `app/api/races/route.ts`**

Dans `LIST_COLS`, remplacer `avg_temp_celsius` par `avg_temp_high_celsius, avg_temp_low_celsius`.

Pour le filtre température (lignes ~77-122), remplacer toutes les occurrences de `avg_temp_celsius` par `avg_temp_high_celsius` (on filtre sur la température haute).

**Step 2: `app/api/races/[id]/route.ts` et `app/api/admin/races/[id]/route.ts`**

Dans `ALLOWED_FIELDS`, remplacer `avg_temp_celsius` par `avg_temp_high_celsius, avg_temp_low_celsius`.

**Step 3: `app/api/admin/races/route.ts`**

Remplacer :
```ts
avg_temp_celsius: toNumberOrNull(body.avg_temp_celsius),
```
Par :
```ts
avg_temp_high_celsius: toNumberOrNull(body.avg_temp_high_celsius),
avg_temp_low_celsius:  toNumberOrNull(body.avg_temp_low_celsius),
```

**Step 4: `app/api/admin/catalog/add/route.ts`**

```ts
avg_temp_high_celsius: toNumberOrNull(scraped.avg_temp_high_celsius),
avg_temp_low_celsius:  toNumberOrNull(scraped.avg_temp_low_celsius),
```

**Step 5: Vérifier compilation**

```bash
npx tsc --noEmit
```

**Step 6: Commit**

```bash
git add app/api/
git commit -m "feat(api): use avg_temp_high/low_celsius in routes and filters"
```

---

### Task 8: Mise à jour admin UI

**Files:**
- Modify: `components/admin/AdminRaceForm.tsx`
- Modify: `app/admin/races/[id]/edit/EditRaceClient.tsx`

**Step 1: `components/admin/AdminRaceForm.tsx`**

Dans le type du formulaire, remplacer :
```ts
avg_temp_celsius: string
```
Par :
```ts
avg_temp_high_celsius: string
avg_temp_low_celsius: string
```

Dans l'état initial :
```ts
avg_temp_high_celsius: '',
avg_temp_low_celsius: '',
```

Dans le rendu, remplacer le champ unique par deux inputs :
```tsx
<FieldLabel label="Temp. max jour J (°C)" field="avg_temp_high_celsius" />
<input type="number" step="0.1" className={inputClass}
  value={form.avg_temp_high_celsius}
  onChange={(e) => set('avg_temp_high_celsius', e.target.value)}
  placeholder="28"
/>
<FieldLabel label="Temp. min jour J (°C)" field="avg_temp_low_celsius" />
<input type="number" step="0.1" className={inputClass}
  value={form.avg_temp_low_celsius}
  onChange={(e) => set('avg_temp_low_celsius', e.target.value)}
  placeholder="18"
/>
```

**Step 2: `app/admin/races/[id]/edit/EditRaceClient.tsx`**

```ts
avg_temp_high_celsius: str(race.avg_temp_high_celsius),
avg_temp_low_celsius:  str(race.avg_temp_low_celsius),
```

**Step 3: Vérifier compilation**

```bash
npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add components/admin/ app/admin/
git commit -m "feat(admin): replace avg_temp_celsius with avg_temp_high/low inputs"
```

---

### Task 9: Mise à jour pages frontend

**Files:**
- Modify: `app/page.tsx`
- Modify: `app/comparateur/page.tsx`
- Modify: `app/mes-courses/page.tsx`
- Modify: `scripts/seed.ts`

**Step 1: `app/page.tsx` ligne 61**

```ts
.filter(r => r.description && r.avg_temp_high_celsius && r.date)
```

**Step 2: `app/comparateur/page.tsx`**

Remplacer la ligne température :
```tsx
{ label: 'Température', icon: <Thermometer size={14} className="text-red-400" />,
  getValue: (r) => (r.avg_temp_high_celsius != null && r.avg_temp_low_celsius != null)
    ? `${r.avg_temp_low_celsius}° / ${r.avg_temp_high_celsius}°C`
    : r.avg_temp_high_celsius != null ? `${r.avg_temp_high_celsius}°C` : '—',
  getNumeric: (r) => r.avg_temp_high_celsius },
```

**Step 3: `app/mes-courses/page.tsx`**

Dans le select, remplacer `avg_temp_celsius` par `avg_temp_high_celsius, avg_temp_low_celsius`.

**Step 4: `scripts/seed.ts`**

Remplacer `'avg_temp_celsius'` par `'avg_temp_high_celsius', 'avg_temp_low_celsius'` dans la liste des colonnes.

**Step 5: Commit**

```bash
git add app/page.tsx app/comparateur/ app/mes-courses/ scripts/seed.ts
git commit -m "feat(pages): use avg_temp_high/low_celsius in comparateur, mes-courses, homepage"
```

---

### Task 10: Refonte UI — Section "Conditions le jour J"

**Files:**
- Modify: `app/courses/[slug]/page.tsx`

**Step 1: Supprimer l'ancienne section météo**

Supprimer le bloc `{/* Météo — déplacée depuis sidebar */}` (lignes ~309-340).

**Step 2: Ajouter la section avant `{r.description && ...}`**

```tsx
{/* Conditions le jour J */}
{(r.avg_temp_high_celsius || r.avg_water_temp_celsius || r.avg_wind_kmh) && (
  <section className="border-t border-gray-200 pt-8 mt-8">
    <h3 className="text-[11px] uppercase tracking-widest text-zinc-400 font-bold mb-4">
      Conditions le jour J
    </h3>
    <div className="grid grid-cols-3 gap-3">

      {/* Température */}
      {r.avg_temp_high_celsius != null && (
        <div className="bg-gray-50 rounded-2xl p-4 flex flex-col gap-1">
          <Sun size={16} className="text-amber-400" aria-hidden="true" />
          <p className="text-lg font-mono font-black text-zinc-900 leading-none mt-2">
            {r.avg_temp_low_celsius != null
              ? `${r.avg_temp_low_celsius}° / ${r.avg_temp_high_celsius}°`
              : `${r.avg_temp_high_celsius}°`}
            <span className="text-sm font-bold">C</span>
          </p>
          {tempLabel(r.avg_temp_high_celsius).label && (
            <span className={`self-start text-[10px] font-bold px-2 py-0.5 rounded-full ${tempLabel(r.avg_temp_high_celsius).color}`}>
              {tempLabel(r.avg_temp_high_celsius).label}
            </span>
          )}
          <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider mt-auto">Température</p>
        </div>
      )}

      {/* Eau */}
      {r.avg_water_temp_celsius != null && (
        <div className="bg-gray-50 rounded-2xl p-4 flex flex-col gap-1">
          <Waves size={16} className="text-blue-400" aria-hidden="true" />
          <p className="text-lg font-mono font-black text-zinc-900 leading-none mt-2">
            {r.avg_water_temp_celsius}°<span className="text-sm font-bold">C</span>
          </p>
          <span className={`self-start text-[10px] font-bold px-2 py-0.5 rounded-full ${
            r.avg_water_temp_celsius < 18
              ? 'bg-cyan-50 text-cyan-600'
              : r.avg_water_temp_celsius < 22
              ? 'bg-blue-50 text-blue-600'
              : 'bg-emerald-50 text-emerald-600'
          }`}>
            {r.avg_water_temp_celsius < 18 ? 'Combinaison obligatoire' : r.avg_water_temp_celsius < 22 ? 'Combinaison recommandée' : 'Eau agréable'}
          </span>
          <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider mt-auto">Eau</p>
        </div>
      )}

      {/* Vent */}
      {r.avg_wind_kmh != null && (
        <div className="bg-gray-50 rounded-2xl p-4 flex flex-col gap-1">
          <Wind size={16} className="text-zinc-400" aria-hidden="true" />
          <p className="text-lg font-mono font-black text-zinc-900 leading-none mt-2">
            {r.avg_wind_kmh}<span className="text-sm font-bold"> km/h</span>
          </p>
          <span className={`self-start text-[10px] font-bold px-2 py-0.5 rounded-full ${
            r.avg_wind_kmh < 15
              ? 'bg-emerald-50 text-emerald-600'
              : r.avg_wind_kmh < 30
              ? 'bg-amber-50 text-amber-600'
              : 'bg-red-50 text-red-600'
          }`}>
            {r.avg_wind_kmh < 15 ? 'Faible' : r.avg_wind_kmh < 30 ? 'Modéré' : 'Fort'}
          </span>
          <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider mt-auto">Vent</p>
        </div>
      )}

    </div>
  </section>
)}
```

**Step 3: Mettre à jour `const temp`**

```ts
const temp = tempLabel(r.avg_temp_high_celsius);
```

**Step 4: Vérifier dans le navigateur**

```bash
npm run dev
```
Naviguer sur une course avec météo (ex: une course Ironman). Vérifier :
- La section "Conditions le jour J" apparaît après les KPIs
- Les 3 cards s'affichent correctement
- Le label de combinaison s'affiche selon la temp eau

**Step 5: Commit**

```bash
git add app/courses/[slug]/page.tsx
git commit -m "feat(race-detail): section Conditions le jour J avec temp high/low + eau + vent"
```

---

### Task 11 : Vérification finale

**Step 1: Build production**

```bash
npm run build
```
Doit passer sans erreurs TypeScript.

**Step 2: Lint**

```bash
npm run lint
```

**Step 3: Commit final si nécessaire**

```bash
git add -A
git commit -m "chore: fix remaining lint warnings post avg_temp migration"
```
