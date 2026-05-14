# CLAUDE.md — narbo-nordik

## Projet
Application web PWA pour la section **running & trail** du club Narbo Nordik (Narbonne). Gestion des athlètes, coachs, séances, statistiques et notifications.

## Design system
- **Primary** : `#000000` (noir, identité brand)
- **Accent** : `#6CCBE6` (cyan Narbo Nordik)
- **Tokens sémantiques** dans `src/index.css` (success/warning/danger/info + échelles 50→900)
- **Primitives UI partagées** dans `src/components/ui/` : `Button`, `Card`, `Badge`, `StatusBadge`, `EmptyState`, `ConfirmDialog`, `Toast`
- **Règle** : ne jamais hardcoder de couleurs Tailwind (`bg-red-500`, `bg-amber-50`...) ni de hex. Toujours passer par les tokens.

## Stack technique
- **Build :** Vite 7
- **Framework :** React 19 (SPA avec react-router-dom v7)
- **Langage :** TypeScript (strict)
- **UI :** Tailwind CSS 4, Lucide icons
- **Backend :** Supabase (auth + DB)
- **Graphiques :** Chart.js + react-chartjs-2
- **Dates :** date-fns
- **PWA :** vite-plugin-pwa + Workbox
- **Déploiement :** Vercel

## Commandes
```bash
npm run dev       # Serveur de développement
npm run build     # Build production (tsc + vite build)
npm run lint      # ESLint
npm run preview   # Preview du build
```

## Architecture
```
src/               → Code source React
public/            → Assets statiques
supabase/          → Configuration Supabase
supabase-schema.sql           → Schéma initial de la DB
supabase-migration-*.sql      → Migrations successives (phase2 à phase6)
dist/              → Build de production
```

## Base de données
- Schéma principal : `supabase-schema.sql`
- Migrations appliquées séquentiellement : phase2, phase3, phase4, phase5, phase6
- Migrations spécifiques : restrict-notifications, session-nordiks

## Documents
- `Guide-Athlete-NarboNordik.docx` — Guide utilisateur athlète
- `Guide-Coach-NarboNordik.docx` — Guide utilisateur coach

## Conventions
- Composants React en PascalCase
- Fichiers en kebab-case
- Français pour les contenus utilisateur, anglais pour le code
- Toujours tester le build avant de déployer (`npm run build`)
