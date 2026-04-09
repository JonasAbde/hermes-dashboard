// api/routes/index.js — main router, mounts all route modules
import express from 'express'

// ── Global error handler — ensures NO raw 500 ever reaches the client ──────────
function errorHandler(err, req, res, next) {
  const status = err.status || err.statusCode || 500
  const code = err.code || (status >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR')

  // Log full stack on 500s, short on 400s
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
import searchRoutes from './search.js'
import metricsRoutes from './metrics.js'

const router = express.Router()

// Mount each router (all routes use /api/ prefix in their path definitions)
router.use(statsRoutes)               // /api/health, /api/ready, /api/stats, /api/ekg, /api/heatmap
router.use(authRoutes)               // /api/auth/verify, /api/auth/csrf-token
router.use(gatewayRoutes)            // /api/gateway, /api/onboarding/status, /api/control/gateway/*
router.use(sessionsRoutes)           // /api/sessions, /api/sessions/:id, /api/sessions/:id/trace, /api/sessions/:id/messages
router.use(memoryRoutes)             // /api/memory, /api/memory/entries, /api/memory/timeline, /api/memory/search, /api/memory/graph
router.use(cronRoutes)              // /api/cron, /api/cron/stats, /api/cron/jobs, /api/cron/:name, /api/cron/:name/*
router.use(skillsRoutes)             // /api/skills, /api/skills/:name, /api/skills/:name/refresh
router.use(approvalsRoutes)          // /api/approvals, /api/approvals/:id/approve, /api/approvals/:id/deny
router.use(terminalRoutes)           // /api/terminal
router.use(configRoutes)             // /api/config, /api/env, /api/control/personality
router.use(controlRoutes)            // /api/control/services, /api/control/services/:name/:action, /api/agent/status, /api/control/neural-shift, /api/webhook/config, /api/control/model
router.use(chatRoutes)               // /api/chat
router.use(mcpRoutes)                // /api/mcp, /api/mcp/:name/start, /api/mcp/:name/stop, /api/mcp/:name/restart, /api/mcp/:name/logs
router.use(recommendationsRoutes)    // /api/recommendations, /api/recommendations/:id/dismiss, /api/recommendations/:id/snooze, /api/recommendations/:id/done, /api/recommendations/:id/restore
router.use(profileRoutes)           // /api/profile
router.use(logsRoutes)              // /api/logs, /api/logs/files
router.use(systemRoutes)            // /api/system/info
router.use(searchRoutes)            // /api/search
router.use('/api/metrics', metricsRoutes) // /api/metrics/lean, /api/metrics/memory/stats

// ── Global error handler — must be last middleware ────────────────────────────────
router.use(errorHandler)

export default router
