# Design — Température eau via Copernicus Marine

**Date :** 2026-02-27

## Objectif

Ajouter un bouton "Récupérer temp. eau" dans la section Météo du formulaire admin qui remplit automatiquement `avg_water_temp_celsius` via les données historiques Copernicus Marine (CMEMS).

## Architecture

Pattern asynchrone : bouton admin → route Next.js → GitHub Actions workflow → script Python → Supabase. Durée ~2-3 min. L'admin actualise la page après déclenchement.

## Composants

### Script Python `scripts/enrichers/water_temp.py`
- Package : `copernicusmarine` (client officiel CMEMS)
- Produit : `cmems_mod_glo_phy_my_0.083deg_P1D-m` (température océan, historique depuis 1993, résolution ~9km)
- Variable : `thetao` (potential temperature) à la surface (depth=0)
- Logique : moyenne sur 3 ans précédents, fenêtre ±3 jours autour de la date de course
- Argument `--race-id` optionnel ; sans argument = toutes les courses sans `avg_water_temp_celsius`
- Credentials via env vars `CMEMS_USERNAME` / `CMEMS_PASSWORD`

### Workflow GitHub Actions `.github/workflows/enrich-water-temp.yml`
- Trigger : `workflow_dispatch` avec input `race_id` (string, optionnel)
- Secrets requis : `CMEMS_USERNAME` + `CMEMS_PASSWORD` (GitHub Settings → Secrets)
- Steps : checkout → Python 3.11 → pip install copernicusmarine supabase → run script

### Route Next.js `POST /api/admin/water-temp/[id]`
- Auth : session Supabase + role admin (même pattern que les autres routes admin)
- Déclenche le workflow `enrich-water-temp.yml` via GitHub API dispatch avec `race_id`
- Retourne `{ triggered: true }` immédiatement

### Modifications `components/admin/AdminRaceForm.tsx`
- Séparer visuellement le champ eau des autres champs météo
- Nouveau sous-bloc "Température de l'eau" avec son propre bouton violet
- État `waterTempLoading` + `waterTempError`
- Après déclenchement : message "En cours — actualise la page dans 2-3 min"

## Layout formulaire

```
┌─ Météo typique ──────────────────── [Récupérer la météo ✦] ─┐
│  Temp. max (°C)   Vent moyen (km/h)                          │
│  Temp. min (°C)                                              │
├─ Température de l'eau ──────────── [Récupérer temp. eau ✦] ─┤
│  Temp. eau (°C)                                              │
│  ℹ Asynchrone — actualise la page dans 2-3 min              │
└──────────────────────────────────────────────────────────────┘
```

## Fichiers impactés

| Fichier | Action |
|---------|--------|
| `scripts/enrichers/water_temp.py` | Créer |
| `.github/workflows/enrich-water-temp.yml` | Créer |
| `app/api/admin/water-temp/[id]/route.ts` | Créer |
| `components/admin/AdminRaceForm.tsx` | Modifier |

## Prérequis manuels

Ajouter dans GitHub Settings → Secrets → Actions :
- `CMEMS_USERNAME` = `mbouttaz`
- `CMEMS_PASSWORD` = (mot de passe CMEMS)
