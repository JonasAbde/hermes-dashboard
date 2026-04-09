/// <reference types="vite/client" />
const TOKEN_KEY: string = import.meta.env.VITE_TOKEN_KEY || 'hermes_dashboard_token'
const CSRF_KEY = 'hermes_dashboard_csrf_token'

export function getToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY) } catch { return null }
}

export function setToken(token: string): void {
  try { localStorage.setItem(TOKEN_KEY, token) } catch {} // acceptable: localStorage quota error — best-effort only
}

export function getCsrfToken(): string | null {
  try { return localStorage.getItem(CSRF_KEY) } catch { return null }
}

export function setCsrfToken(token: string): void {
  try { localStorage.setItem(CSRF_KEY, token) } catch {}
}

export function clearToken(): void {
  try { localStorage.removeItem(TOKEN_KEY) } catch {} // acceptable: localStorage quota error — best-effort only
  try { localStorage.removeItem(CSRF_KEY) } catch {}
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

function composeAbortSignal(timeoutMs?: number, externalSignal?: AbortSignal | null): { signal: AbortSignal | undefined, cleanup: () => void } {
  if (!timeoutMs) {
    return { signal: externalSignal ?? undefined, cleanup: () => {} }
  }

  const controller = new AbortController()
  let timeoutId: ReturnType<typeof setTimeout> | undefined

  const onExternalAbort = () => {
    controller.abort()
  }

  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort()
    } else {
      externalSignal.addEventListener('abort', onExternalAbort, { once: true })
    }
  }

  timeoutId = setTimeout(() => {
    controller.abort()
  }, timeoutMs)

  const cleanup = () => {
    if (timeoutId) clearTimeout(timeoutId)
    externalSignal?.removeEventListener('abort', onExternalAbort)
  }

  return { signal: controller.signal, cleanup }
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
      const data = await res.json().catch(() => ({}))
      if (data?.csrfToken) setCsrfToken(data.csrfToken)
      return token
    }
    return null
  } catch {
    return null
  }
}

// Wrapper around fetch that auto-attaches auth token
export async function apiFetch(url: string | URL, opts: ApiFetchOptions = {}): Promise<Response> {
  const method = String(opts.method || 'GET').toUpperCase()
  const csrfToken = getCsrfToken()
  const needsCsrf = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...authHeaders(),
    ...(needsCsrf && csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
    ...(opts.headers || {}),
  }
  // Don't set Content-Type for FormData
  if (opts.body instanceof FormData) delete headers['Content-Type']

  const { signal, cleanup } = composeAbortSignal(opts.timeout, opts.signal)
  let res: Response
  try {
    res = await fetch(url, {
      ...opts,
      headers,
      signal,
    })
  } finally {
    cleanup()
  }

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
