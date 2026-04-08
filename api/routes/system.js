// api/routes/system.js — GET /api/system/info
import { Router } from 'express'
import {
  existsSync,
  os,
  readFileSync,
  statSync,
  join,
  HERMES,
} from './_lib.js'

const router = Router()

// GET /api/system/info
router.get('/api/system/info', (req, res) => {
  try {
    const uptime = os.uptime()
    const totalMem = os.totalmem()
    const freeMem = os.freemem()
    const usedMem = totalMem - freeMem
    const cpuCount = os.cpus().length

    let gwUptime = null
    try {
      const gwState = JSON.parse(readFileSync(join(HERMES, 'gateway_state.json'), 'utf8'))
      if (gwState.started_at) {
        gwUptime = Math.round((Date.now() - new Date(gwState.started_at).getTime()) / 1000)
      }
    } catch {}

    res.json({
      hostname: os.hostname(),
      platform: os.platform(),
      release: os.release(),
      arch: os.arch(),
      cpu_count: cpuCount,
      total_mem_mb: Math.round(totalMem / 1024 / 1024),
      used_mem_mb: Math.round(usedMem / 1024 / 1024),
      free_mem_mb: Math.round(freeMem / 1024 / 1024),
      mem_pct: Math.round((usedMem / totalMem) * 100),
      uptime_s: uptime,
      uptime_str: `${Math.floor(uptime / 86400)}d ${Math.floor((uptime % 86400) / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`,
      gw_uptime_s: gwUptime,
      hermes_root: HERMES,
      dashboard_version: '1.x',
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

export default router
