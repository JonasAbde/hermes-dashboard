// api/routes/auth.js — POST /api/auth/verify, GET /api/csrf-token
import { Router } from 'express'
import { AUTH_SECRET, generateCsrfToken, getCsrfToken } from './_lib.js'

const router = Router()

router.post('/api/auth/verify', (req, res) => {
  const token = String(req.body?.token || '').trim()
  if (!AUTH_SECRET) {
    const sessionKey = token || 'dev-session'
    const csrfToken = generateCsrfToken(sessionKey)
    return res.json({ ok: true, hasToken: false, csrfToken })
  }

  const ok = token === AUTH_SECRET
  if (ok) {
    // Set httpOnly cookie with security flags:
    // Secure: only sent over HTTPS (browser enforces when available)
    // SameSite=Strict: prevents cross-site request forgery
    // HttpOnly: inaccessible to client-side JavaScript
    const sessionKey = token
    const csrfToken = generateCsrfToken(sessionKey)
    res.setHeader('Set-Cookie',
      `hermes_dashboard_token=${token}; Path=/; SameSite=Strict; HttpOnly; Secure`)
    res.json({ ok, hasToken: !!AUTH_SECRET, csrfToken })
  } else {
    res.json({ ok })
  }
})

// GET /api/csrf-token — returns current CSRF token if authenticated
router.get('/api/auth/csrf-token', (req, res) => {
  let sessionKey = null
  if (req.headers.cookie) {
    const match = req.headers.cookie.match(/(?:^|;\s*)hermes_dashboard_token=([^;]+)/)
    if (match) sessionKey = match[1]
  }
  if (!sessionKey) {
    const authHeader = req.headers.authorization?.replace('Bearer ', '')
    if (authHeader) sessionKey = authHeader
  }
  if (!sessionKey) {
    return res.status(401).json({ error: 'Not authenticated', code: 'unauthenticated' })
  }
  const token = getCsrfToken(sessionKey)
  if (!token) {
    return res.status(401).json({ error: 'No CSRF token found', code: 'csrf_not_found' })
  }
  res.json({ csrfToken: token })
})

// POST /api/auth/refresh — refreshes CSRF token, returns new one
// Accepts current valid token, validates it, generates fresh CSRF token
router.post('/api/auth/refresh', (req, res) => {
  const token = String(req.body?.token || '').trim()
  if (!AUTH_SECRET) {
    const sessionKey = token || 'dev-session'
    const csrfToken = generateCsrfToken(sessionKey)
    return res.json({ ok: true, hasToken: false, csrfToken })
  }

  if (!token) {
    return res.status(400).json({ error: 'Token required', code: 'token_required' })
  }
  if (token !== AUTH_SECRET) {
    return res.status(401).json({ error: 'Invalid token', code: 'invalid_token' })
  }
  // Generate fresh CSRF token for this session
  const csrfToken = generateCsrfToken(token)
  res.json({ ok: true, csrfToken })
})

export default router
