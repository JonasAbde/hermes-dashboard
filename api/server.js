// api/server.js — Bootstrap file for the modular route structure
// Replaces the monolithic 3200+ LOC server.js with a thin wrapper that mounts
// the Express router from api/routes/index.js
import express from 'express'
import cors from 'cors'
import { join } from 'path'
import { existsSync, readFileSync } from 'fs'
import os from 'os'

// ── CORS config (mirrored from original server.js) ────────────────────────────
let CORS_ORIGINS = (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:5175,http://127.0.0.1:5173').split(',').map(s => s.trim())

const app  = express()
const PORT = 5174

const HOME_DIR = os.homedir()
const HERMES_ROOT = join(HOME_DIR, '.hermes')

// ── Load config from HERMES_ROOT/.env ─────────────────────────────────────────
let AUTH_SECRET=undefined
try {
  const envContent = readFileSync(join(HERMES_ROOT, '.env'), 'utf8')
  const dtMatch = envContent.match(/^DASHBOARD_TOKEN=(.+)/m)
  if (dtMatch) AUTH_SECRET=dtMatch[1].trim()
  const coMatch = envContent.match(/^CORS_ORIGINS=(.+)/m)
  if (coMatch) CORS_ORIGINS=coMatch[1].split(',').map(s=>s.trim())
} catch {}

// ── CORS middleware ─────────────────────────────────────────────────────────────
const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true)
    // Auto-allow known tunnel services (random subdomains change each session)
    const TUNNEL_PATTERNS = [
      /\.trycloudflare\.com$/,
      /\.lhr\.life$/,
      /\.serveo\.net$/,
    ]
    if (TUNNEL_PATTERNS.some(p => p.test(origin))) return callback(null, true)
    if (CORS_ORIGINS.includes('*')) return callback(null, true)
    const allowed = CORS_ORIGINS.some(allowed => {
      if (allowed.includes('*')) {
        const pattern = '^' + allowed.replace(/\./g, '\\.').replace(/\*/g, '[^.]+') + '$'
        return new RegExp(pattern).test(origin)
      }
      return origin === allowed
    })
    if (allowed) {
      callback(null, true)
    } else {
      callback(new Error(`Origin ${origin} not allowed`))
    }
  },
  credentials: true,
}
app.use(cors(corsOptions))
app.use(express.json())

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

let shuttingDown = false
const sockets = new Set()

function shutdown(signal) {
  if (shuttingDown) return
  shuttingDown = true
  console.log(`Hermes API shutting down (${signal})`)
  server.close(() => {
    process.exit(0)
  })
  setTimeout(() => {
    for (const socket of sockets) {
      socket.destroy()
    }
  }, 150).unref()
  setTimeout(() => {
    process.exit(0)
  }, 5000).unref()
}

// ── Start server ───────────────────────────────────────────────────────────────
const server = app.listen(PORT, '0.0.0.0', () => {
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

server.on('connection', (socket) => {
  sockets.add(socket)
  socket.on('close', () => {
    sockets.delete(socket)
  })
})

;['SIGINT', 'SIGTERM', 'SIGUSR2'].forEach((signal) => {
  process.on(signal, () => shutdown(signal))
})
