// api/routes/lib/auth.ts — authentication and CSRF utilities
import { randomBytes } from 'crypto'
import { readFileSync } from 'fs'
import { join } from 'path'
import os from 'os'
import type { Request, Response, NextFunction } from 'express'

const HOME_DIR = os.homedir()
const HERMES = join(HOME_DIR, '.hermes')

// ── Auth setup ──────────────────────────────────────────────────────────────
let AUTH_SECRET = ''
try {
  const envContent = readFileSync(join(HERMES, '.env'), 'utf8')
  const match = envContent.match(/^DASHBOARD_TOKEN=(.*)$/m)
  if (match) AUTH_SECRET = match[1]
} catch {}

// Auth skip paths — must use full API paths for req.baseUrl + req.path matching
const AUTH_SKIP = new Set<string>([
  '/api/auth/verify',
  '/api/auth/refresh',
  '/api/stats',
  '/api/gateway',
  '/api/health',
  '/api/ready',
  '/api/ekg',
  '/api/heatmap',
  '/api/chat',
  '/api/onboarding/status',
  '/api/settings',
  '/api/logs/files',
  '/api/system/info',
  '/api/metrics/lean',
  '/api/webhook/github',
])

// Public GET prefixes — read-only endpoints accessible without auth
const PUBLIC_GET_PREFIXES = [
  '/api/sessions', '/api/activity', '/api/skills', '/api/mcp',
  '/api/recommendations', '/api/profile', '/api/logs', '/api/search',
  '/api/cron', '/api/models', '/api/config', '/api/github',
  '/api/agent/fleet', '/api/agent/list', '/api/agent/status', '/api/control/services',
  '/api/control/agent/status', '/api/control/models',
]

// Keys that should NEVER be returned in plaintext
const SENSITIVE_KEYS = /^ANTHROPIC_API_KEY$|^OPENAI_API_KEY$|^GOOGLE_API_KEY$|^TOGETHER_API_KEY$|^GROQ_API_KEY$|^OPENROUTER_API_KEY$|^TELEGRAM_BOT_TOKEN$|^DASHBOARD_TOKEN$|^AUTH_SECRET$|^SECRET/i

// Auth middleware — checks full URL path (baseUrl + path)
// Supports both Authorization header and cookie-based authentication
function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (!AUTH_SECRET) return next()
  const fullPath = (req.baseUrl + req.path).replace(/\/+$/, '')

  // Allow explicitly public paths (all methods)
  if (AUTH_SKIP.has(fullPath) || [...AUTH_SKIP].some(p => fullPath.startsWith(p + '/'))) {
    return next()
  }

  // Allow GET on read-only public data
  if (req.method === 'GET' && PUBLIC_GET_PREFIXES.some(p => fullPath === p || fullPath.startsWith(p + '/'))) {
    return next()
  }

  let token = req.headers.authorization?.replace('Bearer ', '')
             || req.headers['x-auth-token']
             || req.query.token as string

  // Check for cookie-based auth (hermes_dashboard_token)
  if (!token && req.cookies && req.cookies.hermes_dashboard_token) {
    token = req.cookies.hermes_dashboard_token
  }
  // Fallback to legacy cookie parsing for backward compatibility
  if (!token && req.headers.cookie) {
    const match = req.headers.cookie.match(/(?:^|;\s*)hermes_dashboard_token=([^;]+)/)
    if (match) token = match[1]
  }

  if (token !== AUTH_SECRET) {
    res.status(401).json({ error: 'Unauthorized', code: 'invalid_token' })
    return
  }
  next()
}

// ── CSRF protection ────────────────────────────────────────────────────────
// In-memory store: session key (cookie value or auth token) → CSRF token (32-byte hex)
const csrfTokens = new Map<string, string>()

function generateCsrfToken(sessionKey: string): string {
  const token = randomBytes(32).toString('hex')
  csrfTokens.set(sessionKey, token)
  return token
}

function getCsrfToken(sessionKey: string): string | null {
  return csrfTokens.get(sessionKey) || null
}

function removeCsrfToken(sessionKey: string): void {
  csrfTokens.delete(sessionKey)
}

function rotateCsrfToken(sessionKey: string): string {
  const newToken = randomBytes(32).toString('hex')
  csrfTokens.set(sessionKey, newToken)
  return newToken
}

// Middleware: require CSRF token on state-changing requests
function csrfMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Check if CSRF protection is disabled via environment variable
  if (process.env.DISABLE_CSRF === 'true') return next()

  // Only check POST/PUT/PATCH/DELETE
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next()
  // Skip auth endpoints and other safe routes
  const safePaths = new Set([
    '/api/auth/verify',
    '/api/auth/refresh',
    '/api/chat',
  ])
  const fullPath = req.baseUrl + req.path
  if (safePaths.has(fullPath)) return next()

  const token = req.headers['x-csrf-token']
  if (!token) {
    res.status(403).json({ error: 'CSRF token required', code: 'csrf_missing' })
    return
  }

  // Resolve session key from cookie or Authorization header
  let sessionKey = null
  if (req.cookies && req.cookies.hermes_dashboard_token) {
    sessionKey = req.cookies.hermes_dashboard_token
  }
  // Fallback to manual cookie parsing for backward compatibility
  if (!sessionKey && req.headers.cookie) {
    const match = req.headers.cookie.match(/(?:^|;\s*)hermes_dashboard_token=([^;]+)/)
    if (match) sessionKey = match[1]
  }
  // Fallback: use Authorization header value as session key
  if (!sessionKey) {
    const authHeader = req.headers.authorization?.replace('Bearer ', '')
    if (authHeader) sessionKey = authHeader
  }

  if (!sessionKey) {
    res.status(401).json({ error: 'Unauthorized', code: 'invalid_token' })
    return
  }

  const validToken = getCsrfToken(sessionKey)
  if (!validToken || token !== validToken) {
    res.status(403).json({ error: 'CSRF token invalid', code: 'csrf_invalid' })
    return
  }

  // Rotate CSRF token after successful validation for state-changing operations
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    rotateCsrfToken(sessionKey)
  }

  next()
}

export {
  AUTH_SECRET,
  AUTH_SKIP,
  SENSITIVE_KEYS,
  authMiddleware,
  generateCsrfToken,
  getCsrfToken,
  removeCsrfToken,
  rotateCsrfToken,
  csrfMiddleware,
}
