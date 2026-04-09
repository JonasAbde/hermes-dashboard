import express from 'express'
import { authMiddleware } from './_lib.js'
const router = express.Router()

// Fleet status med real-time simulering af metrics
router.get('/fleet', authMiddleware, (req, res) => {
  // Simulerede live metrics (TPS = Tokens Per Second)
  const mondayTPS = Math.floor(Math.random() * 45) + 5;
  const rawanTPS = Math.floor(Math.random() * 10);
  
  res.json({
    agents: [
      { 
        id: 'monday', 
        name: 'Monday', 
        role: 'Lead Operator', 
        status: 'active', 
        rhythm: mondayTPS > 30 ? 'high_burst' : 'steady',
        metrics: {
          tps: mondayTPS,
          latency: Math.floor(Math.random() * 200) + 50,
          uptime: '42h'
        }
      },
      { 
        id: 'rawan', 
        name: 'Rawan-AI', 
        role: 'Support & Sales', 
        status: 'idle', 
        rhythm: 'hibernation',
        metrics: {
          tps: rawanTPS,
          latency: 0,
          uptime: '112h'
        }
      }
    ]
  })
})

export default router
