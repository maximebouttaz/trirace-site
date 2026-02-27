# Design — Section "Conditions le jour J"

**Date :** 2026-02-27
**Contexte :** Refonte de la section météo sur la page détail course

## Objectif

Remplacer la section "Météo Moyenne" actuelle par une section "Conditions le jour J" plus visuelle et utile pour la préparation de course (l'utilisateur est déjà inscrit).

## Changements DB

Migration Supabase :
- Supprimer `avg_temp_celsius`
- Ajouter `avg_temp_high_celsius` (integer, nullable)
- Ajouter `avg_temp_low_celsius` (integer, nullable)

## UI

### Position
Après `RaceDetailBody` (KPIs + GPX), avant la section description.

### Layout
Grille 3 cards horizontales :

```
┌─────────────────┬─────────────────┬─────────────────┐
│   Température   │   Eau           │   Vent          │
│   18° / 28°C   │   22°C          │   12 km/h       │
│   Chaud         │   Combinaison   │   Faible        │
│   [soleil icon] │   [vagues icon] │   [vent icon]   │
└─────────────────┴─────────────────┴─────────────────┘
```

- **Température** : `{avg_temp_low}° / {avg_temp_high}°C` — label basé sur `avg_temp_high`
- **Eau** : `{avg_water_temp_celsius}°C` — label contextuel (ex: "Combinaison recommandée" si < 20°C)
- **Vent** : `{avg_wind_kmh} km/h` — label Faible / Modéré / Fort

Cards affichées uniquement si la donnée existe. Section masquée si aucune donnée météo disponible.

## Fichiers impactés

| Fichier | Changement |
|---------|-----------|
| `supabase/migrations/` | Nouvelle migration : drop avg_temp_celsius, add avg_temp_high/low |
| `lib/types.ts` | Remplacer `avg_temp_celsius` par `avg_temp_high_celsius` + `avg_temp_low_celsius` |
| `lib/utils.ts` | Adapter `tempLabel()` pour prendre `avg_temp_high_celsius` |
| `app/courses/[slug]/page.tsx` | Déplacer section météo, utiliser nouveau design 3 cards |
