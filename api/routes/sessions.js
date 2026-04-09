// api/routes/sessions.js — sessions, session detail, trace, messages, search
import { Router } from 'express'
import {
  existsSync,
  execAsync,
  readFileSync,
  readdirSync,
  statSync,
  join,
  pyQuery,
  HERMES,
  Database,
} from './_lib.js'
import os from 'os'

const HERMES_DB = join(os.homedir(), '.hermes', 'state.db')

const router = Router()

// GET /api/sessions
router.get('/api/sessions', (req, res) => {
  try {
    const sessionsDir = join(HERMES, 'sessions')
    const q = (req.query.q || '').toLowerCase()
    const page = Math.max(1, parseInt(req.query.page || 1))
    const limit = 25

    const sessions = []
    const files = readdirSync(sessionsDir).sort().reverse()

    for (const f of files) {
      if (!f.startsWith('session_') || !f.endsWith('.json')) continue
      try {
        const fullPath = join(sessionsDir, f)
        const obj = JSON.parse(readFileSync(fullPath, 'utf8'))
        const hasMessages = Array.isArray(obj.messages)
        const msgCount = obj.message_count ?? (hasMessages ? obj.messages.length : 0)
        const started = obj.session_start ? new Date(obj.session_start).getTime() / 1000 : null
        const title = obj.title || obj.subject || null

        if (q && !(title || '').toLowerCase().includes(q) &&
            !(obj.platform || '').toLowerCase().includes(q) &&
            !(obj.model || '').toLowerCase().includes(q)) continue

        sessions.push({
          id:             obj.session_id || obj.id || f.replace(/^session_|\.json$/g, ''),
          title:          title,
          source:         obj.platform || 'unknown',
          model:          obj.model || null,
          cost:           null,
          input_tokens:   null,
          output_tokens:  null,
          started_at:     started,
          ended_at:       null,
          message_count:  msgCount,
          last_updated:   obj.last_updated || null,
          file:           f,
        })
      } catch {}
    }

    const total = sessions.length
    const offset = (page - 1) * limit
    const paginated = sessions.slice(offset, offset + limit)

    res.json({
      sessions: paginated,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    })
  } catch (e) {
    console.error('/api/sessions error:', e.message)
    res.status(500).json({ sessions: [], total: 0, error: e.message })
  }
})

// GET /api/sessions/search — Full-text search using Hermes SQLite FTS5
router.get('/api/sessions/search', (req, res) => {
  const { q, limit = 20, sort = 'relevance', filter = 'all' } = req.query
  
  // Validate query
  if (!q || q.length < 2) {
    return res.json({ results: [], total: 0, error: 'q must be at least 2 characters' })
  }
  
  const parsedLimit = Math.min(Math.max(parseInt(limit) || 20, 1), 50)
  const searchQuery = q.trim()
  
  // Validate FTS5 database exists
  if (!existsSync(HERMES_DB)) {
    return res.json({ results: [], total: 0, error: 'FTS5 database not found' })
  }
  
  try {
    // Open database in read-only mode
    const db = new Database(HERMES_DB, { 
      readonly: true,
      fileMustExist: true 
    })
    
    // Sanitize query for FTS5 - escape special characters
    const sanitizedQuery = searchQuery
      .replace(/['"(){}*^+?.,\\^$|]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    
    if (!sanitizedQuery) {
      db.close()
      return res.json({ results: [], total: 0, error: 'Invalid search query' })
    }
    
    // Build time filter based on 'filter' parameter
    const now = Date.now() / 1000
    let timeCondition = ''
    if (filter === 'today') {
      timeCondition = `AND s.started_at >= ${now - 86400}`
    } else if (filter === 'week') {
      timeCondition = `AND s.started_at >= ${now - 86400 * 7}`
    } else if (filter === 'month') {
      timeCondition = `AND s.started_at >= ${now - 86400 * 30}`
    }
    
    // Build ORDER BY based on sort parameter
    let orderBy = 'bm25(messages_fts) DESC'
    if (sort === 'recent') {
      orderBy = 's.started_at DESC'
    } else if (sort === 'oldest') {
      orderBy = 's.started_at ASC'
    }
    
    // Search FTS5 and join with sessions table
    const searchSQL = `
      SELECT DISTINCT
        s.id AS session_id,
        s.source AS platform,
        s.title,
        s.started_at AS timestamp,
        snippet(messages_fts, 0, '<mark>', '</mark>', '…', 30) AS preview,
        bm25(messages_fts) AS score
      FROM messages_fts
      JOIN messages m ON m.id = messages_fts.rowid
      JOIN sessions s ON s.id = m.session_id
      WHERE messages_fts MATCH ?
        ${timeCondition}
      ORDER BY ${orderBy}
      LIMIT ?
    `
    
    // Try FTS5 search first
    let rows = []
    try {
      const stmt = db.prepare(searchSQL)
      rows = stmt.all(sanitizedQuery, parsedLimit)
    } catch (ftsError) {
      // FTS5 query failed - try fallback to LIKE search on messages
      console.warn('[sessions/search] FTS5 query failed, using LIKE fallback:', ftsError.message)
      
      const likeQuery = `%${sanitizedQuery}%`
      const fallbackSQL = `
        SELECT DISTINCT
          s.id AS session_id,
          s.source AS platform,
          s.title,
          s.started_at AS timestamp,
          substr(m.content, 1, 200) AS preview,
          0 AS score
        FROM messages m
        JOIN sessions s ON s.id = m.session_id
        WHERE m.content LIKE ? COLLATE NOCASE
          ${timeCondition}
        ORDER BY s.started_at DESC
        LIMIT ?
      `
      
      const stmt = db.prepare(fallbackSQL)
      rows = stmt.all(likeQuery, parsedLimit)
      
      // Add score based on recency as pseudo-relevance
      const maxTs = Math.max(...rows.map(r => r.timestamp || 0), 1)
      rows = rows.map(r => ({
        ...r,
        score: (r.timestamp || 0) / maxTs
      }))
    }
    
    db.close()
    
    // Format results
    const results = rows.map(row => ({
      session_id: row.session_id,
      platform: row.platform || 'unknown',
      title: row.title || `Session ${row.session_id.slice(-8)}`,
      preview: (row.preview || '').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
      timestamp: row.timestamp,
      score: row.score || 0
    }))
    
    res.json({
      results,
      total: results.length,
      query: searchQuery,
      filter,
      sort
    })
    
  } catch (error) {
    console.error('[sessions/search] Error:', error.message)
    res.status(500).json({ 
      results: [], 
      total: 0, 
      error: 'Search failed: ' + error.message 
    })
  }
})

// GET /api/sessions/:id
router.get('/api/sessions/:id', (req, res) => {
  const { id } = req.params
  try {
    const directPath = join(HERMES, 'sessions', `session_${id}.json`)
    let session = null

    if (existsSync(directPath)) {
      try {
        const obj = JSON.parse(readFileSync(directPath, 'utf8'))
        const msgs = obj.messages
        const hasMessages = Array.isArray(msgs)
        const msgCount = obj.message_count ?? (hasMessages ? msgs.length : 0)
        const sessionStart = obj.session_start || obj.started_at || null
        session = {
          id:             obj.session_id || obj.id || id,
          title:          obj.title || obj.subject || null,
          source:         obj.platform || obj.source || 'unknown',
          model:          obj.model || null,
          cost:           null,
          input_tokens:   null,
          output_tokens:   null,
          started_at:     sessionStart ? Math.floor(new Date(sessionStart).getTime() / 1000) : null,
          ended_at:       null,
          message_count:  msgCount,
          file:           `session_${id}.json`,
          platform:       obj.platform || null,
          session_start:  sessionStart,
          last_updated:   obj.last_updated || null,
        }
      } catch (e) {
        res.json({ error: 'Failed to parse session file: ' + e.message })
        return
      }
    }

    if (!session) {
      const files = readdirSync(join(HERMES, 'sessions'))
      for (const f of files) {
        if (!f.includes(id)) continue
        const fullPath = join(HERMES, 'sessions', f)
        try {
          const obj = JSON.parse(readFileSync(fullPath, 'utf8'))
          const msgs = obj.messages
          const hasMessages = Array.isArray(msgs)
          const msgCount = obj.message_count ?? (hasMessages ? msgs.length : 0)
          const sessionStart = obj.session_start || obj.started_at || null
          session = {
            id:             obj.session_id || obj.id || id,
            title:          obj.title || obj.subject || null,
            source:         obj.platform || obj.source || 'unknown',
            model:          obj.model || null,
            cost:           null,
            input_tokens:   null,
            output_tokens:  null,
            started_at:     sessionStart ? Math.floor(new Date(sessionStart).getTime() / 1000) : null,
            ended_at:       null,
            message_count:  msgCount,
            file:           f,
            platform:       obj.platform || null,
            session_start:  sessionStart,
            last_updated:   obj.last_updated || null,
          }
          break
        } catch {}
      }
    }

    res.json(session ?? { error: 'Session not found' })
  } catch (e) {
    res.json({ error: e.message })
  }
})

// GET /api/sessions/:id/trace
router.get('/api/sessions/:id/trace', async (req, res) => {
  try {
    res.json(await pyQuery('trace', req.params.id))
  } catch (e) {
    res.json({ steps: [] })
  }
})

// GET /api/sessions/:id/messages
router.get('/api/sessions/:id/messages', (req, res) => {
  const { id } = req.params
  try {
    const sessionsDir = join(HERMES, 'sessions')
    const files = readdirSync(sessionsDir)

    let messages = []

    for (const f of files) {
      if (!f.includes(id) && !id.includes(f.replace(/\..+$/, '').replace('session_', ''))) continue
      const path = join(sessionsDir, f)
      if (!statSync(path).isFile()) continue
      try {
        if (f.endsWith('.jsonl')) {
          const lines = readFileSync(path, 'utf8').split('\n').filter(Boolean)
          messages = messages.concat(lines.map(l => JSON.parse(l)))
        } else {
          const obj = JSON.parse(readFileSync(path, 'utf8'))
          if (Array.isArray(obj.messages)) {
            messages = messages.concat(obj.messages)
          } else {
            messages.push(obj)
          }
        }
      } catch {}
    }

    const cleaned = messages.map(m => {
      const role = m.role || m.type || 'unknown'
      let content = null
      if (typeof m.content === 'string') {
        content = m.content.slice(0, 500)
      } else if (Array.isArray(m.content) && m.content[0]?.text) {
        content = m.content[0].text.slice(0, 500)
      }
      if (!content && Array.isArray(m.tool_calls) && m.tool_calls.length > 0) {
        content = '[tool_calls] ' + m.tool_calls.map(t => {
          const fn = t.function || t
          return fn?.name || 'unknown'
        }).join(', ')
      }
      if (role === 'tool' && !content) {
        content = m.content?.slice(0, 500) || null
      }
      return {
        role,
        content,
        tool_name: m.tool_name || null,
        timestamp: m.created_at || m.timestamp || null,
      }
    })

    res.json({ messages: cleaned })
  } catch (e) {
    res.json({ messages: [], error: e.message })
  }
})

export default router
