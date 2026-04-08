// api/routes/logs.js — GET /api/logs/files, GET /api/logs (SSE)
import { Router } from 'express'
import {
  existsSync,
  openSync,
  readSync,
  closeSync,
  readFileSync,
  readdirSync,
  statSync,
  join,
  HERMES,
} from './_lib.js'

const router = Router()

// GET /api/logs/files
router.get('/api/logs/files', (req, res) => {
  try {
    const logsDir = join(HERMES, 'logs')
    if (!existsSync(logsDir)) return res.json({ files: [] })

    const files = readdirSync(logsDir)
      .filter(f => f.endsWith('.log'))
      .map(f => {
        const path = join(logsDir, f)
        const stat = statSync(path)
        return {
          name: f,
          label: f === 'gateway.log' ? 'gateway.log (Hermes gateway)'
            : f === 'agent.log' ? 'agent.log (Hermes agent)'
            : f === 'errors.log' ? 'errors.log (Errors only)'
            : f.replace('.log', '').startsWith('mcp-') ? f
            : f,
          size_kb: Math.round(stat.size / 1024),
          modified: stat.mtime.toISOString(),
          is_mcp: f.startsWith('mcp-'),
          is_builtin: ['gateway.log', 'agent.log', 'errors.log'].includes(f),
        }
      })
      .sort((a, b) => {
        if (a.is_builtin && !b.is_builtin) return -1
        if (!a.is_builtin && b.is_builtin) return 1
        if (a.is_mcp && !b.is_mcp) return 1
        if (!a.is_mcp && b.is_mcp) return -1
        return a.name.localeCompare(b.name)
      })

    res.json({ files })
  } catch (e) {
    res.status(500).json({ error: e.message, files: [] })
  }
})

// GET /api/logs — SSE live tail
router.get('/api/logs', (req, res) => {
  const fileParam = req.query.file || 'gateway'
  const logFile = join(HERMES, 'logs', `${fileParam}.log`)
  const levels = (req.query.levels || 'all').split(',').filter(Boolean)
  const filterAll = levels.includes('all') || levels.length === 0

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  let lastSize = 0
  let clientGone = false
  let iterations = 0
  const MAX_ITERATIONS = 15000

  const sendHeartbeat = () => {
    if (!clientGone) res.write(': heartbeat\n\n')
  }

  const detectLevel = (line) => {
    const m = line.match(/,\d{3}\s+(ERROR|WARN|WARNING|DEBUG|INFO)\s+/)
    if (m) {
      const l = m[1].toLowerCase()
      if (l === 'warning') return 'warn'
      return l
    }
    if (line.includes('ERROR')) return 'error'
    if (line.includes('WARN') || line.includes('WARNING')) return 'warn'
    if (line.includes('DEBUG')) return 'debug'
    return 'info'
  }

  const parseMessage = (line) => {
    const meta = {}
    const tsMatch = line.match(/^(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:,\d{3})?)/)
    if (tsMatch) meta.ts = tsMatch[1]
    const inbound = line.match(/platform=(\w+)/)
    const userMatch = line.match(/user=(\w+)/)
    const chatMatch = line.match(/chat=([-\d]+)/)
    const sessionMatch = line.match(/session[=_]([\w:]+)/)
    if (inbound) meta.platform = inbound[1]
    if (userMatch) meta.user = userMatch[1]
    if (chatMatch) meta.chat = chatMatch[1]
    if (sessionMatch) meta.session_id = sessionMatch[1]
    if (line.includes('Failed') || line.includes('Error') || line.includes('error')) {
      meta.is_error_context = true
    }
    return meta
  }

  const streamLogs = () => {
    try {
      if (!existsSync(logFile)) {
        if (!clientGone) res.write(`data: ${JSON.stringify({ type: 'info', msg: 'Log file not found' })}\n\n`)
        return
      }
      const stat = statSync(logFile)
      const MAX_INITIAL_SIZE = 1024 * 1024
      if (stat.size > lastSize) {
        const bytesToRead = Math.min(stat.size - lastSize, MAX_INITIAL_SIZE)
        const fd = openSync(logFile, 'r')
        const buf = Buffer.alloc(bytesToRead)
        readSync(fd, buf, 0, buf.length, stat.size - bytesToRead)
        closeSync(fd)
        lastSize = stat.size
        const newContent = buf.toString('utf8')
        const lines = newContent.split('\n').filter(l => l.trim())
        for (const line of lines) {
          if (clientGone) break
          const level = detectLevel(line)
          if (!filterAll && !levels.includes(level)) continue
          const meta = parseMessage(line)
          res.write(`data: ${JSON.stringify({ type: 'log', level, msg: line, ...meta })}\n\n`)
        }
      }
    } catch (e) {
      console.error('SSE streamLogs error:', e.message)
    }
  }

  try {
    if (existsSync(logFile)) {
      const content = readFileSync(logFile, 'utf8')
      const allLines = content.split('\n').filter(Boolean).slice(-50)
      for (const line of allLines) {
        if (clientGone) break
        const level = detectLevel(line)
        if (!filterAll && !levels.includes(level)) continue
        const meta = parseMessage(line)
        res.write(`data: ${JSON.stringify({ type: 'log', level, msg: line, ...meta })}\n\n`)
      }
      lastSize = statSync(logFile).size
    } else {
      res.write(`data: ${JSON.stringify({ type: 'info', msg: 'Log file not found' })}\n\n`)
    }
  } catch { res.write(`data: ${JSON.stringify({ type: 'info', msg: 'Could not read log file' })}\n\n`) }

  const iv = setInterval(() => {
    if (clientGone || iterations >= MAX_ITERATIONS) {
      clearInterval(iv)
      if (!clientGone) res.end()
      return
    }
    iterations++
    streamLogs()
    sendHeartbeat()
  }, 200)

  req.on('close', () => {
    clientGone = true
    clearInterval(iv)
  })
})

export default router
