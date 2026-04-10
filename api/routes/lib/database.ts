// api/routes/lib/database.ts — database and query utilities
import Database from 'better-sqlite3'
import { exec, execSync } from 'child_process'
import { promisify } from 'util'
import { join } from 'path'
import os from 'os'

const HOME_DIR = os.homedir()
const HERMES = join(HOME_DIR, '.hermes')
const PYTHON = '/usr/bin/python3'

const execAsync = promisify(exec)

interface Session {
  id: string
  session_id: string
  source: string
  platform: string
  title: string
  model: string
  started_at: string
  ended_at: string | null
  end_reason: string | null
  created_at: string
  updated_at: string | null
  message_count: number
  tool_call_count: number
  input_tokens: number
  output_tokens: number
  cache_read_tokens: number
  cache_write_tokens: number
  reasoning_tokens: number
  token_usage: {
    input: number
    output: number
    cache_read: number
    cache_write: number
    reasoning: number
  }
  cost: number
  estimated_cost_usd: number
  actual_cost_usd: number
  cost_status: string | null
  cost_source: string | null
  billing_provider: string | null
  billing_mode: string | null
}

interface CacheEntry {
  data: unknown
  ts: number
}

// ── Database setup ───────────────────────────────────────────────────────────
const HERMES_DB = new Database(join(os.homedir(), '.hermes/state.db'), { readonly: true })

async function getSessions(): Promise<Session[]> {
  const sessions = HERMES_DB.prepare('SELECT * FROM sessions ORDER BY started_at DESC').all() as any[]
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
  }))
}

// ── pyQuery cache ──────────────────────────────────────────────────────────────
const QUERY_SCRIPT = join(new URL('.', import.meta.url).pathname, '../../query.py')

// Whitelist of allowed query commands for security
const ALLOWED_QUERY_COMMANDS = [
  'sessions',
  'memory',
  'stats',
  'cost',
  'activity',
]

function isValidQueryCommand(cmd: string): boolean {
  return ALLOWED_QUERY_COMMANDS.includes(cmd)
}

function sanitizeQueryArgs(args: unknown[]): string[] {
  // Ensure all args are strings and don't contain dangerous patterns
  return args.map(arg => {
    let strArg: string
    if (typeof arg !== 'string') {
      strArg = String(arg)
    } else {
      strArg = arg
    }
    // Reject args that might contain command injection patterns
    if (/[;&|`$()]/.test(strArg)) {
      throw new Error('Invalid query argument format')
    }
    return strArg
  })
}

const cache = new Map<string, CacheEntry>()
const pending = new Map<string, Promise<unknown>>()
const MAX_CACHE_SIZE = 100

setInterval(() => {
  const now = Date.now()
  const CACHE_TTL = 30000
  for (const [key, entry] of cache.entries()) {
    if (now - entry.ts > CACHE_TTL) cache.delete(key)
  }
}, 300000)

async function pyQuery(cmd: string, ...args: unknown[]): Promise<unknown> {
  // Validate and sanitize inputs
  if (!isValidQueryCommand(cmd)) {
    throw new Error(`Query command not allowed: ${cmd}`)
  }
  const sanitizedArgs = sanitizeQueryArgs(args)

  const key = [cmd, ...sanitizedArgs].join(':')
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

  console.log(`[pyQuery] Executing: ${cmd} ${sanitizedArgs.join(' ')}`)

  const promise = execAsync(
    [PYTHON, QUERY_SCRIPT, cmd, ...sanitizedArgs].join(' '),
    { env: { ...process.env, HOME: HOME_DIR, PATH: '/usr/bin:/bin' }, timeout: 30000 }
  ).then(({ stdout }) => {
    const data = JSON.parse(stdout.trim())
    if (!data.error) cache.set(key, { data, ts: Date.now() })
    pending.delete(key)
    console.log(`[pyQuery] Success: ${cmd}`)
    return data
  }).catch(e => {
    console.error(`[pyQuery Error: ${cmd}]`, e.message)
    pending.delete(key)
    throw e
  })

  pending.set(key, promise)
  return promise
}

export {
  HERMES_DB,
  getSessions,
  pyQuery,
  QUERY_SCRIPT,
  execAsync,
  execSync,
}
