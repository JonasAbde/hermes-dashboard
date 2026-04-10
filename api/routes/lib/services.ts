// api/routes/lib/services.ts — service discovery and control utilities
import { readFileSync } from 'fs'
import { join } from 'path'
import { exec, execSync } from 'child_process'
import { promisify } from 'util'
import os from 'os'

const HOME_DIR = os.homedir()
const HERMES = join(HOME_DIR, '.hermes')
const HERMES_ROOT = HERMES
const HERMES_BIN = join(HOME_DIR, '.local/bin/hermes')

const execAsync = promisify(exec)

interface PidData {
  pid: number
  start_time?: number
  argv?: string[]
}

interface ProcessInfo {
  pid: number
  name: string
  state: string
  alive: boolean
}

interface ServiceStatus {
  key: string
  label: string
  unit: string
  active: boolean
  state: string
  substate: string
  pid: number | null
  uptime_s: number | null
  cmdline: string | null
}

// ── Hermes command wrapper ─────────────────────────────────────────────────────
async function hermesCmd(args: string): Promise<{ stdout: string; stderr: string }> {
  const { stdout, stderr } = await execAsync(`${HERMES_BIN} ${args}`, {
    env: { ...process.env, HOME: HOME_DIR, PATH: `${join(HOME_DIR, '.local/bin')}:/usr/bin:/bin` },
    timeout: 30000,
  })
  return { stdout: stdout.trim(), stderr: stderr.trim() }
}

// ── Service discovery helpers ──────────────────────────────────────────────────
function readPidFile(path: string): PidData | null {
  try {
    const raw = readFileSync(path, 'utf8').trim()
    return JSON.parse(raw) as PidData
  } catch { return null }
}

function kill0(pid: number): boolean {
  try { process.kill(pid, 0); return true } catch { return false }
}

function getProcessInfo(pid: number): ProcessInfo | null {
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

function getServiceStatus(name: string): ServiceStatus {
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

// Shared gateway service control — used by both gateway.js and control.js
async function controlGatewayService(action: 'start' | 'stop' | 'restart'): Promise<string> {
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

// ── MCP helpers ────────────────────────────────────────────────────────────────
function getMcpConfigEntries(cfg: Record<string, unknown> = {}): [string, unknown][] {
  const raw = cfg.mcp_servers ?? cfg.mcpServers ?? (cfg.mcp as Record<string, unknown>)?.servers ?? cfg.mcp ?? {}
  if (Array.isArray(raw)) {
    return raw.map((server, index) => [String((server as Record<string, unknown>)?.name ?? (server as Record<string, unknown>)?.id ?? `server-${index + 1}`), server])
  }
  if (raw && typeof raw === 'object') {
    return Object.entries(raw as Record<string, unknown>)
  }
  return []
}

export {
  HERMES,
  HERMES_ROOT,
  HERMES_BIN,
  HOME_DIR,
  hermesCmd,
  readPidFile,
  kill0,
  getProcessInfo,
  getServiceStatus,
  controlGatewayService,
  getMcpConfigEntries,
  execAsync,
  execSync,
}
