// api/routes/webhooks.js — GitHub Webhook integration
import express from 'express'
import crypto from 'crypto'
import { execSync } from 'child_process'
import { existsSync, appendFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import os from 'os'

const router = express.Router()
const HOME_DIR = os.homedir()
const HERMES_ROOT = join(HOME_DIR, '.hermes')
const LOG_FILE = join(HERMES_ROOT, 'dashboard', 'logs', 'webhooks.log')

// Ensure log directory exists
if (!existsSync(join(HERMES_ROOT, 'dashboard', 'logs'))) {
  mkdirSync(join(HERMES_ROOT, 'dashboard', 'logs'), { recursive: true })
}

function logWebhook(message) {
  const timestamp = new Date().toISOString()
  const logMessage = `[${timestamp}] ${message}\n`
  appendFileSync(LOG_FILE, logMessage)
  console.log(logMessage.trim())
}

function verifySignature(req) {
  const secret = process.env.GITHUB_WEBHOOK_SECRET || 'hermes-sync-secret'
  const signature = req.headers['x-hub-signature-256']
  if (!signature) return false

  const hmac = crypto.createHmac('sha256', secret)
  const digest = 'sha256=' + hmac.update(JSON.stringify(req.body)).digest('hex')
  return signature === digest
}

// GET status
router.get('/github', (req, res) => {
  res.json({ status: 'active', message: 'GitHub webhook endpoint is reachable' })
})

// POST GitHub Hook
router.post('/github', (req, res) => {
  if (!verifySignature(req)) {
    logWebhook('Invalid signature')
    return res.status(401).json({ error: 'Invalid signature' })
  }

  const event = req.headers['x-github-event']
  const payload = req.body

  logWebhook(`Received event: ${event}`)

  if (event === 'push' && (payload.ref === 'refs/heads/main' || payload.ref === 'refs/heads/master')) {
    const repos = [
      join(HERMES_ROOT, 'dashboard'),
      join(HOME_DIR, '.hermes/hermes-workspace-files') // <-- DIN RIGTIGE STI
    ]

    repos.forEach(repo => {
      if (existsSync(repo)) {
        try {
          logWebhook(`Executing git pull in ${repo}`)
          execSync('git pull', { cwd: repo })
          logWebhook(`Successfully pulled ${repo}`)
        } catch (error) {
          logWebhook(`Error pulling ${repo}: ${error.message}`)
        }
      } else {
        logWebhook(`Repo not found: ${repo}`)
      }
    })
  }

  res.status(200).json({ status: 'ok' })
})

export default router
