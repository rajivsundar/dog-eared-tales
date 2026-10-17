import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import './index.css'
import App from './app/App'
import { listenForInstallPrompt } from './pwa/install'
import { profileManager } from './stores'

// The browser offers the install prompt only once, so listen before anything else.
listenForInstallPrompt()
// Open the reading profiles (and finish any migration) while the page loads.
void profileManager.ready()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
