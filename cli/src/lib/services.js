import { execSync } from 'child_process'
import { writeFileSync, readFileSync, unlinkSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'

// Import shared service manager (must be compiled)
let serviceManager = null
async function getServiceManager() {
  if (!serviceManager) {
    serviceManager = await import('../../../api/routes/lib/service-manager.js')
  }
  return serviceManager
}

const SERVICES = {
  api: 'hermes-dashboard-api.service',
  web: 'hermes-dashboard-web.service',
  proxy: 'hermes-dashboard-proxy.service',
  tunnel: 'hermes-dashboard-tunnel.service',
  gateway: 'hermes-gateway.service',
  apiWatch: 'hermes-dashboard-api-watch.service',
  webWatch: 'hermes-dashboard-web-watch.service',
  // Add API and web as aliases for watchers
  apiWatchProxy: 'hermes-dashboard-api.service',
  webWatchProxy: 'hermes-dashboard-web.service',
}

const PID_SERVICES = ['api', 'web', 'proxy', 'gateway']

// Export wrapper to maintain backward compatibility
export async function startService(service) {
  const sm = await getServiceManager()
  const result = sm.startService(service)
  return result.success
}

export async function stopService(service) {
  const sm = await getServiceManager()
  const result = sm.stopService(service)
  if (result.success && PID_SERVICES.includes(service)) {
    const pid = sm.getPid(service)
    if (pid) sm.writePid(service, pid)
    else sm.cleanPid(service)
  }
  return result.success
}

export async function restartService(service) {
  const sm = await getServiceManager()
  const result = sm.restartService(service)
  if (result.success && PID_SERVICES.includes(service)) {
    const pid = sm.getPid(service)
    if (pid) sm.writePid(service, pid)
    else sm.cleanPid(service)
  }
  return result.success
}

export function getStatus(service) {
  try {
    const out = execSync(`systemctl --user status ${SERVICES[service]} --no-pager -l 2>&1`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    return out
  } catch (e) {
    return e.stdout?.toString() || e.message
  }
}

export function getUptime(service) {
  try {
    const out = execSync(
      `systemctl --user show ${SERVICES[service]} -p ActiveEnterTimestamp --value`,
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
    ).trim()
    return out || null
  } catch {
    return null
  }
}

// Start all services that should be running
export async function startAll() {
  const sm = await getServiceManager()
  const results = {}
  for (const svc of PID_SERVICES) {
    results[svc] = sm.startService(svc)
  }
  return results
}

// Stop all services
export async function stopAll() {
  const sm = await getServiceManager()
  const results = {}
  for (const svc of [...PID_SERVICES].reverse()) {
    results[svc] = sm.stopService(svc)
  }
  return results
}

// Export service names
export const serviceNames = SERVICES

// Export isActive - needs to be async since it uses the service manager
export async function isActive(service) {
  const sm = await getServiceManager()
  return sm.systemctlIsAlive(SERVICES[service])
}

export async function getServiceStatus(service) {
  const sm = await getServiceManager()
  const serviceUnit = SERVICES[service]
  if (!serviceUnit) {
    return { service, running: false, pid: null, error: `unknown service: ${service}` }
  }

  const running = await sm.systemctlIsAlive(serviceUnit)
  let pid = null
  if (running && PID_SERVICES.includes(service)) {
    try {
      pid = sm.getPid(service)
      if (pid === 0 || pid === '0') pid = null
    } catch {
      pid = null
    }
  }

  return { service, running, pid }
}

export async function getServicesStatus(services = PID_SERVICES) {
  const statuses = {}
  for (const service of services) {
    statuses[service] = await getServiceStatus(service)
  }
  return statuses
}

// Backward-compatible sync wrappers that throw errors
export function start(service) {
  throw new Error('start() is async. Use startService() instead or call it within async context.')
}

export function stop(service) {
  throw new Error('stop() is async. Use stopService() instead or call it within async context.')
}

export function getPid(service) {
  // Cannot be sync - use await in async context
  throw new Error('getPid(service) requires async context. Await getServiceManager() first or call getPidOnPort(port) instead.')
}

export function writePid(service, pid) {
  throw new Error('writePid() requires async context. Use in async function that calls getServiceManager()')
}

export function cleanPid(service) {
  throw new Error('cleanPid() requires async context. Use in async function that calls getServiceManager()')
}

