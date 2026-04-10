// api/routes/gateway.js — gateway status, onboarding, and control
import { Router } from 'express'
import {
  execAsync,
  execSync,
  existsSync,
  join,
  parseYaml,
  readFileSync,
  HERMES,
  HERMES_ROOT,
  PYTHON,
  controlGatewayService,
} from './_lib.js'

const router = Router()

const gatewayCache = {
  cfg: null,
  cfgTs: 0,
  livePlatforms: {},
  livePlatformsTs: 0,
}

function readGatewayConfigCached() {
  const now = Date.now()
  if (gatewayCache.cfg && (now - gatewayCache.cfgTs) < 5000) return gatewayCache.cfg

  const configPath = join(HERMES, 'config.yaml')
  let cfg
  try {
    const scriptPath = join(new URL('.', import.meta.url).pathname, '../parse_config.py')
    const cfgRaw = execSync(`${PYTHON} ${scriptPath} < ${configPath}`, { cwd: HERMES, timeout: 2000 })
    cfg = JSON.parse(cfgRaw)
  } catch {
    cfg = parseYaml(readFileSync(configPath, 'utf8'))
  }

  gatewayCache.cfg = cfg || {}
  gatewayCache.cfgTs = now
  return gatewayCache.cfg
}

function readLivePlatformsCached() {
  const now = Date.now()
  if (now - gatewayCache.livePlatformsTs < 1500) return gatewayCache.livePlatforms

  const livePlatforms = {}
  try {
    const LOG = join(HERMES, 'logs/gateway.log')
    if (existsSync(LOG)) {
      const logContent = readFileSync(LOG, 'utf8')
      const lines = logContent.split('\n').filter(Boolean)
      const recent = lines.slice(-30)
      const tg_in = recent.some(l => l.includes('inbound message:') && l.includes('platform=telegram'))
      const tg_out = recent.some(l => l.includes('Sending response') && l.includes('telegram'))
      livePlatforms.telegram = (tg_in || tg_out) ? 'live_active' : 'connected'
      const wh_conn = recent.some((line) => {
        const lower = line.toLowerCase()
        return lower.includes('[webhook]') && (lower.includes('connected') || lower.includes('ready'))
      })
      livePlatforms.webhook = wh_conn ? 'connected' : 'disconnected'
    }
  } catch {}

  gatewayCache.livePlatforms = livePlatforms
  gatewayCache.livePlatformsTs = now
  return livePlatforms
}

// GET /api/gateway
router.get('/gateway', (req, res) => {
  try {
    const observedAt = new Date().toISOString()
    const gw_path = join(HERMES, 'gateway_state.json')
    const gw = JSON.parse(readFileSync(gw_path, 'utf8'))
    const cfg = readGatewayConfigCached()

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

    const live_platforms = readLivePlatformsCached()

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
router.get('/onboarding/status', (req, res) => {
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
router.post('/control/gateway/start', async (req, res) => {
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
router.post('/control/gateway/stop', async (req, res) => {
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
router.post('/control/gateway/restart', async (req, res) => {
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
