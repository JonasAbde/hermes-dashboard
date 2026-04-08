// api/routes/index.js — main router, mounts all route modules
import express from 'express'

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

const router = express.Router()

// Mount each router at its base path
router.use(statsRoutes)               // /api/health, /api/ready, /api/stats, /api/ekg, /api/heatmap
router.use(authRoutes)               // /api/auth/verify
router.use(gatewayRoutes)            // /api/gateway, /api/onboarding/status, /api/control/gateway/*
router.use('/sessions', sessionsRoutes)  // /api/sessions, /api/sessions/:id, /api/sessions/:id/trace, /api/sessions/:id/messages
router.use(memoryRoutes)            // /api/memory*, /api/memory/entries*, /api/memory/timeline, /api/memory/search, etc.
router.use('/cron', cronRoutes)      // /api/cron, /api/cron/stats, /api/cron/jobs, /api/cron/:name*
router.use(skillsRoutes)             // /api/skills*, /api/skills/:name*, /api/skills/:name/refresh
router.use(approvalsRoutes)          // /api/approvals, /api/approvals/:id/approve, /api/approvals/:id/deny
router.use(terminalRoutes)           // /api/terminal (GET + POST)
router.use(configRoutes)             // /api/config, /api/config (PATCH), /api/env, /api/settings, /api/control/personality
router.use(controlRoutes)            // /api/control/services, /api/control/services/:name/:action, /api/agent/status, /api/control/neural-shift, /api/webhook/config, /api/control/model
router.use(chatRoutes)               // /api/chat
router.use(mcpRoutes)                // /api/mcp, /api/mcp/:name/start, /api/mcp/:name/stop, /api/mcp/:name/restart, /api/mcp/:name/logs
router.use(recommendationsRoutes)    // /api/recommendations*, /api/recommendations/:id/dismiss, /api/recommendations/:id/snooze, /api/recommendations/:id/done, /api/recommendations/:id/restore
router.use(profileRoutes)           // /api/profile (GET + POST)
router.use(logsRoutes)              // /api/logs, /api/logs/files
router.use(systemRoutes)            // /api/system/info
router.use(searchRoutes)            // /api/search

export default router
