// api/routes/_lib.js — shared dependencies for all route modules
import express from 'express'
import Database from 'better-sqlite3'
import { randomBytes } from 'crypto'
import { readFileSync, readdirSync, statSync, existsSync, openSync, readSync, closeSync, watchFile, unwatchFile, writeFileSync, unlinkSync, mkdirSync } from 'fs'
import { join, resolve } from 'path'
import { parse as parseYaml, parseDocument } from 'yaml'
import cors from 'cors'
import { exec, execSync, spawn } from 'child_process'
import { promisify } from 'util'
import { Readable } from 'stream'
import os from 'os'

// ── CORS config ────────────────────────────────────────────────────────────
const CORS_ORIGINS = (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:5175,http://127.0.0.1:5173').split(',').map(s => s.trim())
const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true)
    const TUNNEL_PATTERNS = [
      /\.trycloudflare\.com$/,
      /\.lhr\.life$/,
      /\.serveo\.net$/,
    ]
    if (TUNNEL_PATTERNS.some(p => p.test(origin))) {
      return callback(null, origin)
    }
    if (CORS_ORIGINS.includes(origin)) {
      callback(null, origin)
    } else {
      callback(new Error(`Origin ${origin} not allowed by CORS policy`))
    }
  },
  credentials: true,
}

const execAsync = promisify(exec)

const HOME_DIR = os.homedir()
const HERMES_ROOT = join(HOME_DIR, '.hermes')
const HERMES_BIN = join(HOME_DIR, '.local/bin/hermes')
const HERMES = HERMES_ROOT
const DB_PATH = join(HERMES, 'state.db')
const PYTHON = '/usr/bin/python3'

async function hermesCmd(args) {
  const { stdout, stderr } = await execAsync(`${HERMES_BIN} ${args}`, {
    env: { ...process.env, HOME: HOME_DIR, PATH: `${join(HOME_DIR, '.local/bin')}:/usr/bin:/bin` },
    timeout: 30000,
  })
  return { stdout: stdout.trim(), stderr: stderr.trim() }
}

// ── Auth setup (moved to end of file with full-path AUTH_SKIP) ──

// ── Config writer helpers ───────────────────────────────────────────────────────
function setEnvVar(key, value) {
  const envPath = join(HERMES, '.env')
  let content = ''
  try { content = readFileSync(envPath, 'utf8') } catch {}
  const lines = content.split('\n').filter(l => !l.startsWith(key + '='))
  lines.push(`${key}=${value}`)
  writeFileSync(envPath, lines.join('\n') + '\n')
}

function setYamlKey(key, value) {
  const configPath = join(HERMES, 'config.yaml')
  const raw = readFileSync(configPath, 'utf8')
  const escapedKey = key.replace(/'/g, "'\"'\"'")
  const escapedVal = JSON.stringify(value)
  try {
    execSync(
      `${PYTHON} -c "import yaml,json,sys; cfg=yaml.safe_load(open('${configPath}')); cfg['${escapedKey}']=json.loads('${escapedVal}'); yaml.dump(cfg,open('${configPath}','w'),default_flow_style=False,allow_unicode=True,sort_keys=False)"`,
      { cwd: HERMES, timeout: 5000 }
    )
  } catch(e) {
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

// ── pyQuery cache ──────────────────────────────────────────────────────────────
const QUERY_SCRIPT = join(new URL('.', import.meta.url).pathname, '../query.py')

const cache = new Map()
const pending = new Map()
const MAX_CACHE_SIZE = 100

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

// ── Dashboard state helpers ─────────────────────────────────────────────────────
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
  try { mkdirSync(DASHBOARD_STATE_DIR, { recursive: true }) } catch {}
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

// ── Service discovery helpers ──────────────────────────────────────────────────
function readPidFile(path) {
  try {
    const raw = readFileSync(path, 'utf8').trim()
    return JSON.parse(raw)
  } catch { return null }
}

function kill0(pid) {
  try { process.kill(pid, 0); return true } catch { return false }
}

function getProcessInfo(pid) {
  if (!pid) return null
  try {
    const stat = readFileSync(`/proc/${pid}/stat`, 'utf8')
    const match = stat.match(/^\d+\s+\(([^)]+)\)\s+(\w)/)
    return {
      pid,
      name: match ? match[1] : 'unknown',
      state: match ? match[2] : '?',
      alive: kill0(pid),
    }
  } catch { return null }
}

function getServiceStatus(name) {
  if (name === 'hermes-gateway') {
    const pidData = readPidFile(join(HERMES, 'gateway.pid'))
    if (pidData?.pid) {
      const info = getProcessInfo(pidData.pid)
      const uptime_s = pidData.start_time
        ? (os.uptime() > pidData.start_time
            ? Math.round(os.uptime() - pidData.start_time)
            : pidData.start_time)
        : null
      return {
        key: name,
        label: 'Hermes Gateway',
        unit: name,
        active: info?.alive ?? false,
        state: info?.alive ? 'active' : 'inactive',
        substate: info?.alive ? 'running' : 'dead',
        pid: pidData.pid,
        uptime_s,
        cmdline: pidData.argv?.[0] ?? 'unknown',
      }
    }
    try {
      const r = execSync(`systemctl --user show ${name} --property=ActiveState,SubState --value`, { timeout: 3000 })
      const [activeState, subState] = r.toString().trim().split('\n')
      return { key: name, label: 'Hermes Gateway', unit: name, active: activeState === 'active', state: activeState, substate: subState, pid: null, uptime_s: null, cmdline: null }
    } catch { return { key: name, label: 'Hermes Gateway', unit: name, active: false, state: 'unknown', substate: 'unknown', pid: null, uptime_s: null, cmdline: null } }
  }

  if (name === 'hermes-dashboard-api') {
    const pid = process.pid
    const alive = kill0(pid)
    return {
      key: name,
      label: 'Dashboard API',
      unit: name,
      active: alive,
      state: alive ? 'active' : 'inactive',
      substate: alive ? 'running' : 'dead',
      pid,
      uptime_s: Math.round(process.uptime()),
      cmdline: 'node api/server.js',
    }
  }

  return { key: name, label: name, unit: name, active: false, state: 'unknown', substate: 'unknown', pid: null, uptime_s: null, cmdline: null }
}

// ── Neural rhythm configs ──────────────────────────────────────────────────────
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

// ── CSRF protection ────────────────────────────────────────────────────────
// In-memory store: session key (cookie value or auth token) → CSRF token (32-byte hex)
const csrfTokens = new Map()

function generateCsrfToken(sessionKey) {
  const token = randomBytes(32).toString('hex')
  csrfTokens.set(sessionKey, token)
  return token
}

function getCsrfToken(sessionKey) {
  return csrfTokens.get(sessionKey) || null
}

function removeCsrfToken(sessionKey) {
  csrfTokens.delete(sessionKey)
}

// Middleware: require CSRF token on state-changing requests
function csrfMiddleware(req, res, next) {
  // Dev mode (no dashboard auth token): skip CSRF enforcement to keep local
  // dashboard controls functional without a session token/cookie.
  if (!AUTH_SECRET) return next()

  // Only check POST/PUT/PATCH
  if (!['POST', 'PUT', 'PATCH'].includes(req.method)) return next()
  // Skip auth endpoints and other safe routes
  const safePaths = new Set([
    '/api/auth/verify',
    '/api/auth/refresh',
    '/api/chat',
  ])
  const fullPath = req.baseUrl + req.path
  if (safePaths.has(fullPath)) return next()

  const token = req.headers['x-csrf-token']
  if (!token) {
    return res.status(403).json({ error: 'CSRF token required', code: 'csrf_missing' })
  }

  // Resolve session key from cookie or Authorization header
  let sessionKey = null
  if (req.headers.cookie) {
    const match = req.headers.cookie.match(/(?:^|;\s*)hermes_dashboard_token=([^;]+)/)
    if (match) sessionKey = match[1]
  }
  // Fallback: use Authorization header value as session key
  if (!sessionKey) {
    const authHeader = req.headers.authorization?.replace('Bearer ', '')
    if (authHeader) sessionKey = authHeader
  }

  if (!sessionKey) {
    return res.status(401).json({ error: 'Unauthorized', code: 'invalid_token' })
  }

  const validToken = getCsrfToken(sessionKey)
  if (!validToken || token !== validToken) {
    return res.status(403).json({ error: 'CSRF token invalid', code: 'csrf_invalid' })
  }

  next()
}

// Keys that should NEVER be returned in plaintext
const SENSITIVE_KEYS = /^ANTHROPIC_API_KEY$|^OPENAI_API_KEY$|^GOOGLE_API_KEY$|^TOGETHER_API_KEY$|^GROQ_API_KEY$|^OPENROUTER_API_KEY$|^TELEGRAM_BOT_TOKEN$|^DASHBOARD_TOKEN$|^AUTH_SECRET$|^SECRET/i

// ── Auth setup ──────────────────────────────────────────────────────────────
let AUTH_SECRET=''
try {
  const envContent = readFileSync(join(HERMES, '.env'), 'utf8')
  const match = envContent.match(/^DASHBOARD_TOKEN=(.*)$/m)
  if (match) AUTH_SECRET=match[1]
} catch {}

// Auth skip paths — must use full API paths for req.baseUrl + req.path matching
const AUTH_SKIP = new Set([
  '/api/auth/verify',
  '/api/auth/refresh',
  '/api/stats',
  '/api/gateway',
  '/api/health',
  '/api/ready',
  '/api/chat',
  '/api/onboarding/status',
  '/api/settings',
  '/api/logs/files',
  '/api/system/info',
])

// Auth middleware — checks full URL path (baseUrl + path)
function authMiddleware(req, res, next) {
  if (!AUTH_SECRET) return next()
  const fullPath = req.baseUrl + req.path
  if (AUTH_SKIP.has(fullPath)) return next()

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

// ── MCP helpers ────────────────────────────────────────────────────────────────
function getMcpConfigEntries(cfg = {}) {
  const raw = cfg.mcp_servers ?? cfg.mcpServers ?? cfg.mcp?.servers ?? cfg.mcp ?? {}
  if (Array.isArray(raw)) {
    return raw.map((server, index) => [server?.name ?? server?.id ?? `server-${index + 1}`, server])
  }
  if (raw && typeof raw === 'object') {
    return Object.entries(raw)
  }
  return []
}

// ── Export all shared code ───────────────────────────────────────────────────────
const HERMES_DB = new Database(join(os.homedir(), '.hermes/state.db'), { readonly: true }); 

 async function getSessions() { 
   const sessions = HERMES_DB.prepare('SELECT * FROM sessions ORDER BY started_at DESC').all(); 
   return sessions.map(s => ({ 
     id: s.id, session_id: s.id, source: s.source, platform: s.source, title: s.title, 
     model: s.model,
     started_at: s.started_at, ended_at: s.ended_at, end_reason: s.end_reason,
     created_at: s.started_at, updated_at: s.ended_at,
     message_count: s.message_count, tool_call_count: s.tool_call_count,
     input_tokens: s.input_tokens, output_tokens: s.output_tokens,
     cache_read_tokens: s.cache_read_tokens, cache_write_tokens: s.cache_write_tokens,
     reasoning_tokens: s.reasoning_tokens,
     token_usage: { input: s.input_tokens, output: s.output_tokens, cache_read: s.cache_read_tokens, cache_write: s.cache_write_tokens, reasoning: s.reasoning_tokens },
     cost: s.estimated_cost_usd, estimated_cost_usd: s.estimated_cost_usd, actual_cost_usd: s.actual_cost_usd,
     cost_status: s.cost_status, cost_source: s.cost_source,
     billing_provider: s.billing_provider, billing_mode: s.billing_mode
   })); 
 } 

// Shared gateway service control — used by both gateway.js and control.js
async function controlGatewayService(action) {
  const unit = 'hermes-gateway.service'
  await execAsync(`systemctl --user reset-failed ${unit} >/dev/null 2>&1 || true`, { timeout: 5000 })
  await execAsync(`systemctl --user ${action} ${unit} 2>&1`, { timeout: 30000 })
  await new Promise((resolve) => setTimeout(resolve, action === 'stop' ? 1200 : 2500))
  const { stdout } = await execAsync(`systemctl --user is-active ${unit} 2>/dev/null || true`, { timeout: 5000 })
  const status = stdout.trim() || 'unknown'
  const expected = action === 'stop' ? status !== 'active' : status === 'active'
  if (!expected) {
    throw new Error(`Gateway state after ${action} is '${status}' (expected ${action === 'stop' ? 'inactive' : 'active'})`)
  }
  return status
}

export { HERMES_DB, getSessions,
  execAsync,
  execSync,
  spawn,
  Readable,
  readFileSync,
  readdirSync,
  statSync,
  existsSync,
  openSync,
  readSync,
  closeSync,
  watchFile,
  unwatchFile,
  writeFileSync,
  unlinkSync,
  mkdirSync,
  join,
  resolve,
  parseYaml,
  parseDocument,
  Database,
  os,
  promisify,
  cors,
  corsOptions,
  HERMES,
  HERMES_ROOT,
  HERMES_BIN,
  HOME_DIR,
  DB_PATH,
  PYTHON,
  QUERY_SCRIPT,
  AUTH_SECRET,
  AUTH_SKIP,
  SENSITIVE_KEYS,
  hermesCmd,
  pyQuery,
  authMiddleware,
  setEnvVar,
  setYamlKey,
  readDashboardOwnedJson,
  writeDashboardOwnedJson,
  ensureDashboardStateDir,
  migrateLegacyDashboardState,
  DASHBOARD_STATE_DIR,
  DASHBOARD_PROFILE_PATH,
  DASHBOARD_RECOMMENDATION_STATE_PATH,
  DASHBOARD_AGENT_STATUS_PATH,
  DASHBOARD_WEBHOOK_CONFIG_PATH,
  readDashboardProfile,
  writeDashboardProfile,
  readRecommendationState,
  writeRecommendationState,
  defaultAgentStatus,
  readDashboardAgentStatus,
  writeDashboardAgentStatus,
  defaultWebhookConfig,
  readDashboardWebhookConfig,
  writeDashboardWebhookConfig,
  getMcpConfigEntries,
  readPidFile,
  kill0,
  getProcessInfo,
  getServiceStatus,
  RHYTHM_CONFIGS,
  generateCsrfToken,
  getCsrfToken,
  removeCsrfToken,
  csrfMiddleware,
  controlGatewayService,
}
