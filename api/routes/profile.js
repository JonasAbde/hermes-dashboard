// api/routes/profile.js — GET /api/profile, POST /api/profile
import { Router } from 'express'
import {
  os,
  readDashboardProfile,
  writeDashboardProfile,
} from './_lib.js'

const router = Router()

// GET /api/profile
router.get('/api/profile', (req, res) => {
  try {
    const userInfo = os.userInfo()
    const profileData = readDashboardProfile()
    res.json({
      username: profileData.name || userInfo.username,
      recommendationMode: profileData.recommendation_mode || 'stability-first',
      storage_owner: 'dashboard',
      storage_path: '~/.hermes/dashboard_state/profile.json',
      systemUser: userInfo.username,
      homedir: userInfo.homedir,
      shell: userInfo.shell,
      platform: os.platform(),
      release: os.release()
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// POST /api/profile
router.post('/api/profile', (req, res) => {
  try {
    let profileData = readDashboardProfile()

    const rawName = typeof req.body?.name === 'string' ? req.body.name : null
    const rawMode = typeof req.body?.recommendationMode === 'string' ? req.body.recommendationMode : null
    const allowedModes = new Set(['stability-first', 'cost-first', 'speed-first'])

    if (rawName != null) {
      const name = rawName.trim()
      if (!name) {
        return res.status(400).json({ ok: false, error: 'name is required' })
      }
      if (name.length > 80) {
        return res.status(400).json({ ok: false, error: 'name too long (max 80)' })
      }
      profileData.name = name
    }

    if (rawMode != null) {
      if (!allowedModes.has(rawMode)) {
        return res.status(400).json({ ok: false, error: 'invalid recommendationMode' })
      }
      profileData.recommendation_mode = rawMode
    }

    if (rawName == null && rawMode == null) {
      return res.status(400).json({ ok: false, error: 'nothing to update' })
    }

    profileData.updated_at = new Date().toISOString()
    writeDashboardProfile(profileData)
    res.json({
      ok: true,
      username: profileData.name || os.userInfo().username,
      recommendationMode: profileData.recommendation_mode || 'stability-first',
      storage_owner: 'dashboard',
      storage_path: '~/.hermes/dashboard_state/profile.json',
    })
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message })
  }
})

export default router
