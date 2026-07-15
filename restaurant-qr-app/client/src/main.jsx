import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Global chunk load error recovery listener
window.addEventListener('error', (e) => {
  if (e.message && (e.message.includes('Failed to fetch dynamically imported module') || e.message.includes('ChunkLoadError'))) {
    window.location.reload();
  }
}, true);

window.addEventListener('unhandledrejection', (e) => {
  if (e.reason && (String(e.reason).includes('Failed to fetch dynamically imported module') || String(e.reason).includes('ChunkLoadError'))) {
    window.location.reload();
  }
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

