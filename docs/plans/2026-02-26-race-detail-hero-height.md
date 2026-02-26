# Design — Réduction hauteur Hero page détail course

**Date :** 2026-02-26
**Scope :** `app/courses/[slug]/page.tsx` — hero section
**Approche validée :** B — 50vh + pb ajusté

## Contexte

Le hero actuel (`h-[70vh] min-h-[500px]`) est trop imposant : l'image/gradient occupe ~700px sur un écran 1080p, avec le contenu textuel ancré tout en bas. Ça crée trop de "vide visuel" avant d'arriver à l'information.

## Changements

| Ligne | Avant | Après |
|-------|-------|-------|
| `~177` | `h-[70vh] min-h-[500px]` | `h-[50vh] min-h-[400px]` |
| `~204` | `pb-20 pt-16` | `pb-12 pt-16` |

## Résultat attendu

- Hero ~500px sur écran standard (vs ~700px) — réduction de ~30%
- Le texte (titre, tagline, méta-row) reste ancré en bas avec un padding inférieur légèrement réduit
- Scrim, breadcrumb, badge statut : inchangés
- Aucun nouveau composant, aucune migration DB
