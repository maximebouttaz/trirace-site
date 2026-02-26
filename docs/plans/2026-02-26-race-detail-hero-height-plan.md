# Race Detail Hero Height Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Réduire la hauteur du hero de la page détail course de 70vh à 50vh, avec padding inférieur ajusté.

**Architecture:** Modification purement CSS dans un server component. 2 lignes à changer dans `app/courses/[slug]/page.tsx`. Aucun nouveau composant, aucune migration DB.

**Tech Stack:** Next.js App Router (server component), Tailwind CSS 4

---

### Task 1 : Modifier la hauteur et le padding du hero

**Files:**
- Modify: `app/courses/[slug]/page.tsx:177`
- Modify: `app/courses/[slug]/page.tsx:204`

**Step 1 : Changer la hauteur du hero**

Localiser la ligne ~177 :
```tsx
<div className={`h-[70vh] min-h-[500px] ${...} relative`}>
```

Remplacer `h-[70vh] min-h-[500px]` par `h-[50vh] min-h-[400px]` :
```tsx
<div className={`h-[50vh] min-h-[400px] ${!r.image_url ? (r.image_gradient || 'bg-gradient-to-br from-zinc-600 to-zinc-800') : ''} relative`}>
```

**Step 2 : Ajuster le padding inférieur du contenu**

Localiser la ligne ~204 :
```tsx
<div className="absolute bottom-0 w-full px-6 md:px-10 pb-20 pt-16">
```

Remplacer `pb-20` par `pb-12` :
```tsx
<div className="absolute bottom-0 w-full px-6 md:px-10 pb-12 pt-16">
```

**Step 3 : Vérifier visuellement**

```bash
npm run dev
```

Ouvrir `http://localhost:3000/courses/ironman-nice-2026` (ou tout autre slug valide).

Attendu :
- Le hero est nettement moins imposant (~500px vs ~700px)
- Le titre, tagline et méta-row sont visibles en bas du hero sans être trop tassés
- L'image/gradient couvre bien le hero sans espaces blancs

**Step 4 : Vérifier le build**

```bash
npm run build
```

Attendu : 0 erreur TypeScript, 0 warning ESLint.

**Step 5 : Commit**

```bash
git add app/courses/[slug]/page.tsx
git commit -m "feat(race-detail): réduire hero 70vh → 50vh + ajuster padding"
```
