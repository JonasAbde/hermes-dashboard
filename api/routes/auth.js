import express from 'express'
import { AUTH_SECRET } from './_lib.js'
const router = express.Router()

router.post('/verify', (req, res) => {
  const { token } = req.body
  console.log('[AUTH] Verify attempt:', token === AUTH_SECRET ? 'SUCCESS' : 'FAIL');
  
  if (!AUTH_SECRET) return res.json({ ok: true, hasToken: false })
  
  if (token === AUTH_SECRET) {
    return res.json({ ok: true, hasToken: true, csrfToken: 'fake-csrf-token' })
  }
  res.status(401).json({ ok: false, error: 'Invalid token' })
})

export default router
