// api/routes/index.js — main router, mounts all route modules
import express from 'express'
import { join, parseYaml, readFileSync, HERMES } from './_lib.js'

// ── Global error handler — ensures NO raw 500 ever reaches the client ──────────
function errorHandler(err, req, res, next) {
  const status = err.status || err.statusCode || 500
  const code = err.code || (status >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR')

  if (status >= 500) {
    console.error(`[ErrorHandler] ${req.method} ${req.baseUrl}${req.path} — ${err.message}`, err.stack?.split('\n').slice(0, 3))
  } else {
    console.warn(`[ErrorHandler] ${req.method} ${req.baseUrl}${req.path} — ${err.message}`)
  }

  res.status(status).json({
    error: err.expose ? err.message : (status >= 500 ? 'Internal server error' : 'Request error'),
    code,
    path: req.baseUrl + req.path,
    ...(process.env.NODE_ENV !== 'production' ? { detail: err.message, stack: err.stack?.split('\n').slice(0, 5) } : {}),
  })
}

// Import all route modules
import statsRoutes from './stats.js'
import authRoutes from './auth.js'
import gatewayRoutes from './gateway.js'
import sessionsRoutes from './sessions.js'
import memoryRoutes from './memory.js'
import cronRoutes from './cron.js'
import skillsRoutes from './skills.js'
import approvalsRoutes from './approvals.js'
import terminalRoutes from './terminal.js'
import configRoutes from './config.js'
import controlRoutes from './control.js'
import chatRoutes from './chat.js'
import mcpRoutes from './mcp.js'
import recommendationsRoutes from './recommendations.js'
import profileRoutes from './profile.js'
import logsRoutes from './logs.js'
import systemRoutes from './system.js'
import metricsRoutes from './metrics.js'
import searchRoutes from './search.js'
import webhooksRoutes from './webhooks.js'
import activityRoutes from './activity.js'
import agentRoutes from './agent.js'
import githubRoutes from './github.js'

const router = express.Router()

// ── Global auth middleware — protects all routes except explicitly public ones ──
const PUBLIC_PATHS = [
  '/api/health', '/api/ready', '/api/ekg', '/api/heatmap',
  '/api/auth/verify', '/api/auth/refresh',
  '/api/gateway', '/api/onboarding/status',
  '/api/stats', '/api/metrics/lean', '/api/system/info',
  '/api/webhook/github',
]

router.use((req, res, next) => {
  const fullPath = (req.baseUrl + req.path).replace(/\/+$/, '')

  // Allow explicitly public paths (all methods)
  if (PUBLIC_PATHS.some(p => fullPath === p || fullPath.startsWith(p + '/'))) {
    return next()
  }

  // Allow GET on read-only public data
  const PUBLIC_GET_PREFIXES = [
    '/api/sessions', '/api/activity', '/api/skills', '/api/mcp',
    '/api/recommendations', '/api/profile', '/api/logs', '/api/search',
    '/api/cron', '/api/models', '/api/config', '/api/github',
    '/api/agent/fleet', '/api/agent/list', '/api/agent/status', '/api/control/services',
    '/api/control/agent/status', '/api/control/models',
  ]
  // Also check without /api prefix (middleware runs after baseUrl is stripped)
  const PUBLIC_GET_PREFIXES_NO_API = [
    '/sessions', '/activity', '/skills', '/mcp',
    '/recommendations', '/profile', '/logs', '/search',
    '/cron', '/models', '/config', '/github',
    '/agent/fleet', '/agent/list', '/agent/status', '/control/services',
    '/control/agent/status', '/control/models',
  ]
  if (req.method === 'GET' && (PUBLIC_GET_PREFIXES.some(p => fullPath === p || fullPath.startsWith(p + '/')) || 
                                 PUBLIC_GET_PREFIXES_NO_API.some(p => fullPath === p || fullPath.startsWith(p + '/')))) {
    return next()
  }

  // Everything else requires auth (fail-closed)
  const AUTH_SECRET = process.env.AUTH_TOKEN || process.env.AUTH_SECRET || process.env.DASHBOARD_TOKEN
  if (!AUTH_SECRET) {
    return res.status(503).json({ error: 'Auth misconfigured: AUTH_SECRET missing' })
  }

  const authHeader = req.headers.authorization
  const token = authHeader?.replace('Bearer ', '') || req.headers['x-auth-token'] || req.query.token
  if (token === AUTH_SECRET) return next()

  return res.status(401).json({ error: 'Authentication required' })
})

// Mount each router with its correct base path
router.use(statsRoutes)                          // /api/health, /api/stats, /api/ready, /api/ekg, /api/heatmap
router.use('/auth', authRoutes)                  // /api/auth/verify, /api/auth/csrf-token
router.use(gatewayRoutes)                        // /api/gateway, /api/onboarding/status, /api/control/gateway/*
router.use('/sessions', sessionsRoutes)          // /api/sessions, /api/sessions/:id, /api/sessions/:id/trace, /api/sessions/:id/messages
router.use('/memory', memoryRoutes)              // /api/memory, /api/memory/entries, /api/memory/timeline, /api/memory/search, /api/memory/graph
router.use('/cron', cronRoutes)                 // /api/cron, /api/cron/stats, /api/cron/jobs, /api/cron/:name, /api/cron/:name/*
router.use('/skills', skillsRoutes)              // /api/skills, /api/skills/:name, /api/skills/:name/refresh
router.use('/approvals', approvalsRoutes)        // /api/approvals, /api/approvals/:id/approve, /api/approvals/:id/deny
router.use('/terminal', terminalRoutes)           // /api/terminal
router.use(configRoutes)                         // /api/config, /api/env, /api/control/personality
router.use('/control', controlRoutes)           // /api/control/services, /api/control/services/:name/:action, /api/agent/status, /api/control/neural-shift, /api/control/model
router.use('/chat', chatRoutes)                 // /api/chat
router.use('/mcp', mcpRoutes)                  // /api/mcp, /api/mcp/:name/start, /api/mcp/:name/stop, /api/mcp/:name/restart, /api/mcp/:name/logs
router.use('/recommendations', recommendationsRoutes)  // /api/recommendations, /api/recommendations/:id/dismiss, etc.
router.use(profileRoutes)                       // /api/profile
router.use('/logs', logsRoutes)                 // /api/logs, /api/logs/files
router.use('/system', systemRoutes)             // /api/system/info
router.use('/metrics', metricsRoutes)           // /api/metrics/lean
router.use('/search', searchRoutes)             // /api/search
router.use('/webhook', webhooksRoutes)          // /api/webhook/github
router.use('/activity', activityRoutes)         // /api/activity
router.use('/agent', agentRoutes)               // /api/agent/fleet, /api/agent/list
router.use('/github', githubRoutes)             // /api/github

// /api/models alias — frontend expects this path (maps to /api/control/models)
router.get('/models', (req, res) => {
  try {
    const configPath = join(HERMES_ROOT, 'config.yaml')
    const cfg = parseYaml(readFileSync(configPath, 'utf8'))
    const models = (Array.isArray(cfg.models) ? cfg.models : []) || (Array.isArray(cfg.providers) ? cfg.providers : []) || []
    res.json({ models, current: cfg.agent?.model || null })
  } catch (e) {
    res.json({ models: [], current: null, error: e.message })
  }
})

// /api/agent/status alias — frontend expects this path (maps to /api/control/agent/status)
router.get('/agent/status', (req, res) => {
  // Redirect to control routes handler (or replicate the logic)
  try {
    const { execSync } = require('child_process')
    let agentStatus = { status: 'unknown', uptime: 0, memory: 0 }
    try {
      const uptime = execSync('ps -p $(pgrep -f "hermes-gateway") -o etimes= 2>/dev/null || echo 0', { encoding: 'utf8' }).trim()
      agentStatus.uptime = parseInt(uptime) || 0
    } catch {}
    try {
      const mem = execSync('ps -p $(pgrep -f "hermes-gateway") -o rss= 2>/dev/null || echo 0', { encoding: 'utf8' }).trim()
      agentStatus.memory = parseInt(mem) || 0
    } catch {}
    // Check if hermes-gateway is running
    try {
      execSync('pgrep -f "hermes-gateway"', { stdio: 'ignore' })
      agentStatus.status = 'running'
    } catch {
      agentStatus.status = 'stopped'
    }
    res.json(agentStatus)
  } catch (e) {
    res.json({ status: 'error', error: e.message })
  }
})

// ── Global error handler — must be last middleware ────────────────────────────────
router.use(errorHandler)

export default router
