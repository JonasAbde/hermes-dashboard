import express from 'express'
import { authMiddleware } from './_lib.js'
import fs from 'fs'
import path from 'path'
import os from 'os'

const router = express.Router()
const LOG_FILE = path.join(os.homedir(), '.hermes/dashboard/api.log')

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

export default router
