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
  const method = String(opts.method || 'GET').toUpperCase()
  const csrfToken = getCsrfToken()
  const csrfExempt = url === '/api/auth/refresh' || url === '/api/auth/csrf-token' || url === '/api/chat'
  const nextOpts = { ...opts, headers: { ...(opts.headers || {}) } }

  if (token) {
    nextOpts.headers = { ...nextOpts.headers, Authorization: `Bearer ${token}` }
  }
  if (csrfToken && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && !csrfExempt) {
    nextOpts.headers = { ...nextOpts.headers, 'X-CSRF-Token': csrfToken }
  }

  let res = await ogFetch(url, nextOpts)

  if (res.status === 403 && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && !csrfExempt && token) {
    const body = await res.clone().json().catch(() => ({}))
    if (body?.code === 'csrf_missing' || body?.code === 'csrf_invalid') {
      const refreshRes = await ogFetch('/api/auth/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ token }),
      })
      if (refreshRes.ok) {
        const refreshBody = await refreshRes.json().catch(() => ({}))
        if (refreshBody?.csrfToken) {
          setCsrfToken(refreshBody.csrfToken)
          nextOpts.headers = { ...nextOpts.headers, 'X-CSRF-Token': refreshBody.csrfToken }
          res = await ogFetch(url, nextOpts)
        }
      }
    }
  }

  if (res.status === 401) {
    clearToken()
    window.location.href = '/login'
  }

  return res
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <App />
      <PwaInstallPrompt />
    </BrowserRouter>
  </React.StrictMode>,
)
