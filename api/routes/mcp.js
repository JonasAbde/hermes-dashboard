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
router.get('/', async (req, res) => {
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
      const fullCmd = `${commandValue} ${cmd}`.trim()
      // Forkort paths for PII — skjul /home/empir/
      const shortCmd = fullCmd.replace(/\/home\/empir\/\.nvm\/[^/]+\/bin\//g, 'npx ').slice(0, 80)
      return {
        name,
        enabled: config?.enabled !== false,
        status: isRunning ? 'running' : 'stopped',
        pid: proc?.pid ?? null,
        command: shortCmd,
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

// GET /api/mcp/tools — return tool definitions for all configured MCP servers
// TODO: Dynamically query MCP servers for their tool definitions via JSON-RPC
// For now, use a static registry based on known server capabilities
const TOOL_REGISTRY = {
  filesystem: [
    { name: 'read_file', description: 'Read the contents of a file from the filesystem.', inputSchema: { type: 'object', properties: { path: { type: 'string' }, offset: { type: 'integer', default: 1 }, limit: { type: 'integer', default: 500 } }, required: ['path'] } },
    { name: 'write_file', description: 'Write content to a file, creating it if it does not exist.', inputSchema: { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string' }, append: { type: 'boolean', default: false } }, required: ['path', 'content'] } },
    { name: 'list_directory', description: 'List the contents of a directory.', inputSchema: { type: 'object', properties: { path: { type: 'string' }, recursive: { type: 'boolean', default: false } }, required: ['path'] } },
    { name: 'search_code', description: 'Search for code patterns across files in a directory.', inputSchema: { type: 'object', properties: { query: { type: 'string' }, path: { type: 'string', default: '.' }, file_glob: { type: 'string' }, limit: { type: 'integer', default: 50 } }, required: ['query'] } },
  ],
  fetch: [
    { name: 'http_request', description: 'Perform an HTTP request to an external URL.', inputSchema: { type: 'object', properties: { url: { type: 'string' }, method: { type: 'string', default: 'GET' }, headers: { type: 'object' }, body: { type: 'string' } }, required: ['url'] } },
    { name: 'fetch', description: 'Fetch a URL and return its contents.', inputSchema: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'] } },
  ],
  git: [
    { name: 'git_status', description: 'Show the working tree status.', inputSchema: { type: 'object', properties: { repo_path: { type: 'string' } }, required: ['repo_path'] } },
    { name: 'git_log', description: 'Show commit logs.', inputSchema: { type: 'object', properties: { repo_path: { type: 'string' }, max_count: { type: 'integer', default: 10 } }, required: ['repo_path'] } },
    { name: 'git_diff', description: 'Show changes between commits, working tree, etc.', inputSchema: { type: 'object', properties: { repo_path: { type: 'string' }, target: { type: 'string' } }, required: ['repo_path'] } },
  ],
  time: [
    { name: 'get_current_time', description: 'Get the current date and time.', inputSchema: { type: 'object', properties: { timezone: { type: 'string' } } } },
    { name: 'get_world_time', description: 'Get the current time in a specific timezone.', inputSchema: { type: 'object', properties: { timezone: { type: 'string' } }, required: ['timezone'] } },
  ],
  sequentialthinking: [
    { name: 'sequentialthinking', description: 'A detailed tool for dynamic and reflective problem-solving through chains of thought.', inputSchema: { type: 'object', properties: { thought: { type: 'string' }, nextThoughtNeeded: { type: 'boolean' }, thoughtNumber: { type: 'integer' }, totalThoughts: { type: 'integer' } }, required: ['thought', 'nextThoughtNeeded', 'thoughtNumber', 'totalThoughts'] } },
  ],
  memory: [
    { name: 'save_memory', description: 'Save a piece of information to memory.', inputSchema: { type: 'object', properties: { content: { type: 'string' }, scope: { type: 'string' } }, required: ['content'] } },
    { name: 'recall_memory', description: 'Recall information from memory.', inputSchema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } },
  ],
  puppeteer: [
    { name: 'browser_navigate', description: 'Navigate to a URL in the browser.', inputSchema: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'] } },
    { name: 'browser_screenshot', description: 'Take a screenshot of the current page.', inputSchema: { type: 'object', properties: { fullPage: { type: 'boolean', default: false } } } },
    { name: 'browser_click', description: 'Click on an element on the page.', inputSchema: { type: 'object', properties: { selector: { type: 'string' } }, required: ['selector'] } },
  ],
  taskr: [
    { name: 'create_task', description: 'Create a new persistent task.', inputSchema: { type: 'object', properties: { title: { type: 'string' }, description: { type: 'string' } }, required: ['title'] } },
    { name: 'list_tasks', description: 'List all tasks.', inputSchema: { type: 'object', properties: { status: { type: 'string' } } } },
  ],
  pdf: [
    { name: 'read_pdf', description: 'Extract text content from a PDF file.', inputSchema: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] } },
  ],
}

router.get('/tools', async (req, res) => {
  try {
    const cfg = parseYaml(readFileSync(join(HERMES, 'config.yaml'), 'utf8'))
    const mcpConfigEntries = getMcpConfigEntries(cfg)

    const tools = []
    for (const [serverName, serverConfig] of mcpConfigEntries) {
      const serverTools = TOOL_REGISTRY[serverName] || []
      for (const tool of serverTools) {
        tools.push({ ...tool, server: serverName })
      }
    }

    res.json({ tools, total: tools.length, source: 'static-registry' })
  } catch (e) {
    res.status(500).json({ tools: [], total: 0, source: 'static-registry', error: e.message })
  }
})

// POST /api/mcp/:name/{start,stop,restart}
router.post('/:name/start', (req, res) => {
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

router.post('/:name/stop', (req, res) => {
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

router.post('/:name/restart', (req, res) => {
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
router.get('/:name/logs', (req, res) => {
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
