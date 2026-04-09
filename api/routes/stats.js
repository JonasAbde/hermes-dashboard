// api/routes/stats.js — health, readiness, stats, ekg, heatmap
import { Router } from 'express'
import {
  Database,
  DB_PATH,
  PYTHON,
  AUTH_SECRET,
  HERMES_ROOT,
  pyQuery,
  existsSync,
  join,
  os,
} from './_lib.js'

const router = Router()

// GET /api/health — liveness probe
router.get('/health', (req, res) => {
  res.json({ status: 'ok', ts: Date.now() })
})

// GET /api/ready — readiness probe
router.get('/ready', (req, res) => {
  const checks = { db: false, hermes_config: false, hermes_root: false, hermes_binary: false, python: false }
  try { const db = new Database(DB_PATH); db.prepare('SELECT 1').get(); checks.db = true } catch {}
  try { checks.hermes_root = existsSync(join(HERMES_ROOT, '.')) } catch {}
  try { checks.hermes_config = existsSync(join(HERMES_ROOT, 'config.yaml')) } catch {}
  try { checks.hermes_binary = existsSync(join(os.homedir(), '.local/bin/hermes')) } catch {}
  try { checks.python = existsSync(PYTHON) } catch {}
  const allOk = checks.db && checks.hermes_config && checks.hermes_root
  const missing = Object.entries(checks).filter(([, v]) => !v).map(([k]) => k)
  if (allOk) {
    res.json({ ok: true, checks, missing: [], ts: Date.now(), dev_mode: !AUTH_SECRET })
  } else {
    res.status(503).json({ ok: false, checks, missing, ts: Date.now(), dev_mode: !AUTH_SECRET })
  }
})

// GET /api/stats
router.get('/stats', async (req, res) => {
  const observedAt = new Date().toISOString()
  try {
    const data = await pyQuery('stats')
    res.json({
      ...data,
      status: 'ok',
      source: 'pyQuery:stats',
      updated_at: observedAt,
      cache_ttl_s: 30,
    })
  } catch (e) {
    console.error('/api/stats error:', e.message)
    res.status(500).json({ status: 'error', source: 'pyQuery:stats', updated_at: observedAt, error: e.message })
  }
})

// GET /api/ekg
router.get('/ekg', async (req, res) => {
  const observedAt = new Date().toISOString()
  try {
    const data = await pyQuery('ekg')
    res.json({
      ...data,
      status: 'ok',
      source: 'pyQuery:ekg',
      updated_at: observedAt,
      cache_ttl_s: 30,
    })
  } catch (e) {
    res.json({ points: [], status: 'error', source: 'pyQuery:ekg', updated_at: observedAt, cache_ttl_s: 30 })
  }
})

// GET /api/heatmap
router.get('/heatmap', async (req, res) => {
  const observedAt = new Date().toISOString()
  try {
    const data = await pyQuery('heatmap')
    res.json({
      ...data,
      status: 'ok',
      source: 'pyQuery:heatmap',
      updated_at: observedAt,
      cache_ttl_s: 30,
    })
  } catch (e) {
    res.json({ grid: null, status: 'error', source: 'pyQuery:heatmap', updated_at: observedAt, cache_ttl_s: 30 })
  }
})

export default router
