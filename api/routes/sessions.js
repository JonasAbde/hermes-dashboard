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
} from './_lib.js'

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
