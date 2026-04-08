// api/routes/gateway.js — gateway status, onboarding, and control
import { Router } from 'express'
import {
  execAsync,
  execSync,
  existsSync,
  join,
  os,
  parseYaml,
  readFileSync,
  HERMES,
  HERMES_ROOT,
  PYTHON,
} from './_lib.js'

const router = Router()

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

// GET /api/gateway
router.get('/api/gateway', (req, res) => {
  try {
    const observedAt = new Date().toISOString()
    const gw_path = join(HERMES, 'gateway_state.json')
    const gw = JSON.parse(readFileSync(gw_path, 'utf8'))
    let cfg
    try {
      const scriptPath = join(new URL('.', import.meta.url).pathname, '../parse_config.py')
      const cfgRaw = execSync(`${PYTHON} ${scriptPath} < ${join(HERMES, 'config.yaml')}`, { cwd: HERMES, timeout: 8000 })
      cfg = JSON.parse(cfgRaw)
    } catch {
      const rawCfg = parseYaml(readFileSync(join(HERMES, 'config.yaml'), 'utf8'))
      cfg = rawCfg
    }

    let pid_alive = false
    if (gw.pid) {
      try { process.kill(gw.pid, 0); pid_alive = true } catch {}
    }

    if (!pid_alive) {
      try {
        const pidFile = readFileSync(join(HERMES, 'gateway.pid'), 'utf8').trim()
        const pid2 = parseInt(pidFile)
        if (pid2) { try { process.kill(pid2, 0); pid_alive = true } catch {} }
      } catch {}
    }

    const updatedAt = gw.updated_at ? new Date(gw.updated_at) : null
    const ageMs = updatedAt ? Date.now() - updatedAt.getTime() : null
    const state_age_s = ageMs ? Math.round(ageMs / 1000) : null
    const heartbeat_age_s = state_age_s
    const heartbeat_fresh = heartbeat_age_s !== null && heartbeat_age_s < 90
    const state_fresh = heartbeat_fresh || (state_age_s !== null && state_age_s < 300)

    let live_platforms = {}
    try {
      const LOG = join(HERMES, 'logs/gateway.log')
      if (existsSync(LOG)) {
        const logContent = readFileSync(LOG, 'utf8')
        const lines = logContent.split('\n').filter(Boolean)
        const recent = lines.slice(-30)
        const tg_in  = recent.some(l => l.includes('inbound message:') && l.includes('platform=telegram'))
        const tg_out = recent.some(l => l.includes('Sending response') && l.includes('telegram'))
        if (tg_in || tg_out) {
          live_platforms['telegram'] = 'live_active'
        } else {
          live_platforms['telegram'] = 'connected'
        }
        const wh_conn = recent.some((line) => {
          const lower = line.toLowerCase()
          return lower.includes('[webhook]') && (lower.includes('connected') || lower.includes('ready'))
        })
        live_platforms['webhook'] = wh_conn ? 'connected' : 'disconnected'
      }
    } catch {}

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

    const modelObj = cfg.model ?? cfg.models?.default ?? cfg.default
    const modelLabel = typeof modelObj === 'string' ? modelObj
      : (modelObj?.default ?? cfg.model?.default ?? cfg.provider ?? 'unknown')

    res.json({
      status: 'ok',
      source: 'gateway_state.json',
      observed_at: observedAt,
      gateway_online: pid_alive,
      gateway_state:  gw.gateway_state ?? 'unknown',
      model:          typeof modelObj === 'string' ? modelObj : (modelObj?.default ?? null),
      model_label:    modelLabel,
      platforms:      platformList,
      pid:            gw.pid,
      updated_at:     gw.updated_at,
      state_age_s,
      state_fresh,
      live_age_s:     null,
    })
  } catch (e) {
    console.error('/api/gateway error:', e.message)
    res.status(503).json({
      status: 'error',
      source: 'gateway_state.json',
      observed_at: new Date().toISOString(),
      gateway_online: null,
      gateway_state: 'unknown',
      platforms: [],
      state_age_s: null,
      state_fresh: false,
      error: e.message,
    })
  }
})

// GET /api/onboarding/status
router.get('/api/onboarding/status', (req, res) => {
  try {
    const configPath = join(HERMES, 'config.yaml')
    let content = ''
    try { content = readFileSync(configPath, 'utf8') } catch {}
    const hasProvider = /^provider\s*:/m.test(content) && !/^provider\s*:\s*""?\s*$/m.test(content)
    const envPath = join(HERMES, '.env')
    let envContent = ''
    try { envContent = readFileSync(envPath, 'utf8') } catch {}
    const hasApiKey = /^[A-Z_]+_API_KEY\s*=/m.test(envContent)
    res.json({ needsOnboarding: !hasProvider, hasApiKey })
  } catch (e) {
    res.json({ needsOnboarding: true, hasApiKey: false })
  }
})

// POST /api/control/gateway/start
router.post('/api/control/gateway/start', async (req, res) => {
  try {
    const status = await controlGatewayService('start')
    res.json({
      ok: true,
      applied: true,
      action: 'start',
      status: 'ok',
      source: 'systemctl',
      updated_at: new Date().toISOString(),
      gateway_state: status,
    })
  } catch (e) {
    res.status(500).json({ ok: false, applied: false, action: 'start', status: 'error', source: 'systemctl', updated_at: new Date().toISOString(), error: e.message })
  }
})

// POST /api/control/gateway/stop
router.post('/api/control/gateway/stop', async (req, res) => {
  try {
    const status = await controlGatewayService('stop')
    res.json({
      ok: true,
      applied: true,
      action: 'stop',
      status: 'ok',
      source: 'systemctl',
      updated_at: new Date().toISOString(),
      gateway_state: status,
    })
  } catch (e) {
    res.status(500).json({ ok: false, applied: false, action: 'stop', status: 'error', source: 'systemctl', updated_at: new Date().toISOString(), error: e.message })
  }
})

// POST /api/control/gateway/restart
router.post('/api/control/gateway/restart', async (req, res) => {
  try {
    const status = await controlGatewayService('restart')
    res.json({
      ok: true,
      applied: true,
      action: 'restart',
      status: 'ok',
      source: 'systemctl',
      updated_at: new Date().toISOString(),
      gateway_state: status,
    })
  } catch (e) {
    res.status(500).json({ ok: false, applied: false, action: 'restart', status: 'error', source: 'systemctl', updated_at: new Date().toISOString(), error: e.message })
  }
})

export default router
