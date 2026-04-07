import express from 'express'
import Database from 'better-sqlite3'
import { readFileSync, readdirSync, statSync, existsSync, openSync, readSync, closeSync, watchFile, unwatchFile, writeFileSync, mkdirSync } from 'fs'
import { join, resolve } from 'path'
import { parse as parseYaml, parseDocument } from 'yaml'
import cors from 'cors'
import { exec, spawn } from 'child_process'
import { promisify } from 'util'
import { Readable } from 'stream'

import os from 'os'

const execAsync = promisify(exec)

const HOME_DIR = os.homedir()
const HERMES_ROOT = join(HOME_DIR, '.hermes')

// Dynamically resolve the hermes binary
const HERMES_BIN = join(HOME_DIR, '.local/bin/hermes')

async function hermesCmd(args) {
  const { stdout, stderr } = await execAsync(`${HERMES_BIN} ${args}`, {
    env: { ...process.env, HOME: HOME_DIR, PATH: `${join(HOME_DIR, '.local/bin')}:/usr/bin:/bin` },
    timeout: 30000,
  })
  return { stdout: stdout.trim(), stderr: stderr.trim() }
}

const app  = express()
const PORT = 5174

const HERMES = HERMES_ROOT
const DB_PATH = join(HERMES, 'state.db')

app.use(cors())
app.use(express.json())

const PYTHON = '/usr/bin/python3'
const QUERY_SCRIPT = join(new URL('.', import.meta.url).pathname, 'query.py')

const cache = new Map()
const pending = new Map()

async function pyQuery(cmd, ...args) {
  const key = [cmd, ...args].join(':')
  const hit = cache.get(key)
  if (hit && Date.now() - hit.ts < 30000) return hit.data

  if (pending.has(key)) return pending.get(key)

  const promise = execAsync(
    [PYTHON, QUERY_SCRIPT, cmd, ...args].join(' '),
    { env: { ...process.env, HOME: HOME_DIR }, timeout: 30000 }
  ).then(({ stdout }) => {
    const data = JSON.parse(stdout.trim())
    if (!data.error) cache.set(key, { data, ts: Date.now() })
    pending.delete(key)
    return data
  }).catch(e => {
    console.error(`[pyQuery Error: ${cmd}]`, e.message)
    pending.delete(key)
    throw e
  })

  pending.set(key, promise)
  return promise
}

/* ── /api/gateway ── */
app.get('/api/gateway', (req, res) => {
  try {
    const gw  = JSON.parse(readFileSync(join(HERMES, 'gateway_state.json'), 'utf8'))
    const cfg = parseYaml(readFileSync(join(HERMES, 'config.yaml'), 'utf8'))

    /* Check if the process is actually alive */
    let pid_alive = false
    if (gw.pid) {
      try { process.kill(gw.pid, 0); pid_alive = true } catch {}
    }

    /* Also check gateway.pid file */
    if (!pid_alive) {
      try {
        const pidFile = readFileSync(join(HERMES, 'gateway.pid'), 'utf8').trim()
        const pid2 = parseInt(pidFile)
        if (pid2) { try { process.kill(pid2, 0); pid_alive = true } catch {} }
      } catch {}
    }

    /* Determine how stale gateway_state.json is */
    const updatedAt = gw.updated_at ? new Date(gw.updated_at) : null
    const ageMs = updatedAt ? Date.now() - updatedAt.getTime() : null
    const state_age_s = ageMs ? Math.round(ageMs / 1000) : null
    const state_fresh = state_age_s !== null && state_age_s < 300  // fresh = < 5 min

    /* Get live platform status from the most recent gateway log lines */
    let live_platforms = {}
    try {
      const LOG = join(HERMES, 'logs/gateway.log')
      if (existsSync(LOG)) {
        const logContent = readFileSync(LOG, 'utf8')
        const lines = logContent.split('\n').filter(Boolean)
        const recent = lines.slice(-30)  // last 30 log lines

        // Telegram: look for recent inbound/outbound messages
        const tg_in  = recent.some(l => l.includes('inbound message:') && l.includes('platform=telegram'))
        const tg_out = recent.some(l => l.includes('Sending response') && l.includes('telegram'))
        if (tg_in || tg_out) {
          live_platforms['telegram'] = 'live_active'
        } else {
          live_platforms['telegram'] = 'connected'  // connected but no recent traffic
        }

        // Webhook: connected or not
        const wh_conn = recent.some(l => l.includes('[Webhook]') && (l.includes('Connected') || l.includes('ready')))
        live_platforms['webhook'] = wh_conn ? 'connected' : 'disconnected'
      }
    } catch {}

    /* Build platform list — prefer live data, fall back to gateway_state.json */
    const platformsObj = gw.platforms ?? gw.channels ?? {}
    const platformList = Object.keys(platformsObj).length > 0
      ? Object.entries(platformsObj).map(([name, ch]) => ({
          name,
          status:  live_platforms[name] ?? (ch.state ?? (ch.connected ? 'connected' : 'disconnected')),
          error:   ch.error_message ?? null,
          updated_at: ch.updated_at ?? null,
          stale:   !state_fresh && !live_platforms[name],
        }))
      : Object.entries(live_platforms).map(([name, status]) => ({
          name, status, error: null, updated_at: null, stale: false,
        }))

    const modelObj = cfg.model ?? cfg.models?.default
    const modelLabel = typeof modelObj === 'string' ? modelObj
      : modelObj?.default ?? modelObj?.provider ?? 'unknown'

    res.json({
      gateway_online: pid_alive,
      gateway_state:  gw.gateway_state ?? 'unknown',
      model:          cfg.model ?? null,
      model_label:    modelLabel,
      platforms:      platformList,
      pid:            gw.pid,
      updated_at:     gw.updated_at,
      state_age_s,    // seconds since last gateway_state.json update
      state_fresh,    // true if updated within 5 minutes
      // Add live_age_s: how old the log-based live status is (null = no recent activity)
      live_age_s:     null,  // derived from log analysis in future
    })
  } catch (e) {
    res.json({ gateway_online: false, platforms: [], state_age_s: null, state_fresh: false })
  }
})

/* ── /api/stats ── */
app.get('/api/stats', async (req, res) => {
  try {
    res.json(await pyQuery('stats'))
  } catch (e) {
    console.error('/api/stats error:', e.message)
    res.status(500).json({ error: e.message })
  }
})

/* ── /api/ekg ── */
app.get('/api/ekg', async (req, res) => {
  try {
    res.json(await pyQuery('ekg'))
  } catch (e) {
    res.json({ points: [] })
  }
})

/* ── /api/heatmap ── */
app.get('/api/heatmap', async (req, res) => {
  try {
    res.json(await pyQuery('heatmap'))
  } catch (e) {
    res.json({ grid: null })
  }
})

/* ── /api/sessions ── */
app.get('/api/sessions', (req, res) => {
  try {
    const sessionsDir = join(HERMES, 'sessions')
    const q = (req.query.q || '').toLowerCase()
    const page = Math.max(1, parseInt(req.query.page || 1))
    const limit = 25

    const sessions = []
    const files = readdirSync(sessionsDir).sort().reverse()  // newest first

    for (const f of files) {
      if (!f.startsWith('session_') || !f.endsWith('.json')) continue
      try {
        const fullPath = join(sessionsDir, f)
        const obj = JSON.parse(readFileSync(fullPath, 'utf8'))
        const hasMessages = Array.isArray(obj.messages)
        const msgCount = obj.message_count ?? (hasMessages ? obj.messages.length : 0)
        const started = obj.session_start ? new Date(obj.session_start).getTime() / 1000 : null
        const title = obj.title || obj.subject || null

        // Filter by search query
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

/* ── /api/sessions/:id ── */
app.get('/api/sessions/:id', (req, res) => {
  const { id } = req.params
  try {
    // Try direct file first (fastest)
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
          output_tokens:  null,
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
      // Fallback: scan all files (for IDs that don't match filename convention)
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

/* ── /api/sessions/:id/trace ── */
app.get('/api/sessions/:id/trace', async (req, res) => {
  try {
    res.json(await pyQuery('trace', req.params.id))
  } catch (e) {
    res.json({ steps: [] })
  }
})

/* ── /api/memory ── */
app.get('/api/memory', (req, res) => {
  try {
    const memDirs = [
      { path: join(HERMES, 'memory'),        type: 'memory' },
      { path: join(HERMES, 'memories'),      type: 'memory' },
      { path: join(HERMES, 'workspace'),      type: 'workspace' },
    ]

    // Cache file patterns to exclude from storage stats and categorize separately
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

          // Classify
          let category = 'other'
          if (CURATED.includes(name)) category = 'curated'
          else if (DAILY_PATTERN.test(name)) category = 'daily'
          else if (name === '.skills_prompt_snapshot.json') category = 'snapshot'
          else if (CACHE_PATTERNS.test(name)) category = 'cache'

          let preview = ''
          try {
            preview = readFileSync(fullPath, 'utf8').slice(0, 150).replace(/\n+/g, ' ')
          } catch {}

          // Count memory entries (lines starting with § or ## in .md files)
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

    // Compute storage stats EXCLUDING cache files
    const storageFiles = allFiles.filter(f => f.category !== 'cache')
    const totalKb = storageFiles.reduce((s, f) => s + f.size_kb, 0)
    const cacheKb = allFiles.filter(f => f.category === 'cache').reduce((s, f) => s + f.size_kb, 0)

    // Memory health: curated entry count + last update
    const curatedFiles = allFiles.filter(f => f.category === 'curated')
    const totalEntries = curatedFiles.reduce((s, f) => s + (f.entry_count || 0), 0)
    const lastMemoryUpdate = curatedFiles
      .map(f => f.mtime)
      .sort()
      .reverse()[0] || null

    // Memory stats by category
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

/* ── /api/memory/activity ── */
app.get('/api/memory/activity', (req, res) => {
  try {
    const memDirs = [
      join(HERMES, 'memory'),
      join(HERMES, 'memories'),
      join(HERMES, 'workspace'),
    ]

    // Collect file modification times for activity feed
    const events = []
    for (const dir of memDirs) {
      if (!existsSync(dir)) continue
      try {
        for (const name of readdirSync(dir)) {
          if (!name.endsWith('.md') && !name.endsWith('.json')) continue
          if (name === 'models_dev_cache.json') continue  // skip huge cache
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

    // Sort by modification time descending — most recent first
    events.sort((a, b) => new Date(b.mtime) - new Date(a.mtime))

    // Build 7-day activity grid (date -> count of writes)
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

    // Recent writes (last 5)
    const recentWrites = events.slice(0, 5).map(e => ({
      name: e.name,
      type: e.type,
      mtime: e.mtime,
      size_kb: e.size_kb,
    }))

    // Last memory write time
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

/* ── /api/cron ── */
app.get('/api/cron', (req, res) => {
  try {
    const cfg = parseYaml(readFileSync(join(HERMES, 'config.yaml'), 'utf8'))
    const rawJobs = cfg.cron ?? cfg.crons ?? []
    const jobs = (Array.isArray(rawJobs) ? rawJobs : Object.entries(rawJobs).map(([k,v]) => ({ name: k, ...v })))
      .map(j => ({
        name:     j.name ?? j.id ?? 'unnamed',
        schedule: j.schedule ?? j.cron ?? '—',
        enabled:  j.enabled !== false,
        last_run: j.last_run ?? null,
        next_run: j.next_run ?? null,
      }))
    res.json({ jobs })
  } catch (e) {
    res.json({ jobs: [] })
  }
})

/* ═══════════════════════════════════════════════════════════
   SKILLS — skill management and viewing
═══════════════════════════════════════════════════════════ */

/* ── /api/skills — list all skills (recursively) ── */
app.get('/api/skills', (req, res) => {
  try {
    const skillsDirs = [
      join(HERMES, 'skills'),
      join(HERMES, 'hermes-agent', 'skills'),
    ]

    const skillSet = new Map() // name -> skill data

    for (const baseDir of skillsDirs) {
      if (!existsSync(baseDir)) continue

      const source = baseDir.includes('hermes-agent') ? 'builtin' : 'custom'

      // Recursively find all SKILL.md files
      function scanDir(dir, pathPrefix = '') {
        try {
          for (const entry of readdirSync(dir)) {
            const fullPath = join(dir, entry)
            const stat = statSync(fullPath)

            if (stat.isDirectory()) {
              scanDir(fullPath, pathPrefix ? `${pathPrefix}/${entry}` : entry)
            } else if (entry === 'SKILL.md') {
              // Extract skill name from path
              const relPath = pathPrefix // e.g., "mlops/models/whisper" or just "csv"
              const skillName = relPath

              try {
                const content = readFileSync(fullPath, 'utf8')
                const fmMatch = content.match(/^---\n([\s\S]+?)\n---\n?/)
                let frontmatter = {}
                if (fmMatch) {
                  try { frontmatter = parseYaml(fmMatch[1]) } catch {}
                }

                // Use path-based identifier as skill name
                // displayName comes from frontmatter
                const displayName = frontmatter.name || skillName
                const description = frontmatter.description || ''

                // Determine category from path
                let category = frontmatter.category || 'other'
                if (!frontmatter.category && relPath.includes('/')) {
                  const parts = relPath.split('/')
                  category = parts[0]
                }

                const existing = skillSet.get(skillName)
                // Prefer custom (user) skills over builtin
                if (!existing || source === 'custom') {
                  skillSet.set(skillName, {
                    name: skillName,
                    displayName,
                    description,
                    category,
                    frontmatter,
                    path: fullPath,
                    source,
                    // Only spread frontmatter fields explicitly
                    version: frontmatter.version,
                    author: frontmatter.author,
                    triggers: frontmatter.triggers,
                  })
                }
              } catch {}
            }
          }
        } catch {}
      }

      scanDir(baseDir)
    }

    const skills = Array.from(skillSet.values())
    res.json({ skills })
  } catch (e) {
    res.json({ skills: [], error: e.message })
  }
})

/* ── GET /api/skills/:name — read a specific skill ── */
app.get('/api/skills/:name', (req, res) => {
  const { name } = req.params
  // Name can contain slashes (e.g., "mlops/models/whisper")
  const skillName = decodeURIComponent(name)

  const searchPaths = [
    // Custom skills first
    join(HERMES, 'skills', skillName, 'SKILL.md'),
    join(HERMES, 'hermes-agent', 'skills', skillName, 'SKILL.md'),
  ]

  // Also try direct paths at various levels
  if (!searchPaths.some(p => existsSync(p))) {
    // Try to find it recursively
    function findSkill(baseDir, targetName) {
      function scan(dir, pathPrefix = '') {
        try {
          for (const entry of readdirSync(dir)) {
            const fullPath = join(dir, entry)
            const stat = statSync(fullPath)
            const currentPath = pathPrefix ? `${pathPrefix}/${entry}` : entry

            if (stat.isDirectory()) {
              if (currentPath === targetName || entry === targetName) {
                const skillPath = join(fullPath, 'SKILL.md')
                if (existsSync(skillPath)) return skillPath
              }
              const found = scan(fullPath, currentPath)
              if (found) return found
            } else if (entry === 'SKILL.md') {
              // Check if this is our target
              if (pathPrefix === targetName || currentPath.replace('/SKILL.md', '') === targetName) {
                return fullPath
              }
            }
          }
        } catch {}
        return null
      }
      return scan(baseDir)
    }

    for (const baseDir of [join(HERMES, 'skills'), join(HERMES, 'hermes-agent', 'skills')]) {
      if (!existsSync(baseDir)) continue
      const found = findSkill(baseDir, skillName)
      if (found) {
        searchPaths.unshift(found)
        break
      }
    }
  }

  for (const path of searchPaths) {
    if (existsSync(path)) {
      try {
        const content = readFileSync(path, 'utf8')
        const fmMatch = content.match(/^---\n([\s\S]+?)\n---\n?([\s\S]*)$/)

        let frontmatter = {}
        let body = content

        if (fmMatch) {
          try { frontmatter = parseYaml(fmMatch[1]) } catch {}
          body = fmMatch[2].trim()
        }

        const source = path.includes('/.hermes/hermes-agent/') ? 'builtin' : 'custom'

        return res.json({
          name: skillName,
          content: body,
          frontmatter,
          path,
          source,
          fullContent: content,
        })
      } catch (e) {
        return res.status(500).json({ name: skillName, exists: false, error: e.message })
      }
    }
  }

  res.status(404).json({ name: skillName, exists: false })
})

/* ── PUT /api/skills/:name — write/update a skill ── */
app.put('/api/skills/:name', (req, res) => {
  const { name } = req.params
  const skillName = decodeURIComponent(name)
  const { content } = req.body

  if (!content) return res.status(400).json({ error: 'content required' })

  // Find existing skill path or use custom skills dir
  const existingPaths = [
    join(HERMES, 'skills', skillName, 'SKILL.md'),
    join(HERMES, 'hermes-agent', 'skills', skillName, 'SKILL.md'),
  ]

  let targetPath = existingPaths.find(p => existsSync(p))

  if (!targetPath) {
    // Create in custom skills directory
    targetPath = join(HERMES, 'skills', skillName, 'SKILL.md')
  }

  try {
    // Ensure directory exists
    const dir = join(targetPath, '..')
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }

    writeFileSync(targetPath, content, 'utf8')
    res.json({ ok: true, path: targetPath })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

/* ── POST /api/skills/:name/refresh — trigger skill re-sync ── */
app.post('/api/skills/:name/refresh', async (req, res) => {
  const { name } = req.params
  const skillName = decodeURIComponent(name)

  try {
    // Try to refresh via hermes CLI
    const { stdout, stderr } = await execAsync(
      `${HERMES_BIN} skills refresh ${skillName} 2>&1`,
      { timeout: 30000, env: { ...process.env, HOME: HOME_DIR } }
    ).catch(() => ({ stdout: '', stderr: '' }))
    res.json({ ok: true, output: stdout || 'Skill reloaded' })
  } catch (e) {
    res.json({ ok: true, output: 'Skill refresh triggered' })
  }
})

/* ── GET /api/skills/categories — group skills by category ── */
app.get('/api/skills/categories', (req, res) => {
  try {
    const skillsDirs = [
      join(HERMES, 'skills'),
      join(HERMES, 'hermes-agent', 'skills'),
    ]

    const cats = {}
    const skillSet = new Map()

    for (const baseDir of skillsDirs) {
      if (!existsSync(baseDir)) continue
      const source = baseDir.includes('hermes-agent') ? 'builtin' : 'custom'

      function scanDir(dir, pathPrefix = '') {
        try {
          for (const entry of readdirSync(dir)) {
            const fullPath = join(dir, entry)
            const stat = statSync(fullPath)
            const currentPath = pathPrefix ? `${pathPrefix}/${entry}` : entry

            if (stat.isDirectory()) {
              scanDir(fullPath, currentPath)
            } else if (entry === 'SKILL.md') {
              const skillName = pathPrefix
              if (!skillName) return

              try {
                const content = readFileSync(fullPath, 'utf8')
                const fmMatch = content.match(/^---\n([\s\S]+?)\n---\n?/)
                let frontmatter = {}
                if (fmMatch) {
                  try { frontmatter = parseYaml(fmMatch[1]) } catch {}
                }

                const category = frontmatter.category || pathPrefix.split('/')[0] || 'other'
                const displayName = frontmatter.name || skillName

                if (!skillSet.has(skillName) || source === 'custom') {
                  skillSet.set(skillName, {
                    name: skillName,
                    displayName,
                    description: frontmatter.description || '',
                    category,
                    source,
                    frontmatter,
                  })
                }
              } catch {}
            }
          }
        } catch {}
      }

      scanDir(baseDir)
    }

    // Group by category
    for (const skill of skillSet.values()) {
      const cat = skill.category || 'other'
      if (!cats[cat]) cats[cat] = []
      cats[cat].push(skill)
    }

    res.json({ categories: cats })
  } catch (e) {
    res.json({ categories: {}, error: e.message })
  }
})

/* ── /api/approvals ── */
app.get('/api/approvals', async (req, res) => {
  try {
    res.json(await pyQuery('approvals'))
  } catch (e) {
    res.json({ pending: [] })
  }
})

/* stub approvals removed — real handlers below at /api/approvals/:id (CLI + DB) */

/* ── /api/terminal ── */
app.get('/api/terminal', (req, res) => {
  res.json({ backends: ['cli', 'websocket'], available: ['hermes', 'bash'] })
})

/* POST /api/terminal — execute a Hermes CLI command */
app.post('/api/terminal', async (req, res) => {
  const { command } = req.body
  if (!command?.trim()) return res.status(400).json({ error: 'command required' })

  try {
    const { stdout, stderr } = await execAsync(
      `${command.trim()} 2>&1`,
      { timeout: 30000, env: { ...process.env, HOME: HOME_DIR, TERM: 'dumb', PATH: process.env.PATH } }
    ).catch(e => ({ stdout: '', stderr: e.message }))
    const clean = stdout.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '').trim()
    const cleanErr = stderr.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '').trim()
    res.json({ ok: true, stdout: clean, stderr: cleanErr, exit_code: 0 })
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message })
  }
})

/* ── /api/config ── */
app.get('/api/config', (req, res) => {
  try {
    const raw = readFileSync(join(HERMES, 'config.yaml'), 'utf8')
    const cfg = parseYaml(raw)
    res.json({
      config: {
        model:       cfg.model ?? cfg.models?.default,
        provider:    cfg.provider,
        max_tokens:  cfg.max_tokens,
        temperature: cfg.temperature,
        yolo:        cfg.yolo ?? false,
      },
      full_config: cfg,
      personalities: Object.keys(cfg.agent?.personalities || {}),
      current_personality: cfg.display?.personality || null,
      raw_config:  raw, // Return full raw config so it can be edited
      config_path: join(HERMES, 'config.yaml'),
      db_path:     DB_PATH,
      version:     '1.x',
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.put('/api/config', (req, res) => {
  try {
    const { raw_config } = req.body
    if (!raw_config) return res.status(400).json({ error: 'raw_config required' })
    // Validate syntax
    parseYaml(raw_config)
    
    // Write
    writeFileSync(join(HERMES, 'config.yaml'), raw_config, 'utf8')
    res.json({ ok: true })
  } catch(e) {
    res.status(400).json({ error: e.message })
  }
})

app.patch('/api/config', (req, res) => {
  try {
    const { updates } = req.body
    if (!updates) return res.status(400).json({ error: 'updates required' })
    
    const configPath = join(HERMES, 'config.yaml')
    const raw = readFileSync(configPath, 'utf8')
    const doc = parseDocument(raw)
    
    for (const [key, value] of Object.entries(updates)) {
      const path = key.split('.')
      doc.setIn(path, value)
    }
    
    writeFileSync(configPath, String(doc), 'utf8')
    res.json({ ok: true, patched: Object.keys(updates) })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.get('/api/env', (req, res) => {
  try {
    const envPath = join(HERMES, '.env')
    if (!existsSync(envPath)) return res.json({ env: '' })
    const raw = readFileSync(envPath, 'utf8')
    res.json({ env: raw })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.put('/api/env', (req, res) => {
  try {
    const { env } = req.body
    const envPath = join(HERMES, '.env')
    writeFileSync(envPath, env, 'utf8')
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.put('/api/control/personality', (req, res) => {
  const { personality } = req.body
  if (!personality) return res.status(400).json({ error: 'personality required' })
  try {
    const raw = readFileSync(join(HERMES, 'config.yaml'), 'utf8')
    const cfg = parseYaml(raw)
    
    // RegEx to replace 'personality: <value>' specifically in the 'display:' block
    const newRaw = raw.replace(/(display:[\s\S]*?)personality:\s*[^\n]+/, `$1personality: ${personality}`)
    
    // Fallback: if regex didn't match (e.g. no personality field), append it
    if (newRaw === raw) {
      if (raw.includes('display:')) {
         const withFallback = raw.replace(/(display:\s*\n)/, `$1  personality: ${personality}\n`)
         writeFileSync(join(HERMES, 'config.yaml'), withFallback, 'utf8')
      } else {
         writeFileSync(join(HERMES, 'config.yaml'), raw + `\ndisplay:\n  personality: ${personality}\n`, 'utf8')
      }
    } else {
      writeFileSync(join(HERMES, 'config.yaml'), newRaw, 'utf8')
    }

    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message })
  }
})

/* ── /api/control/gateway ── */
app.post('/api/control/gateway/start', async (req, res) => {
  try {
    const r = await hermesCmd('gateway start')
    res.json({ ok: true, output: r.stdout })
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message })
  }
})

app.post('/api/control/gateway/stop', async (req, res) => {
  try {
    const r = await hermesCmd('gateway stop')
    res.json({ ok: true, output: r.stdout })
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message })
  }
})

app.post('/api/control/gateway/restart', async (req, res) => {
  try {
    const r = await hermesCmd('gateway restart')
    res.json({ ok: true, output: r.stdout })
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message })
  }
})

/* ── /api/agent/status ── */
app.get('/api/agent/status', (req, res) => {
  try {
    const path = join(HERMES, 'agent_status.json')
    if (!existsSync(path)) {
      return res.json({ status: 'online', rhythm: 'steady', stopped: false })
    }
    const data = JSON.parse(readFileSync(path, 'utf8'))
    res.json(data)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.post('/api/agent/status', (req, res) => {
  try {
    const path = join(HERMES, 'agent_status.json')
    const current = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : { status: 'online', rhythm: 'steady', stopped: false }
    
    const updates = req.body
    const next = { ...current, ...updates, updated_at: new Date().toISOString() }
    
    writeFileSync(path, JSON.stringify(next, null, 2), 'utf8')
    res.json(next)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

/* ── /api/control/neural-shift — change agent neural rhythm mode ── */
const RHYTHM_CONFIGS = {
  hibernation: {
    agent: { reasoning_effort: 'low', max_turns: 10 },
    terminal: { timeout: 60 },
    code_execution: { max_tool_calls: 20, timeout: 120 },
  },
  steady: {
    agent: { reasoning_effort: 'medium', max_turns: 40 },
    terminal: { timeout: 300 },
    code_execution: { max_tool_calls: 50, timeout: 600 },
  },
  deep_focus: {
    agent: { reasoning_effort: 'high', max_turns: 80 },
    terminal: { timeout: 600 },
    code_execution: { max_tool_calls: 100, timeout: 900 },
  },
  high_burst: {
    agent: { reasoning_effort: 'medium', max_turns: 120 },
    terminal: { timeout: 60 },
    code_execution: { max_tool_calls: 200, timeout: 300 },
  },
}

app.post('/api/control/neural-shift', async (req, res) => {
  const { rhythm } = req.body
  
  if (!rhythm || !RHYTHM_CONFIGS[rhythm]) {
    return res.status(400).json({ error: `Invalid rhythm: ${rhythm}. Valid: ${Object.keys(RHYTHM_CONFIGS).join(', ')}` })
  }
  
  try {
    const configPath = join(HERMES, 'config.yaml')
    const statusPath = join(HERMES, 'agent_status.json')
    const raw = readFileSync(configPath, 'utf8')
    const cfg = parseYaml(raw)
    const rhythmCfg = RHYTHM_CONFIGS[rhythm]
    
    // Update agent settings
    if (rhythmCfg.agent) {
      cfg.agent = cfg.agent || {}
      if (rhythmCfg.agent.reasoning_effort !== undefined) cfg.agent.reasoning_effort = rhythmCfg.agent.reasoning_effort
      if (rhythmCfg.agent.max_turns !== undefined) cfg.agent.max_turns = rhythmCfg.agent.max_turns
    }
    
    // Update terminal settings
    if (rhythmCfg.terminal) {
      cfg.terminal = cfg.terminal || {}
      if (rhythmCfg.terminal.timeout !== undefined) cfg.terminal.timeout = rhythmCfg.terminal.timeout
    }
    
    // Update code_execution settings
    if (rhythmCfg.code_execution) {
      cfg.code_execution = cfg.code_execution || {}
      if (rhythmCfg.code_execution.max_tool_calls !== undefined) cfg.code_execution.max_tool_calls = rhythmCfg.code_execution.max_tool_calls
      if (rhythmCfg.code_execution.timeout !== undefined) cfg.code_execution.timeout = rhythmCfg.code_execution.timeout
    }
    
    // Serialize back to YAML - use yaml library for proper quoting
    const yamlLib = await import('yaml')
    const newRaw = yamlLib.stringify(cfg)
    writeFileSync(configPath, newRaw, 'utf8')
    
    // Also update agent_status.json for UI state
    const currentStatus = existsSync(statusPath) ? JSON.parse(readFileSync(statusPath, 'utf8')) : {}
    const nextStatus = { ...currentStatus, rhythm, updated_at: new Date().toISOString() }
    writeFileSync(statusPath, JSON.stringify(nextStatus, null, 2), 'utf8')
    
    // Notify gateway if running (optional - doesn't block response)
    hermesCmd('gateway notify rhythm-changed').catch(() => {})
    
    res.json({ ok: true, rhythm, config: rhythmCfg })
  } catch (e) {
    console.error('Neural shift error:', e)
    res.status(500).json({ error: e.message })
  }
})

/* duplicate gateway/model/approval routes removed — canonical handlers below */

/* ── /api/settings alias ── */
app.get('/api/settings', (req, res) => res.redirect('/api/config'))

/* ── /api/profile ── */
app.get('/api/profile', (req, res) => {
  try {
    const userInfo = os.userInfo();
    const profilePath = join(HERMES, 'user_profile.json');
    let profileData = {};
    
    if (existsSync(profilePath)) {
      profileData = JSON.parse(readFileSync(profilePath, 'utf8'));
    }
    res.json({
      username: profileData.name || userInfo.username,
      systemUser: userInfo.username,
      homedir: userInfo.homedir,
      shell: userInfo.shell,
      platform: os.platform(),
      release: os.release()
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
})

app.post('/api/profile', (req, res) => {
  try {
    const profilePath = join(HERMES, 'user_profile.json');
    let profileData = {};
    if (existsSync(profilePath)) {
      profileData = JSON.parse(readFileSync(profilePath, 'utf8'));
    }
    
    const { name } = req.body;
    profileData.name = name;
    profileData.updated_at = new Date().toISOString();
    
    writeFileSync(profilePath, JSON.stringify(profileData, null, 2), 'utf8');
    res.json({ ok: true, username: profileData.name });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
})

/* ── /api/logs SSE — live tail of Hermes gateway logs ── */
app.get('/api/logs', (req, res) => {
  const logFile = req.query.file === 'gateway' ? join(HERMES, 'logs/gateway.log')
    : req.query.file === 'errors' ? join(HERMES, 'logs/errors.log')
    : join(HERMES, 'logs/agent.log')

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  let lastSize = 0
  let clientGone = false

  const sendHeartbeat = () => {
    if (!clientGone) res.write(': heartbeat\n\n')
  }

  const streamLogs = () => {
    try {
      if (!existsSync(logFile)) {
        if (!clientGone) res.write(`data: ${JSON.stringify({ type: 'info', msg: 'Log file not found' })}\n\n`)
        return
      }
      const stat = statSync(logFile)
      if (stat.size > lastSize) {
        // Efficient incremental read
        const fd = openSync(logFile, 'r')
        const buf = Buffer.alloc(stat.size - lastSize)
        readSync(fd, buf, 0, buf.length, lastSize)
        closeSync(fd)
        lastSize = stat.size
        const newContent = buf.toString('utf8')
        const lines = newContent.split('\n').filter(l => l.trim())
        for (const line of lines) {
          if (!clientGone) {
            const level = line.includes('ERROR') ? 'error'
              : line.includes('WARN') ? 'warn'
              : line.includes('DEBUG') ? 'debug'
              : 'info'
            res.write(`data: ${JSON.stringify({ type: 'log', level, msg: line })}\n\n`)
          }
        }
      }
    } catch {}
  }

  /* Send last 50 lines as initial batch */
  try {
    if (existsSync(logFile)) {
      const content = readFileSync(logFile, 'utf8')
      const allLines = content.split('\n').filter(Boolean).slice(-50)
      for (const line of allLines) {
        const level = line.includes('ERROR') ? 'error'
          : line.includes('WARN') ? 'warn'
          : line.includes('DEBUG') ? 'debug'
          : 'info'
        res.write(`data: ${JSON.stringify({ type: 'log', level, msg: line })}\n\n`)
      }
      lastSize = statSync(logFile).size
    } else {
      res.write(`data: ${JSON.stringify({ type: 'info', msg: 'Log file not found' })}\n\n`)
    }
  } catch { res.write(`data: ${JSON.stringify({ type: 'info', msg: 'Could not read log file' })}\n\n`) }

  const iv = setInterval(() => {
    if (clientGone) { clearInterval(iv); return }
    streamLogs()
    sendHeartbeat()
  }, 1000)

  req.on('close', () => {
    clientGone = true
    clearInterval(iv)
  })
})

/* ═══════════════════════════════════════════════════════════
   CHAT — two-way Hermes communication via CLI
═══════════════════════════════════════════════════════════ */

/* POST /api/chat — send a message to Hermes */
app.post('/api/chat', async (req, res) => {
  const { message } = req.body
  if (!message?.trim()) return res.status(400).json({ error: 'message required' })

  const CHAT_SCRIPT = join(new URL('.', import.meta.url).pathname, 'hermes_chat.py')
  // Use absolute path to the Hermes venv python to ensure openai is available
  const PYTHON_VENV = join(HERMES_ROOT, 'hermes-agent/venv/bin/python3')

  try {
    const { stdout, stderr } = await execAsync(
      `"${PYTHON_VENV}" "${CHAT_SCRIPT}" ${JSON.stringify(message.trim())}`,
      { timeout: 90000, env: { ...process.env, HOME: HOME_DIR } }
    )
    let data
    try {
      data = JSON.parse(stdout.trim())
    } catch {
      // Strip ANSI and return raw
      const clean = stdout.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '').trim()
      return res.json({ ok: true, response: clean || stdout.trim().slice(0, 500) })
    }
    if (data.error && !data.response) {
      return res.status(500).json(data)
    }
    res.json(data)
  } catch (e) {
    // Fallback: try CLI directly
    try {
      const { stdout } = await execAsync(
        `timeout 60 "${PYTHON_VENV}" "${CHAT_SCRIPT}" ${JSON.stringify(message.trim())} 2>&1 || echo "FALLBACK_ERROR: $?"`,
        { timeout: 70000, env: { ...process.env, HOME: HOME_DIR } }
      )
      const clean = stdout.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '').trim()
      // Filter out MCP noise
      const lines = clean.split('\n').filter(l =>
        l && !l.includes('MCP Server') && !l.includes('Warning:') &&
        !l.includes('Failed to parse') && !l.includes('Knowledge Graph') &&
        !l.includes('pdf-server') && !l.includes('Sequential Thinking') &&
        !l.includes('Puppeteer') && !l.startsWith('Traceback')
      )
      res.json({ ok: true, response: lines.join('\n') || clean })
    } catch (e2) {
      res.status(500).json({ ok: false, error: e2.message || e.message })
    }
  }
})

/* ═══════════════════════════════════════════════════════════
   MCP SERVERS — status of all MCP server instances
═══════════════════════════════════════════════════════════ */

/* GET /api/mcp — MCP server status via pstree process tree */
app.get('/api/mcp', async (req, res) => {
  try {
    const cfg = parseYaml(readFileSync(join(HERMES, 'config.yaml'), 'utf8'))
    const mcpConfigs = cfg.mcp_servers ?? {}

    // Read gateway PID from gateway_state.json
    let gwPid = null
    try {
      const gwState = JSON.parse(readFileSync(join(HERMES, 'gateway_state.json'), 'utf8'))
      gwPid = gwState.pid
    } catch { /* gateway_state might not exist */ }

    let runningMcpProcs = []
    if (gwPid) {
      try {
        // pstree -ap shows the full tree: gateway → uv → mcp-server-*
        // Parse: each line shows "name,pid command" e.g. "uv,59941 tool uvx mcp-filesystem"
        const { stdout } = await execAsync(
          `pstree -ap ${gwPid} 2>/dev/null`,
          { timeout: 5000, maxBuffer: 32 * 1024 }
        )

        // pstree -ap output has tree chars at start: "|-name,pid args" or "|   `-name,pid args"
        // Strip tree structure chars, then parse "name,pid args"
        runningMcpProcs = stdout.split('\n').map(l => {
          // Strip leading tree branch chars (|, -, `, space)
          const stripped = l.replace(/^[|`\-\s]+/, '')
          // Match "name,pid args" pattern
          const m = stripped.match(/^([\w\-\.]+),(\d+)\s+(.+)/)
          return m ? { name: m[1], pid: m[2], cmd: m[3].slice(0, 120) } : null
        }).filter(Boolean)
      } catch { /* pstree might not be available */ }
    }

    // Map known server names to command patterns to match
    const SERVER_PATTERNS = {
      taskr:              ['taskr', 'mcp-taskr', 'mcp-server-taskr'],
      filesystem:         ['mcp-filesystem', 'mcp-server-filesystem', 'filesystem'],
      fetch:              ['mcp-server-fetch', 'mcp-fetch', 'fetch'],
      git:                ['mcp-server-git', 'mcp-git', 'git'],
      time:               ['mcp-server-time', 'mcp-time', 'time'],
      sequentialthinking: ['sequentialthinking', 'mcp-sequential'],
      pdf:                ['mcp-server-pdf', 'mcp-pdf', 'pdf'],
      memory:             ['mcp-server-memory', 'mcp-memory', 'memory'],
      puppeteer:          ['mcp-server-puppeteer', 'puppeteer'],
    }

    const servers = Object.entries(mcpConfigs).map(([name, config]) => {
      const patterns = SERVER_PATTERNS[name] ?? [name]
      const isRunning = runningMcpProcs.some(p =>
        patterns.some(pat => p.cmd.toLowerCase().includes(pat.toLowerCase())) ||
        patterns.some(pat => p.name.toLowerCase().includes(pat.toLowerCase()))
      )
      const cmd = Array.isArray(config.args) ? config.args.join(' ') : config.args || ''
      const proc = runningMcpProcs.find(p =>
        patterns.some(pat => p.cmd.toLowerCase().includes(pat.toLowerCase())) ||
        patterns.some(pat => p.name.toLowerCase().includes(pat.toLowerCase()))
      )
      return {
        name,
        enabled: true,
        status: isRunning ? 'running' : 'stopped',
        pid: proc?.pid ?? null,
        command: `${config.command || '?'} ${cmd}`.trim().slice(0, 80),
      }
    })

    res.json({
      servers,
      running_procs: runningMcpProcs,
      total: servers.length,
      running_count: servers.filter(s => s.status === 'running').length,
    })
  } catch (e) {
    res.json({ servers: [], error: e.message, running_procs: [] })
  }
})

/* ═══════════════════════════════════════════════════════════
   SEARCH — FTS5 full-text search across sessions
═══════════════════════════════════════════════════════════ */

/* GET /api/search?q=... */
app.get('/api/search', async (req, res) => {
  const q = (req.query.q || '').trim()
  if (!q || q.length < 2) return res.json({ results: [] })

  try {
    const results = await pyQuery('fts', `'${q.replace(/'/g, "''")}'`)
    res.json(results)
  } catch (e) {
    res.json({ results: [], error: e.message })
  }
})

/* ═══════════════════════════════════════════════════════════
   SESSION MESSAGES — read messages from session JSONL
═══════════════════════════════════════════════════════════ */

/* GET /api/sessions/:id/messages */
app.get('/api/sessions/:id/messages', (req, res) => {
  const { id } = req.params
  try {
    const sessionsDir = join(HERMES, 'sessions')
    const files = readdirSync(sessionsDir)

    let messages = []

    // Find matching session file
    for (const f of files) {
      if (!f.includes(id) && !id.includes(f.replace(/\..+$/, '').replace('session_', ''))) continue
      const path = join(sessionsDir, f)
      if (!statSync(path).isFile()) continue
      try {
        if (f.endsWith('.jsonl')) {
          // JSONL: one JSON object per line
          const lines = readFileSync(path, 'utf8').split('\n').filter(Boolean)
          messages = messages.concat(lines.map(l => JSON.parse(l)))
        } else {
          // JSON: gateway session file with {session_id, messages: [...], ...}
          const obj = JSON.parse(readFileSync(path, 'utf8'))
          if (Array.isArray(obj.messages)) {
            messages = messages.concat(obj.messages)
          } else {
            messages.push(obj)
          }
        }
      } catch {}
    }

    // Clean up: keep role, content (first 500 chars), and tool_name
    const cleaned = messages.map(m => {
      const role = m.role || m.type || 'unknown'
      let content = null
      if (typeof m.content === 'string') {
        content = m.content.slice(0, 500)
      } else if (Array.isArray(m.content) && m.content[0]?.text) {
        content = m.content[0].text.slice(0, 500)
      }
      // For assistant messages with tool calls, show the tool names as content
      if (!content && Array.isArray(m.tool_calls) && m.tool_calls.length > 0) {
        content = '[tool_calls] ' + m.tool_calls.map(t => {
          const fn = t.function || t
          return fn?.name || 'unknown'
        }).join(', ')
      }
      // For tool role messages
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

/* ═══════════════════════════════════════════════════════════
   KNOWLEDGE GRAPH — extract entities from memory files
═══════════════════════════════════════════════════════════ */

/* GET /api/memory/graph */
app.get('/api/memory/graph', async (req, res) => {
  const pyScript = join(new URL('.', import.meta.url).pathname, 'memory_graph.py')
  try {
    const { stdout } = await execAsync(`python3 "${pyScript}"`, { timeout: 30000 })
    res.json(JSON.parse(stdout))
  } catch (err) {
    console.error('Error generating graph:', err)
    res.status(500).json({ nodes: [], links: [], error: 'Failed to generate graph' })
  }
})

/* ═══════════════════════════════════════════════════════════
   MODEL SWITCHER — available models from Hermes
═══════════════════════════════════════════════════════════ */

/* GET /api/models — list available models */
app.get('/api/models', async (req, res) => {
  try {
    // hermes model --list requires an interactive terminal, so we return known models
    const knownModels = [
      { name: 'kilo-auto/balanced', provider: 'kilocode', description: 'Auto-select balanced' },
      { name: 'kilo-auto/fast', provider: 'kilocode', description: 'Auto-select fastest' },
      { name: 'kilo-auto/reasoning', provider: 'kilocode', description: 'Auto-select reasoning' },
      { name: 'claude-sonnet-4-6.20181120', provider: 'anthropic', description: 'Claude Sonnet 4 (Anthropic via Kilo)' },
    ]
    const cfg = parseYaml(readFileSync(join(HERMES, 'config.yaml'), 'utf8'))
    const current = cfg.model?.default || cfg.model?.provider || 'kilo-auto/balanced'
    res.json({ models: knownModels, current })
  } catch (e) {
    res.json({ models: [], current: 'unknown', error: e.message })
  }
})

/* ── /api/recommendations ── */
app.get('/api/recommendations', async (req, res) => {
  const severityRank = { critical: 0, high: 1, medium: 2, low: 3 }

  function pushAction(items, item) {
    items.push({
      id: item.id,
      title: item.title,
      reason: item.reason,
      severity: item.severity || 'medium',
      action: item.action || null,
      area: item.area || 'overview',
      created_at: new Date().toISOString(),
    })
  }

  try {
    const items = []

    let gw = null
    try {
      gw = JSON.parse(readFileSync(join(HERMES, 'gateway_state.json'), 'utf8'))
    } catch {}

    let gatewayOnline = false
    if (gw?.pid) {
      try {
        process.kill(gw.pid, 0)
        gatewayOnline = true
      } catch {}
    }

    const updatedAt = gw?.updated_at ? new Date(gw.updated_at) : null
    const ageSeconds = updatedAt ? Math.max(0, Math.round((Date.now() - updatedAt.getTime()) / 1000)) : null
    const isStale = ageSeconds != null && ageSeconds > 300

    if (!gatewayOnline) {
      pushAction(items, {
        id: 'gateway-offline',
        title: 'Gateway offline',
        reason: 'Hermes gateway process is not alive. Control actions and platform sync can fail.',
        severity: 'critical',
        area: 'reliability',
        action: { type: 'api', method: 'POST', target: '/api/control/gateway/restart', label: 'Restart gateway' },
      })
    } else if (isStale) {
      pushAction(items, {
        id: 'gateway-stale',
        title: 'Gateway state is stale',
        reason: `Status file is ${Math.round(ageSeconds / 60)} minutes old. Runtime health may be outdated.`,
        severity: 'high',
        area: 'reliability',
        action: { type: 'navigate', target: '/logs', label: 'Inspect logs' },
      })
    }

    let approvalsData = null
    try {
      approvalsData = await pyQuery('approvals')
    } catch {}
    const pendingApprovals = Array.isArray(approvalsData?.pending) ? approvalsData.pending.length : 0
    if (pendingApprovals > 0) {
      pushAction(items, {
        id: 'pending-approvals',
        title: 'Pending approvals need review',
        reason: `${pendingApprovals} approval request(s) are waiting and can block workflows.`,
        severity: pendingApprovals > 5 ? 'high' : 'medium',
        area: 'operations',
        action: { type: 'navigate', target: '/approvals', label: 'Review approvals' },
      })
    }

    let statsData = null
    try {
      statsData = await pyQuery('stats')
    } catch {}

    const sessionsToday = Number(statsData?.sessions_today || 0)
    if (sessionsToday === 0) {
      pushAction(items, {
        id: 'zero-sessions',
        title: 'No sessions today',
        reason: 'No active session signals today. Verify channel connectivity or start a test prompt.',
        severity: 'medium',
        area: 'usage',
        action: { type: 'navigate', target: '/chat', label: 'Open chat' },
      })
    }

    const memoryPct = Number(statsData?.memory_pct)
    if (!Number.isNaN(memoryPct) && memoryPct >= 85) {
      pushAction(items, {
        id: 'memory-pressure',
        title: 'Memory nearing capacity',
        reason: `Memory usage is ${memoryPct}%. Pruning or consolidation may improve relevance.`,
        severity: memoryPct >= 95 ? 'high' : 'medium',
        area: 'memory',
        action: { type: 'navigate', target: '/memory', label: 'Review memory' },
      })
    }

    const budget = Number(statsData?.budget || 0)
    const costMonth = Number(statsData?.cost_month || 0)
    if (budget > 0 && costMonth > budget) {
      pushAction(items, {
        id: 'budget-overrun',
        title: 'Monthly budget exceeded',
        reason: `Current spend is $${costMonth.toFixed(2)} vs budget $${budget.toFixed(2)}.`,
        severity: 'high',
        area: 'cost',
        action: { type: 'navigate', target: '/settings', label: 'Adjust model policy' },
      })
    }

    if (items.length === 0) {
      pushAction(items, {
        id: 'system-healthy',
        title: 'System looks healthy',
        reason: 'No urgent actions detected from gateway, approvals, usage, memory, or budget signals.',
        severity: 'low',
        area: 'status',
        action: { type: 'navigate', target: '/sessions', label: 'Review recent sessions' },
      })
    }

    items.sort((a, b) => {
      const pa = severityRank[a.severity] ?? 99
      const pb = severityRank[b.severity] ?? 99
      if (pa !== pb) return pa - pb
      return a.title.localeCompare(b.title)
    })

    res.json({
      generated_at: new Date().toISOString(),
      count: items.length,
      items: items.slice(0, 6),
    })
  } catch (e) {
    res.status(500).json({
      generated_at: new Date().toISOString(),
      count: 0,
      items: [],
      error: e.message,
    })
  }
})

/* ═══════════════════════════════════════════════════════════
   CRON — trigger a cron job manually
═══════════════════════════════════════════════════════════ */

/* POST /api/cron/:name/trigger */
app.post('/api/cron/:name/trigger', async (req, res) => {
  const { name } = req.params
  try {
    const { stdout, stderr } = await execAsync(
      `${HERMES_BIN} cron run ${name} 2>&1`,
      { timeout: 60000, env: { ...process.env, HOME: HOME_DIR } }
    ).catch(e => ({ stdout: '', stderr: e.message }))
    res.json({ ok: true, output: stdout || stderr })
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message })
  }
})

/* ═══════════════════════════════════════════════════════════
   APPROVALS — real two-way approval via Hermes CLI
═══════════════════════════════════════════════════════════ */

/* POST /api/approvals/:id/approve (CLI-based) */
app.post('/api/approvals/:id/approve', async (req, res) => {
  const { id } = req.params
  try {
    // Try Hermes CLI first
    const { stdout } = await execAsync(
      `${HERMES_BIN} approve ${id} 2>&1`,
      { timeout: 15000, env: { ...process.env, HOME: HOME_DIR } }
    ).catch(() => ({ stdout: '' }))

    // Also update DB directly
    try {
      const d = new Database(DB_PATH, { fileMustExist: true })
      d.prepare(`UPDATE approvals SET status = 'approved', resolved_at = unixepoch() WHERE id = ?`).run(id)
      d.close()
    } catch {}

    res.json({ ok: true, output: stdout })
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message })
  }
})

/* POST /api/approvals/:id/deny */
app.post('/api/approvals/:id/deny', async (req, res) => {
  const { id } = req.params
  try {
    await execAsync(
      `${HERMES_BIN} deny ${id} 2>&1`,
      { timeout: 15000, env: { ...process.env, HOME: HOME_DIR } }
    ).catch(() => {})
    try {
      const d = new Database(DB_PATH, { fileMustExist: true })
      d.prepare(`UPDATE approvals SET status = 'denied', resolved_at = unixepoch() WHERE id = ?`).run(id)
      d.close()
    } catch {}
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message })
  }
})

/* ═══════════════════════════════════════════════════════════
   GATEWAY CONTROL — full restart with webhook subscription
═══════════════════════════════════════════════════════════ */

/* POST /api/control/gateway/restart — full restart + reinit */
app.post('/api/control/gateway/restart', async (req, res) => {
  try {
    // 1. Stop
    await execAsync(`systemctl --user restart hermes-gateway 2>&1`, { timeout: 30000 })
    // 2. Wait for it to come back
    await new Promise(r => setTimeout(r, 4000))
    // 3. Check status
    const { stdout } = await execAsync(
      `systemctl --user is-active hermes-gateway 2>&1`,
      { timeout: 5000 }
    )
    res.json({ ok: true, status: stdout.trim() })
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message })
  }
})

/* POST /api/control/model — real model switch */
app.post('/api/control/model', async (req, res) => {
  const { model, provider } = req.body
  if (!model) return res.status(400).json({ error: 'model required' })

  try {
    const args = ['model', 'switch', model]
    if (provider) args.push('--provider', provider)
    const { stdout, stderr } = await execAsync(
      `${HERMES_BIN} ${args.join(' ')} 2>&1`,
      { timeout: 30000, env: { ...process.env, HOME: HOME_DIR } }
    )
    res.json({ ok: true, output: stdout || stderr })
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message })
  }
})

/* ═══════════════════════════════════════════════════════════
   SERVER START
═══════════════════════════════════════════════════════════ */
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Hermes API → http://0.0.0.0:${PORT}`)
  console.log(`  Chat:        POST /api/chat`)
  console.log(`  MCP:         GET  /api/mcp`)
  console.log(`  Search:      GET  /api/search?q=...`)
  console.log(`  Models:      GET  /api/models`)
  console.log(`  Memory Graph:GET  /api/memory/graph`)
  pyQuery('stats').then(() => console.log('cache warmed: stats')).catch(() => {})
  pyQuery('ekg').then(() => console.log('cache warmed: ekg')).catch(() => {})
  pyQuery('heatmap').then(() => console.log('cache warmed: heatmap')).catch(() => {})
})
