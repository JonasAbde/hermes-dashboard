/// <reference types="vite/client" />
const TOKEN_KEY: string = import.meta.env.VITE_TOKEN_KEY || 'hermes_dashboard_token'

export function getToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY) } catch { return null }
}

export function setToken(token: string): void {
  try { localStorage.setItem(TOKEN_KEY, token) } catch {} // acceptable: localStorage quota error — best-effort only
}

export function clearToken(): void {
  try { localStorage.removeItem(TOKEN_KEY) } catch {} // acceptable: localStorage quota error — best-effort only
}

export function isAuthenticated(): boolean {
  return !!getToken()
}

export function authHeaders(): Record<string, string> {
  const token = getToken()
  return token ? { 'Authorization': `Bearer ${token}` } : {}
}

interface ApiFetchOptions extends RequestInit {
  timeout?: number
  headers?: Record<string, string>
}

// Token refresh state — prevents race conditions on multiple simultaneous 401s
let refreshPromise: Promise<string | null> | null = null

// Attempt to refresh the auth token by calling POST /api/auth/refresh
async function refreshToken(): Promise<string | null> {
  const token = getToken()
  if (!token) return null

  try {
    const res = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
    if (res.ok) {
      // Refresh successful — return the same valid token (server confirmed it's good)
      return token
    }
    return null
  } catch {
    return null
  }
}

// Wrapper around fetch that auto-attaches auth token
export async function apiFetch(url: string | URL, opts: ApiFetchOptions = {}): Promise<Response> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...authHeaders(),
    ...(opts.headers || {}),
  }
  // Don't set Content-Type for FormData
  if (opts.body instanceof FormData) delete headers['Content-Type']

  const res = await fetch(url, {
    ...opts,
    headers,
    signal: opts.timeout
      ? (() => {
          const ac = new AbortController()
          const t = setTimeout(() => ac.abort(), opts.timeout)
          opts.signal?.addEventListener('abort', () => clearTimeout(t))
          return ac.signal
        })()
      : opts.signal,
  })

  // Handle 401 → attempt one token refresh before failing
  if (res.status === 401) {
    // Use existing refresh promise if one is in flight (race condition guard)
    let refreshAttempt = refreshPromise ?? refreshToken()
    refreshPromise = refreshAttempt.then(result => {
      refreshPromise = null
      return result
    })

    const newToken = await refreshAttempt

    if (newToken) {
      // Refresh succeeded — retry the original request with the refreshed token
      const retryHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${newToken}`,
        ...(opts.headers || {}),
      }
      if (opts.body instanceof FormData) delete retryHeaders['Content-Type']

      const retryRes = await fetch(url, {
        ...opts,
        headers: retryHeaders,
        signal: opts.signal,
      })

      // If retry also fails with 401, the token is truly invalid
      if (retryRes.status === 401) {
        clearToken()
        window.location.href = '/login'
        throw new Error('Unauthorized')
      }

      return retryRes
    }

    // Refresh failed — clear token and redirect to login
    clearToken()
    window.location.href = '/login'
    throw new Error('Unauthorized')
  }

  return res
}
