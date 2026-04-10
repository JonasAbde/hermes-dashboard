import { Router } from 'express'

const router = Router()

// Mounted at /api/sessions in routes/index.js
router.get('/', (req, res) => {
  res.json({ ok: true, message: 'sessions endpoint' })
})

export default router
