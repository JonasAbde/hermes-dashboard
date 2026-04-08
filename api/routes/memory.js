// api/routes/memory.js — memory overview, entries, timeline, search, graph, compact, stats
import { Router } from 'express'
import {
  execAsync,
  execSync,
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
  join,
  HERMES,
  pyQuery,
  parseYaml,
} from './_lib.js'

const router = Router()

// GET /api/memory
router.get('/api/memory', (req, res) => {
  try {
    const memDirs = [
      { path: join(HERMES, 'memory'),        type: 'memory' },
      { path: join(HERMES, 'memories'),      type: 'memory' },
      { path: join(HERMES, 'workspace'),      type: 'workspace' },
    ]

    const CACHE_PATTERNS = /models_dev_cache|channel_directory|gateway_state|heartbeat-state|skills_prompt/
    const CONFIG_PATTERNS = /\.(json|yaml|yml|toml)$/
    const DAILY_PATTERN = /^\d{4}-\d{2}-\d{2}/
    const CURATED = ['MEMORY.md', 'USER.md', 'SOUL.md', 'HEARTBEAT.md', 'IDENTITY.md', 'AGENTS.md', 'TOOLS.md', 'CONFIG.md', 'SETUP.md', 'README.md', 'spec.md']

    let allFiles = []
    for (const { path: dir, type } of memDirs) {
      if (!existsSync(dir)) continue
      try {
        readdirSync(dir).forEach(name => {
          if (!name.endsWith('.md') && !name.endsWith('.json')) return
          const fullPath = join(dir, name)
          const stat = statSync(fullPath)
          const sizeKb = stat.size / 1024
          const mtime = stat.mtime.toISOString()

          let category = 'other'
          if (CURATED.includes(name)) category = 'curated'
          else if (DAILY_PATTERN.test(name)) category = 'daily'
          else if (name === '.skills_prompt_snapshot.json') category = 'snapshot'
          else if (CACHE_PATTERNS.test(name)) category = 'cache'

          let preview = ''
          try {
            preview = readFileSync(fullPath, 'utf8').slice(0, 150).replace(/\n+/g, ' ')
          } catch {}

          let entryCount = 0
          let lastEntry = null
          if (name.endsWith('.md') && category !== 'snapshot') {
            try {
              const content = readFileSync(fullPath, 'utf8')
              entryCount = (content.match(/^##?\s/mg) || []).length
              const lastModified = content.match(/^(?:updated|modified):\s*(.+)$/mi)?.[1]
              lastEntry = lastModified || mtime
            } catch {}
          }

          allFiles.push({
            name,
            path: dir,
            size_kb: sizeKb,
            mtime,
            preview,
            category,
            entry_count: entryCount,
            last_entry: lastEntry,
          })
        })
      } catch {}
    }

    const storageFiles = allFiles.filter(f => f.category !== 'cache')
    const totalKb = storageFiles.reduce((s, f) => s + f.size_kb, 0)
    const cacheKb = allFiles.filter(f => f.category === 'cache').reduce((s, f) => s + f.size_kb, 0)
    const curatedFiles = allFiles.filter(f => f.category === 'curated')
    const totalEntries = curatedFiles.reduce((s, f) => s + (f.entry_count || 0), 0)
    const lastMemoryUpdate = curatedFiles
      .map(f => f.mtime)
      .sort()
      .reverse()[0] || null
    const byCategory = {
      curated:  allFiles.filter(f => f.category === 'curated').length,
      daily:    allFiles.filter(f => f.category === 'daily').length,
      cache:    allFiles.filter(f => f.category === 'cache').length,
      other:    allFiles.filter(f => f.category === 'other').length,
    }

    res.json({
      files: allFiles,
      storage_kb: Math.round(totalKb * 10) / 10,
      cache_kb: Math.round(cacheKb * 10) / 10,
      max_kb: 2500,
      total_entries: totalEntries,
      last_memory_update: lastMemoryUpdate,
      by_category: byCategory,
    })
  } catch (e) {
    res.json({ files: [], storage_kb: 0, cache_kb: 0, max_kb: 2500, total_entries: 0, by_category: {} })
  }
})

// GET /api/memory/activity
router.get('/api/memory/activity', (req, res) => {
  try {
    const memDirs = [
      join(HERMES, 'memory'),
      join(HERMES, 'memories'),
      join(HERMES, 'workspace'),
    ]

    const events = []
    for (const dir of memDirs) {
      if (!existsSync(dir)) continue
      try {
        for (const name of readdirSync(dir)) {
          if (!name.endsWith('.md') && !name.endsWith('.json')) continue
          if (name === 'models_dev_cache.json') continue
          const fullPath = join(dir, name)
          try {
            const stat = statSync(fullPath)
            const sizeKb = Math.round(stat.size / 1024 * 10) / 10
            events.push({
              name,
              type: name.endsWith('.md') ? 'note' : 'config',
              mtime: stat.mtime.toISOString(),
              size_kb: sizeKb,
              category: name.startsWith('20') ? 'daily' : 'system',
            })
          } catch {}
        }
      } catch {}
    }

    events.sort((a, b) => new Date(b.mtime) - new Date(a.mtime))

    const now = new Date()
    const dayGrid = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now)
      d.setDate(d.getDate() - (6 - i))
      return {
        date: d.toISOString().slice(0, 10),
        label: d.toLocaleDateString('da-DK', { weekday: 'short' }),
        count: 0,
      }
    })

    for (const ev of events) {
      const evDate = ev.mtime.slice(0, 10)
      const day = dayGrid.find(d => d.date === evDate)
      if (day) day.count++
    }

    const recentWrites = events.slice(0, 5).map(e => ({
      name: e.name,
      type: e.type,
      mtime: e.mtime,
      size_kb: e.size_kb,
    }))

    const lastWrite = events[0]?.mtime || null

    res.json({
      recent_writes: recentWrites,
      last_write: lastWrite,
      day_grid: dayGrid,
      total_events: events.length,
    })
  } catch (e) {
    res.json({ recent_writes: [], day_grid: [], last_write: null })
  }
})

// GET /api/memory/entries
router.get('/api/memory/entries', (req, res) => {
  const pyScript = join(new URL('.', import.meta.url).pathname, '../memory_entries.py')
  const target = req.query.target || ''
  const source = req.query.source || ''
  const tag = req.query.tag || ''
  const q = req.query.q || ''
  const limit = Math.min(100, parseInt(req.query.limit || 50))
  const offset = Math.max(0, parseInt(req.query.offset || 0))

  let args = 'entries'
  if (target) args += ` --target ${target}`
  if (source) args += ` --source ${source}`
  if (tag) args += ` --tag ${tag}`
  if (q) args += ` --q ${q}`
  args += ` --limit ${limit} --offset ${offset}`

  execAsync(`python3 "${pyScript}" ${args}`, { timeout: 15000 })
    .then(({ stdout }) => {
      try { res.json(JSON.parse(stdout.trim())) }
      catch { res.status(500).json({ error: 'Failed to parse memory entries' }) }
    })
    .catch(e => {
      console.error('/api/memory/entries error:', e.message)
      res.status(500).json({ error: e.message })
    })
})

// GET /api/memory/timeline
router.get('/api/memory/timeline', (req, res) => {
  const pyScript = join(new URL('.', import.meta.url).pathname, '../memory_entries.py')
  const limit = Math.min(100, parseInt(req.query.limit || 50))
  const offset = Math.max(0, parseInt(req.query.offset || 0))

  execAsync(`python3 "${pyScript}" timeline ${limit} ${offset}`, { timeout: 15000 })
    .then(({ stdout }) => {
      try { res.json(JSON.parse(stdout.trim())) }
      catch { res.status(500).json({ error: 'Failed to parse timeline' }) }
    })
    .catch(e => {
      console.error('/api/memory/timeline error:', e.message)
      res.status(500).json({ error: e.message })
    })
})

// GET /api/memory/search
router.get('/api/memory/search', (req, res) => {
  const pyScript = join(new URL('.', import.meta.url).pathname, '../memory_entries.py')
  const q = (req.query.q || '').trim()
  const limit = Math.min(50, parseInt(req.query.limit || 20))

  if (!q) return res.json({ results: [], total: 0, query: '' })

  execAsync(`python3 "${pyScript}" search ${JSON.stringify(q)} ${limit}`, { timeout: 15000 })
    .then(({ stdout }) => {
      try { res.json(JSON.parse(stdout.trim())) }
      catch { res.status(500).json({ error: 'Failed to parse search results' }) }
    })
    .catch(e => {
      console.error('/api/memory/search error:', e.message)
      res.status(500).json({ error: e.message })
    })
})

// GET /api/memory/entries/graph
router.get('/api/memory/entries/graph', (req, res) => {
  const pyScript = join(new URL('.', import.meta.url).pathname, '../memory_entries.py')

  execAsync(`python3 "${pyScript}" graph`, { timeout: 15000 })
    .then(({ stdout }) => {
      try { res.json(JSON.parse(stdout.trim())) }
      catch { res.status(500).json({ error: 'Failed to parse graph data' }) }
    })
    .catch(e => {
      console.error('/api/memory/entries/graph error:', e.message)
      res.status(500).json({ error: e.message })
    })
})

// POST /api/memory/entries
router.post('/api/memory/entries', (req, res) => {
  const { content, target, conversation_id } = req.body
  if (!content || !content.trim()) {
    return res.status(400).json({ success: false, error: 'content required' })
  }

  const pyScript = join(new URL('.', import.meta.url).pathname, '../memory_entries.py')
  const targetArg = (target === 'user') ? 'user' : 'memory'
  const contentEscaped = content.trim().replace(/"/g, '\\"')

  execAsync(
    `python3 "${pyScript}" add ${targetArg} "${contentEscaped}"`,
    { timeout: 15000 }
  )
    .then(({ stdout }) => {
      try {
        const result = JSON.parse(stdout.trim())
        execAsync(`python3 "${pyScript}" index`, { timeout: 10000 }).catch(() => {})
        res.json(result)
      }
      catch { res.status(500).json({ success: false, error: 'Failed to add entry' }) }
    })
    .catch(e => {
      console.error('/api/memory/entries POST error:', e.message)
      res.status(500).json({ success: false, error: e.message })
    })
})

// GET /api/memory/index
router.get('/api/memory/index', (req, res) => {
  const idxPath = join(HERMES, 'memories', 'entries_index.json')
  try {
    if (existsSync(idxPath)) {
      const raw = readFileSync(idxPath, 'utf8')
      const data = JSON.parse(raw)
      return res.json(data)
    }
    const pyScript = join(new URL('.', import.meta.url).pathname, '../memory_entries.py')
    execAsync(`python3 "${pyScript}" index`, { timeout: 10000 }).catch(() => {})
    res.json({ error: 'index not yet built', generated_at: new Date().toISOString() })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// GET /api/memory/graph
router.get('/api/memory/graph', async (req, res) => {
  const pyScript = join(new URL('.', import.meta.url).pathname, '../memory_graph.py')
  try {
    const { stdout } = await execAsync(`python3 "${pyScript}"`, { timeout: 30000 })
    res.json(JSON.parse(stdout))
  } catch (err) {
    console.error('Error generating graph:', err)
    res.status(500).json({ nodes: [], links: [], error: 'Failed to generate graph' })
  }
})

// GET /api/memory/stats
router.get('/api/memory/stats', async (req, res) => {
  try {
    const memPath = join(HERMES, 'memories', 'MEMORY.md')
    const userPath = join(HERMES, 'memories', 'USER.md')

    let memStats = { size_kb: 0, chars: 0, lines: 0, path: memPath, exists: false }
    let userStats = { size_kb: 0, chars: 0, lines: 0, path: userPath, exists: false }

    if (existsSync(memPath)) {
      const content = readFileSync(memPath, 'utf8')
      const stat = statSync(memPath)
      memStats = {
        size_kb: Math.round(stat.size / 1024 * 10) / 10,
        chars: content.length,
        lines: content.split('\n').length,
        entries: (content.match(/^##? /gm) || []).length,
        path: memPath,
        exists: true,
        mtime: stat.mtime.toISOString(),
      }
    }

    if (existsSync(userPath)) {
      const content = readFileSync(userPath, 'utf8')
      const stat = statSync(userPath)
      userStats = {
        size_kb: Math.round(stat.size / 1024 * 10) / 10,
        chars: content.length,
        lines: content.split('\n').length,
        entries: (content.match(/^##? /gm) || []).length,
        path: userPath,
        exists: true,
        mtime: stat.mtime.toISOString(),
      }
    }

    const MAX_CHARS = 250_000
    const memPct = Math.min(Math.round((memStats.chars / MAX_CHARS) * 100), 100)

    res.json({
      memory: memStats,
      user: userStats,
      memory_pct: memPct,
      max_chars: MAX_CHARS,
      total_kb: Math.round((memStats.size_kb + userStats.size_kb) * 10) / 10,
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// POST /api/memory/compact
router.post('/compact', async (req, res) => {
  const memPath = join(HERMES, 'memories', 'MEMORY.md')

  if (!existsSync(memPath)) {
    return res.status(404).json({ ok: false, error: 'MEMORY.md not found' })
  }

  try {
    const content = readFileSync(memPath, 'utf8')
    const originalSize = content.length

    let compacted = content.replace(/\n{3,}/g, '\n\n')
    compacted = compacted.split('\n').map(l => l.trimEnd()).join('\n')
    compacted = compacted.split('\n').filter(l => l.trim() !== '' || l === '').join('\n')
    compacted = compacted.trimEnd() + '\n'

    const newSize = compacted.length
    const saved = originalSize - newSize

    const backupPath = memPath + '.compact.bak'
    writeFileSync(backupPath, content, 'utf8')
    writeFileSync(memPath, compacted, 'utf8')

    res.json({
      ok: true,
      original_chars: originalSize,
      new_chars: newSize,
      saved_chars: saved,
      saved_pct: Math.round((saved / originalSize) * 100),
    })
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message })
  }
})

export default router
