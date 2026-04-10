// api/routes/chat.js — POST /api/chat
import { Router } from 'express'
import {
  execAsync,
  join,
  HERMES_ROOT,
  HOME_DIR,
  existsSync,
} from './_lib.js'

const router = Router()

// POST /api/chat
router.post('/', async (req, res) => {
  const { message } = req.body
  if (!message?.trim()) return res.status(400).json({ error: 'message required' })

  const CHAT_SCRIPT = join(new URL('.', import.meta.url).pathname, '../hermes_chat.py')
  // Detect hermes-agent Python: uv-managed venv (current) or legacy
  const UV_HERMES_PYTHON = '/home/empir/.local/share/uv/tools/hermes-agent/bin/python'
  const LEGACY_VENV_PYTHON = join(HERMES_ROOT, 'hermes-agent/venv/bin/python3')
  const PYTHON_VENV = existsSync(UV_HERMES_PYTHON) ? UV_HERMES_PYTHON : LEGACY_VENV_PYTHON

  try {
    const { stdout, stderr } = await execAsync(
      `"${PYTHON_VENV}" "${CHAT_SCRIPT}" ${JSON.stringify(message.trim())}`,
      { timeout: 90000, env: { ...process.env, HOME: HOME_DIR } }
    )
    let data
    try {
      data = JSON.parse(stdout.trim())
    } catch {
      const clean = stdout.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '').trim()
      return res.json({ ok: true, response: clean || stdout.trim().slice(0, 500) })
    }
    if (data.error && !data.response) {
      return res.status(500).json(data)
    }
    res.json(data)
  } catch (e) {
    try {
      const { stdout } = await execAsync(
        `timeout 60 "${PYTHON_VENV}" "${CHAT_SCRIPT}" ${JSON.stringify(message.trim())} 2>&1 || echo "FALLBACK_ERROR: $?"`,
        { timeout: 70000, env: { ...process.env, HOME: HOME_DIR } }
      )
      const clean = stdout.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '').trim()
      const lines = clean.split('\n').filter(l =>
        l && !l.includes('MCP Server') && !l.includes('Warning:') &&
        !l.includes('Failed to parse') && !l.includes('Knowledge Graph') &&
        !l.includes('pdf-server') && !l.includes('Sequential Thinking') &&
        !l.includes('Puppeteer') && !l.startsWith('Traceback')
      )
      res.json({ ok: true, response: lines.join('\n') || clean })
    } catch (e2) {
      res.status(500).json({ ok: false, error: e2.message || e.message })
    }
  }
})

export default router
