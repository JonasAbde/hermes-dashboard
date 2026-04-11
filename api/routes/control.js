// api/routes/control.js — services, agent status, neural shift, webhook config, model switch
import { Router } from 'express'
import {
  execAsync,
  execSync,
  existsSync,
  join,
  parseYaml,
  readFileSync,
  hermesCmd,
  RHYTHM_CONFIGS,
  readDashboardAgentStatus,
  writeDashboardAgentStatus,
  readDashboardWebhookConfig,
  writeDashboardWebhookConfig,
  defaultWebhookConfig,
  getServiceStatus,
  HERMES,
  HERMES_BIN,
  HOME_DIR,
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

// GET /api/control/services
router.get('/api/control/services', (req, res) => {
  const names = ['hermes-gateway', 'hermes-dashboard-api']
  const observedAt = new Date().toISOString()
  try {
    res.json({
      status: 'ok',
      source: 'runtime',
      updated_at: observedAt,
      services: names.map((name) => ({ ...getServiceStatus(name), observed_at: observedAt })),
    })
  } catch (e) {
    res.status(500).json({ status: 'error', source: 'runtime', updated_at: observedAt, error: e.message, services: [] })
  }
})

// POST /api/control/services/:name/:action
router.post('/api/control/services/:name/:action', async (req, res) => {
  const { name, action } = req.params
  if (!['hermes-gateway', 'hermes-dashboard-api'].includes(name)) {
    return res.status(404).json({ ok: false, error: `Unknown service: ${name}` })
  }
  if (!['start', 'stop', 'restart'].includes(action)) {
    return res.status(400).json({ ok: false, error: `Invalid action: ${action}. Use: start|stop|restart` })
  }

  const actionLabel = `${name} ${action}`
  console.log(`[service-control] ${actionLabel} triggered`)

  if (name === 'hermes-gateway') {
    try {
      const status = await controlGatewayService(action)
      const observedAt = new Date().toISOString()
      const service = getServiceStatus(name)
      console.log(`[service-control] ${actionLabel} → ${status}`)
      return res.json({
        ok: true,
        applied: true,
        action,
        service: name,
        status: 'ok',
        source: 'systemctl',
        updated_at: observedAt,
        service_status: service,
        gateway_state: status,
      })
    } catch (e) {
      console.error(`[service-control] ${actionLabel} failed: ${e.message}`)
      return res.status(500).json({
        ok: false,
        applied: false,
        action,
        service: name,
        status: 'error',
        source: 'systemctl',
        updated_at: new Date().toISOString(),
        error: e.message,
      })
    }
  }

  return res.status(409).json({
    ok: false,
    applied: false,
    action,
    service: name,
    status: 'not_supported',
    source: 'dashboard-api',
    updated_at: new Date().toISOString(),
    error: 'Dashboard API cannot be controlled via this endpoint. Use: npm run api / docker compose restart api',
  })
})

// GET /api/agent/status
router.get('/api/agent/status', (req, res) => {
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

// POST /api/agent/status
router.post('/api/agent/status', (req, res) => {
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

// POST /api/control/neural-shift
router.post('/api/control/neural-shift', async (req, res) => {
  const { rhythm } = req.body

  if (!rhythm || !RHYTHM_CONFIGS[rhythm]) {
    return res.status(400).json({ error: `Invalid rhythm: ${rhythm}. Valid: ${Object.keys(RHYTHM_CONFIGS).join(', ')}` })
  }

  try {
    const configPath = join(HERMES, 'config.yaml')
    const rhythmCfg = RHYTHM_CONFIGS[rhythm]

    const deepMerge = {}
    if (rhythmCfg.agent) {
      deepMerge.agent = {}
      if (rhythmCfg.agent.reasoning_effort !== undefined) deepMerge.agent.reasoning_effort = rhythmCfg.agent.reasoning_effort
      if (rhythmCfg.agent.max_turns !== undefined) deepMerge.agent.max_turns = rhythmCfg.agent.max_turns
    }
    if (rhythmCfg.terminal) {
      deepMerge.terminal = {}
      if (rhythmCfg.terminal.timeout !== undefined) deepMerge.terminal.timeout = rhythmCfg.terminal.timeout
    }
    if (rhythmCfg.code_execution) {
      deepMerge.code_execution = {}
      if (rhythmCfg.code_execution.max_tool_calls !== undefined) deepMerge.code_execution.max_tool_calls = rhythmCfg.code_execution.max_tool_calls
      if (rhythmCfg.code_execution.timeout !== undefined) deepMerge.code_execution.timeout = rhythmCfg.code_execution.timeout
    }

    const escaped = JSON.stringify(deepMerge).replace(/'/g, "'\"'\"'")
    execSync(
      `${PYTHON} -c "import yaml,json,sys; cfg=yaml.safe_load(open('${configPath}')); u=json.loads('${escaped}'); [cfg.update({k:v}) for k,v in u.items()]; yaml.dump(cfg,open('${configPath}','w'),default_flow_style=False,allow_unicode=True,sort_keys=False)"`,
      { cwd: HERMES, timeout: 8000 }
    )

    const currentStatus = readDashboardAgentStatus()
    const nextStatus = { ...currentStatus, rhythm, updated_at: new Date().toISOString() }
    writeDashboardAgentStatus(nextStatus)

    hermesCmd('gateway notify rhythm-changed').catch(() => {})

    res.json({ ok: true, rhythm, config: rhythmCfg })
  } catch (e) {
    console.error('Neural shift error:', e)
    res.status(500).json({ error: e.message })
  }
})

// GET /api/webhook/config
router.get('/api/webhook/config', (req, res) => {
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

// POST /api/webhook/config
router.post('/api/webhook/config', (req, res) => {
  try {
    const { url, secret, enabled } = req.body
    const config = {
      url: url || '',
      secret: secret || '',
      enabled: enabled || false,
      updated_at: new Date().toISOString(),
    }

    writeDashboardWebhookConfig(config)

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

// GET /api/models — list available models and current selection
router.get('/api/models', (req, res) => {
  try {
    const gwState = JSON.parse(readFileSync(join(HERMES, 'gateway_state.json'), 'utf8'))
    const cfgRaw = parseYaml(readFileSync(join(HERMES, 'config.yaml'), 'utf8'))
    const currentModel = cfgRaw.model?.default || cfgRaw.model || gwState?.model || 'kilo-auto/balanced'

    const models = [
      'kilo-auto/balanced',
      'kilo-auto/creative',
      'kilo-auto/reasoning',
      'kilo-code/balanced',
      'kilo-code/advanced',
    ]

    // Defensive: ensure models is always an array
    const safeModels = Array.isArray(models) ? models : []
    res.json({ models: safeModels, current: currentModel })
  } catch (e) {
    res.json({ models: ['kilo-auto/balanced'], current: 'kilo-auto/balanced' })
  }
})

router.post('/api/control/model', async (req, res) => {
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

export default router
