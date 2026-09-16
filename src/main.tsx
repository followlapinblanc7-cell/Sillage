import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

declare global {
  interface Window {
    __sillageInstallPrompt?: Event | null
  }
}

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault()
  window.__sillageInstallPrompt = event
  window.dispatchEvent(new Event('sillage-install-available'))
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

