const TOKEN_KEY = import.meta.env.VITE_TOKEN_KEY || 'hermes_dashboard_token'

export function getToken() {
  try { return localStorage.getItem(TOKEN_KEY) } catch { return null }
}

export function setToken(token) {
  try { localStorage.setItem(TOKEN_KEY, token) } catch {}
}

export function clearToken() {
  try { localStorage.removeItem(TOKEN_KEY) } catch {}
}

export function isAuthenticated() {
  return !!getToken()
}

export function authHeaders() {
  const token = getToken()
  return token ? { 'Authorization': `Bearer ${token}` } : {}
}

// Wrapper around fetch that auto-attaches auth token
export async function apiFetch(url, opts = {}) {
  const headers = {
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

  // Handle 401 → clear token and redirect to login
  if (res.status === 401) {
    clearToken()
    window.location.href = '/login'
    throw new Error('Unauthorized')
  }

  return res
}
