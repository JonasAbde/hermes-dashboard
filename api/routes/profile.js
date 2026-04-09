// api/routes/profile.js — GET /api/profile, POST /api/profile
import { Router } from 'express'
import {
  os,
  readDashboardProfile,
  writeDashboardProfile,
} from './_lib.js'

const router = Router()

// GET /api/profile
router.get('/profile', (req, res) => {
  try {
    const userInfo = os.userInfo()
    const profileData = readDashboardProfile()
    res.json({
      username: profileData.name || userInfo.username,
      role: profileData.role || '',
      language: profileData.language || '',
      timezone: profileData.timezone || '',
      recommendationMode: profileData.recommendation_mode || 'stability-first',
      proaktivitet: profileData.proaktivitet ?? true,
      telegram_notifications: profileData.telegram_notifications ?? true,
      auto_handle: profileData.auto_handle ?? false,
      updated_at: profileData.updated_at || null,
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
router.post('/profile', (req, res) => {
  try {
    let profileData = readDashboardProfile()

    const rawName = typeof req.body?.name === 'string' ? req.body.name : null
    const rawMode = typeof req.body?.recommendationMode === 'string' ? req.body.recommendationMode : null
    const rawRole = typeof req.body?.role === 'string' ? req.body.role : null
    const rawProaktivitet = typeof req.body?.proaktivitet === 'boolean' ? req.body.proaktivitet : null
    const rawTelegram = typeof req.body?.telegram_notifications === 'boolean' ? req.body.telegram_notifications : null
    const rawAutoHandle = typeof req.body?.auto_handle === 'boolean' ? req.body.auto_handle : null
    const allowedModes = new Set(['stability-first', 'cost-first', 'speed-first'])

    let updated = false

    if (rawName != null) {
      const name = rawName.trim()
      if (!name) return res.status(400).json({ ok: false, error: 'name is required' })
      if (name.length > 80) return res.status(400).json({ ok: false, error: 'name too long (max 80)' })
      profileData.name = name
      updated = true
    }

    if (rawMode != null) {
      if (!allowedModes.has(rawMode)) return res.status(400).json({ ok: false, error: 'invalid recommendationMode' })
      profileData.recommendation_mode = rawMode
      updated = true
    }

    if (rawRole != null) {
      const role = rawRole.trim()
      if (role.length > 80) return res.status(400).json({ ok: false, error: 'role too long (max 80)' })
      profileData.role = role
      updated = true
    }

    if (rawProaktivitet !== null) {
      profileData.proaktivitet = rawProaktivitet
      updated = true
    }

    if (rawTelegram !== null) {
      profileData.telegram_notifications = rawTelegram
      updated = true
    }

    if (rawAutoHandle !== null) {
      profileData.auto_handle = rawAutoHandle
      updated = true
    }

    if (!updated) {
      return res.status(400).json({ ok: false, error: 'nothing to update' })
    }

    profileData.updated_at = new Date().toISOString()
    writeDashboardProfile(profileData)
    res.json({
      ok: true,
      username: profileData.name || os.userInfo().username,
      role: profileData.role || '',
      language: profileData.language || '',
      timezone: profileData.timezone || '',
      recommendationMode: profileData.recommendation_mode || 'stability-first',
      proaktivitet: profileData.proaktivitet,
      telegram_notifications: profileData.telegram_notifications,
      auto_handle: profileData.auto_handle,
      updated_at: profileData.updated_at || null,
      storage_owner: 'dashboard',
      storage_path: '~/.hermes/dashboard_state/profile.json',
    })
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message })
  }
})

export default router
