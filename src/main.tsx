import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

// Theme Chart.js — best-effort, ne doit JAMAIS bloquer le mount React
import('./lib/chartTheme')
  .then(({ applyChartTheme }) => {
    try {
      applyChartTheme();
    } catch (err) {
      console.warn('[chartTheme] non-blocking init error:', err);
    }
  })
  .catch((err) => console.warn('[chartTheme] dynamic import failed:', err));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
