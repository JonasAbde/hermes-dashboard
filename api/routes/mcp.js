// api/routes/mcp.js — MCP server status, start/stop/restart, logs
import { Router } from 'express'
import {
  execAsync,
  existsSync,
  join,
  parseYaml,
  readFileSync,
  getMcpConfigEntries,
  HERMES,
} from './_lib.js'

const router = Router()

// GET /api/mcp
router.get('/api/mcp', async (req, res) => {
  try {
    const observedAt = new Date().toISOString()
    const cfg = parseYaml(readFileSync(join(HERMES, 'config.yaml'), 'utf8'))
    const mcpConfigEntries = getMcpConfigEntries(cfg)

    let gwPid = null
    try {
      const gwState = JSON.parse(readFileSync(join(HERMES, 'gateway_state.json'), 'utf8'))
      gwPid = gwState.pid
    } catch {}

    let runningMcpProcs = []
    if (gwPid) {
      try {
        const { stdout } = await execAsync(
          `pstree -ap ${gwPid} 2>/dev/null`,
          { timeout: 5000, maxBuffer: 32 * 1024 }
        )

        runningMcpProcs = stdout.split('\n').map(l => {
          const stripped = l.replace(/^[|`\-\s]+/, '')
          const m = stripped.match(/^([\w\-\.]+),(\d+)\s+(.+)/)
          return m ? { name: m[1], pid: m[2], cmd: m[3].slice(0, 120) } : null
        }).filter(Boolean)
      } catch {}
    }

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

    const servers = mcpConfigEntries.map(([name, config]) => {
      const patterns = SERVER_PATTERNS[name] ?? [name]
      const isRunning = runningMcpProcs.some(p =>
        patterns.some(pat => p.cmd.toLowerCase().includes(pat.toLowerCase())) ||
        patterns.some(pat => p.name.toLowerCase().includes(pat.toLowerCase()))
      )
      const commandValue = config?.command ?? config?.cmd ?? config?.transport ?? '?'
      const cmd = Array.isArray(config?.args) ? config.args.join(' ') : config?.args || ''
      const proc = runningMcpProcs.find(p =>
        patterns.some(pat => p.cmd.toLowerCase().includes(pat.toLowerCase())) ||
        patterns.some(pat => p.name.toLowerCase().includes(pat.toLowerCase()))
      )
      return {
        name,
        enabled: config?.enabled !== false,
        status: isRunning ? 'running' : 'stopped',
        pid: proc?.pid ?? null,
        command: `${commandValue} ${cmd}`.trim().slice(0, 80),
      }
    })

    res.json({
      status: 'ok',
      source: 'gateway-process-tree',
      updated_at: observedAt,
      servers,
      running_procs: runningMcpProcs,
      total: servers.length,
      running_count: servers.filter(s => s.status === 'running').length,
    })
  } catch (e) {
    res.status(500).json({ status: 'error', source: 'gateway-process-tree', updated_at: new Date().toISOString(), servers: [], total: 0, running_count: 0, error: e.message, running_procs: [] })
  }
})

// POST /api/mcp/:name/{start,stop,restart}
router.post('/api/mcp/:name/start', (req, res) => {
  const { name } = req.params
  const serverName = decodeURIComponent(name)
  res.status(409).json({
    ok: false,
    applied: false,
    status: 'not_supported',
    source: 'gateway-static-mcp',
    updated_at: new Date().toISOString(),
    error: `MCP server '${serverName}' cannot be started at runtime`,
    note: `MCP servers are loaded at gateway startup and reloaded when config changes. Server '${serverName}' cannot be started or stopped at runtime. To add/remove servers: edit config.yaml or use 'hermes mcp add/remove'. To reload: restart the gateway with POST /api/control/gateway/restart.`,
    actions: ['restart_gateway', 'edit_config', 'hermes_mcp_add'],
  })
})

router.post('/api/mcp/:name/stop', (req, res) => {
  const { name } = req.params
  const serverName = decodeURIComponent(name)
  res.status(409).json({
    ok: false,
    applied: false,
    status: 'not_supported',
    source: 'gateway-static-mcp',
    updated_at: new Date().toISOString(),
    error: `MCP server '${serverName}' cannot be stopped at runtime`,
    note: `MCP servers are loaded at gateway startup and reloaded when config changes. Server '${serverName}' cannot be started or stopped at runtime. To add/remove servers: edit config.yaml or use 'hermes mcp add/remove'. To reload: restart the gateway with POST /api/control/gateway/restart.`,
    actions: ['restart_gateway', 'edit_config', 'hermes_mcp_add'],
  })
})

router.post('/api/mcp/:name/restart', (req, res) => {
  const { name } = req.params
  const serverName = decodeURIComponent(name)
  res.status(409).json({
    ok: false,
    applied: false,
    status: 'not_supported',
    source: 'gateway-static-mcp',
    updated_at: new Date().toISOString(),
    error: `MCP server '${serverName}' cannot be restarted at runtime`,
    note: `MCP servers are loaded at gateway startup and reloaded when config changes. Server '${serverName}' cannot be started or stopped at runtime. To add/remove servers: edit config.yaml or use 'hermes mcp add/remove'. To reload: restart the gateway with POST /api/control/gateway/restart.`,
    actions: ['restart_gateway', 'edit_config', 'hermes_mcp_add'],
  })
})

// GET /api/mcp/:name/logs
router.get('/api/mcp/:name/logs', (req, res) => {
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

export default router
