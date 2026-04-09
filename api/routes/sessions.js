// api/routes/sessions.js
import { Router } from 'express'
import { HERMES_DB, getSessions } from './_lib.js'

const router = Router()

// GET /api/sessions
router.get('/', async (req, res) => {
  try {
    const sessions = await getSessions()
    res.json({ sessions, total: sessions.length, limit: 100 })
  } catch (err) {
    res.status(500).json({ error: 'Kunne ikke hente sessions' })
  }
})

// GET /api/sessions/:id/messages
router.get('/:id/messages', (req, res) => {
  const { id } = req.params
  try {
    const messages = HERMES_DB.prepare(`
      SELECT id, role, content, timestamp, tool_calls, reasoning
      FROM messages WHERE session_id = ? ORDER BY timestamp ASC
    `).all(id).map(m => {
      let tc = null;
      let rs = null;
      try { tc = m.tool_calls ? JSON.parse(m.tool_calls) : null } catch(e) {}
      try { rs = m.reasoning ? JSON.parse(m.reasoning) : null } catch(e) {}
      
      return {
        ...m,
        tool_calls: tc,
        reasoning: rs
      }
    })
    res.json({ session_id: id, messages })
  } catch (err) {
    res.status(500).json({ error: 'Fejl', details: err.message })
  }
})

// GET /api/sessions/search
router.get('/search', (req, res) => {
  const { q, limit = 20 } = req.query
  if (!q) return res.json({ results: [] })
  try {
    const results = HERMES_DB.prepare(`
      SELECT s.session_id, s.platform, s.title, s.created_at, 
             snippet(messages_fts, 2, '<mark>', '</mark>', '...', 20) as preview
      FROM messages_fts f
      JOIN sessions s ON f.session_id = s.session_id
      WHERE messages_fts MATCH ?
      LIMIT ?
    `).all(q, limit)
    res.json({ results, total: results.length })
  } catch (err) {
    res.json({ results: [], error: err.message })
  }
})

export default router
