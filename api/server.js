import express from 'express'
import Database from 'better-sqlite3'
import { readFileSync, readdirSync, statSync, existsSync, openSync, readSync, closeSync, watchFile, unwatchFile, writeFileSync, mkdirSync } from 'fs'
import { join, resolve } from 'path'
import { parse as parseYaml, parseDocument } from 'yaml'
import cors from 'cors'
import { exec, spawn } from 'child_process'
import { promisify } from 'util'
import { Readable } from 'stream'

const execAsync = promisify(exec)
const HERMES_BIN = '/home/empir/.local/bin/hermes'

async function hermesCmd(args) {
  const { stdout, stderr } = await execAsync(`${HERMES_BIN} ${args}`, {
    env: { ...process.env, HOME: '/home/empir', PATH: '/home/empir/.local/bin:/usr/bin:/bin' },
    timeout: 15000,
  })
  return { stdout: stdout.trim(), stderr: stderr.trim() }
}

const app  = express()
const PORT = 5174

const HERMES = resolve('/home/empir/.hermes')
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
    { env: { ...process.env, HOME: '/home/empir' }, timeout: 15000 }
  ).then(({ stdout }) => {
    const data = JSON.parse(stdout.trim())
    if (!data.error) cache.set(key, { data, ts: Date.now() })
    pending.delete(key)
    return data
  }).catch(e => {
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
app.get('/api/sessions', async (req, res) => {
  try {
    const page = parseInt(req.query.page ?? 1)
    const q    = req.query.q ?? ''
    res.json(await pyQuery('sessions', page, q ? `'${q}'` : ''))
  } catch (e) {
    console.error('/api/sessions error:', e.message)
    res.status(500).json({ error: e.message })
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
      join(HERMES, 'memories'),
      join(HERMES, 'memory'),
      join(HERMES, 'workspace'),
    ]

    const files = []
    for (const dir of memDirs) {
      if (!existsSync(dir)) continue
      readdirSync(dir).forEach(name => {
        if (!name.endsWith('.md') && !name.endsWith('.json')) return
        const path = join(dir, name)
        const stat = statSync(path)
        const sizeKb = stat.size / 1024
        let preview = ''
        try {
          preview = readFileSync(path, 'utf8').slice(0, 200).replace(/\n+/g, ' ')
        } catch {}
        files.push({ name, size_kb: sizeKb, preview })
      })
    }

    const totalKb = files.reduce((s, f) => s + f.size_kb, 0)
    res.json({ files, total_kb: totalKb, max_kb: 500 })
  } catch (e) {
    res.json({ files: [], total_kb: 0, max_kb: 500 })
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
      { timeout: 30000, env: { ...process.env, HOME: '/home/empir' } }
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

app.post('/api/approvals/:id/approve', (req, res) => {
  res.json({ ok: true })
})

app.post('/api/approvals/:id/deny', (req, res) => {
  res.json({ ok: true })
})

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
      `${HERMES_BIN} ${command.trim()} 2>&1`,
      { timeout: 30000, env: { ...process.env, HOME: '/home/empir', TERM: 'dumb' } }
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

app.post('/api/control/model', async (req, res) => {
  const { model } = req.body
  if (!model) return res.status(400).json({ error: 'model required' })
  try {
    const r = await hermesCmd(`model switch ${model}`)
    res.json({ ok: true, output: r.stdout })
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message })
  }
})

/* ── /api/approvals (real) ── */
app.post('/api/approvals/:id/approve', async (req, res) => {
  try {
    const d = new Database(DB_PATH, { fileMustExist: true })
    d.prepare(`UPDATE approvals SET status = 'approved', resolved_at = unixepoch() WHERE id = ?`).run(req.params.id)
    d.close()
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message })
  }
})

app.post('/api/approvals/:id/deny', async (req, res) => {
  try {
    const d = new Database(DB_PATH, { fileMustExist: true })
    d.prepare(`UPDATE approvals SET status = 'denied', resolved_at = unixepoch() WHERE id = ?`).run(req.params.id)
    d.close()
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message })
  }
})

/* ── /api/settings alias ── */
app.get('/api/settings', (req, res) => res.redirect('/api/config'))

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
  const PYTHON = '/home/empir/.hermes/hermes-agent/venv/bin/python3'

  try {
    const { stdout, stderr } = await execAsync(
      `"${PYTHON}" "${CHAT_SCRIPT}" ${JSON.stringify(message.trim())}`,
      { timeout: 90000, env: { ...process.env, HOME: '/home/empir' } }
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
        `timeout 60 "${PYTHON}" "${CHAT_SCRIPT}" ${JSON.stringify(message.trim())} 2>&1 || echo "FALLBACK_ERROR: $?"`,
        { timeout: 70000, env: { ...process.env, HOME: '/home/empir' } }
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

/* GET /api/mcp — MCP server status from gateway process tree */
app.get('/api/mcp', async (req, res) => {
  try {
    // Read MCP server configs from config.yaml
    const cfg = parseYaml(readFileSync(join(HERMES, 'config.yaml'), 'utf8'))
    const mcpConfigs = cfg.mcp_servers ?? {}

    // Check gateway state for running MCP processes
    const gwState = JSON.parse(readFileSync(join(HERMES, 'gateway_state.json'), 'utf8'))
    const gwPid = gwState.pid

    // Get process tree via ps
    const { stdout: psOut } = await execAsync(
      `ps --forest -o pid,comm,args --ppid ${gwPid} 2>/dev/null | grep -E 'mcp|stdio|npx|node' | head -20`,
      { timeout: 5000 }
    ).catch(() => ({ stdout: '' }))

    const runningProcs = psOut.split('\n').map(l => {
      const m = l.trim().match(/^(\S+)\s+(.+)/)
      return m ? { pid: m[1], cmd: m[2].slice(0, 60) } : null
    }).filter(Boolean)

    // Determine status of each configured MCP server
    const servers = Object.entries(mcpConfigs).map(([name, config]) => {
      const isRunning = runningProcs.some(p =>
        p.cmd.includes(name) || p.cmd.includes('mcp-' + name) || p.cmd.includes(config.command || '')
      )
      const cmd = Array.isArray(config.args) ? config.args.join(' ') : config.args || ''
      return {
        name,
        enabled: true,
        status: isRunning ? 'running' : 'stopped',
        command: `${config.command || '?'} ${cmd}`.slice(0, 80),
        url: typeof config === 'object' && config.url ? config.url : null,
      }
    })

    res.json({ servers, running_procs: runningProcs })
  } catch (e) {
    res.json({ servers: [], error: e.message })
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
    // Try JSONL files first
    const glob = require('path')
    const sessionsDir = join(HERMES, 'sessions')
    const files = readdirSync(sessionsDir)

    let messages = []
    // Find matching JSONL file
    for (const f of files) {
      if (!f.includes(id) && !id.includes(f.replace(/\..+$/, '').replace('session_', ''))) continue
      const path = join(sessionsDir, f)
      if (!statSync(path).isFile()) continue
      try {
        const content = f.endsWith('.jsonl')
          ? readFileSync(path, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l))
          : [JSON.parse(readFileSync(path, 'utf8'))]
        messages = messages.concat(content)
      } catch {}
    }

    // Clean up messages — strip tool call internals
    const cleaned = messages.map(m => ({
      role: m.role || m.type || 'unknown',
      content: typeof m.content === 'string' ? m.content.slice(0, 500)
        : m.content?.[0]?.text?.slice(0, 500) || null,
      tool_name: m.tool_name || m.toolCallId || null,
      timestamp: m.created_at || m.timestamp || null,
    }))

    res.json({ messages: cleaned })
  } catch (e) {
    res.json({ messages: [], error: e.message })
  }
})

/* ═══════════════════════════════════════════════════════════
   KNOWLEDGE GRAPH — extract entities from memory files
═══════════════════════════════════════════════════════════ */

/* GET /api/memory/graph */
app.get('/api/memory/graph', (req, res) => {
  try {
    const nodes = []
    const links = []
    const seen = new Set()

    const memFiles = [
      join(HERMES, 'memories', 'MEMORY.md'),
      join(HERMES, 'memories', 'USER.md'),
      join(HERMES, 'workspace', 'memory', '2026-04-07.md'),
      join(HERMES, 'workspace', 'MEMORY.md'),
    ]

    const content = memFiles
      .filter(f => existsSync(f))
      .map(f => { try { return readFileSync(f, 'utf8') } catch { return '' } })
      .join('\n')

    // Extract H3 headings as entities (## Name)
    const headingRe = /^#{1,3}\s+(.+)/gm
    let match
    while ((match = headingRe.exec(content)) !== null) {
      const name = match[1].trim()
      if (name.length > 2 && name.length < 60) {
        nodes.push({
          id: name.toLowerCase().replace(/\s+/g, '-'),
          label: name,
          type: 'entity',
        })
      }
    }

    // Extract code blocks / special markers as projects
    const projRe = /```projects?([\s\S]+?)```/gi
    while ((match = projRe.exec(content)) !== null) {
      const items = match[1].split('\n').filter(l => l.trim())
      items.forEach(item => {
        const name = item.replace(/^[-*]\s+/, '').trim()
        if (name && !seen.has(name)) {
          seen.add(name)
          nodes.push({ id: name.toLowerCase().replace(/\s+/g, '-'), label: name, type: 'project' })
        }
      })
    }

    // Simple link extraction: look for "→" or "→" or "links to" patterns
    const linkRe = /([^→\n]+?)\s*→\s*([^→\n]+)/g
    while ((match = linkRe.exec(content)) !== null) {
      const from = match[1].trim().toLowerCase().replace(/\s+/g, '-').slice(0, 30)
      const to = match[2].trim().toLowerCase().replace(/\s+/g, '-').slice(0, 30)
      if (from && to && from !== to) {
        links.push({ source: from, target: to })
      }
    }

    // Deduplicate nodes
    const uniqueNodes = Object.values(
      nodes.reduce((acc, n) => { acc[n.id] = n; return acc }, {})
    ).slice(0, 50) // limit for performance

    res.json({ nodes: uniqueNodes, links })
  } catch (e) {
    res.json({ nodes: [], links: [], error: e.message })
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

/* ═══════════════════════════════════════════════════════════
   CRON — trigger a cron job manually
═══════════════════════════════════════════════════════════ */

/* POST /api/cron/:name/trigger */
app.post('/api/cron/:name/trigger', async (req, res) => {
  const { name } = req.params
  try {
    const { stdout, stderr } = await execAsync(
      `${HERMES_BIN} cron run ${name} 2>&1`,
      { timeout: 60000, env: { ...process.env, HOME: '/home/empir' } }
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
      { timeout: 15000, env: { ...process.env, HOME: '/home/empir' } }
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
      { timeout: 15000, env: { ...process.env, HOME: '/home/empir' } }
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
      { timeout: 30000, env: { ...process.env, HOME: '/home/empir' } }
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
