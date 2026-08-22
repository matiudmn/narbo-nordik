import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['logo-club.png', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'Narbo Nordik Club',
        short_name: 'Narbo Nordik',
        description: "Application d'entraînement running & trail",
        theme_color: '#000000',
        background_color: '#000000',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        // Identité de l'app, figée explicitement. Sans ce champ, Chrome la
        // dérive de start_url : l'app serait alors liée à l'origine courante,
        // et un futur passage sur un domaine du club casserait toutes les
        // installations existantes (nouvelle app, membres déconnectés).
        // La valeur '/' reproduit à l'identique l'identité déjà dérivée
        // aujourd'hui : aucune installation en place n'est affectée.
        id: '/',
        lang: 'fr',
        // Chrome n'affiche sa boîte d'installation enrichie, façon fiche
        // d'application, que si le manifeste porte à la fois `description` et
        // `screenshots`. Sans elles, le membre voit l'invite minimale : c'est
        // précisément le signal de confiance qui manque à quelqu'un de 65 ans
        // devant une installation inhabituelle.
        screenshots: [
          {
            src: 'screenshot-accueil.png',
            sizes: '720x1565',
            type: 'image/png',
            form_factor: 'narrow',
            label: 'Ta VMA, tes allures et ton assiduité',
          },
          {
            src: 'screenshot-suivi.png',
            sizes: '720x1565',
            type: 'image/png',
            form_factor: 'narrow',
            label: 'Ton suivi de saison, séance par séance',
          },
        ],
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // jspdf (~386 Ko), html2canvas (~199 Ko), chart-vendor (~197 Ko) et
        // xlsx (~492 Ko) sont lazy-loadés (React.lazy / import dynamique) et
        // rarement utilisés (export PDF/PNG, pages avec graphique, dépôt d'un
        // classeur Excel sur la page Import) : les précacher au premier
        // chargement gonfle inutilement le SW pour la quasi-totalité des visites.
        // Ils restent servis normalement par le réseau au premier usage, puis mis
        // en cache via runtimeCaching ci-dessous pour rester fluides ensuite.
        // Les captures du manifeste (~530 Ko à elles deux) ne sont lues que par
        // la boîte d'installation du navigateur, jamais par l'app elle-même.
        // Les précacher gonflerait le service worker de près de 30 % pour
        // chaque visiteur, sans qu'aucun n'en tire quoi que ce soit.
        globIgnores: [
          '**/jspdf*.js',
          '**/html2canvas*.js',
          '**/chart-vendor*.js',
          '**/xlsx*.js',
          '**/screenshot-*.png',
        ],
        runtimeCaching: [
          {
            urlPattern: /\/assets\/(jspdf|html2canvas|chart-vendor|xlsx)[^/]*\.js$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'heavy-chunks-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  build: {
    modulePreload: {
      // chart-vendor (~69 Ko gzip) n'est importé que par deux pages lazy
      // (ClubProfile, VmaHistory) : il ne doit pas être modulepreloadé à
      // chaque chargement de page, seulement chargé au moment du lazy import.
      resolveDependencies: (_filename, deps) => deps.filter(dep => !dep.includes('chart-vendor')),
    },
    rollupOptions: {
      output: {
        // Split heavy libs into their own chunks so the initial bundle
        // stays under control. Chart.js is only used on a few pages —
        // lazy loaded via React.lazy in App.tsx anyway, but vendor
        // chunking lets the browser cache it independently.
        //
        // manualChunks doit être une fonction (et non l'objet ci-dessus) :
        // la forme objet ne capture que les paquets listés littéralement,
        // donc les runtimes partagés comme react/jsx-runtime (importé par
        // toutes les pages, y compris les pages à graphique) retombaient
        // dans le premier chunk qui les référençait, ici chart-vendor —
        // ce qui le tirait dans le chunk d'entrée au lieu de rester lazy.
        // La fonction range explicitement tout module react-* dans
        // react-vendor avant de tester chart.js, pour que chart-vendor ne
        // contienne plus que chart.js/react-chartjs-2.
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (
            id.includes('/react/') ||
            id.includes('/react-dom/') ||
            id.includes('react-router') ||
            id.includes('/scheduler/')
          ) {
            return 'react-vendor'
          }
          if (id.includes('chart.js') || id.includes('react-chartjs-2')) {
            return 'chart-vendor'
          }
          if (id.includes('/motion/') || id.includes('/motion-')) {
            return 'motion-vendor'
          }
          if (id.includes('@supabase/supabase-js')) {
            return 'supabase-vendor'
          }
          if (id.includes('date-fns')) {
            return 'date-vendor'
          }
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
})
