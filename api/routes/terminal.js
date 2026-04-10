import express from 'express'
import { authMiddleware, HERMES_ROOT } from './_lib.js'
import * as fs from 'fs'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import os from 'os'

const router = express.Router()
const LOG_FILE = join(HERMES_ROOT, 'dashboard', 'api.log')

router.get('/logs', authMiddleware, (req, res) => {
  // Læs de sidste 50 linjer af logfilen
  try {
    if (!fs.existsSync(LOG_FILE)) {
      return res.json({ logs: [] });
    }
    const content = fs.readFileSync(LOG_FILE, 'utf8');
    const lines = content.split('\n').filter(l => l.trim()).slice(-50);
    res.json({ logs: lines.map(l => ({ type: 'agent', text: l, timestamp: new Date() })) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
})

// Eksisterende terminal logik (beholdes)
router.get('/', authMiddleware, (req, res) => {
  res.json({ ok: true, backends: ['local', 'api_server'] })
})

router.post('/', authMiddleware, (req, res) => {
    const { command } = req.body;
    // Her ville den rigtige eksekvering ligge
    res.json({ ok: true, stdout: `Executed: ${command}\nResult: Success` });
})

// GET /history — terminal command history
router.get('/history', authMiddleware, (req, res) => {
  const histPath = join(HERMES_ROOT, 'logs', 'terminal-history.json')
  try {
    if (existsSync(histPath)) {
      const data = JSON.parse(readFileSync(histPath, 'utf8'))
      res.json({ history: data.slice(-100) })
    } else {
      // Fallback: read from bash history
      const bashHist = join(process.env.HOME, '.bash_history')
      if (existsSync(bashHist)) {
        const lines = readFileSync(bashHist, 'utf8').trim().split('\n').slice(-100)
        res.json({ history: lines.map((cmd, i) => ({ id: i, command: cmd, timestamp: null })) })
      } else {
        res.json({ history: [] })
      }
    }
  } catch (e) {
    res.json({ history: [], error: e.message })
  }
})

export default router
