// api/routes/github.js — GitHub integration endpoints
import { Router } from 'express'
import { execSync } from 'child_process'
import { authMiddleware } from './_lib.js'

const router = Router()

function runGit(cmd) {
  try {
    return JSON.parse(execSync(cmd, { encoding: 'utf8', timeout: 10000 }))
  } catch (e) {
    return null
  }
}

// GET / — GitHub status and repos
router.get('/', authMiddleware, (req, res) => {
  // Check if gh CLI is available
  let ghAvailable = false
  try {
    execSync('which gh', { encoding: 'utf8', timeout: 3000 })
    ghAvailable = true
  } catch {}

  // Get git user
  let gitUser = null
  try {
    gitUser = execSync('git config user.name', { encoding: 'utf8' }).trim()
  } catch {}

  // List known repos
  let repos = []
  try {
    const dashboardDir = process.env.HOME + '/.hermes/dashboard'
    const remotes = execSync('git -C ' + dashboardDir + ' remote -v', { encoding: 'utf8' })
    const originMatch = remotes.match(/origin\s+(\S+)/)
    if (originMatch) {
      repos.push({ name: 'hermes-dashboard', path: dashboardDir, remote: originMatch[1] })
    }
  } catch {}

  // Recent activity
  let recentCommits = []
  try {
    const dashboardDir = process.env.HOME + '/.hermes/dashboard'
    const log = execSync(
      `git -C ${dashboardDir} log --oneline -5 --format='{"hash":"%h","msg":"%s","date":"%cr","author":"%an"}'`,
      { encoding: 'utf8', timeout: 5000 }
    )
    recentCommits = log.trim().split('\n').filter(Boolean).map(l => {
      try { return JSON.parse(l) } catch { return { hash: l.substring(0, 7), msg: l } }
    })
  } catch {}

  res.json({
    available: ghAvailable,
    user: gitUser,
    repos,
    recentCommits
  })
})

// GET /repos — list repositories
router.get('/repos', authMiddleware, (req, res) => {
  if (!runGit('which gh')) {
    return res.json({ repos: [], error: 'gh CLI not installed' })
  }
  const repos = runGit('gh repo list --limit 20 --json name,visibility,updatedAt,url')
  res.json({ repos: repos || [] })
})

export default router
