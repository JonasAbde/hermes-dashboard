// api/routes/cron.js — Manage Cron jobs and schedules
import { Router } from 'express'
import { join } from 'path'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { HERMES_ROOT, HOME_DIR, execAsync, HERMES_BIN } from './_lib.js'
import { execSync } from 'child_process'

const router = Router()
const JOBS_FILE = join(HERMES_ROOT, 'cron', 'jobs.json')

// GET /api/cron — main cron endpoint
router.get('/', (req, res) => {
  try {
    if (!existsSync(JOBS_FILE)) return res.json({ jobs: [] })
    const data = JSON.parse(readFileSync(JOBS_FILE, 'utf8'))
    res.json({ jobs: data.jobs || [] })
  } catch (err) {
    res.status(500).json({ error: 'Kunne ikke læse jobs' })
  }
})

// GET /api/cron/jobs (alias)
router.get('/jobs', (req, res) => {
  try {
    if (!existsSync(JOBS_FILE)) return res.json({ jobs: [] })
    const data = JSON.parse(readFileSync(JOBS_FILE, 'utf8'))
    res.json({ jobs: data.jobs || [] })
  } catch (err) {
    res.status(500).json({ error: 'Kunne ikke læse jobs' })
  }
})

// POST /api/cron/jobs (Opret)
router.post('/jobs', (req, res) => {
  try {
    const { name, schedule, prompt, deliver = 'origin', enabled = true } = req.body
    if (!name || !schedule || !prompt) return res.status(400).json({ error: 'Mangler data' })

    let data = { jobs: [] }
    if (existsSync(JOBS_FILE)) data = JSON.parse(readFileSync(JOBS_FILE, 'utf8'))
    
    if (data.jobs.find(j => j.name === name)) return res.status(409).json({ error: 'Job findes allerede' })

    data.jobs.push({ name, schedule, prompt, deliver, enabled, created_at: new Date().toISOString() })
    writeFileSync(JOBS_FILE, JSON.stringify(data, null, 2))
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: 'Kunne ikke gemme job' })
  }
})

// DELETE /api/cron/jobs/:name
router.delete('/jobs/:name', (req, res) => {
  try {
    const { name } = req.params
    if (!existsSync(JOBS_FILE)) return res.status(404).json({ error: 'Ingen jobs fundet' })
    
    let data = JSON.parse(readFileSync(JOBS_FILE, 'utf8'))
    const initialLen = data.jobs.length
    data.jobs = data.jobs.filter(j => j.name !== name)
    
    if (data.jobs.length === initialLen) return res.status(404).json({ error: 'Job ikke fundet' })

    writeFileSync(JOBS_FILE, JSON.stringify(data, null, 2))
    res.json({ ok: true, message: `Job '${name}' slettet` })
  } catch (err) {
    res.status(500).json({ error: 'Kunne ikke slette job' })
  }
})

// POST /api/cron/:name/trigger
router.post('/:name/trigger', async (req, res) => {
  const { name } = req.params
  try {
    const { stdout, stderr } = await execAsync(
      `${HERMES_BIN} cron run ${name} 2>&1`,
      { timeout: 60000, env: { ...process.env, HOME: HOME_DIR } }
    ).catch(e => ({ stdout: '', stderr: e.message }))
    res.json({ ok: true, output: stdout || stderr })
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message })
  }
})

// GET /stats — cron statistics
router.get('/stats', (req, res) => {
  try {
    const out = execSync(`${HERMES_BIN} cron list --json 2>&1`, {
      timeout: 10000, env: { ...process.env, HOME: HOME_DIR }
    }).toString()
    let jobs = []
    try { jobs = JSON.parse(out) } catch {}
    const total = jobs.length
    const active = jobs.filter(j => j.status === 'active' || j.enabled).length
    const paused = total - active
    res.json({ total, active, paused, jobs })
  } catch (e) {
    res.json({ total: 0, active: 0, paused: 0, error: e.message })
  }
})

// GET /:name/output — get last output for a cron job
router.get('/:name/output', (req, res) => {
  try {
    const logPath = join(HERMES_ROOT, 'logs', `cron-${req.params.name}.log`)
    if (existsSync(logPath)) {
      const content = readFileSync(logPath, 'utf8')
      const lines = content.trim().split('\n')
      res.json({ name: req.params.name, output: lines.slice(-50).join('\n'), lines: lines.length })
    } else {
      res.json({ name: req.params.name, output: '', lines: 0 })
    }
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// PATCH /:name/enable — enable a cron job
router.patch('/:name/enable', (req, res) => {
  try {
    execSync(`${HERMES_BIN} cron enable ${req.params.name} 2>&1`, {
      timeout: 10000, env: { ...process.env, HOME: HOME_DIR }
    })
    res.json({ ok: true, name: req.params.name, enabled: true })
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message })
  }
})

// PATCH /jobs/:name — update cron job
router.patch('/jobs/:name', (req, res) => {
  try {
    const { schedule, prompt, enabled } = req.body
    if (schedule) {
      execSync(`${HERMES_BIN} cron update ${req.params.name} --schedule '${schedule}' 2>&1`, {
        timeout: 10000, env: { ...process.env, HOME: HOME_DIR }
      })
    }
    if (prompt) {
      execSync(`${HERMES_BIN} cron update ${req.params.name} --prompt '${prompt.replace(/'/g, "'\\''")}' 2>&1`, {
        timeout: 10000, env: { ...process.env, HOME: HOME_DIR }
      })
    }
    res.json({ ok: true, name: req.params.name })
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message })
  }
})

export default router
