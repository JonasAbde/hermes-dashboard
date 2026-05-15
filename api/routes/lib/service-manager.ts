// api/routes/lib/service-manager.ts — Unified service management
// Shared between CLI and API
import { readFileSync, writeFileSync, readFileSync as readFile, existsSync } from 'fs'
import { join } from 'path'
import { exec, execSync } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

const HOME_DIR = process.env.HOME || require('os').homedir()
const HERMES = join(HOME_DIR, '.hermes')
const HERMES_ROOT = HERMES
const HERMES_BIN = join(HOME_DIR, '.local/bin/hermes')

const PID_DIR = join(HERMES, '.pids')

// Service names matching systemd units
const SERVICE_NAMES = {
  api: 'hermes-dashboard-api.service',
  web: 'hermes-dashboard-web.service',
  proxy: 'hermes-dashboard-proxy.service',
  tunnel: 'hermes-dashboard-tunnel.service',
  gateway: 'hermes-gateway.service',
} as const

// API ports for web scraping
const SERVICE_PORTS = {
  api: 5174,
  web: 5175,
  proxy: 5176,
  gateway: 8642,
} as const

// Service state tracking
interface ServiceState {
  running: boolean
  pid: number | null
  portOpen: boolean
  unhealthy: boolean
}

interface ServiceStatus {
  key: string
  label: string
  unit: string
  port: number
  active: boolean
  state: string
  substate: string
  pid: number | null
  uptime_s: number | null
  cmdline: string | null
  health?: {
    ok: boolean
    data?: any
    error?: string
  }
}

export interface ServiceControlResult {
  success: boolean
  applied: boolean
  service: string
  status: 'ok' | 'error' | 'not_supported'
  source: 'systemctl' | 'runtime'
  updated_at: string
  service_status?: ServiceStatus
  error?: string
}

// ── PID file management ─────────────────────────────────────────────────────
export function getPidDir(): string {
  if (!existsSync(PID_DIR)) {
    try {
      writeFileSync(PID_DIR, '')
    } catch {}
  }
  return PID_DIR
}

export function readPidFile(service: string): number | null {
  try {
    const file = join(getPidDir(), `${service}.pid`)
    const raw = readFile(file, 'utf8').trim()
    return parseInt(raw, 10)
  } catch {
    return null
  }
}

export function writePidFile(service: string, pid: number): void {
  const pidDir = getPidDir()
  writeFileSync(join(pidDir, `${service}.pid`), String(pid))
}

export function cleanPidFile(service: string): void {
  try {
    const file = join(getPidDir(), `${service}.pid`)
    if (existsSync(file)) {
      writeFileSync(file, '')
    }
  } catch {}
}

// ── Process detection ───────────────────────────────────────────────────────
export function isPidAlive(pid: number): boolean {
  try {
    // kill 0 checks if process exists without killing
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

export function getProcessCmdline(pid: number): string | null {
  try {
    const stat = readFile(`/proc/${pid}/stat`, 'utf8')
    const match = stat.match(/^\d+\s+\(([^)]+)\)\s+\w+/)
    return match ? match[1] : null
  } catch {
    return null
  }
}

// ── Systemctl wrapper ──────────────────────────────────────────────────────
export async function systemctl(action: 'start' | 'stop' | 'restart', unit: string): Promise<ServiceControlResult> {
  const startTime = Date.now()
  const envName = process.env.HERMES_ENV || 'development'

  try {
    const { stdout, stderr } = await execAsync(
      `systemctl --user --no-pager ${action} ${unit} 2>&1`,
      { timeout: 30000 }
    )

    const status = await systemctlIsAlive(unit)
    const uptime = await systemctlGetUptime(unit)

    console.log(`[service-manager] systemctl ${action} ${unit} [${envName}]: success (${Date.now() - startTime}ms)`)

    return {
      success: true,
      applied: true,
      service: unit,
      status: 'ok',
      source: 'systemctl',
      updated_at: new Date().toISOString(),
      service_status: {
        key: unit,
        label: unit,
        unit,
        port: 0,
        active: status,
        state: status ? 'active' : 'inactive',
        substate: 'running',
        pid: null,
        uptime_s: uptime,
        cmdline: null,
      },
    }
  } catch (error: any) {
    console.error(`[service-manager] systemctl ${action} ${unit} failed: ${error.message}`)

    return {
      success: false,
      applied: false,
      service: unit,
      status: 'error',
      source: 'systemctl',
      updated_at: new Date().toISOString(),
      error: error.message,
    }
  }
}

export async function systemctlIsAlive(unit: string): Promise<boolean> {
  try {
    const { stdout } = await execAsync(`systemctl --user is-active --quiet ${unit}`, { timeout: 5000 })
    return stdout.trim() === 'active'
  } catch {
    return false
  }
}

export async function systemctlGetUptime(unit: string): Promise<number | null> {
  try {
    const { stdout } = await execAsync(
      `systemctl --user show ${unit} -p ActiveEnterTimestamp --value`,
      { timeout: 5000 }
    )
    return stdout.trim() || null
  } catch {
    return null
  }
}

// ── Service status (unified) ─────────────────────────────────────────────────
export async function getServiceStatus(key: string): Promise<ServiceStatus> {
  const unit = SERVICE_NAMES[key as keyof typeof SERVICE_NAMES] || key

  try {
    if (key === 'gateway') {
      // Gateway has special handling with PID file
      const pidData = readPidFile('gateway')
      if (pidData && isPidAlive(pidData)) {
        const cmdline = getProcessCmdline(pidData)
        return {
          key,
          label: 'Hermes Gateway',
          unit,
          port: SERVICE_PORTS.gateway,
          active: true,
          state: 'active',
          substate: 'running',
          pid: pidData,
          uptime_s: null,
          cmdline,
        }
      }
    }

    const [activeState, subState] = await Promise.all([
      systemctlIsAlive(unit),
      execAsync(`systemctl --user show ${unit} -p SubState --value`, { timeout: 5000 })
        .then(r => r.stdout.trim())
        .catch(() => 'unknown')
    ])

    const pid = await systemctlGetPid(unit)

    return {
      key,
      label: key,
      unit,
      port: SERVICE_PORTS[key as keyof typeof SERVICE_PORTS] || 0,
      active: activeState,
      state: activeState ? 'active' : 'inactive',
      substate: subState,
      pid,
      uptime_s: null,
      cmdline: null,
    }
  } catch (error: any) {
    return {
      key,
      label: key,
      unit,
      port: SERVICE_PORTS[key as keyof typeof SERVICE_PORTS] || 0,
      active: false,
      state: 'unknown',
      substate: 'unknown',
      pid: null,
      uptime_s: null,
      cmdline: null,
    }
  }
}

export async function getAllServicesStatus(): Promise<Record<string, ServiceStatus>> {
  const services: Record<string, ServiceStatus> = {}

  for (const key of Object.keys(SERVICE_NAMES)) {
    const status = await getServiceStatus(key)
    services[key] = status
  }

  return services
}

// ── Service control (unified) ───────────────────────────────────────────────
export async function controlService(
  key: string,
  action: 'start' | 'stop' | 'restart'
): Promise<ServiceControlResult> {
  const unit = SERVICE_NAMES[key as keyof typeof SERVICE_NAMES]

  if (!unit) {
    return {
      success: false,
      applied: false,
      service: key,
      status: 'error',
      source: 'runtime',
      updated_at: new Date().toISOString(),
      error: `Unknown service: ${key}`,
    }
  }

  if (key === 'gateway') {
    // Gateway uses custom control logic
    return controlGatewayService(action)
  }

  // Stop gateway separately (when stopping all)
  if (action === 'stop' && key === 'gateway') {
    // Don't stop gateway when stopping dashboard services
    return {
      success: true,
      applied: false,
      service: key,
      status: 'not_supported',
      source: 'runtime',
      updated_at: new Date().toISOString(),
      error: 'Gateway should be controlled separately',
    }
  }

  return systemctl(action, unit)
}

export async function startServices(keys: string[]): Promise<string[]> {
  const started: string[] = []

  for (const key of keys) {
    const result = await controlService(key, 'start')
    if (result.success) {
      started.push(key)
    }
  }

  return started
}

export async function stopServices(keys: string[]): Promise<string[]> {
  const stopped: string[] = []

  for (const key of keys) {
    const result = await controlService(key, 'stop')
    if (result.success) {
      stopped.push(key)
    }
  }

  return stopped
}

export async function restartServices(keys: string[]): Promise<string[]> {
  const restarted: string[] = []

  for (const key of keys) {
    const result = await controlService(key, 'restart')
    if (result.success) {
      restarted.push(key)
    }
  }

  return restarted
}

// ── Gateway special handling ─────────────────────────────────────────────────
export async function controlGatewayService(action: 'start' | 'stop' | 'restart'): Promise<ServiceControlResult> {
  const startTime = Date.now()

  try {
    if (action === 'stop') {
      await execAsync(`systemctl --user stop hermes-gateway.service 2>&1`, { timeout: 30000 })
      cleanPidFile('gateway')
      console.log(`[service-manager] gateway ${action} [${process.env.HERMES_ENV || 'development'}]: success`)

      const status = await systemctlIsAlive('hermes-gateway.service')
      return {
        success: true,
        applied: true,
        service: 'hermes-gateway.service',
        status: 'ok',
        source: 'systemctl',
        updated_at: new Date().toISOString(),
        service_status: {
          key: 'gateway',
          label: 'Hermes Gateway',
          unit: 'hermes-gateway.service',
          port: SERVICE_PORTS.gateway,
          active: !status,
          state: 'inactive',
          substate: 'dead',
          pid: null,
          uptime_s: null,
          cmdline: null,
        },
      }
    }

    // Start and restart for gateway
    await execAsync(`systemctl --user reset-failed hermes-gateway.service >/dev/null 2>&1 || true`, { timeout: 5000 })
    await execAsync(`systemctl --user ${action} hermes-gateway.service 2>&1`, { timeout: 30000 })

    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

    // Wait for service to be active
    if (action === 'start') {
      await sleep(2500)
    } else {
      await sleep(1200)
    }

    const status = await systemctlIsAlive('hermes-gateway.service')

    if ((action === 'stop' && status) || (action !== 'stop' && !status)) {
      throw new Error(`Gateway state mismatch: expected ${action === 'stop' ? 'inactive' : 'active'}, got ${status}`)
    }

    // Update PID file
    const pid = await systemctlGetPid('hermes-gateway.service')
    if (pid) {
      writePidFile('gateway', pid)
    }

    const uptime = await systemctlGetUptime('hermes-gateway.service')

    console.log(`[service-manager] gateway ${action} [${process.env.HERMES_ENV || 'development'}]: success`)

    return {
      success: true,
      applied: true,
      service: 'hermes-gateway.service',
      status: 'ok',
      source: 'systemctl',
      updated_at: new Date().toISOString(),
      service_status: {
        key: 'gateway',
        label: 'Hermes Gateway',
        unit: 'hermes-gateway.service',
        port: SERVICE_PORTS.gateway,
        active: status,
        state: status ? 'active' : 'inactive',
        substate: 'running',
        pid,
        uptime_s: uptime,
        cmdline: getProcessCmdline(pid),
      },
    }
  } catch (error: any) {
    console.error(`[service-manager] gateway ${action} failed: ${error.message}`)

    return {
      success: false,
      applied: false,
      service: 'hermes-gateway.service',
      status: 'error',
      source: 'systemctl',
      updated_at: new Date().toISOString(),
      error: error.message,
    }
  }
}

// ── Legacy helpers for backward compatibility ───────────────────────────────
export function systemctlLegacy(action: string, service: string) {
  try {
    execSync(`systemctl --user ${action} ${service}`, { stdio: 'pipe' })
    return { success: true, error: null }
  } catch (e: any) {
    const error = e.stderr?.toString().trim() || e.stdout?.toString().trim() || e.message
    console.error(`[service-manager] systemctl ${action} ${service} failed: ${error}`)
    return { success: false, error }
  }
}

export function startService(service: string) {
  return systemctlLegacy('start', SERVICE_NAMES[service as keyof typeof SERVICE_NAMES] || service)
}

export function stopService(service: string) {
  return systemctlLegacy('stop', SERVICE_NAMES[service as keyof typeof SERVICE_NAMES] || service)
}

export function restartService(service: string) {
  return systemctlLegacy('restart', SERVICE_NAMES[service as keyof typeof SERVICE_NAMES] || service)
}

export function isActive(service: string): boolean {
  try {
    execSync(`systemctl --user is-active --quiet ${SERVICE_NAMES[service as keyof typeof SERVICE_NAMES] || service}`, { stdio: 'pipe' })
    return true
  } catch {
    return false
  }
}

export function getPid(service: string): number | null {
  try {
    const out = execSync(`systemctl --user show -p MainPID --value ${SERVICE_NAMES[service as keyof typeof SERVICE_NAMES] || service}`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim()
    return out && out !== '0' ? parseInt(out, 10) : null
  } catch {
    return null
  }
}

// ── Exports ────────────────────────────────────────────────────────────────
export {
  HOME_DIR,
  HERMES,
  HERMES_ROOT,
  HERMES_BIN,
  SERVICE_NAMES,
  SERVICE_PORTS,
  PID_DIR,
}
