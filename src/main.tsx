import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { registerChunkErrorReload } from './lib/chunkReload'

// Résilience aux décalages de chunks après déploiement : recharge la page une
// seule fois si un import dynamique lazy échoue (ancien hash référencé par le
// service worker). À enregistrer avant tout import() de route lazy.
registerChunkErrorReload()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
