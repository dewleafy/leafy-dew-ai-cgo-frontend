import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './ErrorBoundary.tsx'
import { AuthGate } from './AuthGate.tsx'
import { ShopPage } from './ShopPage.tsx'

// /shop is the public link-in-bio page. It needs no login and never loads the private app.
const isShop = window.location.pathname.replace(/\/+$/, '') === '/shop'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary label="Leafy Dew">
      {isShop ? (
        <ShopPage />
      ) : (
        <AuthGate>
          <App />
        </AuthGate>
      )}
    </ErrorBoundary>
  </StrictMode>,
)
