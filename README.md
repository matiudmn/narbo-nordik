# Narbo Nordik, application du club

PWA de suivi des athlètes et des coachs de la section running/trail du Narbo Nordik Club (Narbonne), projet bénévole, dépôt public.

## Stack

- Vite 7, React 19 (react-router-dom v7), TypeScript strict
- Tailwind CSS 4
- Supabase : authentification, base de données, fonctions Edge (Deno)
- PWA : vite-plugin-pwa + Workbox
- Déploiement : Vercel

## Démarrer

Version Node requise : voir `.nvmrc` (22).

```bash
npm ci
cp .env.example .env
```

Renseigner dans `.env` les variables définies dans `.env.example` : `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY`.

```bash
npm run dev     # serveur de développement
npm run build   # build de production
npm run lint    # ESLint
npx vitest run  # tests unitaires
deno test --no-check supabase/functions/  # tests des fonctions Edge (comme en CI)
```

## Structure du dépôt

- `src/` : code source React
- `public/` : assets statiques
- `supabase/migrations/` : migrations CLI, source de vérité de la base de données (voir [`supabase/MIGRATIONS.md`](./supabase/MIGRATIONS.md))
- `supabase/functions/` : fonctions Edge (`ai-coach-summary`, `ai-ocr`, `ai-search-filters`, `analyze-validation`, `daily-session-digest`, `delete-account`, `membership-notify`, `send-notification-email`, `weekly-digest`)
- `supabase/legacy/` : SQL historiques, dépréciés (pré-CLI)
- `docs/` : guides utilisateurs, PRD, backlog, onboarding
- `legal/` : politique de confidentialité
- `scripts/` : scripts ponctuels

## Base de données

- Source de vérité unique : [`supabase/MIGRATIONS.md`](./supabase/MIGRATIONS.md)
- `supabase db reset` reconstruit toute la base depuis zéro
- Toute modification de schéma est une nouvelle migration dans `supabase/migrations/`

## Déploiement

- **Vercel** : application SPA, rewrites et en-têtes de sécurité définis dans `vercel.json`.
- **Supabase** : base de données et fonctions Edge.
- **CI (GitHub Actions)** : lint, `tsc`, vitest, tests Deno et build, sur chaque push vers `main` et chaque pull request.

## Documentation

- [`CLAUDE.md`](./CLAUDE.md) : conventions du projet
- [`docs/`](./docs/) : guides, PRD, backlog
- [`legal/privacy-policy.md`](./legal/privacy-policy.md) : politique de confidentialité
