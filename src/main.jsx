import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'
import { getToken, clearToken, getCsrfToken, setCsrfToken } from './utils/auth'
import PwaInstallPrompt from './components/PwaInstallPrompt'

// ── Service Worker Registration ────────────────────────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
      // Auto-update when a new SW takes over
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing
        if (!newWorker) return
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // New content available — could show a toast or auto-reload
            console.log('[PWA] New version available — refresh to update')
          }
        })
      })

      // Handle controller change (user accepted new SW)
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        window.location.reload()
      })

      console.log('[PWA] Service Worker registered:', registration.scope)
    } catch (err) {
      console.warn('[PWA] SW registration failed:', err.message)
    }
  })
}

// ── Auth-aware fetch ────────────────────────────────────────────────────────
const ogFetch = window.fetch.bind(window)
window.fetch = async (url, opts = {}) => {
  if (typeof url !== 'string' || !url.startsWith('/api') || url === '/api/auth/verify') {
    return ogFetch(url, opts)
  }

  const token = getToken()
  const csrfToken = getCsrfToken()
  
  const headers = {
    ...opts.headers,
    'Accept': 'application/json',
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  
  if (csrfToken) {
    headers['X-CSRF-Token'] = csrfToken
  }

  const response = await ogFetch(url, { ...opts, headers })

  if (response.status === 401 && url !== '/api/auth/login') {
    clearToken()
    // App renders LoginPage at '/' when token is missing
    window.location.href = '/'
  }

  // Update CSRF token if returned in headers
  const newCsrf = response.headers.get('X-CSRF-Token')
  if (newCsrf) {
    setCsrfToken(newCsrf)
  }

  return response
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <App />
      <PwaInstallPrompt />
    </BrowserRouter>
  </React.StrictMode>
)
