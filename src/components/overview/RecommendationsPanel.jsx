import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Clock3,
  History,
  RotateCw,
  Sparkles,
  Undo2,
} from 'lucide-react'
import { Chip } from '../ui/Chip'
import { ActionGuardDialog } from '../ui/ActionGuardDialog'
import { getActionGuardrail } from '../../utils/actionGuardrails'

const severityVariant = {
  critical: 'offline',
  high: 'warn',
  medium: 'model',
  low: 'online',
}

const actionTone = {
  dismissed: 'text-red border-red/20 bg-red/10',
  snoozed: 'text-amber border-amber/20 bg-amber/10',
  done: 'text-green border-green/20 bg-green/10',
  restored: 'text-blue border-blue/20 bg-blue/10',
}

function severityLabel(severity) {
  if (!severity) return 'Medium'
  return severity.charAt(0).toUpperCase() + severity.slice(1)
}

function modeLabel(mode) {
  if (mode === 'cost-first') return 'Cost First'
  if (mode === 'speed-first') return 'Speed First'
  return 'Stability First'
}

function shortTime(ts) {
  if (!ts) return 'unknown time'
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return 'unknown time'
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function formatExpiry(ts) {
  if (!ts) return 'until unknown time'
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return 'until unknown time'
  return `until ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
}

function recommendationName(entry) {
  return entry?.title || entry?.id || 'Recommendation'
}

function actionLabel(action) {
  if (action === 'dismissed') return 'Dismissed'
  if (action === 'snoozed') return 'Snoozed'
  if (action === 'done') return 'Marked done'
  if (action === 'restored') return 'Restored'
  return action || 'Updated'
}

function buildSuppressedEntry(item, actionType, suppressUntil) {
  return {
    id: item.id,
    title: item.title,
    reason: item.reason,
    severity: item.severity,
    action_label: item.action?.label || '',
    status: actionType,
    suppress_until: suppressUntil,
    updated_at: new Date().toISOString(),
  }
}

function buildHistoryEntry(item, actionType, suppressUntil) {
  return {
    id: item.id,
    title: item.title,
    reason: item.reason,
    severity: item.severity,
    action_label: item.action?.label || '',
    action: actionType,
    suppress_until: suppressUntil,
    created_at: new Date().toISOString(),
  }
}

function SummaryPill({ label, value }) {
  return (
    <div className="rounded-md border border-border bg-surface2/40 px-2.5 py-1.5 min-w-[88px]">
      <div className="text-[9px] uppercase tracking-wider text-t3">{label}</div>
      <div className="text-[11px] font-semibold text-t1 mt-0.5">{value}</div>
    </div>
  )
}

export function RecommendationsPanel({ data, loading, onRefresh }) {
  const navigate = useNavigate()
  const [busyKey, setBusyKey] = useState(null)
  const [feedback, setFeedback] = useState(null)
  const [expandedIds, setExpandedIds] = useState({})
  const [exitingIds, setExitingIds] = useState({})
  const [hiddenIds, setHiddenIds] = useState({})
  const [historyOpen, setHistoryOpen] = useState(true)
  const [historyData, setHistoryData] = useState({ history: [], suppressed: [], suppressed_count: 0 })
  const [guard, setGuard] = useState(null)

  const items = useMemo(
    () => (Array.isArray(data?.items) ? data.items.filter((item) => !hiddenIds[item.id]) : []),
    [data?.items, hiddenIds]
  )

  const loadHistory = async () => {
    try {
      const res = await fetch('/api/recommendations/history?limit=8')
      if (!res.ok) return
      const body = await res.json().catch(() => ({}))
      setHistoryData({
        history: Array.isArray(body?.history) ? body.history : [],
        suppressed: Array.isArray(body?.suppressed) ? body.suppressed : [],
        suppressed_count: Number(body?.suppressed_count || 0),
      })
    } catch {}
  }

  const reconcileWithServer = async () => {
    await loadHistory()
    try {
      await onRefresh?.()
    } finally {
      // Let server state become the source of truth after optimistic UI transitions.
      setHiddenIds({})
    }
  }

  useEffect(() => {
    loadHistory()
  }, [])

  useEffect(() => {
    loadHistory()
  }, [data?.generated_at])

  const toggleExpanded = (id) => {
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const hideCardWithAnimation = (id) => {
    setExitingIds((prev) => ({ ...prev, [id]: true }))
    setTimeout(() => {
      setHiddenIds((prev) => ({ ...prev, [id]: true }))
      setExitingIds((prev) => {
        const next = { ...prev }
        delete next[id]
        return next
      })
    }, 220)
  }

  const applyOptimisticSuppression = (item, actionType, suppressUntil) => {
    const nextSuppressed = buildSuppressedEntry(item, actionType, suppressUntil)
    const nextHistory = buildHistoryEntry(item, actionType, suppressUntil)
    setHistoryData((prev) => ({
      suppressed_count: Math.max((prev.suppressed_count || 0) + 1, 1),
      suppressed: [nextSuppressed, ...(prev.suppressed || []).filter((entry) => entry.id !== item.id)].slice(0, 20),
      history: [nextHistory, ...(prev.history || [])].slice(0, 8),
    }))
  }

  const updateRecState = async (item, kind, minutes, options = {}) => {
    if (!item?.id) return
    if (!options.allowWhileBusy && busyKey) return
    const optimisticUntil = new Date(Date.now() + (minutes || 0) * 60 * 1000).toISOString()
    setBusyKey(`${item.id}:${kind}`)
    setFeedback(null)
    try {
      const res = await fetch(`/api/recommendations/${item.id}/${kind}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          minutes,
          title: item.title,
          reason: item.reason,
          severity: item.severity,
          actionLabel: item.action?.label || '',
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (res.ok) {
        const nextUntil = body.suppress_until || optimisticUntil
        if (kind === 'snooze' || kind === 'dismiss' || kind === 'done') {
          hideCardWithAnimation(item.id)
          applyOptimisticSuppression(item, body.status || kind, nextUntil)
        }
        setFeedback({
          ok: true,
          message: `${item.title} · ${actionLabel(body.status || kind)} ${formatExpiry(nextUntil)}`,
        })
        await reconcileWithServer()
      } else {
        setFeedback({ ok: false, message: body.error || `Failed (${res.status})` })
      }
    } catch (e) {
      setFeedback({ ok: false, message: e.message || 'Request failed' })
    } finally {
      setBusyKey(null)
    }
  }

  const restoreRecommendation = async (entry) => {
    const id = entry?.id
    if (!id || busyKey) return
    setBusyKey(`${id}:restore`)
    setFeedback(null)
    try {
      const res = await fetch(`/api/recommendations/${id}/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const body = await res.json().catch(() => ({}))
      if (res.ok) {
        setHiddenIds((prev) => {
          if (!prev[id]) return prev
          const next = { ...prev }
          delete next[id]
          return next
        })
        setHistoryData((prev) => ({
          suppressed_count: Math.max((prev.suppressed_count || 1) - 1, 0),
          suppressed: (prev.suppressed || []).filter((item) => item.id !== id),
          history: [
            {
              id,
              title: body.title || recommendationName(entry),
              action: 'restored',
              created_at: new Date().toISOString(),
            },
            ...(prev.history || []),
          ].slice(0, 8),
        }))
        setFeedback({ ok: true, message: `${body.title || recommendationName(entry)} restored to active evaluation` })
        await reconcileWithServer()
      } else {
        setFeedback({ ok: false, message: body.error || `Failed (${res.status})` })
      }
    } catch (e) {
      setFeedback({ ok: false, message: e.message || 'Request failed' })
    } finally {
      setBusyKey(null)
    }
  }

  const executeApiAction = async (item) => {
    setBusyKey(`${item.id}:action`)
    try {
      const res = await fetch(item.action.target, {
        method: item.action.method || 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const body = await res.json().catch(() => ({}))
      if (res.ok) {
        setFeedback({
          ok: true,
          message: `${item.title} · ${body.message || body.output || `${item.action.label || 'Action'} completed`}`,
        })
        await updateRecState(item, 'done', 120, { allowWhileBusy: true })
      } else {
        setFeedback({
          ok: false,
          message: body.error || `Action failed (${res.status})`,
        })
      }
    } catch (e) {
      setFeedback({ ok: false, message: e.message || 'Request failed' })
    } finally {
      setBusyKey(null)
    }
  }

  const runAction = async (item) => {
    if (!item?.action || busyKey) return
    setFeedback(null)

    if (item.action.type === 'navigate' && item.action.target) {
      setFeedback({ ok: true, message: `${item.title} · opened ${item.action.label}` })
      navigate(item.action.target)
      await updateRecState(item, 'done', 90, { allowWhileBusy: true })
      return
    }

    if (item.action.type === 'api' && item.action.target) {
      const nextGuard = getActionGuardrail({
        type: 'api',
        target: item.action.target,
        method: item.action.method || 'POST',
        label: item.action.label,
      })
      if (nextGuard) {
        setGuard({ ...nextGuard, item })
        return
      }
      await executeApiAction(item)
    }
  }

  const hiddenCount = historyData?.suppressed_count || data?.suppressed_count || 0

  return (
    <div className="bg-surface border border-border rounded-lg overflow-hidden card-amber">
      <div className="px-4 py-3 border-b border-border">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2">
            <AlertTriangle size={13} className="text-amber mt-0.5" />
            <div>
              <div className="text-xs font-bold text-t2">Next Best Actions</div>
              <div className="text-[9px] font-mono text-t3/80 mt-0.5">
                Dashboard-owned guidance, not Hermes core memory
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="font-mono text-[10px] text-t3">{modeLabel(data?.recommendation_mode)}</div>
            <div className="font-mono text-[9px] text-t3/70 mt-0.5">
              {items.length} active · {hiddenCount} hidden
            </div>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <SummaryPill label="Active" value={`${items.length}`} />
          <SummaryPill label="Hidden" value={`${hiddenCount}`} />
          <SummaryPill label="Recent" value={`${historyData.history?.length || 0}`} />
        </div>
      </div>

      {feedback && (
        <div className={`mx-4 mt-3 px-3 py-2 rounded-md border text-[11px] font-mono ${feedback.ok ? 'text-green border-green/20 bg-green/10' : 'text-red border-red/20 bg-red/10'}`}>
          {feedback.message}
        </div>
      )}

      <div className="p-3 space-y-3">
        {loading && !items.length ? (
          <div className="text-sm text-t3 py-4 text-center">Analyzing signals...</div>
        ) : items.length > 0 ? (
          items.map((item) => {
            const variant = severityVariant[item.severity] || 'model'
            const isBusy = Boolean(busyKey && busyKey.startsWith(`${item.id}:`))
            const isExpanded = Boolean(expandedIds[item.id])
            const hasDetails = Array.isArray(item.details) && item.details.length > 0
            return (
              <div
                key={item.id}
                className={`rounded-md border border-border bg-surface2/40 px-3 py-3 transition-all duration-300 hover:-translate-y-0.5 hover:border-white/20 hover:bg-surface2/55 ${
                  exitingIds[item.id] ? 'opacity-0 -translate-y-1 scale-[0.98]' : 'opacity-100 translate-y-0 scale-100'
                } ${isBusy ? 'ring-1 ring-white/10' : ''}`}
                style={{ transitionTimingFunction: 'cubic-bezier(0.2, 0.8, 0.2, 1)' }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-t1">{item.title}</div>
                    <div className="text-[11px] text-t2 mt-1 leading-relaxed">{item.reason}</div>
                    {hasDetails && (
                      <div className="mt-2">
                        <button
                          type="button"
                          onClick={() => toggleExpanded(item.id)}
                          className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-t3 hover:text-t1 transition-colors"
                        >
                          <Sparkles size={11} />
                          {isExpanded ? 'Hide signal details' : 'Why this recommendation?'}
                          <ChevronDown
                            size={11}
                            className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                          />
                        </button>
                      </div>
                    )}
                    {hasDetails && (
                      <div
                        className={`grid transition-all duration-300 ${isExpanded ? 'grid-rows-[1fr] opacity-100 mt-2' : 'grid-rows-[0fr] opacity-0'}`}
                      >
                        <div className="overflow-hidden">
                          <div className="rounded-md border border-border bg-surface/70 px-3 py-2.5 space-y-1.5">
                            <div className="text-[9px] uppercase tracking-wider text-t3">Signal reasoning</div>
                            {item.details.map((detail, idx) => (
                              <div key={`${item.id}-d-${idx}`} className="text-[10px] text-t2 font-mono leading-relaxed">
                                • {detail}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Chip variant={variant}>{severityLabel(item.severity)}</Chip>
                    {isBusy && (
                      <div className="inline-flex items-center gap-1 text-[9px] font-mono text-t3">
                        <RotateCw size={10} className="animate-spin" />
                        updating
                      </div>
                    )}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {item.action?.label && (
                    <button
                      onClick={() => runAction(item)}
                      disabled={isBusy}
                      className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1.5 rounded-md border border-border text-t2 hover:text-t1 hover:bg-surface transition-colors disabled:opacity-60 disabled:cursor-wait"
                      title={getActionGuardrail({ type: 'api', target: item.action.target, method: item.action.method || 'POST', label: item.action.label }) ? 'Confirmation required before this action runs' : item.action.label}
                    >
                      {isBusy ? <RotateCw size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                      {item.action.label}
                      {!isBusy && <ArrowRight size={12} />}
                    </button>
                  )}
                  <button
                    onClick={() => updateRecState(item, 'snooze', 60)}
                    disabled={isBusy}
                    className="text-[10px] font-semibold px-2 py-1.5 rounded-md border border-border text-t3 hover:text-t1 hover:bg-surface transition-colors disabled:opacity-60 disabled:cursor-wait"
                    title="Hide this recommendation for one hour"
                  >
                    Snooze 1h
                  </button>
                  <button
                    onClick={() => updateRecState(item, 'dismiss', 24 * 60)}
                    disabled={isBusy}
                    className="text-[10px] font-semibold px-2 py-1.5 rounded-md border border-border text-t3 hover:text-t1 hover:bg-surface transition-colors disabled:opacity-60 disabled:cursor-wait"
                    title="Hide this recommendation for 24 hours"
                  >
                    Dismiss 24h
                  </button>
                  <button
                    onClick={() => updateRecState(item, 'done', 120)}
                    disabled={isBusy}
                    className="text-[10px] font-semibold px-2 py-1.5 rounded-md border border-border text-t3 hover:text-t1 hover:bg-surface transition-colors disabled:opacity-60 disabled:cursor-wait"
                    title="Mark handled and hide temporarily"
                  >
                    Mark done
                  </button>
                </div>
              </div>
            )
          })
        ) : (
          <div className="rounded-md border border-border bg-surface2/30 px-4 py-4 text-center">
            <div className="text-sm font-semibold text-t1">No active actions right now</div>
            <div className="text-[11px] text-t2 mt-1 leading-relaxed">
              The current signal set looks quiet. Hidden recommendations and recent actions remain below so you can restore or review them.
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-border px-3 py-2.5 bg-surface2/20">
        <button
          type="button"
          onClick={() => setHistoryOpen((v) => !v)}
          className="w-full flex items-center justify-between text-left text-[11px] text-t2 hover:text-t1 transition-colors"
        >
          <span className="inline-flex items-center gap-1.5 font-semibold">
            <History size={12} />
            Hidden & Recent Activity
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="font-mono text-[10px] text-t3">
              {hiddenCount} hidden · {historyData.history?.length || 0} recent
            </span>
            <ChevronDown size={12} className={`transition-transform duration-200 ${historyOpen ? 'rotate-180' : ''}`} />
          </span>
        </button>
        <div className={`grid transition-all duration-300 ${historyOpen ? 'grid-rows-[1fr] opacity-100 mt-2' : 'grid-rows-[0fr] opacity-0 mt-0'}`}>
          <div className="overflow-hidden space-y-3">
            <div className="rounded-md border border-border bg-surface/50 px-3 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-t3">Hidden recommendations</div>
                  <div className="text-[11px] text-t2 mt-1">
                    Restore a hidden item if it should return to active evaluation now.
                  </div>
                </div>
                <div className="inline-flex items-center gap-1 text-[10px] font-mono text-t3">
                  <Clock3 size={11} />
                  {hiddenCount}
                </div>
              </div>
              {historyData.suppressed_count > 0 ? (
                <div className="space-y-2 mt-3">
                  {historyData.suppressed.slice(0, 4).map((entry) => {
                    const restoreBusy = busyKey === `${entry.id}:restore`
                    return (
                      <div key={`sup-${entry.id}`} className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface2/40 px-3 py-2.5">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <div className="text-[11px] text-t1 font-semibold truncate">{recommendationName(entry)}</div>
                            {entry.severity && (
                              <Chip variant={severityVariant[entry.severity] || 'model'}>{severityLabel(entry.severity)}</Chip>
                            )}
                          </div>
                          <div className="text-[10px] text-t2 mt-1 leading-relaxed">{entry.reason || 'Temporarily hidden from active recommendations.'}</div>
                          <div className="text-[9px] text-t3 mt-1">
                            {actionLabel(entry.status)} · {formatExpiry(entry.suppress_until)}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => restoreRecommendation(entry)}
                          disabled={restoreBusy}
                          className="inline-flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1.5 rounded-md border border-border text-t2 hover:text-t1 hover:bg-surface transition-colors disabled:opacity-60 disabled:cursor-wait"
                        >
                          {restoreBusy ? <RotateCw size={11} className="animate-spin" /> : <Undo2 size={11} />}
                          Restore now
                        </button>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="text-[10px] text-t3 mt-3">No recommendations are currently hidden.</div>
              )}
            </div>

            <div className="rounded-md border border-border bg-surface/50 px-3 py-2.5">
              <div className="text-[10px] uppercase tracking-wider text-t3">Recent actions</div>
              <div className="text-[11px] text-t2 mt-1">
                A short local history of recommendation actions saved by the dashboard.
              </div>
              {historyData.history?.length > 0 ? (
                <div className="space-y-2 mt-3">
                  {historyData.history.slice(0, 6).map((entry, idx) => (
                    <div
                      key={`hist-${entry.id}-${entry.created_at || idx}`}
                      className="rounded-md border border-border bg-surface2/30 px-3 py-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-[11px] text-t1 font-semibold truncate">{recommendationName(entry)}</div>
                          <div className="text-[10px] text-t2 mt-1">{entry.reason || 'No additional context recorded.'}</div>
                        </div>
                        <div className={`shrink-0 rounded-full border px-2 py-1 text-[9px] font-mono ${actionTone[entry.action] || 'text-t3 border-border bg-surface'}`}>
                          {actionLabel(entry.action)}
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-2">
                        <div className="text-[9px] text-t3">
                          {entry.suppress_until ? formatExpiry(entry.suppress_until) : 'No active suppression window'}
                        </div>
                        <div className="text-[9px] text-t3 font-mono">{shortTime(entry.created_at)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-[10px] text-t3 mt-3">No recommendation actions have been recorded yet.</div>
              )}
            </div>
          </div>
        </div>
      </div>
      <ActionGuardDialog
        guard={guard}
        pending={Boolean(guard && busyKey === `${guard.item?.id}:action`)}
        onCancel={() => !(guard && busyKey === `${guard.item?.id}:action`) && setGuard(null)}
        onConfirm={async () => {
          const guardedItem = guard?.item
          setGuard(null)
          if (guardedItem) await executeApiAction(guardedItem)
        }}
      />
    </div>
  )
}
