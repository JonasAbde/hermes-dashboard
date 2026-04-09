// api/routes/cron.js — Manage Cron jobs and schedules
import { Router } from 'express'
import { join } from 'path'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { HERMES_ROOT, HOME_DIR, execAsync, HERMES_BIN } from './_lib.js'

const router = Router()
const JOBS_FILE = join(HERMES_ROOT, 'cron', 'jobs.json')

// GET /api/cron — main cron endpoint
router.get('/cron', (req, res) => {
  try {
    if (!existsSync(JOBS_FILE)) return res.json({ jobs: [] })
    const data = JSON.parse(readFileSync(JOBS_FILE, 'utf8'))
    res.json({ jobs: data.jobs || [] })
  } catch (err) {
    res.status(500).json({ error: 'Kunne ikke læse jobs' })
  }
})

// GET /api/cron/jobs (alias)
router.get('/cron/jobs', (req, res) => {
  try {
    if (!existsSync(JOBS_FILE)) return res.json({ jobs: [] })
    const data = JSON.parse(readFileSync(JOBS_FILE, 'utf8'))
    res.json({ jobs: data.jobs || [] })
  } catch (err) {
    res.status(500).json({ error: 'Kunne ikke læse jobs' })
  }
})

// POST /api/cron/jobs (Opret)
router.post('/cron/jobs', (req, res) => {
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
router.delete('/cron/jobs/:name', (req, res) => {
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
router.post('/cron/:name/trigger', async (req, res) => {
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

export default router
