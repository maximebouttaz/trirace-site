# Design — Refonte page détail course (desktop)

Date : 2026-02-26
Branche : feature/run-laps → à poursuivre sur une nouvelle branche

## Problème

La page actuelle présente toutes les informations au même niveau visuel. Le visiteur ne sait pas en 3 secondes si la course est faite pour lui. La hiérarchie de lecture n'est pas respectée.

## Hiérarchie d'information validée

1. **Décision** — format, distances, prix, disponibilité
2. **Logistique** — date, lieu
3. **Parcours** — GPX, dénivelé, discipline details
4. **Contexte approfondi** — météo, records, infos pratiques, description

## Architecture retenue (Approche A)

### Hero (simplifié)

- **Supprimé** : badges catégorie (Sprint/Ironman...), badge label, badges statut colorés répétés
- **Conservé** :
  - Statut inscription en badge sobre **au-dessus du titre** (ouvert / complet / fermé)
  - Titre (`h1`)
  - Tagline (italique, sous le titre)
  - Meta-row : date · lieu

### Body — grid 2/3 + 1/3

#### Colonne principale (2/3)

```
Sélecteur de format [tabs horizontaux]  ← pivot de la page
KPI Distances (réactif au format sélectionné)
Parcours / GPX (réactif)
Records H/F (réactifs)
Description
Météo + Infos pratiques
Courses similaires
```

#### Sidebar (1/3, sticky, épurée)

Un seul bloc : **Inscriptions**
- Statut global (ouvert / complet / fermé)
- Prix par format
- CTA « S'inscrire » (lien vers website_url)

Tout le reste de l'ancienne sidebar (météo, infos pratiques, tags, liens) est déplacé dans la colonne principale.

---

## Sélecteur de format — comportement

Onglets horizontaux affichant les formats disponibles de la course (ex: `Sprint | Olympique | Half | Relais`).

Clic sur un format → mise à jour synchronisée de :
- **KPI distances** : `fmt.swim`, `fmt.bike`, `fmt.run`, `fmt.total`, `fmt.elevation`, `fmt.price`
- **Carte GPX + profil dénivelé** : tracé spécifique au format (à terme — données par format)
- **Records H/F** : records spécifiques au format (à terme)

### Gestion des données manquantes (transition)

Tant que la DB ne stocke pas encore le GPX et les records par format :
- Afficher le GPX/records de la course principale
- Indicateur discret : « données partagées entre formats »

### Gestion d'état

- Nouveau composant `RaceDetailBody` — client component
- Wrappé autour des 3 blocs réactifs (format selector + KPIs + GPX + records)
- Le reste de la page reste server component (hero, description, météo, sidebar, courses liées)

---

## Évolutions DB à prévoir (hors scope immédiat)

- Champ `gpx_url` / `track_geojson` par format (actuellement race-level uniquement)
- Champs `record_men` / `record_women` par format (actuellement race-level)

---

## Ce qui ne change pas

- ISR (revalidate: 86400) — le server component reste statique
- JSON-LD SportsEvent — inchangé
- Breadcrumb — inchangé
- TriCoach CTA — conservé (position à affiner)
- Courses similaires — conservées en bas de colonne principale
