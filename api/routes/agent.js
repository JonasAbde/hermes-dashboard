// api/routes/agent.js — agent fleet status
import { Router } from 'express'
import { readFileSync, writeFileSync, existsSync, join, HERMES_ROOT } from './_lib.js'

const router = Router()

// GET /fleet — return agent fleet status
router.get('/fleet', (req, res) => {
  // Build fleet from known agents
  const agents = [
    {
      id: 'hermes',
      name: 'Hermes',
      role: 'Lead Operator',
      status: 'active',
      rhythm: 'steady',
      metrics: { tps: 0, latency: 0 }
    },
    {
      id: 'rawan',
      name: 'Rawan-AI',
      role: 'Support & Salg',
      status: 'idle',
      rhythm: 'hibernation',
      metrics: { tps: 0, latency: 0 }
    }
  ]

  // Try to read agent status from gateway_state
  try {
    const statePath = join(HERMES_ROOT, 'gateway_state.json')
    if (existsSync(statePath)) {
      const state = JSON.parse(readFileSync(statePath, 'utf8'))
      if (state.agents) {
        state.agents.forEach(a => {
          const existing = agents.find(e => e.id === a.id)
          if (existing) {
            Object.assign(existing, a)
          } else {
            agents.push(a)
          }
        })
      }
    }
  } catch {}

  res.json({ agents })
})

// GET /list — list all agents  
router.get('/list', (req, res) => {
  try {
    const statePath = join(HERMES_ROOT, 'gateway_state.json')
    if (existsSync(statePath)) {
      const state = JSON.parse(readFileSync(statePath, 'utf8'))
      return res.json({ agents: state.agents || [] })
    }
  } catch {}
  res.json({ agents: [] })
})

// POST /start — start an agent
router.post('/start', (req, res) => {
  const { agent_id } = req.body
  if (!agent_id) return res.status(400).json({ ok: false, error: 'agent_id required' })
  // Agent start is handled by the gateway — record intent
  try {
    const statePath = join(HERMES_ROOT, 'gateway_state.json')
    let state = {}
    if (existsSync(statePath)) state = JSON.parse(readFileSync(statePath, 'utf8'))
    if (!state.agents) state.agents = []
    const agent = state.agents.find(a => a.id === agent_id)
    if (agent) agent.status = 'active'
    else state.agents.push({ id: agent_id, name: agent_id, status: 'active', rhythm: 'steady', metrics: { tps: 0, latency: 0 } })
    writeFileSync(statePath, JSON.stringify(state, null, 2))
    res.json({ ok: true, agent_id, status: 'active' })
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message })
  }
})

// POST /stop — stop an agent
router.post('/stop', (req, res) => {
  const { agent_id } = req.body
  if (!agent_id) return res.status(400).json({ ok: false, error: 'agent_id required' })
  try {
    const statePath = join(HERMES_ROOT, 'gateway_state.json')
    let state = {}
    if (existsSync(statePath)) state = JSON.parse(readFileSync(statePath, 'utf8'))
    if (!state.agents) state.agents = []
    const agent = state.agents.find(a => a.id === agent_id)
    if (agent) agent.status = 'idle'
    else state.agents.push({ id: agent_id, name: agent_id, status: 'idle', rhythm: 'hibernation', metrics: { tps: 0, latency: 0 } })
    writeFileSync(statePath, JSON.stringify(state, null, 2))
    res.json({ ok: true, agent_id, status: 'idle' })
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message })
  }
})

// POST /rhythm — set agent rhythm (neural shift)
router.post('/rhythm', (req, res) => {
  const { agent_id, rhythm } = req.body
  if (!agent_id || !rhythm) return res.status(400).json({ ok: false, error: 'agent_id and rhythm required' })
  const valid = ['steady', 'burst', 'focused', 'hibernation', 'creative']
  if (!valid.includes(rhythm)) return res.status(400).json({ ok: false, error: `Invalid rhythm. Must be: ${valid.join(', ')}` })
  try {
    const statePath = join(HERMES_ROOT, 'gateway_state.json')
    let state = {}
    if (existsSync(statePath)) state = JSON.parse(readFileSync(statePath, 'utf8'))
    if (!state.agents) state.agents = []
    const agent = state.agents.find(a => a.id === agent_id)
    if (agent) agent.rhythm = rhythm
    else state.agents.push({ id: agent_id, name: agent_id, status: 'active', rhythm, metrics: { tps: 0, latency: 0 } })
    writeFileSync(statePath, JSON.stringify(state, null, 2))
    res.json({ ok: true, agent_id, rhythm })
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message })
  }
})

export default router

