import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // priceless-kare-a8eb2d : worktree git imbriqué (sessions Claude parallèles), hors périmètre du lint
  globalIgnores(['dist', 'priceless-kare-a8eb2d']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
  {
    // Contexts : Provider + hook useX co-localisés (idiome React standard).
    // Fast Refresh retombe en full reload sur ces fichiers, sans impact en prod ;
    // éclater les hooks toucherait ~50 fichiers importeurs pour un gain DX nul.
    files: ['src/contexts/**/*.tsx'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },
])
