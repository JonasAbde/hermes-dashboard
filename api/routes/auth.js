import express from 'express'
import { AUTH_SECRET, generateCsrfToken } from './_lib.js'
const router = express.Router()

router.post('/verify', (req, res) => {
  const { token } = req.body
  console.log('[AUTH] Verify attempt:', token === AUTH_SECRET ? 'SUCCESS' : 'FAIL');
  
  if (!AUTH_SECRET) return res.json({ ok: true, hasToken: false })
  
  if (token === AUTH_SECRET) {
    const csrfToken = generateCsrfToken(token)
    return res.json({ ok: true, hasToken: true, csrfToken })
  }
  res.status(401).json({ ok: false, error: 'Invalid token' })
})

// POST /refresh — refresh auth token
router.post('/refresh', (req, res) => {
  // Token refresh — re-verify existing token and issue fresh session
  const authHeader = req.headers.authorization
  const token = authHeader?.replace('Bearer ', '') || req.headers['x-auth-token']
  if (!token) return res.status(401).json({ ok: false, error: 'No token provided' })
  
  const expectedToken = process.env.DASHBOARD_TOKEN || process.env.AUTH_SECRET || AUTH_SECRET
  if (expectedToken && token !== expectedToken) {
    return res.status(401).json({ ok: false, error: 'Invalid token' })
  }
  
  res.json({ ok: true, token, refreshed: true, ts: Date.now() })
})

export default router
