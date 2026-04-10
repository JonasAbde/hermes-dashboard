// api/routes/webhooks.js — GitHub Webhook integration
import express from 'express'
import crypto from 'crypto'
import { execSync } from 'child_process'
import { existsSync, appendFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { HERMES_ROOT, HOME_DIR } from './_lib.js'

const router = express.Router()
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

function verifySignature(payload, signature) {
  const secret = process.env.GITHUB_WEBHOOK_SECRET
  if (!secret) {
    logWebhook('WARNING: GITHUB_WEBHOOK_SECRET not set — skipping signature verification')
    return true // Allow in dev mode when no secret configured
  }
  if (!signature) return false

  const hmac = crypto.createHmac('sha256', secret)
  const digest = 'sha256=' + hmac.update(payload).digest('hex')
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest))
  } catch {
    return false
  }
}

// Raw body capture middleware — ONLY for webhook routes
router.use('/github', express.raw({ type: '*/*', verify: (req, _res, buf) => {
  req.rawBody = buf.toString('utf8')
} }))

// GET status
router.get('/github', (req, res) => {
  const hasSecret = !!process.env.GITHUB_WEBHOOK_SECRET
  res.json({ status: 'active', signature_verification: hasSecret, message: 'GitHub webhook endpoint is reachable' })
})

// POST GitHub Hook
router.post('/github', (req, res) => {
  // Parse body from rawBody if JSON middleware didn't run
  let payload = req.body
  if (!payload || typeof payload === 'string') {
    try { payload = JSON.parse(req.rawBody) } catch { return res.status(400).json({ error: 'Invalid JSON' }) }
  }

  if (!verifySignature(req.rawBody, req.headers['x-hub-signature-256'])) {
    logWebhook('Invalid signature')
    return res.status(401).json({ error: 'Invalid signature' })
  }

  const event = req.headers['x-github-event']
  logWebhook(`Received event: ${event}`)

  if (event === 'push' && (payload.ref === 'refs/heads/main' || payload.ref === 'refs/heads/master')) {
    const repos = [
      join(HERMES_ROOT, 'dashboard'),
      join(HERMES_ROOT, 'workspace')
    ]

    repos.forEach(repo => {
      if (existsSync(join(repo, '.git'))) {
        try {
          logWebhook(`Executing git pull in ${repo}`)
          execSync('git pull', { cwd: repo })
          logWebhook(`Successfully pulled ${repo}`)
        } catch (error) {
          logWebhook(`Error pulling ${repo}: ${error.message}`)
        }
      }
    })
  }

  res.status(200).json({ status: 'ok' })
})

export default router
