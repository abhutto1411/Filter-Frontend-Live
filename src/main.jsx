import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { reloadOnceForStaleChunk } from './utils/lazyPage'
import BootErrorBoundary, { BootErrorScreen } from './components/BootErrorScreen'
import { paintBootError } from './utils/paintBootError'

// After a new Vercel deploy, cached index.html may reference deleted chunk files.
window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault()
  if (!reloadOnceForStaleChunk()) {
    paintBootError(event.payload || new Error('ChunkLoadError'))
  }
})

const el = document.getElementById('root')
const root = createRoot(el)

import('./App.jsx')
  .then((mod) => {
    const AppComponent = mod.default
    root.render(
      <StrictMode>
        <BootErrorBoundary>
          <AppComponent />
        </BootErrorBoundary>
      </StrictMode>,
    )
  })
  .catch((error) => {
    console.error('[boot] App module failed', error)
    try {
      root.render(
        <StrictMode>
          <BootErrorScreen error={error} />
        </StrictMode>,
      )
    } catch (renderErr) {
      console.error('[boot] render failed', renderErr)
      paintBootError(error || renderErr, el)
    }
  })
