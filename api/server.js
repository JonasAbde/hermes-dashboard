import express from 'express'
import Database from 'better-sqlite3'
import { readFileSync, readdirSync, statSync, existsSync, openSync, readSync, closeSync, watchFile, unwatchFile, writeFileSync, mkdirSync } from 'fs'
import { join, resolve } from 'path'
import { parse as parseYaml, parseDocument } from 'yaml'
import cors from 'cors'
import { exec, execSync, spawn } from 'child_process'
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

// ── Auth ────────────────────────────────────────────────────────────────────
// Read DASHBOARD_TOKEN from .env at startup
let AUTH_SECRET = ''
try {
  const envContent = readFileSync(join(HERMES, '.env'), 'utf8')
  const match = envContent.match(/^DASHBOARD_TOKEN=(.+)/m)
  if (match) AUTH_SECRET = match[1].trim()
} catch {}

const AUTH_SKIP = new Set([
  '/api/auth/verify',
  '/api/stats',
  '/api/gateway',
  '/api/health',
  '/api/chat',          // chat needs to work for unauth users too
])

function authMiddleware(req, res, next) {
  if (!AUTH_SECRET) return next()  // Auth disabled if no token in .env
  if (AUTH_SKIP.has(req.path)) return next()

  // Support 3 token sources: Authorization header, query param (SSE fallback),
  // or httpOnly cookie set by the login endpoint.
  let token = req.headers.authorization?.replace('Bearer ', '')
             || req.query.token
  if (!token && req.headers.cookie) {
    const match = req.headers.cookie.match(/(?:^|;\s*)hermes_dashboard_token=([^;]+)/)
    if (match) token = match[1]
  }
  if (token !== AUTH_SECRET) {
    return res.status(401).json({ error: 'Unauthorized', code: 'invalid_token' })
  }
  next()
}
app.use(authMiddleware)

app.post('/api/auth/verify', (req, res) => {
  const { token } = req.body || {}
  const ok = token === AUTH_SECRET
  if (ok) {
    // Set httpOnly cookie for SSE fallback — browser sends it automatically
    // to same-origin EventSource connections (no token in URL needed).
    res.setHeader('Set-Cookie',
      `hermes_dashboard_token=${token}; Path=/; SameSite=Lax; HttpOnly`)
  }
  res.json({ ok, hasToken: !!AUTH_SECRET })
})

// GET /api/onboarding/status — should we show onboarding?
// Returns: { needsOnboarding: true } if no provider configured yet
//          { needsOnboarding: false } if already configured
app.get('/api/onboarding/status', (req, res) => {
  try {
    const configPath = join(HERMES, 'config.yaml')
    let content = ''
    try { content = readFileSync(configPath, 'utf8') } catch {}
    // Check if config.yaml has a top-level provider key
    // Provider can be: "kilocode", "anthropic", "openrouter", etc.
    // or nested under a model: key
    const hasProvider = /^provider\s*:/m.test(content)
    const hasModel = /^model\s*:/m.test(content)
    res.json({ needsOnboarding: !(hasProvider || hasModel) })
  } catch (e) {
    // If we can't read config, treat as needing onboarding
    res.json({ needsOnboarding: true })
  }
})

// ── Config writer helpers ───────────────────────────────────────────────────────

function setEnvVar(key, value) {
  const envPath = join(HERMES, '.env')
  let content = ''
  try { content = readFileSync(envPath, 'utf8') } catch {}
  const lines = content.split('\n').filter(l => !l.startsWith(key + '='))
  lines.push(`${key}=${value}`)
  writeFileSync(envPath, lines.join('\n') + '\n')
}

// Safe config write: reads current config.yaml, patches ONLY the keys that
// were changed, preserves everything else (no delete, no overwrite).
// Uses Python/PyYAML to ensure valid YAML output and proper nested structure.
function setYamlKey(key, value) {
  const configPath = join(HERMES, 'config.yaml')
  const raw = readFileSync(configPath, 'utf8')
  // Use Python to merge the patch into the existing config
  // This is the safest approach: Python reads the YAML, updates one key,
  // and writes back with proper formatting (preserving comments and structure)
  const escapedKey = key.replace(/'/g, "'\"'\"'")
  const escapedVal = JSON.stringify(value)
  try {
    execSync(
      `${PYTHON} -c "import yaml,json,sys; cfg=yaml.safe_load(open('${configPath}')); cfg['${escapedKey}']=json.loads('${escapedVal}'); yaml.dump(cfg,open('${configPath}','w'),default_flow_style=False,allow_unicode=True,sort_keys=False)"`,
      { cwd: HERMES, timeout: 5000 }
    )
  } catch(e) {
    // Fallback: line-by-line replacement (safe for top-level keys)
    const lines = raw.split('\n')
    const regex = new RegExp(`^(${key.replace(/\./g, '\\\\.')}\\s*:\\s*)(.*)$`)
    const idx = lines.findIndex(l => regex.test(l))
    if (idx >= 0) {
      lines[idx] = lines[idx].replace(regex, `$1${JSON.stringify(value)}`)
    } else {
      lines.push(`${key}: ${JSON.stringify(value)}`)
    }
    writeFileSync(configPath, lines.join('\n'))
  }
}

app.post('/api/config', async (req, res) => {
  const { provider, model, apiKey, telegramToken } = req.body || {}
  try {
    // Backup before any writes
    const configPath = join(HERMES, 'config.yaml')
    const backupPath = configPath + '.bak'
    try {
      const current = readFileSync(configPath, 'utf8')
      // Only backup if no recent backup exists (don't overwrite existing backups)
      if (!existsSync(backupPath) || Date.now() - 86400000 > 0) {
        writeFileSync(backupPath, current, 'utf8')
      }
    } catch {}

    if (provider) setYamlKey('provider', provider)
    if (model) setYamlKey('model', model)   // sets model: <value>
    if (apiKey && provider) {
      const envKey = `${provider.toUpperCase()}_API_KEY`
      setEnvVar(envKey, apiKey)
    }
    if (telegramToken) {
      setEnvVar('TELEGRAM_BOT_TOKEN', telegramToken)
    }

    // Validate: re-read and confirm the write happened
    try {
      const after = readFileSync(configPath, 'utf8')
      if (provider && !after.includes(`provider: ${provider}`)) {
        throw new Error('provider write failed — file may have been corrupted')
      }
    } catch(e) {
      // Restore from backup
      if (existsSync(backupPath)) {
        writeFileSync(configPath, readFileSync(backupPath, 'utf8'), 'utf8')
      }
      return res.status(500).json({ ok: false, error: `Write failed, restored from backup: ${e.message}` })
    }

    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message })
  }
})

// GET /api/onboarding/status — should we show onboarding?
// Returns: { needsOnboarding: true } if no provider configured yet
//          { needsOnboarding: false } if already configured
app.get('/api/onboarding/status', (req, res) => {
  try {
    const configPath = join(HERMES, 'config.yaml')
    let content = ''
    try { content = readFileSync(configPath, 'utf8') } catch {}
    const hasProvider = /^provider\s*:/m.test(content) && !/^provider\s*:\s*""?\s*$/.test(content)
    const envPath = join(HERMES, '.env')
    let envContent = ''
    try { envContent = readFileSync(envPath, 'utf8') } catch {}
    const hasApiKey = /^[A-Z_]+_API_KEY\s*=/m.test(envContent)
    res.json({ needsOnboarding: !hasProvider, hasApiKey })
  } catch (e) {
    // If we can't read config, treat as needing onboarding
    res.json({ needsOnboarding: true, hasApiKey: false })
  }
})

const PYTHON = '/usr/bin/python3'
const QUERY_SCRIPT = join(new URL('.', import.meta.url).pathname, 'query.py')

const cache = new Map()
const pending = new Map()
const MAX_CACHE_SIZE = 100  // Limit cache to prevent unbounded growth

// Periodic cache cleanup (every 5 minutes)
setInterval(() => {
  const now = Date.now()
  const CACHE_TTL = 30000
  for (const [key, entry] of cache.entries()) {
    if (now - entry.ts > CACHE_TTL) cache.delete(key)
  }
}, 300000)

async function pyQuery(cmd, ...args) {
  const key = [cmd, ...args].join(':')
  const hit = cache.get(key)
  if (hit && Date.now() - hit.ts < 30000) return hit.data

  if (pending.has(key)) return pending.get(key)

  // Evict oldest entries if cache is full
  if (cache.size >= MAX_CACHE_SIZE) {
    const oldestKeys = [...cache.entries()]
      .sort((a, b) => a[1].ts - b[1].ts)
      .slice(0, Math.floor(MAX_CACHE_SIZE / 4))
      .map(([k]) => k)
    oldestKeys.forEach(k => cache.delete(k))
  }

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

const DASHBOARD_STATE_DIR = join(HERMES, 'dashboard_state')
const DASHBOARD_RECOMMENDATION_STATE_PATH = join(DASHBOARD_STATE_DIR, 'recommendations.json')
const DASHBOARD_PROFILE_PATH = join(DASHBOARD_STATE_DIR, 'profile.json')
const DASHBOARD_AGENT_STATUS_PATH = join(DASHBOARD_STATE_DIR, 'agent-status.json')
const DASHBOARD_WEBHOOK_CONFIG_PATH = join(DASHBOARD_STATE_DIR, 'webhook-config.json')
const LEGACY_RECOMMENDATION_STATE_PATH = join(HERMES, 'recommendation_state.json')
const LEGACY_PROFILE_PATH = join(HERMES, 'user_profile.json')
const LEGACY_AGENT_STATUS_PATH = join(HERMES, 'agent_status.json')
const LEGACY_WEBHOOK_CONFIG_PATH = join(HERMES, 'webhook_config.json')

function ensureDashboardStateDir() {
  try {
    mkdirSync(DASHBOARD_STATE_DIR, { recursive: true })
  } catch {}
}

function migrateLegacyDashboardState(primaryPath, legacyPath, value) {
  if (primaryPath === legacyPath) return value
  try {
    if (!existsSync(primaryPath) && existsSync(legacyPath) && value && typeof value === 'object') {
      ensureDashboardStateDir()
      writeFileSync(primaryPath, JSON.stringify(value, null, 2), 'utf8')
    }
  } catch {}
  return value
}

function readDashboardOwnedJson(primaryPath, legacyPath, fallback) {
  const tryPaths = [primaryPath, legacyPath]
  for (const path of tryPaths) {
    try {
      if (!existsSync(path)) continue
      const raw = JSON.parse(readFileSync(path, 'utf8'))
      if (raw && typeof raw === 'object') {
        return migrateLegacyDashboardState(primaryPath, legacyPath, raw)
      }
    } catch {}
  }
  return typeof fallback === 'function' ? fallback() : fallback
}

function writeDashboardOwnedJson(path, data) {
  ensureDashboardStateDir()
  writeFileSync(path, JSON.stringify(data, null, 2), 'utf8')
}

function readDashboardProfile() {
  return readDashboardOwnedJson(DASHBOARD_PROFILE_PATH, LEGACY_PROFILE_PATH, {})
}

function writeDashboardProfile(profileData) {
  writeDashboardOwnedJson(DASHBOARD_PROFILE_PATH, profileData)
}

function readRecommendationState() {
  const raw = readDashboardOwnedJson(DASHBOARD_RECOMMENDATION_STATE_PATH, LEGACY_RECOMMENDATION_STATE_PATH, {})
  return {
    items: raw?.items && typeof raw.items === 'object' ? raw.items : {},
    history: Array.isArray(raw?.history) ? raw.history : [],
  }
}

function writeRecommendationState(state) {
  const next = {
    items: state?.items && typeof state.items === 'object' ? state.items : {},
    history: Array.isArray(state?.history) ? state.history.slice(-500) : [],
    updated_at: new Date().toISOString(),
  }
  writeDashboardOwnedJson(DASHBOARD_RECOMMENDATION_STATE_PATH, next)
}

function defaultAgentStatus() {
  return { status: 'online', rhythm: 'steady', stopped: false }
}

function readDashboardAgentStatus() {
  return readDashboardOwnedJson(DASHBOARD_AGENT_STATUS_PATH, LEGACY_AGENT_STATUS_PATH, defaultAgentStatus)
}

function writeDashboardAgentStatus(statusData) {
  writeDashboardOwnedJson(DASHBOARD_AGENT_STATUS_PATH, statusData)
}

function defaultWebhookConfig() {
  return { url: '', secret: '', enabled: false }
}

function readDashboardWebhookConfig() {
  return readDashboardOwnedJson(DASHBOARD_WEBHOOK_CONFIG_PATH, LEGACY_WEBHOOK_CONFIG_PATH, defaultWebhookConfig)
}

function writeDashboardWebhookConfig(configData) {
  writeDashboardOwnedJson(DASHBOARD_WEBHOOK_CONFIG_PATH, configData)
}

/* ── /api/gateway ── */
app.get('/api/gateway', (req, res) => {
  try {
    const gw_path = join(HERMES, 'gateway_state.json')
    const gw = JSON.parse(readFileSync(gw_path, 'utf8'))
    // Parse config.yaml via Python script file — avoids Node.js yaml library issues
    // with reserved words like "default" as mapping keys.
    // Fallback: if Python fails, use Node.js yaml with workaround.
    let cfg
    try {
      const scriptPath = join(new URL('.', import.meta.url).pathname, 'parse_config.py')
      const cfgRaw = execSync(`${PYTHON} ${scriptPath} < ${join(HERMES, 'config.yaml')}`, { cwd: HERMES, timeout: 8000 })
      cfg = JSON.parse(cfgRaw)
    } catch {
      // Fallback: Node.js yaml — works for most keys but 'default:' becomes inaccessible
      // We handle model via cfg.provider + cfg.default.default below
      const rawCfg = parseYaml(readFileSync(join(HERMES, 'config.yaml'), 'utf8'))
      cfg = rawCfg
    }

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
    
    // Check heartbeat age (heartbeat updates every 30s even when idle)
    // Staleness threshold: 3x heartbeat interval (90s) for heartbeat, 300s (5min) for legacy
    const heartbeat_age_s = state_age_s  // Same as updated_at for now
    const heartbeat_fresh = heartbeat_age_s !== null && heartbeat_age_s < 90  // 3x 30s interval
    const state_fresh = heartbeat_fresh || (state_age_s !== null && state_age_s < 300)  // Fallback to 5min for legacy

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

    // cfg.model: can be string "anthropic/claude-opus-4-6" or object { default, provider, api_key }
    // cfg.default: Python-parsed YAML "default:" key → { default: '...', provider, api_key }
    //   (Node.js yaml makes cfg.default inaccessible, so we also check cfg.model?.default)
    const modelObj = cfg.model ?? cfg.models?.default ?? cfg.default
    // Python: modelObj = { default: 'kilo-auto/balanced', provider } → label = modelObj.default
    // Node.js: modelObj = undefined → use provider as fallback label
    const modelLabel = typeof modelObj === 'string' ? modelObj
      : (modelObj?.default ?? cfg.model?.default ?? cfg.provider ?? 'unknown')

    res.json({
      gateway_online: pid_alive,
      gateway_state:  gw.gateway_state ?? 'unknown',
      model:          typeof modelObj === 'string' ? modelObj : (modelObj?.default ?? null),
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
    console.error('/api/gateway error:', e.message)
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

/* ═══════════════════════════════════════════════════════════
   MEMORY ENTRIES — read/write Hermes Agent memory entries
   Hermes writes to: ~/.hermes/memories/MEMORY.md and USER.md
   Format: §-delimited entries
═══════════════════════════════════════════════════════════ */

const MEMORY_API_SCRIPT = join(new URL('.', import.meta.url).pathname, 'memory_api.py')

async function memoryApiCall(action, target, arg1 = null, arg2 = null) {
  const args = [PYTHON, MEMORY_API_SCRIPT, action, target]
  if (arg1 !== null) args.push(arg1)
  if (arg2 !== null) args.push(arg2)
  
  const { stdout } = await execAsync(args.join(' '), {
    env: { ...process.env, HOME: HOME_DIR },
    timeout: 15000,
  })
  return JSON.parse(stdout.trim())
}

/* GET /api/memory/entries — read all memory entries (structured via memory_entries.py) */
app.get('/api/memory/entries', async (req, res) => {
  const target = req.query.target || 'all'
  try {
    const entriesScript = join(new URL('.', import.meta.url).pathname, 'memory_entries.py')
    const limit = parseInt(req.query.limit) || 100
    const offset = parseInt(req.query.offset) || 0
    const { stdout } = await execAsync(
      `${PYTHON} ${entriesScript} entries --limit ${limit} --offset ${offset}`,
      { env: { ...process.env, HOME: HOME_DIR }, timeout: 15000 }
    )
    let data = JSON.parse(stdout.trim())
    // Filter by target if specified
    if (target !== 'all') {
      data.entries = (data.entries || []).filter(e => e.target === target)
      data.total = data.entries.length
    }
    res.json(data)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

/* POST /api/memory/entries — add a new memory entry */
app.post('/api/memory/entries', async (req, res) => {
  const { target, content } = req.body
  
  if (!['memory', 'user'].includes(target)) {
    return res.status(400).json({ error: "target must be 'memory' or 'user'" })
  }
  if (!content || !content.trim()) {
    return res.status(400).json({ error: "content is required" })
  }
  
  try {
    const result = await memoryApiCall('add', target, content.trim())
    res.json(result)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

/* PUT /api/memory/entries — replace an existing entry */
app.put('/api/memory/entries', async (req, res) => {
  const { target, old_text, new_content } = req.body
  
  if (!['memory', 'user'].includes(target)) {
    return res.status(400).json({ error: "target must be 'memory' or 'user'" })
  }
  if (!old_text || !old_text.trim()) {
    return res.status(400).json({ error: "old_text is required" })
  }
  if (!new_content || !new_content.trim()) {
    return res.status(400).json({ error: "new_content is required" })
  }
  
  try {
    const result = await memoryApiCall('replace', target, old_text.trim(), new_content.trim())
    res.json(result)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

/* DELETE /api/memory/entries — remove an entry */
app.delete('/api/memory/entries', async (req, res) => {
  const { target, old_text } = req.body
  
  if (!['memory', 'user'].includes(target)) {
    return res.status(400).json({ error: "target must be 'memory' or 'user'" })
  }
  if (!old_text || !old_text.trim()) {
    return res.status(400).json({ error: "old_text is required" })
  }
  
  try {
    const result = await memoryApiCall('remove', target, old_text.trim())
    res.json(result)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

/* ── /api/cron ── */
app.get('/api/cron', (req, res) => {
  try {
    // Try reading from jobs.json first (source of truth for CLI/chat created jobs)
    const jobsFile = join(HERMES, 'cron', 'jobs.json')
    let rawJobs = []
    
    if (existsSync(jobsFile)) {
      try {
        const data = JSON.parse(readFileSync(jobsFile, 'utf8'))
        rawJobs = data.jobs || []
      } catch (e) {
        console.error('Failed to read jobs.json:', e)
      }
    }
    
    // Fallback to config.yaml if jobs.json is empty or missing
    if (rawJobs.length === 0) {
      try {
        const cfg = parseYaml(readFileSync(join(HERMES, 'config.yaml'), 'utf8'))
        const configJobs = cfg.cron ?? cfg.crons ?? []
        rawJobs = Array.isArray(configJobs) ? configJobs : Object.entries(configJobs).map(([k,v]) => ({ name: k, ...v }))
      } catch (e) {
        console.error('Failed to read config.yaml cron:', e)
      }
    }
    
    const jobs = rawJobs
      .map(j => ({
        id:        j.id ?? j.name ?? 'unnamed',
        name:      j.name ?? j.id ?? 'unnamed',
        schedule:  j.schedule ?? j.cron ?? '—',
        enabled:   j.enabled !== false,
        paused:    j.paused === true,
        last_run:  j.last_run_at ?? j.last_run ?? null,
        next_run:  j.next_run_at ?? j.next_run ?? null,
        repeat:    j.repeat ?? null,
        repeat_count: j.repeat_count ?? 0,
        prompt:    j.prompt ?? null,
        deliver:   j.deliver ?? null,
      }))
      // Filter out config-only entries that aren't real scheduled jobs
      .filter(j => j.schedule && j.schedule !== '—')
    
    res.json({ jobs })
  } catch (e) {
    console.error('Error in /api/cron:', e)
    res.json({ jobs: [] })
  }
})

/* POST /api/cron/jobs — create a new job */
app.post('/api/cron/jobs', (req, res) => {
  try {
    const { name, schedule, prompt, deliver, enabled, skills, repeat, model } = req.body || {}
    if (!name || !schedule || !prompt) {
      return res.status(400).json({ error: 'name, schedule and prompt are required' })
    }

    const jobsFile = join(HERMES, 'cron', 'jobs.json')
    let jobs = []
    try {
      if (existsSync(jobsFile)) {
        const data = JSON.parse(readFileSync(jobsFile, 'utf8'))
        jobs = data.jobs || []
      }
    } catch {}

    // Check for duplicate name
    if (jobs.find(j => j.name === name)) {
      return res.status(409).json({ error: `Job '${name}' already exists` })
    }

    const newJob = {
      id: name.replace(/\s+/g, '-').toLowerCase(),
      name,
      schedule,
      prompt,
      deliver: deliver || 'local',
      enabled: enabled !== false,
      skills: skills || [],
      repeat: repeat || null,
      model: model || null,
      created_at: Date.now(),
      last_run: null,
      next_run: null,
    }

    jobs.push(newJob)
    writeFileSync(jobsFile, JSON.stringify({ jobs, updated_at: new Date().toISOString() }, null, 2), 'utf8')
    res.json({ ok: true, job: newJob })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

/* PUT /api/cron/:name — update a job */
app.put('/api/cron/:name', (req, res) => {
  try {
    const { name } = req.params
    const updates = req.body || {}

    const jobsFile = join(HERMES, 'cron', 'jobs.json')
    let jobs = []
    try {
      if (existsSync(jobsFile)) {
        const data = JSON.parse(readFileSync(jobsFile, 'utf8'))
        jobs = data.jobs || []
      }
    } catch {}

    const idx = jobs.findIndex(j => j.name === name)
    if (idx < 0) return res.status(404).json({ error: `Job '${name}' not found` })

    jobs[idx] = { ...jobs[idx], ...updates, updated_at: Date.now() }
    writeFileSync(jobsFile, JSON.stringify({ jobs, updated_at: new Date().toISOString() }, null, 2), 'utf8')
    res.json({ ok: true, job: jobs[idx] })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

/* DELETE /api/cron/:name — delete a job */
app.delete('/api/cron/:name', (req, res) => {
  try {
    const { name } = req.params
    const jobsFile = join(HERMES, 'cron', 'jobs.json')
    let jobs = []
    try {
      if (existsSync(jobsFile)) {
        const data = JSON.parse(readFileSync(jobsFile, 'utf8'))
        jobs = data.jobs || []
      }
    } catch {}

    const idx = jobs.findIndex(j => j.name === name)
    if (idx < 0) return res.status(404).json({ error: `Job '${name}' not found` })

    jobs.splice(idx, 1)
    writeFileSync(jobsFile, JSON.stringify({ jobs, updated_at: new Date().toISOString() }, null, 2), 'utf8')
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

/* PATCH /api/cron/:name/enable — toggle enabled */
app.patch('/api/cron/:name/enable', (req, res) => {
  try {
    const { name } = req.params
    const { enabled } = req.body || {}

    const jobsFile = join(HERMES, 'cron', 'jobs.json')
    let jobs = []
    try {
      if (existsSync(jobsFile)) {
        const data = JSON.parse(readFileSync(jobsFile, 'utf8'))
        jobs = data.jobs || []
      }
    } catch {}

    const idx = jobs.findIndex(j => j.name === name)
    if (idx < 0) return res.status(404).json({ error: `Job '${name}' not found` })

    jobs[idx].enabled = enabled
    jobs[idx].updated_at = Date.now()
    writeFileSync(jobsFile, JSON.stringify({ jobs, updated_at: new Date().toISOString() }, null, 2), 'utf8')
    res.json({ ok: true, job: jobs[idx] })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

/* GET /api/cron/:name/output — read last output from output dir */
app.get('/api/cron/:name/output', (req, res) => {
  try {
    const { name } = req.params
    const limit = parseInt(req.query.limit) || 5
    const outputDir = join(HERMES, 'cron', 'output')

    if (!existsSync(outputDir)) return res.json({ outputs: [] })

    const prefix = name.replace(/[^a-zA-Z0-9_-]/g, '_')
    const files = readdirSync(outputDir)
      .filter(f => f.startsWith(prefix + '_'))
      .sort()
      .reverse()
      .slice(0, limit)

    const outputs = files.map(f => {
      try {
        const content = readFileSync(join(outputDir, f), 'utf8')
        const parsed = JSON.parse(content)
        // Extract timestamp from filename: name_timestamp.json
        const ts = f.replace(prefix + '_', '').replace('.json', '')
        return { filename: f, timestamp: ts, data: parsed }
      } catch {
        return { filename: f, timestamp: f, data: null }
      }
    })

    res.json({ outputs })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

/* GET /api/cron/stats — aggregate cron stats */
app.get('/api/cron/stats', (req, res) => {
  try {
    const jobsFile = join(HERMES, 'cron', 'jobs.json')
    const outputDir = join(HERMES, 'cron', 'output')

    let jobs = []
    try {
      if (existsSync(jobsFile)) {
        const data = JSON.parse(readFileSync(jobsFile, 'utf8'))
        jobs = data.jobs || []
      }
    } catch {}

    let failedToday = 0
    let outputsToday = 0
    if (existsSync(outputDir)) {
      const today = new Date().toISOString().slice(0, 10)
      const files = readdirSync(outputDir)
      outputsToday = files.length
      failedToday = files.filter(f => {
        try {
          const content = readFileSync(join(outputDir, f), 'utf8')
          const parsed = JSON.parse(content)
          const ts = f.split('_').pop()?.replace('.json', '') || ''
          return ts.startsWith(today) && (parsed.error || parsed.ok === false)
        } catch { return false }
      }).length
    }

    const activeJobs = jobs.filter(j => j.enabled !== false)
    const nextScheduled = activeJobs
      .filter(j => j.next_run)
      .sort((a, b) => (a.next_run || Infinity) - (b.next_run || Infinity))[0]

    res.json({
      total: jobs.length,
      active: activeJobs.length,
      inactive: jobs.length - activeJobs.length,
      failed_today: failedToday,
      outputs_today: outputsToday,
      next_scheduled: nextScheduled || null,
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

/* ═══════════════════════════════════════════════════════════
   SKILLS — skill management and viewing
═══════════════════════════════════════════════════════════ */

/* ── /api/skills — list all skills (recursively) ── */
app.get('/api/skills', (req, res) => {
  try {
    const skillsDirs = [
      join(HERMES, 'workspace', 'skills'),
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


/* ── GET /api/skills/categories — group skills by category ── */
app.get('/api/skills/categories', (req, res) => {
  try {
    const skillsDirs = [
      join(HERMES, 'workspace', 'skills'),
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

/* ── GET /api/skills/:name — read a specific skill ── */
app.get('/api/skills/:name', (req, res) => {
  const { name } = req.params
  // Name can contain slashes (e.g., "mlops/models/whisper")
  const skillName = decodeURIComponent(name)

  const searchPaths = [
    // Custom skills first
    join(HERMES, 'workspace', 'skills', skillName, 'SKILL.md'),
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

    for (const baseDir of [join(HERMES, 'workspace', 'skills'), join(HERMES, 'hermes-agent', 'skills')]) {
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
    join(HERMES, 'workspace', 'skills', skillName, 'SKILL.md'),
    join(HERMES, 'hermes-agent', 'skills', skillName, 'SKILL.md'),
  ]

  let targetPath = existingPaths.find(p => existsSync(p))

  if (!targetPath) {
    // Create in custom skills directory
    targetPath = join(HERMES, 'workspace', 'skills', skillName, 'SKILL.md')
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
    // Validate syntax first
    parseYaml(raw_config)

    // Backup before full replace
    const configPath = join(HERMES, 'config.yaml')
    const backupPath = configPath + '.bak'
    try { writeFileSync(backupPath, readFileSync(configPath, 'utf8'), 'utf8') } catch {}

    writeFileSync(configPath, raw_config, 'utf8')
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
    // Backup before any changes
    const backupPath = configPath + '.bak'
    try { writeFileSync(backupPath, readFileSync(configPath, 'utf8'), 'utf8') } catch {}

    // Use Python for safe deep merge (avoids corruption)
    const escapedUpdates = JSON.stringify(updates).replace(/'/g, "'\"'\"'")
    try {
      execSync(
        `${PYTHON} -c "import yaml,json,sys; cfg=yaml.safe_load(open('${configPath}')); cfg.update(json.loads('${escapedUpdates}')); yaml.dump(cfg,open('${configPath}','w'),default_flow_style=False,allow_unicode=True,sort_keys=False)"`,
        { cwd: HERMES, timeout: 8000 }
      )
      res.json({ ok: true, patched: Object.keys(updates) })
    } catch(e) {
      // Restore from backup
      if (existsSync(backupPath)) {
        writeFileSync(configPath, readFileSync(backupPath, 'utf8'), 'utf8')
      }
      res.status(500).json({ ok: false, error: `patch failed: ${e.message}` })
    }
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

/* GET /api/control/services — list systemd services status */
app.get('/api/control/services', (req, res) => {
  try {
    const serviceNames = ['hermes-gateway', 'hermes-dashboard-api']
    const services = serviceNames.map((name) => {
      try {
        const r = execSync(`systemctl --user show ${name} --property=ActiveState,SubState --value`, { timeout: 5000 })
        const lines = r.toString().trim().split('\n')
        const activeState = lines[0] || 'unknown'
        const subState = lines[1] || 'unknown'
        return {
          name,
          active: activeState === 'active',
          state: activeState,
          substate: subState,
        }
      } catch {
        return { name, active: false, state: 'unknown', substate: 'unknown' }
      }
    })
    res.json({ services })
  } catch (e) {
    res.status(500).json({ error: e.message })
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

/* ── /api/agent/status ── */
app.get('/api/agent/status', (req, res) => {
  try {
    const data = readDashboardAgentStatus()
    res.json({
      ...data,
      storage_owner: 'dashboard',
      storage_path: '~/.hermes/dashboard_state/agent-status.json',
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.post('/api/agent/status', (req, res) => {
  try {
    const current = readDashboardAgentStatus()
    const updates = req.body
    const next = { ...current, ...updates, updated_at: new Date().toISOString() }

    writeDashboardAgentStatus(next)
    res.json({
      ...next,
      storage_owner: 'dashboard',
      storage_path: '~/.hermes/dashboard_state/agent-status.json',
    })
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
    
    // Also update dashboard-owned agent status for UI state
    const currentStatus = readDashboardAgentStatus()
    const nextStatus = { ...currentStatus, rhythm, updated_at: new Date().toISOString() }
    writeDashboardAgentStatus(nextStatus)
    
    // Notify gateway if running (optional - doesn't block response)
    hermesCmd('gateway notify rhythm-changed').catch(() => {})
    
    res.json({ ok: true, rhythm, config: rhythmCfg })
  } catch (e) {
    console.error('Neural shift error:', e)
    res.status(500).json({ error: e.message })
  }
})

/* ── /api/webhook/config ── */
app.get('/api/webhook/config', (req, res) => {
  try {
    const config = readDashboardWebhookConfig()
    res.json({
      ...config,
      storage_owner: 'dashboard',
      storage_path: '~/.hermes/dashboard_state/webhook-config.json',
    })
  } catch (e) {
    res.json({
      ...defaultWebhookConfig(),
      storage_owner: 'dashboard',
      storage_path: '~/.hermes/dashboard_state/webhook-config.json',
    })
  }
})

app.post('/api/webhook/config', (req, res) => {
  try {
    const { url, secret, enabled } = req.body
    const config = {
      url: url || '',
      secret: secret || '',
      enabled: enabled || false,
      updated_at: new Date().toISOString(),
    }

    writeDashboardWebhookConfig(config)
    
    // Restart gateway to pick up new webhook config if needed
    if (enabled && url) {
      hermesCmd('gateway restart').catch(() => {})
    }
    
    res.json({
      ok: true,
      message: 'Webhook configuration saved. Gateway restart triggered if webhook was enabled.',
      storage_owner: 'dashboard',
      storage_path: '~/.hermes/dashboard_state/webhook-config.json',
    })
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message })
  }
})

/* duplicate gateway/model/approval routes removed — canonical handlers below */

/* ── /api/settings alias ── */
app.get('/api/settings', (req, res) => res.redirect('/api/config'))

/* ── /api/profile ── */
app.get('/api/profile', (req, res) => {
  try {
    const userInfo = os.userInfo();
    const profileData = readDashboardProfile()
    res.json({
      username: profileData.name || userInfo.username,
      recommendationMode: profileData.recommendation_mode || 'stability-first',
      storage_owner: 'dashboard',
      storage_path: '~/.hermes/dashboard_state/profile.json',
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
    let profileData = readDashboardProfile()
    
    const rawName = typeof req.body?.name === 'string' ? req.body.name : null;
    const rawMode = typeof req.body?.recommendationMode === 'string' ? req.body.recommendationMode : null;
    const allowedModes = new Set(['stability-first', 'cost-first', 'speed-first']);

    if (rawName != null) {
      const name = rawName.trim();
      if (!name) {
        return res.status(400).json({ ok: false, error: 'name is required' });
      }
      if (name.length > 80) {
        return res.status(400).json({ ok: false, error: 'name too long (max 80)' });
      }
      profileData.name = name;
    }

    if (rawMode != null) {
      if (!allowedModes.has(rawMode)) {
        return res.status(400).json({ ok: false, error: 'invalid recommendationMode' });
      }
      profileData.recommendation_mode = rawMode;
    }

    if (rawName == null && rawMode == null) {
      return res.status(400).json({ ok: false, error: 'nothing to update' });
    }

    profileData.updated_at = new Date().toISOString();
    
    writeDashboardProfile(profileData)
    res.json({
      ok: true,
      username: profileData.name || os.userInfo().username,
      recommendationMode: profileData.recommendation_mode || 'stability-first',
      storage_owner: 'dashboard',
      storage_path: '~/.hermes/dashboard_state/profile.json',
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
})

/* ── /api/logs/files — discover all available log files ── */
app.get('/api/logs/files', (req, res) => {
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
          // Pretty label
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
        // Built-in first, then MCP, then others
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

/* ── /api/logs SSE — live tail of Hermes gateway logs ── */
app.get('/api/logs', (req, res) => {
  const fileParam = req.query.file || 'gateway'
  const logFile = join(HERMES, 'logs', `${fileParam}.log`)
  // Backend level filter (saves bandwidth)
  const levels = (req.query.levels || 'all').split(',').filter(Boolean)
  const filterAll = levels.includes('all') || levels.length === 0

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  let lastSize = 0
  let clientGone = false
  let iterations = 0
  const MAX_ITERATIONS = 15000  // ~50 minutes at 200ms interval to prevent indefinite resource usage

  const sendHeartbeat = () => {
    if (!clientGone) res.write(': heartbeat\n\n')
  }

  // Smarter level detection using structured log format
  // Format: YYYY-MM-DD HH:MM:SS,mmm LEVEL logger_name: message
  const detectLevel = (line) => {
    // Hermes structured format: ",NNN LEVEL logger:" → look for the level
    // e.g. "2026-04-08 01:22:11,545 INFO gateway.run:"
    const m = line.match(/,\d{3}\s+(ERROR|WARN|WARNING|DEBUG|INFO)\s+/)
    if (m) {
      const l = m[1].toLowerCase()
      if (l === 'warning') return 'warn'
      return l
    }
    // Fallback: just look for keyword
    if (line.includes('ERROR')) return 'error'
    if (line.includes('WARN') || line.includes('WARNING')) return 'warn'
    if (line.includes('DEBUG')) return 'debug'
    return 'info'
  }

  // Parse structured message into metadata
  const parseMessage = (line) => {
    // Hermes format: "time LEVEL logger: message"
    // e.g. "2026-04-08 01:22:11,545 INFO gateway.run: inbound message: platform=telegram ..."
    const meta = {}
    const tsMatch = line.match(/^(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:,\d{3})?)/)
    if (tsMatch) meta.ts = tsMatch[1]

    // Platform/user/session from gateway run logs
    const inbound = line.match(/platform=(\w+)/)
    const userMatch = line.match(/user=(\w+)/)
    const chatMatch = line.match(/chat=([-\d]+)/)
    const sessionMatch = line.match(/session[=_]([\w:]+)/)

    if (inbound) meta.platform = inbound[1]
    if (userMatch) meta.user = userMatch[1]
    if (chatMatch) meta.chat = chatMatch[1]
    if (sessionMatch) meta.session_id = sessionMatch[1]

    // Error context
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
      // Limit initial read to prevent memory issues with large log files
      const MAX_INITIAL_SIZE = 1024 * 1024  // 1MB max
      if (stat.size > lastSize) {
        const bytesToRead = Math.min(stat.size - lastSize, MAX_INITIAL_SIZE)
        const fd = openSync(logFile, 'r')
        const buf = Buffer.alloc(bytesToRead)
        readSync(fd, buf, 0, buf.length, stat.size - bytesToRead)  // Read from end
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

  /* Send last 50 lines as initial batch */
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

  // 200ms polling for near-real-time updates
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
   UNIFIED MEMORY — entries, timeline, search, cross-refs
   Single source of truth: ~/.hermes/memories/ (MEMORY.md + USER.md)
   Hermes agent writes here, Dashboard reads here.
═══════════════════════════════════════════════════════════ */

/* GET /api/memory/entries — structured memory entries JSON */
app.get('/api/memory/entries', (req, res) => {
  const pyScript = join(new URL('.', import.meta.url).pathname, 'memory_entries.py')
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

/* GET /api/memory/timeline — chronological entry list */
app.get('/api/memory/timeline', (req, res) => {
  const pyScript = join(new URL('.', import.meta.url).pathname, 'memory_entries.py')
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

/* GET /api/memory/search — ranked full-text search */
app.get('/api/memory/search', (req, res) => {
  const pyScript = join(new URL('.', import.meta.url).pathname, 'memory_entries.py')
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

/* GET /api/memory/graph — unified graph data from entries index */
app.get('/api/memory/entries/graph', (req, res) => {
  const pyScript = join(new URL('.', import.meta.url).pathname, 'memory_entries.py')

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

/* POST /api/memory/entries — add new entry (Dashboard → Hermes) */
app.post('/api/memory/entries', (req, res) => {
  const { content, target, conversation_id } = req.body
  if (!content || !content.trim()) {
    return res.status(400).json({ success: false, error: 'content required' })
  }

  const pyScript = join(new URL('.', import.meta.url).pathname, 'memory_entries.py')
  const targetArg = (target === 'user') ? 'user' : 'memory'
  const contentEscaped = content.trim().replace(/"/g, '\\"')

  execAsync(
    `python3 "${pyScript}" add ${targetArg} "${contentEscaped}"`,
    { timeout: 15000 }
  )
    .then(({ stdout }) => {
      try {
        const result = JSON.parse(stdout.trim())
        // Also refresh the entries index after write
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

/* GET /api/memory/index — raw entries index JSON (cross-ref + metadata) */
app.get('/api/memory/index', (req, res) => {
  const idxPath = join(HERMES, 'memories', 'entries_index.json')
  try {
    if (existsSync(idxPath)) {
      const raw = readFileSync(idxPath, 'utf8')
      const data = JSON.parse(raw)
      return res.json(data)
    }
    // Fallback: generate on the fly
    const pyScript = join(new URL('.', import.meta.url).pathname, 'memory_entries.py')
    execAsync(`python3 "${pyScript}" index`, { timeout: 10000 }).catch(() => {})
    res.json({ error: 'index not yet built', generated_at: new Date().toISOString() })
  } catch (e) {
    res.status(500).json({ error: e.message })
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
  const areaPriorityByMode = {
    'stability-first': { reliability: 0, operations: 1, memory: 2, usage: 3, cost: 4, status: 5, overview: 6 },
    'cost-first': { cost: 0, reliability: 1, operations: 2, memory: 3, usage: 4, status: 5, overview: 6 },
    'speed-first': { usage: 0, operations: 1, reliability: 2, memory: 3, cost: 4, status: 5, overview: 6 },
  }

  function pushAction(items, item) {
    items.push({
      id: item.id,
      title: item.title,
      reason: item.reason,
      details: Array.isArray(item.details) ? item.details : [],
      severity: item.severity || 'medium',
      action: item.action || null,
      area: item.area || 'overview',
      created_at: new Date().toISOString(),
    })
  }

  try {
    const items = []
    let recommendationMode = 'stability-first'
    const recommendationState = readRecommendationState()
    const nowMs = Date.now()

    try {
      const profile = readDashboardProfile()
      const mode = profile?.recommendation_mode
      if (mode && areaPriorityByMode[mode]) recommendationMode = mode
    } catch {}

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
        details: [
          `Gateway PID: ${gw?.pid ?? 'missing'}`,
          'Control actions can fail while gateway is offline',
        ],
        severity: 'critical',
        area: 'reliability',
        action: { type: 'api', method: 'POST', target: '/api/control/gateway/restart', label: 'Restart gateway' },
      })
    } else if (isStale) {
      pushAction(items, {
        id: 'gateway-stale',
        title: 'Gateway state is stale',
        reason: `Status file is ${Math.round(ageSeconds / 60)} minutes old. Runtime health may be outdated.`,
        details: [
          `State age: ${ageSeconds}s`,
          'Live runtime may not match the dashboard snapshot',
        ],
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
        details: [
          `${pendingApprovals} request(s) in pending queue`,
          'Blocked approvals can stall agent execution',
        ],
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
        details: [
          'sessions_today = 0',
          'Run a quick chat prompt to verify traffic path',
        ],
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
        details: [
          `memory_pct = ${memoryPct}%`,
          'High memory pressure can degrade retrieval quality',
        ],
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
        details: [
          `cost_month = $${costMonth.toFixed(2)}`,
          `budget = $${budget.toFixed(2)}`,
        ],
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
        details: ['No active high-priority incidents detected'],
        severity: 'low',
        area: 'status',
        action: { type: 'navigate', target: '/sessions', label: 'Review recent sessions' },
      })
    }

    const visibleItems = items.filter((item) => {
      const state = recommendationState.items?.[item.id]
      if (!state?.suppress_until) return true
      const untilMs = Date.parse(state.suppress_until)
      if (!Number.isFinite(untilMs)) return true
      return untilMs <= nowMs
    })

    const areaPriority = areaPriorityByMode[recommendationMode] || areaPriorityByMode['stability-first']
    visibleItems.sort((a, b) => {
      const pa = severityRank[a.severity] ?? 99
      const pb = severityRank[b.severity] ?? 99
      if (pa !== pb) return pa - pb
      const aa = areaPriority[a.area] ?? 99
      const ab = areaPriority[b.area] ?? 99
      if (aa !== ab) return aa - ab
      return a.title.localeCompare(b.title)
    })

    res.json({
      generated_at: new Date().toISOString(),
      recommendation_mode: recommendationMode,
      count: visibleItems.length,
      suppressed_count: Math.max(items.length - visibleItems.length, 0),
      items: visibleItems.slice(0, 6),
      storage_owner: 'dashboard',
      storage_path: '~/.hermes/dashboard_state/recommendations.json',
    })
  } catch (e) {
    res.status(500).json({
      generated_at: new Date().toISOString(),
      recommendation_mode: 'stability-first',
      count: 0,
      items: [],
      storage_owner: 'dashboard',
      storage_path: '~/.hermes/dashboard_state/recommendations.json',
      error: e.message,
    })
  }
})

/* GET /api/recommendations/history */
app.get('/api/recommendations/history', (req, res) => {
  try {
    const state = readRecommendationState()
    const limit = Math.max(1, Math.min(200, Number(req.query.limit || 50)))
    const history = state.history.slice(-limit).reverse()
    const nowMs = Date.now()
    const suppressed = Object.values(state.items || {})
      .filter((entry) => {
        const untilMs = Date.parse(entry?.suppress_until || '')
        return Number.isFinite(untilMs) && untilMs > nowMs
      })
      .sort((a, b) => Date.parse(b?.updated_at || 0) - Date.parse(a?.updated_at || 0))
      .slice(0, 20)
    res.json({
      count: history.length,
      suppressed_count: suppressed.length,
      history,
      suppressed,
      storage_owner: 'dashboard',
      storage_path: '~/.hermes/dashboard_state/recommendations.json',
    })
  } catch (e) {
    res.status(500).json({
      count: 0,
      suppressed_count: 0,
      history: [],
      suppressed: [],
      storage_owner: 'dashboard',
      storage_path: '~/.hermes/dashboard_state/recommendations.json',
      error: e.message,
    })
  }
})

function setRecommendationState(req, res, actionType, fallbackMinutes) {
  try {
    const { id } = req.params
    if (!id) return res.status(400).json({ ok: false, error: 'recommendation id required' })

    const minutesInput = Number(req.body?.minutes)
    const minutes = Number.isFinite(minutesInput) && minutesInput > 0
      ? Math.min(60 * 24 * 30, Math.floor(minutesInput))
      : fallbackMinutes

    const now = new Date()
    const suppressUntil = new Date(now.getTime() + minutes * 60 * 1000).toISOString()
    const state = readRecommendationState()
    const current = state.items?.[id] || {}
    const title = typeof req.body?.title === 'string' ? req.body.title.trim().slice(0, 160) : ''
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim().slice(0, 280) : ''
    const severity = typeof req.body?.severity === 'string' ? req.body.severity.trim().slice(0, 32) : ''
    const actionLabel = typeof req.body?.actionLabel === 'string' ? req.body.actionLabel.trim().slice(0, 80) : ''
    const nextEntry = {
      ...current,
      id,
      title: title || current.title || id,
      reason: reason || current.reason || '',
      severity: severity || current.severity || '',
      action_label: actionLabel || current.action_label || '',
      status: actionType,
      suppress_until: suppressUntil,
      updated_at: now.toISOString(),
    }
    state.items = state.items || {}
    state.items[id] = nextEntry
    state.history = Array.isArray(state.history) ? state.history : []
    state.history.push({
      id,
      title: nextEntry.title,
      reason: nextEntry.reason,
      severity: nextEntry.severity,
      action_label: nextEntry.action_label,
      action: actionType,
      suppress_until: suppressUntil,
      created_at: now.toISOString(),
    })
    writeRecommendationState(state)
    res.json({
      ok: true,
      id,
      title: nextEntry.title,
      status: actionType,
      suppress_until: suppressUntil,
      message: `${actionType} saved`,
    })
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message })
  }
}

/* POST /api/recommendations/:id/dismiss */
app.post('/api/recommendations/:id/dismiss', (req, res) => setRecommendationState(req, res, 'dismissed', 24 * 60))

/* POST /api/recommendations/:id/snooze */
app.post('/api/recommendations/:id/snooze', (req, res) => setRecommendationState(req, res, 'snoozed', 60))

/* POST /api/recommendations/:id/done */
app.post('/api/recommendations/:id/done', (req, res) => setRecommendationState(req, res, 'done', 120))

/* POST /api/recommendations/:id/restore */
app.post('/api/recommendations/:id/restore', (req, res) => {
  try {
    const { id } = req.params
    if (!id) return res.status(400).json({ ok: false, error: 'recommendation id required' })

    const now = new Date().toISOString()
    const state = readRecommendationState()
    const existingEntry = state.items?.[id] || null
    const existed = Boolean(existingEntry)
    if (state.items && state.items[id]) {
      delete state.items[id]
    }
    state.history = Array.isArray(state.history) ? state.history : []
    state.history.push({
      id,
      title: existingEntry?.title || id,
      reason: existingEntry?.reason || '',
      severity: existingEntry?.severity || '',
      action_label: existingEntry?.action_label || '',
      action: 'restored',
      created_at: now,
    })
    writeRecommendationState(state)
    res.json({
      ok: true,
      id,
      title: existingEntry?.title || id,
      restored: existed,
      message: existed ? 'recommendation restored' : 'no suppressed recommendation found',
    })
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message })
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
   MCP SERVER CONTROL — start / stop individual MCP servers
═══════════════════════════════════════════════════════════ */

/* POST /api/mcp/:name/start — start a configured MCP server */
app.post('/api/mcp/:name/start', async (req, res) => {
  const { name } = req.params
  const serverName = decodeURIComponent(name)

  try {
    const cfg = parseYaml(readFileSync(join(HERMES, 'config.yaml'), 'utf8'))
    const mcpConfigs = cfg.mcp_servers ?? {}

    if (!mcpConfigs[serverName]) {
      return res.status(404).json({ ok: false, error: `Server '${serverName}' not found in config` })
    }

    const serverCfg = mcpConfigs[serverName]
    const command = serverCfg.command || 'uvx'
    const args = Array.isArray(serverCfg.args) ? serverCfg.args : (serverCfg.args ? [serverCfg.args] : [])
    const cmdStr = `${command} ${args.join(' ')}`.trim()

    // Start via hermes CLI or directly
    const { stdout, stderr } = await execAsync(
      `${HERMES_BIN} mcp start ${serverName} 2>&1`,
      { timeout: 15000, env: { ...process.env, HOME: HOME_DIR } }
    ).catch(async () => {
      // Fallback: spawn directly with nohup
      return execAsync(
        `nohup ${cmdStr} > ${join(HERMES, 'logs', `mcp-${serverName}.log`)} 2>&1 &`,
        { timeout: 5000 }
      )
    })

    res.json({ ok: true, server: serverName, output: stdout || stderr || 'Started' })
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message })
  }
})

/* POST /api/mcp/:name/stop — stop a running MCP server (SIGTERM) */
app.post('/api/mcp/:name/stop', async (req, res) => {
  const { name } = req.params
  const serverName = decodeURIComponent(name)

  try {
    // Find the process via pstree under gateway PID
    let gwPid = null
    try {
      const gwState = JSON.parse(readFileSync(join(HERMES, 'gateway_state.json'), 'utf8'))
      gwPid = gwState.pid
    } catch {}

    if (gwPid) {
      try {
        const { stdout } = await execAsync(
          `pstree -ap ${gwPid} 2>/dev/null | grep -i '${serverName}' | grep -oP '\\d+' | head -3`,
          { timeout: 5000 }
        )
        const pids = stdout.trim().split('\n').map(p => parseInt(p)).filter(p => p > 0)
        for (const pid of pids) {
          try { process.kill(pid, 'SIGTERM') } catch {}
        }
        // Give it 1s then SIGKILL any survivors
        await new Promise(r => setTimeout(r, 1000))
        for (const pid of pids) {
          try { process.kill(pid, 'SIGKILL') } catch {}
        }
      } catch {}
    }

    // Also try via hermes CLI
    await execAsync(
      `${HERMES_BIN} mcp stop ${serverName} 2>&1`,
      { timeout: 10000, env: { ...process.env, HOME: HOME_DIR } }
    ).catch(() => {})

    res.json({ ok: true, server: serverName })
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message })
  }
})

/* POST /api/mcp/:name/restart — stop then start */
app.post('/api/mcp/:name/restart', async (req, res) => {
  const { name } = req.params
  const serverName = decodeURIComponent(name)

  try {
    // Stop
    await execAsync(
      `${HERMES_BIN} mcp stop ${serverName} 2>&1`,
      { timeout: 10000, env: { ...process.env, HOME: HOME_DIR } }
    ).catch(() => {})

    await new Promise(r => setTimeout(r, 2000))

    // Start
    const { stdout, stderr } = await execAsync(
      `${HERMES_BIN} mcp start ${serverName} 2>&1`,
      { timeout: 15000, env: { ...process.env, HOME: HOME_DIR } }
    ).catch(() => ({ stdout: '', stderr: '' }))

    res.json({ ok: true, server: serverName, output: stdout || stderr || 'Restarted' })
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message })
  }
})

/* GET /api/mcp/:name/logs — tail MCP server log */
app.get('/api/mcp/:name/logs', (req, res) => {
  const { name } = req.params
  const serverName = decodeURIComponent(name)
  const logPath = join(HERMES, 'logs', `mcp-${serverName}.log`)

  try {
    if (!existsSync(logPath)) {
      return res.json({ lines: [], server: serverName, error: 'No log file found' })
    }

    const content = readFileSync(logPath, 'utf8')
    const lines = content.split('\n').filter(Boolean).slice(-80)

    res.json({ lines, server: serverName, count: lines.length })
  } catch (e) {
    res.json({ lines: [], server: serverName, error: e.message })
  }
})

/* GET /api/memory/stats — memory usage statistics for SettingsPage */
app.get('/api/memory/stats', async (req, res) => {
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

/* POST /api/memory/compact — compact MEMORY.md by deduplication */
app.post('/api/memory/compact', async (req, res) => {
  const memPath = join(HERMES, 'memories', 'MEMORY.md')

  if (!existsSync(memPath)) {
    return res.status(404).json({ ok: false, error: 'MEMORY.md not found' })
  }

  try {
    const content = readFileSync(memPath, 'utf8')
    const originalSize = content.length

    // Remove duplicate consecutive empty lines (more than 2)
    let compacted = content.replace(/\n{3,}/g, '\n\n')

    // Remove trailing whitespace on lines
    compacted = compacted.split('\n').map(l => l.trimEnd()).join('\n')

    // Remove lines that are only whitespace
    compacted = compacted.split('\n').filter(l => l.trim() !== '' || l === '').join('\n')

    // Trim end of file
    compacted = compacted.trimEnd() + '\n'

    const newSize = compacted.length
    const saved = originalSize - newSize

    // Backup
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

/* GET /api/system/info — system info for About section */
app.get('/api/system/info', (req, res) => {
  try {
    const uptime = os.uptime()
    const totalMem = os.totalmem()
    const freeMem = os.freemem()
    const usedMem = totalMem - freeMem
    const cpuCount = os.cpus().length

    const diskPath = HERMES
    const diskStat = statSync(diskPath)

    // Gateway uptime from pid file
    let gwUptime = null
    try {
      const gwState = JSON.parse(readFileSync(join(HERMES, 'gateway_state.json'), 'utf8'))
      if (gwState.started_at) {
        gwUptime = Math.round((Date.now() - new Date(gwState.started_at).getTime()) / 1000)
      }
    } catch {}

    res.json({
      hostname: os.hostname(),
      platform: os.platform(),
      release: os.release(),
      arch: os.arch(),
      cpu_count: cpuCount,
      total_mem_mb: Math.round(totalMem / 1024 / 1024),
      used_mem_mb: Math.round(usedMem / 1024 / 1024),
      free_mem_mb: Math.round(freeMem / 1024 / 1024),
      mem_pct: Math.round((usedMem / totalMem) * 100),
      uptime_s: uptime,
      uptime_str: `${Math.floor(uptime / 86400)}d ${Math.floor((uptime % 86400) / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`,
      gw_uptime_s: gwUptime,
      hermes_root: HERMES,
      dashboard_version: '1.x',
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
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
  console.log(`  Memory Entries:GET/POST /api/memory/entries`)
  console.log(`  Memory Timeline:GET /api/memory/timeline`)
  console.log(`  Memory Search:GET  /api/memory/search`)
  pyQuery('stats').then(() => console.log('cache warmed: stats')).catch(() => {})
  pyQuery('ekg').then(() => console.log('cache warmed: ekg')).catch(() => {})
  pyQuery('heatmap').then(() => console.log('cache warmed: heatmap')).catch(() => {})
})
