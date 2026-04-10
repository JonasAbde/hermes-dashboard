// api/routes/recommendations.js — recommendations, history, dismiss, snooze, done, restore
import { Router } from 'express'
import {
  existsSync,
  readFileSync,
  writeFileSync,
  join,
  pyQuery,
  readRecommendationState,
  writeRecommendationState,
  readDashboardProfile,
  HERMES,
} from './_lib.js'

const router = Router()

// GET /api/recommendations
router.get('/', async (req, res) => {
  const severityRank = { critical: 0, high: 1, medium: 2, low: 3 }
  const areaPriorityByMode = {
    'stability-first': { reliability: 0, operations: 1, memory: 2, usage: 3, cost: 4, status: 5, overview: 6 },
    'cost-first': { cost: 0, reliability: 1, operations: 2, memory: 3, usage: 4, status: 5, overview: 6 },
    'speed-first': { usage: 0, operations: 1, reliability: 2, memory: 3, cost: 4, status: 5, overview: 6 },
  }

  function pushAction(items, item) {
    items.push({
      id: item.id,
      title: item.title,
      reason: item.reason,
      details: Array.isArray(item.details) ? item.details : [],
      severity: item.severity || 'medium',
      action: item.action || null,
      area: item.area || 'overview',
      created_at: new Date().toISOString(),
    })
  }

  try {
    const items = []
    let recommendationMode = 'stability-first'
    const recommendationState = readRecommendationState()
    const nowMs = Date.now()

    try {
      const profile = readDashboardProfile()
      const mode = profile?.recommendation_mode
      if (mode && areaPriorityByMode[mode]) recommendationMode = mode
    } catch {}

    let gw = null
    try {
      gw = JSON.parse(readFileSync(join(HERMES, 'gateway_state.json'), 'utf8'))
    } catch {}

    let gatewayOnline = false
    if (gw?.pid) {
      try {
        process.kill(gw.pid, 0)
        gatewayOnline = true
      } catch {}
    }

    const updatedAt = gw?.updated_at ? new Date(gw.updated_at) : null
    const ageSeconds = updatedAt ? Math.max(0, Math.round((Date.now() - updatedAt.getTime()) / 1000)) : null
    const isStale = ageSeconds != null && ageSeconds > 300

    if (!gatewayOnline) {
      pushAction(items, {
        id: 'gateway-offline',
        title: 'Gateway er offline',
        reason: 'Hermes gateway-processen kører ikke. Kontrolhandlinger og platformsynk kan fejle.',
        details: [
          `Gateway PID: ${gw?.pid ?? 'mangler'}`,
          'Kontrolhandlinger kan fejle mens gateway er offline',
        ],
        severity: 'critical',
        area: 'reliability',
        action: { type: 'api', method: 'POST', target: '/api/control/gateway/restart', label: 'Genstart gateway' },
      })
    } else if (isStale) {
      pushAction(items, {
        id: 'gateway-stale',
        title: 'Gateway-status er forældet',
        reason: `Statusfilen er ${Math.round(ageSeconds / 60)} minutter gammel. Runtime-tilstanden kan være forældet.`,
        details: [
          `Status-alder: ${ageSeconds}s`,
          'Live runtime matcher muligvis ikke dashboard-snapshot',
        ],
        severity: 'high',
        area: 'reliability',
        action: { type: 'navigate', target: '/logs', label: 'Tjek logs' },
      })
    }

    let approvalsData = null
    try {
      approvalsData = await pyQuery('approvals')
    } catch {}
    const pendingApprovals = Array.isArray(approvalsData?.pending) ? approvalsData.pending.length : 0
    if (pendingApprovals > 0) {
      pushAction(items, {
        id: 'pending-approvals',
        title: 'Ventende godkendelser kræver gennemgang',
        reason: `${pendingApprovals} godkendelsesforespørgsel(er) venter og kan blokere workflows.`,
        details: [
          `${pendingApprovals} forespørgsel(er) i ventekø`,
          'Blokerede godkendelser kan stoppe agent-kørsel',
        ],
        severity: pendingApprovals > 5 ? 'high' : 'medium',
        area: 'operations',
        action: { type: 'navigate', target: '/approvals', label: 'Gennemgå godkendelser' },
      })
    }

    let statsData = null
    try {
      statsData = await pyQuery('stats')
    } catch {}

    const sessionsToday = Number(statsData?.sessions_today || 0)
    if (sessionsToday === 0) {
      pushAction(items, {
        id: 'zero-sessions',
        title: 'Ingen sessioner i dag',
        reason: 'Ingen aktive sessionsignaler i dag. Verificér kanalforbindelser eller start en testprompt.',
        details: [
          'sessions_today = 0',
          'Kør en hurtig chatprompt for at verificere trafikstien',
        ],
        severity: 'medium',
        area: 'usage',
        action: { type: 'navigate', target: '/chat', label: 'Åbn chat' },
      })
    }

    const memoryPct = Number(statsData?.memory_pct)
    if (!Number.isNaN(memoryPct) && memoryPct >= 85) {
      pushAction(items, {
        id: 'memory-pressure',
        title: 'Hukommelse nær kapacitetsgrænsen',
        reason: `Hukommelsesforbrug er ${memoryPct}%. Oprydning eller konsolidering kan forbedre relevans.`,
        details: [
          `memory_pct = ${memoryPct}%`,
          'Højt hukommelsestryk kan forringe retrieval-kvalitet',
        ],
        severity: memoryPct >= 95 ? 'high' : 'medium',
        area: 'memory',
        action: { type: 'navigate', target: '/memory', label: 'Gennemgå hukommelse' },
      })
    }

    const budget = Number(statsData?.budget || 0)
    const costMonth = Number(statsData?.cost_month || 0)
    if (budget > 0 && costMonth > budget) {
      pushAction(items, {
        id: 'budget-overrun',
        title: 'Månedsbudget overskredet',
        reason: `Nuværende forbrug er $${costMonth.toFixed(2)} mod budget $${budget.toFixed(2)}.`,
        details: [
          `cost_month = $${costMonth.toFixed(2)}`,
          `budget = $${budget.toFixed(2)}`,
        ],
        severity: 'high',
        area: 'cost',
        action: { type: 'navigate', target: '/settings', label: 'Juster modelpolitik' },
      })
    }

    if (items.length === 0) {
      pushAction(items, {
        id: 'system-healthy',
        title: 'Systemet ser sundt ud',
        reason: 'Ingen hastende handlinger fundet i signaler fra gateway, godkendelser, aktivitet, hukommelse eller budget.',
        details: ['Ingen aktive højprioritets-hændelser registreret'],
        severity: 'low',
        area: 'status',
        action: { type: 'navigate', target: '/sessions', label: 'Gennemgå seneste sessioner' },
      })
    }

    const visibleItems = items.filter((item) => {
      const state = recommendationState.items?.[item.id]
      if (!state?.suppress_until) return true
      const untilMs = Date.parse(state.suppress_until)
      if (!Number.isFinite(untilMs)) return true
      return untilMs <= nowMs
    })

    const areaPriority = areaPriorityByMode[recommendationMode] || areaPriorityByMode['stability-first']
    visibleItems.sort((a, b) => {
      const pa = severityRank[a.severity] ?? 99
      const pb = severityRank[b.severity] ?? 99
      if (pa !== pb) return pa - pb
      const aa = areaPriority[a.area] ?? 99
      const ab = areaPriority[b.area] ?? 99
      if (aa !== ab) return aa - ab
      return a.title.localeCompare(b.title)
    })

    res.json({
      generated_at: new Date().toISOString(),
      recommendation_mode: recommendationMode,
      count: visibleItems.length,
      suppressed_count: Math.max(items.length - visibleItems.length, 0),
      items: visibleItems.slice(0, 6),
      storage_owner: 'dashboard',
      storage_path: '~/.hermes/dashboard_state/recommendations.json',
    })
  } catch (e) {
    res.status(500).json({
      generated_at: new Date().toISOString(),
      recommendation_mode: 'stability-first',
      count: 0,
      items: [],
      storage_owner: 'dashboard',
      storage_path: '~/.hermes/dashboard_state/recommendations.json',
      error: e.message,
    })
  }
})

// GET /api/recommendations/history
router.get('/history', (req, res) => {
  try {
    const state = readRecommendationState()
    const limit = Math.max(1, Math.min(200, Number(req.query.limit || 50)))
    const history = state.history.slice(-limit).reverse()
    const nowMs = Date.now()
    const suppressed = Object.values(state.items || {})
      .filter((entry) => {
        const untilMs = Date.parse(entry?.suppress_until || '')
        return Number.isFinite(untilMs) && untilMs > nowMs
      })
      .sort((a, b) => Date.parse(b?.updated_at || 0) - Date.parse(a?.updated_at || 0))
      .slice(0, 20)
    res.json({
      count: history.length,
      suppressed_count: suppressed.length,
      history,
      suppressed,
      storage_owner: 'dashboard',
      storage_path: '~/.hermes/dashboard_state/recommendations.json',
    })
  } catch (e) {
    res.status(500).json({
      count: 0,
      suppressed_count: 0,
      history: [],
      suppressed: [],
      storage_owner: 'dashboard',
      storage_path: '~/.hermes/dashboard_state/recommendations.json',
      error: e.message,
    })
  }
})

// Helper for setRecommendationState (used by dismiss/snooze/done)
function setRecommendationState(req, res, actionType, fallbackMinutes) {
  try {
    const { id } = req.params
    if (!id) return res.status(400).json({ ok: false, error: 'recommendation id required' })

    const minutesInput = Number(req.body?.minutes)
    const minutes = Number.isFinite(minutesInput) && minutesInput > 0
      ? Math.min(60 * 24 * 30, Math.floor(minutesInput))
      : fallbackMinutes

    const now = new Date()
    const suppressUntil = new Date(now.getTime() + minutes * 60 * 1000).toISOString()
    const state = readRecommendationState()
    const current = state.items?.[id] || {}
    const title = typeof req.body?.title === 'string' ? req.body.title.trim().slice(0, 160) : ''
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim().slice(0, 280) : ''
    const severity = typeof req.body?.severity === 'string' ? req.body.severity.trim().slice(0, 32) : ''
    const actionLabel = typeof req.body?.actionLabel === 'string' ? req.body.actionLabel.trim().slice(0, 80) : ''
    const nextEntry = {
      ...current,
      id,
      title: title || current.title || id,
      reason: reason || current.reason || '',
      severity: severity || current.severity || '',
      action_label: actionLabel || current.action_label || '',
      status: actionType,
      suppress_until: suppressUntil,
      updated_at: now.toISOString(),
    }
    state.items = state.items || {}
    state.items[id] = nextEntry
    state.history = Array.isArray(state.history) ? state.history : []
    state.history.push({
      id,
      title: nextEntry.title,
      reason: nextEntry.reason,
      severity: nextEntry.severity,
      action_label: nextEntry.action_label,
      action: actionType,
      suppress_until: suppressUntil,
      created_at: now.toISOString(),
    })
    writeRecommendationState(state)
    res.json({
      ok: true,
      id,
      title: nextEntry.title,
      status: actionType,
      suppress_until: suppressUntil,
      message: `${actionType} saved`,
    })
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message })
  }
}

// POST /api/recommendations/:id/dismiss
router.post('/:id/dismiss', (req, res) => setRecommendationState(req, res, 'dismissed', 24 * 60))

// POST /api/recommendations/:id/snooze
router.post('/:id/snooze', (req, res) => setRecommendationState(req, res, 'snoozed', 60))

// POST /api/recommendations/:id/done
router.post('/:id/done', (req, res) => setRecommendationState(req, res, 'done', 120))

// POST /api/recommendations/:id/restore
router.post('/:id/restore', (req, res) => {
  try {
    const { id } = req.params
    if (!id) return res.status(400).json({ ok: false, error: 'recommendation id required' })

    const now = new Date().toISOString()
    const state = readRecommendationState()
    const existingEntry = state.items?.[id] || null
    const existed = Boolean(existingEntry)
    if (state.items && state.items[id]) {
      delete state.items[id]
    }
    state.history = Array.isArray(state.history) ? state.history : []
    state.history.push({
      id,
      title: existingEntry?.title || id,
      reason: existingEntry?.reason || '',
      severity: existingEntry?.severity || '',
      action_label: existingEntry?.action_label || '',
      action: 'restored',
      created_at: now,
    })
    writeRecommendationState(state)
    res.json({
      ok: true,
      id,
      title: existingEntry?.title || id,
      restored: existed,
      message: existed ? 'recommendation restored' : 'no suppressed recommendation found',
    })
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message })
  }
})

export default router
