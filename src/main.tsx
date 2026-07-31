import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import * as Sentry from '@sentry/react'
import './index.css'
import App from './App'
import { registerChunkErrorReload } from './lib/chunkReload'

// Remontée d'erreurs prod : strictement conditionnée à la présence du DSN
// (absent en local/preview par défaut => zéro effet, zéro requête). Config
// sobre : pas de replay, échantillonnage de traces faible.
if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,
    tracesSampleRate: 0.1,
  })
}

// Résilience aux décalages de chunks après déploiement : recharge la page une
// seule fois si un import dynamique lazy échoue (ancien hash référencé par le
// service worker). À enregistrer avant tout import() de route lazy.
registerChunkErrorReload()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
