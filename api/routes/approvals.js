// api/routes/approvals.js — approvals listing, approve, deny
import { Router } from 'express'
import {
  Database,
  DB_PATH,
  execAsync,
  HERMES_BIN,
  HOME_DIR,
  pyQuery,
} from './_lib.js'

const router = Router()

// GET /api/approvals
router.get('/', async (req, res) => {
  try {
    res.json(await pyQuery('approvals'))
  } catch (e) {
    res.json({ pending: [] })
  }
})

// POST /api/approvals/:id/approve
router.post('/:id/approve', async (req, res) => {
  const { id } = req.params
  try {
    const { stdout } = await execAsync(
      `${HERMES_BIN} approve ${id} 2>&1`,
      { timeout: 15000, env: { ...process.env, HOME: HOME_DIR } }
    ).catch(() => ({ stdout: '' }))

    try {
      const d = new Database(DB_PATH, { fileMustExist: true })
      d.prepare(`UPDATE approvals SET status = 'approved', resolved_at = unixepoch() WHERE id = ?`).run(id)
      d.close()
    } catch {}

    res.json({ ok: true, output: stdout })
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message })
  }
})

// POST /api/approvals/:id/deny
router.post('/:id/deny', async (req, res) => {
  const { id } = req.params
  try {
    await execAsync(
      `${HERMES_BIN} deny ${id} 2>&1`,
      { timeout: 15000, env: { ...process.env, HOME: HOME_DIR } }
    ).catch(() => {})

    try {
      const d = new Database(DB_PATH, { fileMustExist: true })
      d.prepare(`UPDATE approvals SET status = 'denied', resolved_at = unixepoch() WHERE id = ?`).run(id)
      d.close()
    } catch {}

    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message })
  }
})

export default router
