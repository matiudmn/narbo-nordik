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
supabase/migrations/          → Migrations CLI (SOURCE DE VÉRITÉ, voir supabase/MIGRATIONS.md)
supabase/functions/           → Edge Functions
supabase/legacy/               → SQL pré-CLI (DÉPRÉCIÉ, consolidé dans le baseline)
docs/              → PRD, backlog, guides utilisateurs, onboarding
legal/             → Politique de confidentialité (importée par l'app)
scripts/           → Scripts ponctuels
dist/              → Build de production
```

## Base de données
- **Source de vérité : `supabase/migrations/`** (migrations CLI Supabase horodatées).
  `supabase db reset` reconstruit toute la base depuis zéro. Voir **`supabase/MIGRATIONS.md`**.
- Le baseline `supabase/migrations/20260307000000_baseline.sql` capture l'état pré-CLI
  (consolide l'ancien `supabase-schema.sql` + phase2/4/5 + session-nordiks + restrict-notifications).
- Les fichiers SQL dans **`supabase/legacy/`** (`supabase-schema.sql`, `supabase-migration-phase*.sql`,
  `-session-nordiks`, `-restrict-notifications`) sont **historiques/dépréciés** : ne plus s'y fier.
- Toute nouvelle modif de schéma : ajouter un fichier dans `supabase/migrations/` (jamais à la racine).

## Documents
- `docs/Guide-Athlete-NarboNordik.docx` : guide utilisateur athlète
- `docs/Guide-Coach-NarboNordik.docx` : guide utilisateur coach
- `docs/BACKLOG-EVOLUTIONS-2026.md` : backlog d'évolutions 2026
- `docs/garmin-application-brief.md` : brief de candidature Garmin

## Conventions
- Composants React en PascalCase
- Fichiers en kebab-case
- Français pour les contenus utilisateur, anglais pour le code
- Toujours tester le build avant de déployer (`npm run build`)
