# Design — Refonte FormatSelector + Section Parcours

**Date :** 2026-02-27
**Scope :** `components/FormatSelector.tsx`, `components/RaceGPXSection.tsx`, `components/RaceDetailBody.tsx`

## Contexte

La section format/parcours actuelle (Image 1) est fonctionnelle mais peu inspirante :
- Pills rouges/grises sans cohérence visuelle
- Section GPS en une seule colonne, avec tabs séparés des infos disciplines

L'objectif est un redesign en deux parties.

## Design validé

### Partie 1 — En-tête + nouveau sélecteur de format

Au-dessus du sélecteur (affiché seulement si `formats.length >= 2`) :
- **Titre** : "Choisissez votre défi" — `text-2xl font-black text-zinc-900`
- **Description** : `r.tagline` — `text-sm text-zinc-500` (si non null)

**Pills redesign (Image 2 style) :**
- Ancien : pills individuelles rouge actif / gris inactif
- Nouveau : un conteneur `bg-gray-100 rounded-2xl p-1 inline-flex gap-1`
  - Active : `bg-white rounded-xl shadow-sm text-zinc-900 font-bold`
  - Inactive : `text-zinc-500 hover:text-zinc-700 font-semibold`

### Partie 2 — Section parcours en 2 colonnes

`RaceGPXSection` passe d'un layout vertical à un grid 2 colonnes.

**Colonne gauche :**
- Carte GPX (segment actif, `h-64`, `rounded-2xl`)
- Profil dénivelé (si dispo)

**Colonne droite — cartes disciplines cliquables :**
- 3 cartes (natation / vélo / course), chaque carte = un bouton qui change le segment affiché à gauche
- Carte active : bordure colorée + fond coloré léger
- Carte inactive : fond `bg-gray-50`, bordure `border-gray-200`
- Structure interne : icône colorée (carré arrondi) + nom discipline + `distance • type`

**Données affichées par carte :**
| Discipline | Distance | Sous-label |
|------------|----------|------------|
| Natation | `swim.distanceM` | `swim.type` (lac, mer, rivière…) |
| Vélo | `bike.distanceM` | `bike.type` (route, gravel…) + dénivelé |
| Course à pied | `run.distanceM` | boucles si `run.laps` dispo |

## Fichiers concernés

- `components/FormatSelector.tsx` — en-tête + redesign pills
- `components/RaceGPXSection.tsx` — split layout + cartes cliquables
- `components/RaceDetailBody.tsx` — passer `distanceM` pour swim et run dans `disciplines`

## Contraintes

- `FormatSelector` est `'use client'` — ok pour l'état de sélection
- `RaceGPXSection` est `'use client'` — ok pour l'état `activeSegment`
- Le tagline est passé depuis `RaceDetailBody` (ou directement depuis la page) vers `FormatSelector`
- Aucune migration DB, aucun nouveau composant
