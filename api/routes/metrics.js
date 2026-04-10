// api/routes/metrics.js — LeanCTX metrics endpoint
import { Router } from 'express'
import { exec } from 'child_process'
import { promisify } from 'util'
import { existsSync } from 'fs'
import { join } from 'path'

const execAsync = promisify(exec)
const router = Router()

// GET /api/metrics/lean
router.get('/lean', async (req, res) => {
  try {
    // Check if lean-ctx is available
    const leanPath = join(process.env.HOME || '/home/empir', '.local/bin/lean-ctx')
    if (!existsSync(leanPath)) {
      return res.json({
        totalTokensSaved: 12847,
        compressionRatio: 0.942,
        usdSaved: 0.84,
        topCommands: [
          { cmd: 'git commit', saved: 4821 },
          { cmd: 'npm test', saved: 2341 },
          { cmd: 'cargo build', saved: 3102 }
        ],
        status: 'stub',
        message: 'lean-ctx not installed'
      })
    }

    const { stdout } = await execAsync('~/.local/bin/lean-ctx gain --json 2>/dev/null', { timeout: 3000 })
    const data = JSON.parse(stdout)
    res.json({
      totalTokensSaved: data.tokens_saved || 0,
      compressionRatio: data.compression_ratio || 0,
      usdSaved: data.usd_saved || 0,
      topCommands: (data.top_commands || []).slice(0, 5),
      status: 'live'
    })
  } catch {
    // Return stub on any error (lean-ctx not installed, command failed, etc.)
    res.json({
      totalTokensSaved: 12847,
      compressionRatio: 0.942,
      usdSaved: 0.84,
      topCommands: [
        { cmd: 'git commit', saved: 4821 },
        { cmd: 'npm test', saved: 2341 }
      ],
      status: 'stub'
    })
  }
})

export default router
