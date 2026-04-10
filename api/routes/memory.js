import express from 'express'
import { readFileSync, writeFileSync, appendFileSync, statSync, existsSync } from 'fs'
import { join, resolve } from 'path'
import { authMiddleware } from './_lib.js'
const router = express.Router()

// GET /api/memory — memory overview
router.get('/', authMiddleware, (req, res) => {
  const memoryPath = resolve(process.env.HOME || '/home/empir', '.hermes/MEMORY.md')
  let chars = 0, entries = 0, content = ''
  try {
    if (existsSync(memoryPath)) {
      const raw = readFileSync(memoryPath, 'utf8')
      chars = raw.length
      entries = (raw.match(/^#{1,3}\s/gm) || []).length + (raw.match(/^-\s/gm) || []).length
      content = raw
    }
  } catch {}
  const memory_pct = Math.min(Math.round((chars / 10000) * 100), 100)
  res.json({ memory_pct, memory: { chars, entries }, content })
})

// GET /api/memory/stats — memory statistics
router.get('/stats', authMiddleware, (req, res) => {
  const memoryPath = resolve(process.env.HOME || '/home/empir', '.hermes/MEMORY.md')
  const MAX_CHARS = 10000

  let chars = 0
  let entries = 0

  try {
    if (existsSync(memoryPath)) {
      const raw = readFileSync(memoryPath, 'utf8')
      chars = raw.length
      // Count section headers and bullet points as "entries"
      entries = (raw.match(/^#{1,3}\s/gm) || []).length + (raw.match(/^-\s/gm) || []).length
    }
  } catch (e) {
    // Best-effort
  }

  const memory_pct = Math.min(Math.round((chars / MAX_CHARS) * 100), 100)

  res.json({
    memory_pct,
    memory: { chars, entries }
  })
})

router.get('/graph', authMiddleware, (req, res) => {
  res.json({
    nodes: [
      { id: 'root', label: 'Hermes Mind', type: 'root' },
      // Categories
      { id: 'user', label: 'Jonas', type: 'category' },
      { id: 'business', label: 'Rendetalje ApS', type: 'category' },
      { id: 'skills', label: 'Skillset', type: 'category' },
      // Items under Jonas
      { id: 'rawan', label: 'Rawan (Hustru)', type: 'subcategory', content: 'Gift den 18/4-2026' },
      { id: 'aarhus', label: 'Aarhus', type: 'subcategory', content: 'Bopæl' },
      { id: 'ps5', label: 'PlayStation 5', type: 'item', content: 'Spiller Crimson Desert' },
      // Items under Business
      { id: 'leads', label: 'Lead Management', type: 'subcategory', content: 'Drift af Rendetalje leads' },
      { id: 'erp', label: 'ERP Integration', type: 'item', content: 'Specialist i ERP systemer' },
      // Items under Skills
      { id: 'coding', label: 'Automated Coding', type: 'subcategory', content: 'React, Node.js, Python' },
      { id: 'mcp', label: 'MCP Mastery', type: 'item', content: 'Expert i Model Context Protocol' }
    ],
    links: [
      { source: 'root', target: 'user', value: 5 },
      { source: 'root', target: 'business', value: 5 },
      { source: 'root', target: 'skills', value: 5 },
      { source: 'user', target: 'rawan', value: 3 },
      { source: 'user', target: 'aarhus', value: 3 },
      { source: 'user', target: 'ps5', value: 1 },
      { source: 'business', target: 'leads', value: 3 },
      { source: 'business', target: 'erp', value: 1 },
      { source: 'skills', target: 'coding', value: 3 },
      { source: 'skills', target: 'mcp', value: 1 }
    ]
  })
})

// GET /api/memory/entries — structured entries from MEMORY.md
router.get('/entries', authMiddleware, (req, res) => {
  const memoryPath = resolve(process.env.HOME || '/home/empir', '.hermes/MEMORY.md')
  const limit = parseInt(req.query.limit) || 100
  try {
    if (!existsSync(memoryPath)) return res.json({ entries: [], total: 0 })
    const raw = readFileSync(memoryPath, 'utf8')
    const lines = raw.split('\n')
    const entries = []
    let current = null
    for (const line of lines) {
      const headingMatch = line.match(/^(#{1,3})\s+(.+)/)
      if (headingMatch) {
        if (current) entries.push(current)
        current = { id: `h${entries.length}`, heading: headingMatch[2], level: headingMatch[1].length, lines: [] }
      } else if (current && line.trim()) {
        const bulletMatch = line.match(/^-\s+(.+)/)
        if (bulletMatch) {
          current.lines.push({ type: 'bullet', text: bulletMatch[1] })
        } else if (line.startsWith('§')) {
          current.lines.push({ type: 'separator', text: line.trim() })
        } else {
          current.lines.push({ type: 'text', text: line.trim() })
        }
      }
    }
    if (current) entries.push(current)
    res.json({ entries: entries.slice(0, limit), total: entries.length })
  } catch (err) {
    res.json({ entries: [], total: 0, error: err.message })
  }
})

// POST /api/memory/entries — add entry to MEMORY.md
router.post('/entries', authMiddleware, (req, res) => {
  const memoryPath = resolve(process.env.HOME || '/home/empir', '.hermes/MEMORY.md')
  try {
    const { heading, text, level = 2 } = req.body
    if (!heading) return res.status(400).json({ error: 'Heading required' })
    const prefix = '#'.repeat(Math.min(Math.max(level, 1), 3))
    const entry = `\n${prefix} ${heading}\n${text ? '- ' + text + '\n' : ''}`
    appendFileSync(memoryPath, entry)
    res.json({ ok: true, added: { heading, text } })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/memory/entries — remove entry by heading from MEMORY.md
router.delete('/entries', authMiddleware, (req, res) => {
  const memoryPath = resolve(process.env.HOME || '/home/empir', '.hermes/MEMORY.md')
  try {
    const { heading } = req.body
    if (!heading) return res.status(400).json({ error: 'Heading required' })
    let raw = readFileSync(memoryPath, 'utf8')
    const lines = raw.split('\n')
    const out = []
    let skipping = false
    let skipLevel = 0
    for (const line of lines) {
      const m = line.match(/^(#{1,3})\s+(.+)/)
      if (m) {
        if (m[2].trim() === heading.trim()) {
          skipping = true
          skipLevel = m[1].length
          continue
        }
        if (skipping && m[1].length <= skipLevel) {
          skipping = false
        }
      }
      if (!skipping) out.push(line)
    }
    writeFileSync(memoryPath, out.join('\n'))
    res.json({ ok: true, removed: heading })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/memory/activity — memory change log
router.get('/activity', authMiddleware, (req, res) => {
  const memoryPath = resolve(process.env.HOME || '/home/empir', '.hermes/MEMORY.md')
  try {
    if (!existsSync(memoryPath)) return res.json({ activity: [] })
    const stat = statSync(memoryPath)
    res.json({
      activity: [{
        action: 'modified',
        timestamp: stat.mtimeMs,
        size: stat.size,
        path: memoryPath
      }]
    })
  } catch (err) {
    res.json({ activity: [], error: err.message })
  }
})

// GET /api/memory/timeline — timeline view of memory entries
router.get('/timeline', authMiddleware, (req, res) => {
  const memoryPath = resolve(process.env.HOME || '/home/empir', '.hermes/MEMORY.md')
  const limit = parseInt(req.query.limit) || 50
  const offset = parseInt(req.query.offset) || 0
  try {
    if (!existsSync(memoryPath)) return res.json({ timeline: [], total: 0 })
    const raw = readFileSync(memoryPath, 'utf8')
    const lines = raw.split('\n')
    const items = []
    for (const line of lines) {
      const m = line.match(/^(#{1,3})\s+(.+)/)
      if (m) {
        items.push({ heading: m[2], level: m[1].length, type: 'section' })
      } else if (line.match(/^-\s+/)) {
        items.push({ text: line.replace(/^-\s+/, ''), type: 'entry' })
      }
    }
    res.json({ timeline: items.slice(offset, offset + limit), total: items.length })
  } catch (err) {
    res.json({ timeline: [], total: 0, error: err.message })
  }
})

// GET /api/memory/search — search memory content
router.get('/search', authMiddleware, (req, res) => {
  const memoryPath = resolve(process.env.HOME || '/home/empir', '.hermes/MEMORY.md')
  const q = (req.query.q || '').toLowerCase()
  if (!q) return res.json({ results: [], total: 0 })
  try {
    if (!existsSync(memoryPath)) return res.json({ results: [], total: 0 })
    const raw = readFileSync(memoryPath, 'utf8')
    const lines = raw.split('\n')
    const results = []
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].toLowerCase().includes(q)) {
        results.push({
          line: i + 1,
          text: lines[i].trim(),
          context: (lines[i - 1] || '').trim() + ' | ' + (lines[i + 1] || '').trim()
        })
      }
    }
    res.json({ results: results.slice(0, 50), total: results.length })
  } catch (err) {
    res.json({ results: [], total: 0, error: err.message })
  }
})

// POST /api/memory/compact — compact/summarize memory
router.post('/compact', authMiddleware, (req, res) => {
  const memoryPath = resolve(process.env.HOME || '/home/empir', '.hermes/MEMORY.md')
  try {
    if (!existsSync(memoryPath)) return res.json({ ok: false, error: 'No memory file' })
    const raw = readFileSync(memoryPath, 'utf8')
    // Remove duplicate blank lines and trailing whitespace
    const compacted = raw
      .split('\n')
      .map(l => l.trimEnd())
      .filter((l, i, arr) => !(l === '' && arr[i - 1] === ''))
      .join('\n')
      .trim() + '\n'
    writeFileSync(memoryPath, compacted)
    const saved = raw.length - compacted.length
    res.json({ ok: true, before: raw.length, after: compacted.length, saved })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
