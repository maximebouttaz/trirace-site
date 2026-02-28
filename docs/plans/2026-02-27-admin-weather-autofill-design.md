# Design — Bouton auto-fill météo dans le formulaire admin

**Date :** 2026-02-27

## Objectif

Ajouter un bouton "Récupérer la météo historique" dans la section Météo du formulaire admin qui remplit automatiquement avg_temp_high_celsius, avg_temp_low_celsius et avg_wind_kmh via Open-Meteo.

## Architecture

Route API Next.js + bouton dans AdminRaceForm. Logique météo centralisée côté serveur (réutilise scripts/weather.ts).

## Route API

`GET /api/admin/weather?lat=...&lng=...&date=...`

- Protégée par session admin (createClient)
- Appelle Open-Meteo Archive API sur les 3 dernières années à la même date (fenêtre ±3 jours)
- Retourne `{ avg_temp_high_celsius, avg_temp_low_celsius, avg_wind_kmh }`
- Erreur 400 si lat/lng/date manquants, 503 si Open-Meteo échoue

## Bouton dans AdminRaceForm

- Positionné sous le titre "Météo moyenne"
- Label : "Récupérer la météo historique"
- État loading (spinner) pendant l'appel
- Validation préalable : lat, lng et date doivent être présents → sinon message inline
- On succès : remplit avg_temp_high_celsius, avg_temp_low_celsius, avg_wind_kmh
- On erreur : affiche message d'erreur inline

## Fichiers impactés

| Fichier | Action |
|---------|--------|
| `app/api/admin/weather/route.ts` | Créer |
| `components/admin/AdminRaceForm.tsx` | Modifier (bouton + état loading/erreur) |
