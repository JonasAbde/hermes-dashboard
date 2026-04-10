// api/routes/activity.js — recent activity events for dashboard
import { Router } from 'express'
import { Database, DB_PATH } from './_lib.js'

const router = Router()

// GET /activity — return recent activity events
router.get('/', (req, res) => {
  try {
    const db = new Database(DB_PATH, { readonly: true })
    const limit = Math.min(parseInt(req.query.limit) || 50, 200)
    
    // Try to read from sessions table as activity source
    let events = []
    try {
      events = db.prepare(`
        SELECT 
          id as id,
          'session' as type,
          COALESCE(title, 'Session') as title,
          model as detail,
          started_at as timestamp,
          (input_tokens + output_tokens) as tokens
        FROM sessions 
        ORDER BY started_at DESC 
        LIMIT ?
      `).all(limit)
    } catch (e) {
      // Table might not exist
    }

    res.json({ events, count: events.length })
  } catch (e) {
    res.json({ events: [], count: 0 })
  }
})

export default router

