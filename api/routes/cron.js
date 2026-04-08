// api/routes/cron.js — cron jobs: list, create, update, delete, toggle, output, trigger, stats
import { Router } from 'express'
import {
  execAsync,
  existsSync,
  readFileSync,
  readdirSync,
  writeFileSync,
  join,
  parseYaml,
  HERMES,
  HERMES_BIN,
  HOME_DIR,
} from './_lib.js'

const router = Router()

// GET /api/cron
router.get('/api/cron', (req, res) => {
  try {
    const jobsFile = join(HERMES, 'cron', 'jobs.json')
    let rawJobs = []

    if (existsSync(jobsFile)) {
      try {
        const data = JSON.parse(readFileSync(jobsFile, 'utf8'))
        rawJobs = data.jobs || []
      } catch (e) {
        console.error('Failed to read jobs.json:', e)
      }
    }

    if (rawJobs.length === 0) {
      try {
        const cfg = parseYaml(readFileSync(join(HERMES, 'config.yaml'), 'utf8'))
        const configJobs = cfg.cron ?? cfg.crons ?? []
        rawJobs = Array.isArray(configJobs) ? configJobs : Object.entries(configJobs).map(([k,v]) => ({ name: k, ...v }))
      } catch (e) {
        console.error('Failed to read config.yaml cron:', e)
      }
    }

    const jobs = rawJobs
      .map(j => ({
        id:        j.id ?? j.name ?? 'unnamed',
        name:      j.name ?? j.id ?? 'unnamed',
        schedule:  j.schedule ?? j.cron ?? '—',
        enabled:   j.enabled !== false,
        paused:    j.paused === true,
        last_run:  j.last_run_at ?? j.last_run ?? null,
        next_run:  j.next_run_at ?? j.next_run ?? null,
        repeat:    j.repeat ?? null,
        repeat_count: j.repeat_count ?? 0,
        prompt:    j.prompt ?? null,
        deliver:   j.deliver ?? null,
      }))
      .filter(j => j.schedule && j.schedule !== '—')

    res.json({ jobs })
  } catch (e) {
    console.error('Error in /api/cron:', e)
    res.json({ jobs: [] })
  }
})

// GET /api/cron/stats
router.get('/api/cron/stats', (req, res) => {
  try {
    const jobsFile = join(HERMES, 'cron', 'jobs.json')
    const outputDir = join(HERMES, 'cron', 'output')

    let jobs = []
    try {
      if (existsSync(jobsFile)) {
        const data = JSON.parse(readFileSync(jobsFile, 'utf8'))
        jobs = data.jobs || []
      }
    } catch {}

    let failedToday = 0
    let outputsToday = 0
    if (existsSync(outputDir)) {
      const today = new Date().toISOString().slice(0, 10)
      const files = readdirSync(outputDir)
      outputsToday = files.length
      failedToday = files.filter(f => {
        try {
          const content = readFileSync(join(outputDir, f), 'utf8')
          const parsed = JSON.parse(content)
          const ts = f.split('_').pop()?.replace('.json', '') || ''
          return ts.startsWith(today) && (parsed.error || parsed.ok === false)
        } catch { return false }
      }).length
    }

    const activeJobs = jobs.filter(j => j.enabled !== false)
    const nextScheduled = activeJobs
      .filter(j => j.next_run)
      .sort((a, b) => (a.next_run || Infinity) - (b.next_run || Infinity))[0]

    res.json({
      total: jobs.length,
      active: activeJobs.length,
      inactive: jobs.length - activeJobs.length,
      failed_today: failedToday,
      outputs_today: outputsToday,
      next_scheduled: nextScheduled || null,
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// POST /api/cron/jobs
router.post('/api/cron/jobs', (req, res) => {
  try {
    const { name, schedule, prompt, deliver, enabled, skills, repeat, model } = req.body || {}
    if (!name || !schedule || !prompt) {
      return res.status(400).json({ error: 'name, schedule and prompt are required' })
    }

    const jobsFile = join(HERMES, 'cron', 'jobs.json')
    let jobs = []
    try {
      if (existsSync(jobsFile)) {
        const data = JSON.parse(readFileSync(jobsFile, 'utf8'))
        jobs = data.jobs || []
      }
    } catch {}

    if (jobs.find(j => j.name === name)) {
      return res.status(409).json({ error: `Job '${name}' already exists` })
    }

    const newJob = {
      id: name.replace(/\s+/g, '-').toLowerCase(),
      name,
      schedule,
      prompt,
      deliver: deliver || 'local',
      enabled: enabled !== false,
      skills: skills || [],
      repeat: repeat || null,
      model: model || null,
      created_at: Date.now(),
      last_run: null,
      next_run: null,
    }

    jobs.push(newJob)
    writeFileSync(jobsFile, JSON.stringify({ jobs, updated_at: new Date().toISOString() }, null, 2), 'utf8')
    res.json({ ok: true, job: newJob })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// PUT /api/cron/:name
router.put('/api/cron/:name', (req, res) => {
  try {
    const { name } = req.params
    const updates = req.body || {}

    const jobsFile = join(HERMES, 'cron', 'jobs.json')
    let jobs = []
    try {
      if (existsSync(jobsFile)) {
        const data = JSON.parse(readFileSync(jobsFile, 'utf8'))
        jobs = data.jobs || []
      }
    } catch {}

    const idx = jobs.findIndex(j => j.name === name)
    if (idx < 0) return res.status(404).json({ error: `Job '${name}' not found` })

    jobs[idx] = { ...jobs[idx], ...updates, updated_at: Date.now() }
    writeFileSync(jobsFile, JSON.stringify({ jobs, updated_at: new Date().toISOString() }, null, 2), 'utf8')
    res.json({ ok: true, job: jobs[idx] })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// DELETE /api/cron/:name
router.delete('/api/cron/:name', (req, res) => {
  try {
    const { name } = req.params
    const jobsFile = join(HERMES, 'cron', 'jobs.json')
    let jobs = []
    try {
      if (existsSync(jobsFile)) {
        const data = JSON.parse(readFileSync(jobsFile, 'utf8'))
        jobs = data.jobs || []
      }
    } catch {}

    const idx = jobs.findIndex(j => j.name === name)
    if (idx < 0) return res.status(404).json({ error: `Job '${name}' not found` })

    jobs.splice(idx, 1)
    writeFileSync(jobsFile, JSON.stringify({ jobs, updated_at: new Date().toISOString() }, null, 2), 'utf8')
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// PATCH /api/cron/:name/enable
router.patch('/api/cron/:name/enable', (req, res) => {
  try {
    const { name } = req.params
    const { enabled } = req.body || {}

    const jobsFile = join(HERMES, 'cron', 'jobs.json')
    let jobs = []
    try {
      if (existsSync(jobsFile)) {
        const data = JSON.parse(readFileSync(jobsFile, 'utf8'))
        jobs = data.jobs || []
      }
    } catch {}

    const idx = jobs.findIndex(j => j.name === name)
    if (idx < 0) return res.status(404).json({ error: `Job '${name}' not found` })

    jobs[idx].enabled = enabled
    jobs[idx].updated_at = Date.now()
    writeFileSync(jobsFile, JSON.stringify({ jobs, updated_at: new Date().toISOString() }, null, 2), 'utf8')
    res.json({ ok: true, job: jobs[idx] })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// GET /api/cron/:name/output
router.get('/api/cron/:name/output', (req, res) => {
  try {
    const { name } = req.params
    const limit = parseInt(req.query.limit) || 5
    const outputDir = join(HERMES, 'cron', 'output')

    if (!existsSync(outputDir)) return res.json({ outputs: [] })

    const prefix = name.replace(/[^a-zA-Z0-9_-]/g, '_')
    const files = readdirSync(outputDir)
      .filter(f => f.startsWith(prefix + '_'))
      .sort()
      .reverse()
      .slice(0, limit)

    const outputs = files.map(f => {
      try {
        const content = readFileSync(join(outputDir, f), 'utf8')
        const parsed = JSON.parse(content)
        const ts = f.replace(prefix + '_', '').replace('.json', '')
        return { filename: f, timestamp: ts, data: parsed }
      } catch {
        return { filename: f, timestamp: f, data: null }
      }
    })

    res.json({ outputs })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// POST /api/cron/:name/trigger
router.post('/api/cron/:name/trigger', async (req, res) => {
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
