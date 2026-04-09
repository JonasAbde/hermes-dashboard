// api/server.js — Bootstrap file for the modular route structure
import express from 'express'
import cors from 'cors'
import { join } from 'path'
import { existsSync, readFileSync } from 'fs'
import os from 'os'
import routesModule from './routes/index.js'

const app = express()
const PORT = 5174
const HOME_DIR = os.homedir()
const HERMES_ROOT = join(HOME_DIR, '.hermes')

// ── Load config from HERMES_ROOT/.env ─────────────────────────────────────────
let AUTH_SECRET = 'hermes-dev'
let CORS_ORIGINS = ['http://localhost:5173', 'http://localhost:5175', 'http://localhost:5176', 'http://127.0.0.1:5173', 'http://127.0.0.1:5176']

try {
  const envContent = readFileSync(join(HERMES_ROOT, '.env'), 'utf8')
  const dtMatch = envContent.match(/^DASHBOARD_TOKEN=(.+)/m)
  if (dtMatch) AUTH_SECRET = dtMatch[1].trim()
  const coMatch = envContent.match(/^CORS_ORIGINS=(.+)/m)
  if (coMatch) CORS_ORIGINS = coMatch[1].split(',').map(s => s.trim())
} catch (err) {}

// ── CORS middleware ─────────────────────────────────────────────────────────────
const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true)
    const TUNNEL_PATTERNS = [/\.trycloudflare\.com$/, /\.lhr\.life$/, /\.serveo\.net$/]
    const STATIC_ALLOWED = ['http://localhost:5173', 'http://localhost:5175', 'http://localhost:5176', 'http://127.0.0.1:5173', 'http://127.0.0.1:5176']
    
    if (STATIC_ALLOWED.includes(origin) || TUNNEL_PATTERNS.some(p => p.test(origin)) || CORS_ORIGINS.includes(origin) || CORS_ORIGINS.includes('*')) {
      return callback(null, origin)
    }
    callback(new Error(`Origin ${origin} not allowed`))
  },
  credentials: true,
}

app.use(cors(corsOptions))
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf
  }
}))

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', uptime: Math.round(process.uptime()), memory: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB' })
})

// Mount Modular Router under /api prefix
app.use('/api', routesModule)

app.listen(PORT, () => {
  console.log(`[START] API server running on port ${PORT}`)
})
