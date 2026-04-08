// api/server.js — Bootstrap file for the modular route structure
// Replaces the monolithic 3200+ LOC server.js with a thin wrapper that mounts
// the Express router from api/routes/index.js
import express from 'express'
import cors from 'cors'
import { join } from 'path'
import { existsSync, readFileSync } from 'fs'
import os from 'os'

// ── CORS config (mirrored from original server.js) ────────────────────────────
const CORS_ORIGINS = (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:5175,http://127.0.0.1:5173').split(',').map(s => s.trim())
const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || CORS_ORIGINS.includes(origin)) {
      callback(null, true)
    } else {
      callback(new Error(`Origin ${origin} not allowed by CORS policy`))
    }
  },
  credentials: true,
}

const app  = express()
const PORT = 5174

const HOME_DIR = os.homedir()
const HERMES_ROOT = join(HOME_DIR, '.hermes')

// ── Middleware ─────────────────────────────────────────────────────────────────
app.use(cors(corsOptions))
app.use(express.json())

// ── Auth middleware (checks baseUrl + path for modular routing) ──────────────
let AUTH_SECRET=''
try {
  const envContent = readFileSync(join(HERMES_ROOT, '.env'), 'utf8')
  const match = envContent.match(/^DASHBOARD_TOKEN=(.*)$/)
  if (match) AUTH_SECRET=match[1]
} catch {}

// Paths that bypass auth — must use full API paths for modular routing
const AUTH_SKIP = new Set([
  '/api/auth/verify',
  '/api/stats',
  '/api/gateway',
  '/api/health',
  '/api/ready',
  '/api/chat',
  '/api/onboarding/status',
  '/api/settings',
  '/api/logs/files',
  '/api/system/info',
])

function authMiddleware(req, res, next) {
  if (!AUTH_SECRET) return next()
  const fullPath = req.baseUrl + req.path
  if (AUTH_SKIP.has(fullPath)) return next()

  let token = req.headers.authorization?.replace('Bearer ', '')
             || req.query.token
  if (!token && req.headers.cookie) {
    const match = req.headers.cookie.match(/(?:^|;\s*)hermes_dashboard_token=([^;]+)/)
    if (match) token = match[1]
  }
  if (token !== AUTH_SECRET) {
    return res.status(401).json({ error: 'Unauthorized', code: 'invalid_token' })
  }
  next()
}

app.use(authMiddleware)

// Apply CSRF protection to state-changing requests (POST/PUT/PATCH)
// Skip paths are handled inside csrfMiddleware via req.baseUrl + req.path
const { csrfMiddleware } = await import('./routes/_lib.js')
app.use(csrfMiddleware)

// ── Mount the modular router ──────────────────────────────────────────────────
const routesModule = await import('./routes/index.js')
app.use(routesModule.default)

// ── pyQuery cache warmup on startup ───────────────────────────────────────────
async function warmCache() {
  const { pyQuery } = await import('./routes/_lib.js')
  pyQuery('stats').then(() => console.log('cache warmed: stats')).catch(() => {})
  pyQuery('ekg').then(() => console.log('cache warmed: ekg')).catch(() => {})
  pyQuery('heatmap').then(() => console.log('cache warmed: heatmap')).catch(() => {})
}

// ── Start server ───────────────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Hermes API → http://0.0.0.0:${PORT}`)
  console.log(`  Chat:        POST /api/chat`)
  console.log(`  MCP:         GET  /api/mcp`)
  console.log(`  Search:      GET  /api/search?q=...`)
  console.log(`  Memory Graph:GET  /api/memory/graph`)
  console.log(`  Memory Entries:GET/POST /api/memory/entries`)
  console.log(`  Memory Timeline:GET /api/memory/timeline`)
  console.log(`  Memory Search:GET  /api/memory/search`)
  warmCache()
})
