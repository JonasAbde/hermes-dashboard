// api/routes/search.js — GET /api/search
import { Router } from 'express'
import {
  execAsync,
  pyQuery,
} from './_lib.js'

const router = Router()

// GET /api/search?q=...
router.get('/', async (req, res) => {
  const q = (req.query.q || '').trim()
  if (!q || q.length < 2) return res.json({ results: [] })
  try {
    const results = await pyQuery('fts', `'${q.replace(/'/g, "''")}'`)
    res.json(results)
  } catch (e) {
    res.json({ results: [], error: e.message })
  }
})

export default router
