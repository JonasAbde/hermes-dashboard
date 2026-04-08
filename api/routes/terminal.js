// api/routes/terminal.js — GET /api/terminal, POST /api/terminal
import { Router } from 'express'
import {
  execAsync,
  HOME_DIR,
} from './_lib.js'

const router = Router()

// GET /api/terminal
router.get('/api/terminal', (req, res) => {
  res.json({ backends: ['cli', 'websocket'], available: ['hermes', 'bash'] })
})

// POST /api/terminal
router.post('/api/terminal', async (req, res) => {
  const { command } = req.body
  if (!command?.trim()) return res.status(400).json({ error: 'command required' })

  const cmd = command.trim()

  const dangerousChars = /[|;&$`(){ }[\]<>\\]/
  if (dangerousChars.test(cmd)) {
    return res.status(403).json({ ok: false, error: 'Forbidden: dangerous characters detected' })
  }

  const dangerousCommands = /\b(rm|mv|cp|chmod|chown|wget|curl|nc|ssh|git|pip|npm|python|node|sudo|eval|bash|sh)\b/
  if (dangerousCommands.test(cmd)) {
    return res.status(403).json({ ok: false, error: 'Forbidden: dangerous command detected' })
  }

  const allowedCommands = {
    'ps': { args: false },
    'df': { args: false },
    'du': { args: false },
    'free': { args: false },
    'uptime': { args: false },
    'whoami': { args: false },
    'hostname': { args: false },
    'uname': { args: false },
    'cat': { args: true, allowedPaths: ['/proc/meminfo', '/proc/loadavg', '/proc/uptime'] },
  }

  const parts = cmd.split(/\s+/)
  const baseCmd = parts[0]
  const args = parts.slice(1)

  if (!allowedCommands[baseCmd]) {
    return res.status(403).json({ ok: false, error: `Forbidden: '${baseCmd}' is not an allowed command` })
  }

  if (baseCmd === 'cat') {
    if (args.length === 0) {
      return res.status(400).json({ ok: false, error: 'cat requires a file path argument' })
    }
    const filePath = args[0]
    if (!allowedCommands.cat.allowedPaths.includes(filePath)) {
      return res.status(403).json({ ok: false, error: `Forbidden: only ${allowedCommands.cat.allowedPaths.join(', ')} are allowed with cat` })
    }
  }

  if (!allowedCommands[baseCmd].args && args.length > 0) {
    return res.status(403).json({ ok: false, error: `Forbidden: '${baseCmd}' does not accept arguments` })
  }

  const safeCmd = baseCmd

  try {
    const { stdout, stderr } = await execAsync(
      safeCmd + (args.length > 0 ? ' ' + args.join(' ') : '') + ' 2>&1',
      { timeout: 30000, env: { ...process.env, HOME: HOME_DIR, TERM: 'dumb', PATH: process.env.PATH } }
    ).catch(e => ({ stdout: '', stderr: e.message }))
    const clean = stdout.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '').trim()
    const cleanErr = stderr.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '').trim()
    res.json({ ok: true, stdout: clean, stderr: cleanErr, exit_code: 0 })
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message })
  }
})

export default router
