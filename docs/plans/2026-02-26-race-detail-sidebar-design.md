# Design — Refonte Sidebar Page Détail Course

**Date :** 2026-02-26
**Scope :** `app/courses/[slug]/page.tsx` — sidebar droite (1/3)
**Style cible :** Dashboard / data-driven

## Contexte

La page détail d'une course utilise un layout 2/3 (contenu) + 1/3 (sidebar). La sidebar actuelle contient météo, infos pratiques, tags et liens dans des blocs `bg-gray-50/50`. L'objectif est de la rendre plus data-driven et utile, en ajoutant un bloc inscriptions proéminent en haut.

## Design validé

### Nouveau bloc : Inscriptions (en haut de sidebar)

Un bloc visuel avec :
- **Statut global** basé sur `race.registration_status` :
  - `'open'` → fond vert clair + border-l-4 verte + texte "Inscriptions ouvertes"
  - `'sold_out'` → fond rouge clair + border-l-4 rouge + texte "Complet"
  - `'closed'` → fond gris + border-l-4 grise + texte "Inscriptions fermées"
  - `null` → pas de bloc statut
- **Liste des formats** (si `race.formats` non null) : chaque format non-relay affiché avec :
  - Nom du format (`categoryLabel(fmt.category)`) + badge `is_relay`
  - Prix (`fmt.price` ou `race.price_euros` en fallback)
  - Flèche → lien vers `race.website_url`
- **Bouton CTA principal** "S'inscrire" → `race.website_url` (si dispo)

Note : le statut sold_out est **global** (non par format) car la DB ne stocke pas le statut par format.

### Blocs existants améliorés

**Météo** : garder l'existant, améliorer légèrement (fond blanc + bordure).

**Infos pratiques** : garder l'existant, nettoyer les rows.

**Tags** : inchangé.

**Liens** : inchangé.

## Fichiers concernés

- `app/courses/[slug]/page.tsx` — section sidebar (lignes 404–537)

## Contraintes

- Server component (pas de `useState`) — le bloc inscriptions est statique
- `registration_status` est au niveau race, pas par format
- `website_url` est le seul lien disponible (même pour tous les formats)
- Respecter le thème clair (bg-white, bg-gray-50, text-zinc-900...)
