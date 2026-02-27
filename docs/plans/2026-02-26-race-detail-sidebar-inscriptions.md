# Race Detail Sidebar — Bloc Inscriptions

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ajouter un bloc "Inscriptions" en haut de la sidebar de la page détail course, affichant le statut global + la liste des formats avec prix et lien, plus un CTA "S'inscrire".

**Architecture:** Modification purement UI dans un server component. On insère un nouveau bloc JSX en haut de la sidebar existante (`<div className="space-y-6">`). Aucune nouvelle route, aucun état client nécessaire.

**Tech Stack:** Next.js App Router (server component), Tailwind CSS 4, Lucide React, TypeScript

---

### Task 1 : Ajouter les imports Lucide manquants

**Files:**
- Modify: `app/courses/[slug]/page.tsx:6-11`

**Step 1 : Repérer la ligne d'imports Lucide**

La ligne d'import lucide-react se trouve ligne 6-11 :
```tsx
import {
  Calendar, MapPin, Users, Wind, Sun,
  Waves, Bike, Activity, Euro, ExternalLink,
  ArrowRight, Zap, ChevronRight,
  Flag, Medal, Shield,
} from 'lucide-react';
```

**Step 2 : Ajouter `TicketCheck` et `Lock` pour les statuts**

Remplacer par :
```tsx
import {
  Calendar, MapPin, Users, Wind, Sun,
  Waves, Bike, Activity, Euro, ExternalLink,
  ArrowRight, Zap, ChevronRight,
  Flag, Medal, Shield, TicketCheck, Lock,
} from 'lucide-react';
```

`TicketCheck` → inscriptions ouvertes (vert)
`Lock` → sold out / fermé (rouge / gris)

**Step 3 : Vérifier que le serveur ne plante pas**

```bash
npm run dev
```
Ouvrir `http://localhost:3000/courses/ironman-nice-2026` (ou n'importe quel slug valide).
Attendu : page charge sans erreur.

---

### Task 2 : Ajouter le bloc Inscriptions en haut de la sidebar

**Files:**
- Modify: `app/courses/[slug]/page.tsx:403-405`

**Contexte :** La sidebar commence à la ligne 403 :
```tsx
{/* Sidebar — unified style */}
<div className="space-y-6">

  {/* Weather */}
```

**Step 1 : Insérer le bloc inscriptions entre la ligne 404 et le commentaire `{/* Weather */}`**

Remplacer :
```tsx
          {/* Sidebar — unified style */}
          <div className="space-y-6">

            {/* Weather */}
```

Par :
```tsx
          {/* Sidebar — unified style */}
          <div className="space-y-6">

            {/* Inscriptions */}
            {(r.registration_status || r.website_url || (r.formats && r.formats.length > 0)) && (
              <section className="rounded-2xl border border-gray-200 overflow-hidden">
                {/* Statut global */}
                {r.registration_status === 'open' && (
                  <div className="flex items-center gap-2.5 px-5 py-3.5 bg-emerald-50 border-b border-emerald-100">
                    <TicketCheck size={15} className="text-emerald-600 shrink-0" aria-hidden="true" />
                    <span className="text-sm font-bold text-emerald-700">Inscriptions ouvertes</span>
                  </div>
                )}
                {r.registration_status === 'sold_out' && (
                  <div className="flex items-center gap-2.5 px-5 py-3.5 bg-red-50 border-b border-red-100">
                    <Lock size={15} className="text-red-500 shrink-0" aria-hidden="true" />
                    <span className="text-sm font-bold text-red-600">Complet</span>
                  </div>
                )}
                {r.registration_status === 'closed' && (
                  <div className="flex items-center gap-2.5 px-5 py-3.5 bg-gray-100 border-b border-gray-200">
                    <Lock size={15} className="text-zinc-400 shrink-0" aria-hidden="true" />
                    <span className="text-sm font-bold text-zinc-500">Inscriptions fermées</span>
                  </div>
                )}

                {/* Liste des formats */}
                {r.formats && r.formats.length > 0 && (
                  <div className="divide-y divide-gray-100">
                    {r.formats
                      .filter((fmt, idx, arr) =>
                        arr.findIndex((f) => f.category === fmt.category && f.is_relay === fmt.is_relay) === idx
                      )
                      .map((fmt) => {
                        const fmtPrice = fmt.price ?? r.price_euros;
                        return (
                          <div key={`${fmt.category}-${fmt.is_relay}`} className="flex items-center justify-between gap-3 px-5 py-3">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-zinc-800">
                                {fmt.is_relay ? 'Relais' : categoryLabel(fmt.category)}
                              </span>
                            </div>
                            <div className="flex items-center gap-3">
                              {fmtPrice && (
                                <span className="text-sm font-mono font-bold text-zinc-900">
                                  {fmtPrice}€
                                </span>
                              )}
                              {r.website_url && (
                                <a
                                  href={r.website_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-zinc-300 hover:text-zinc-600 transition-colors"
                                  aria-label={`S'inscrire — ${fmt.is_relay ? 'Relais' : categoryLabel(fmt.category)}`}
                                >
                                  <ArrowRight size={14} aria-hidden="true" />
                                </a>
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}

                {/* Fallback : pas de formats mais un prix global */}
                {(!r.formats || r.formats.length === 0) && r.price_euros && (
                  <div className="flex items-center justify-between px-5 py-3">
                    <span className="text-sm font-bold text-zinc-800">Inscription</span>
                    <span className="text-sm font-mono font-bold text-zinc-900">{r.price_euros}€</span>
                  </div>
                )}

                {/* CTA S'inscrire */}
                {r.website_url && r.registration_status !== 'closed' && (
                  <div className="px-5 py-4 border-t border-gray-100">
                    <a
                      href={r.website_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-zinc-900 text-white text-sm font-bold hover:bg-zinc-800 transition-colors duration-200"
                    >
                      S&apos;inscrire
                      <ArrowRight size={14} aria-hidden="true" />
                    </a>
                  </div>
                )}
              </section>
            )}

            {/* Weather */}
```

**Step 2 : Vérifier visuellement**

```bash
npm run dev
```

Tester sur des courses avec des cas variés :
- Course avec `formats` (ex: un Ironman avec M + XL + Relais)
- Course sans `formats` mais avec `price_euros`
- Course avec `registration_status = 'open'`
- Course avec `registration_status = 'sold_out'` ou `null`

Attendu : le bloc s'affiche proprement en haut de la sidebar dans chaque cas.

**Step 3 : Commit**

```bash
git add app/courses/[slug]/page.tsx
git commit -m "feat: bloc inscriptions en haut de la sidebar (statut + formats + CTA)"
```

---

### Task 3 : Retirer le bloc statut redondant dans le Hero

**Contexte :** Le Hero affiche déjà le statut dans les badges (lignes 234–248). Maintenant que la sidebar affiche aussi le statut de manière plus détaillée, les badges hero restent utiles (visibles immédiatement) donc **ne pas les supprimer**. Task annulée.

---

### Task 4 : Vérification finale

**Step 1 : Build production**

```bash
npm run build
```
Attendu : 0 erreur TypeScript, 0 erreur ESLint.

**Step 2 : Tester mobile**

Ouvrir DevTools → responsive 375px.
Attendu : le bloc inscriptions est lisible, le bouton CTA est full-width et tappable.

**Step 3 : Commit final si tout est bon**

```bash
git add .
git commit -m "chore: vérification build sidebar inscriptions"
```

---

## Résumé des changements

| Fichier | Type | Description |
|---------|------|-------------|
| `app/courses/[slug]/page.tsx` | Modify | Ajout imports `TicketCheck`, `Lock` + nouveau bloc inscriptions sidebar |

**Aucune migration DB, aucun nouveau fichier, aucun nouveau composant.**
