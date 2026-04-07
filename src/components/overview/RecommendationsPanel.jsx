import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, ArrowRight, CheckCircle2, ChevronDown, History, RotateCw, Undo2 } from 'lucide-react'
import { Chip } from '../ui/Chip'

const severityVariant = {
  critical: 'offline',
  high: 'warn',
  medium: 'model',
  low: 'online',
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

export function RecommendationsPanel({ data, loading, onRefresh }) {
  const navigate = useNavigate()
  const [busyKey, setBusyKey] = useState(null)
  const [feedback, setFeedback] = useState(null)
  const [expandedIds, setExpandedIds] = useState({})
  const [exitingIds, setExitingIds] = useState({})
  const [hiddenIds, setHiddenIds] = useState({})
  const [historyOpen, setHistoryOpen] = useState(true)
  const [historyData, setHistoryData] = useState({ history: [], suppressed: [], suppressed_count: 0 })

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

  const updateRecState = async (item, kind, minutes, options = {}) => {
    if (!item?.id) return
    if (!options.allowWhileBusy && busyKey) return
    setBusyKey(`${item.id}:${kind}`)
    setFeedback(null)
    try {
      const res = await fetch(`/api/recommendations/${item.id}/${kind}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(minutes ? { minutes } : {}),
      })
      const body = await res.json().catch(() => ({}))
      if (res.ok) {
        setFeedback({ ok: true, message: body.message || `${kind} saved` })
        if (kind === 'snooze' || kind === 'dismiss' || kind === 'done') {
          hideCardWithAnimation(item.id)
        }
        loadHistory()
        onRefresh?.()
      } else {
        setFeedback({ ok: false, message: body.error || `Failed (${res.status})` })
      }
    } catch (e) {
      setFeedback({ ok: false, message: e.message || 'Request failed' })
    } finally {
      setBusyKey(null)
    }
  }

  const restoreRecommendation = async (id) => {
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
        setFeedback({ ok: true, message: body.message || 'recommendation restored' })
        loadHistory()
        onRefresh?.()
      } else {
        setFeedback({ ok: false, message: body.error || `Failed (${res.status})` })
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
      navigate(item.action.target)
      await updateRecState(item, 'done', 90, { allowWhileBusy: true })
      return
    }

    if (item.action.type === 'api' && item.action.target) {
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
            message: body.message || body.output || `${item.action.label || 'Action'} completed`,
          })
          await updateRecState(item, 'done', 120, { allowWhileBusy: true })
          onRefresh?.()
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
  }

  return (
    <div className="bg-surface border border-border rounded-lg overflow-hidden card-amber">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle size={13} className="text-amber" />
          <div>
            <div className="text-xs font-bold text-t2">Next Best Actions</div>
            <div className="text-[9px] font-mono text-t3/80 mt-0.5">
              Dashboard-owned guidance, not Hermes core memory
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="font-mono text-[10px] text-t3">{items.length} signal{items.length === 1 ? '' : 's'}</div>
          <div className="font-mono text-[9px] text-t3/80">{modeLabel(data?.recommendation_mode)}</div>
          {(historyData?.suppressed_count || data?.suppressed_count || 0) > 0 && (
            <div className="font-mono text-[9px] text-t3/70">{historyData?.suppressed_count || data?.suppressed_count || 0} hidden</div>
          )}
        </div>
      </div>

      {feedback && (
        <div className={`mx-4 mt-3 px-3 py-2 rounded-md border text-[11px] font-mono ${feedback.ok ? 'text-green border-green/20 bg-green/10' : 'text-red border-red/20 bg-red/10'}`}>
          {feedback.message}
        </div>
      )}

      <div className="p-3 space-y-2">
        {loading && !items.length ? (
          <div className="text-sm text-t3 py-4 text-center">Analyzing signals...</div>
        ) : (
          items.map((item) => {
            const variant = severityVariant[item.severity] || 'model'
            const isBusy = Boolean(busyKey && busyKey.startsWith(`${item.id}:`))
            const isExpanded = Boolean(expandedIds[item.id])
            const hasDetails = Array.isArray(item.details) && item.details.length > 0
            return (
              <div
                key={item.id}
                className={`rounded-md border border-border bg-surface2/40 px-3 py-2.5 transition-all duration-300 hover:-translate-y-0.5 hover:border-white/20 hover:bg-surface2/55 ${
                  exitingIds[item.id] ? 'opacity-0 -translate-y-1 scale-[0.98]' : 'opacity-100 translate-y-0 scale-100'
                }`}
                style={{ transitionTimingFunction: 'cubic-bezier(0.2, 0.8, 0.2, 1)' }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-t1">{item.title}</div>
                    <div className="text-[11px] text-t3 mt-1">{item.reason}</div>
                    {hasDetails && (
                      <div className="mt-1.5">
                        <button
                          type="button"
                          onClick={() => toggleExpanded(item.id)}
                          className="inline-flex items-center gap-1 text-[10px] font-semibold text-t3 hover:text-t1 transition-colors"
                        >
                          Why this recommendation?
                          <ChevronDown
                            size={11}
                            className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                          />
                        </button>
                      </div>
                    )}
                    {hasDetails && (
                      <div
                        className={`grid transition-all duration-300 ${isExpanded ? 'grid-rows-[1fr] opacity-100 mt-1.5' : 'grid-rows-[0fr] opacity-0'}`}
                      >
                        <div className="overflow-hidden space-y-1">
                          {item.details.map((detail, idx) => (
                            <div key={`${item.id}-d-${idx}`} className="text-[10px] text-t3/90 font-mono">
                              • {detail}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <Chip variant={variant}>{severityLabel(item.severity)}</Chip>
                </div>
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {item.action?.label && (
                    <button
                      onClick={() => runAction(item)}
                      disabled={isBusy}
                      className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1.5 rounded-md border border-border text-t2 hover:text-t1 hover:bg-surface transition-colors disabled:opacity-60 disabled:cursor-wait"
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
                  >
                    Snooze 1h
                  </button>
                  <button
                    onClick={() => updateRecState(item, 'dismiss', 24 * 60)}
                    disabled={isBusy}
                    className="text-[10px] font-semibold px-2 py-1.5 rounded-md border border-border text-t3 hover:text-t1 hover:bg-surface transition-colors disabled:opacity-60 disabled:cursor-wait"
                  >
                    Dismiss 24h
                  </button>
                  <button
                    onClick={() => updateRecState(item, 'done', 120)}
                    disabled={isBusy}
                    className="text-[10px] font-semibold px-2 py-1.5 rounded-md border border-border text-t3 hover:text-t1 hover:bg-surface transition-colors disabled:opacity-60 disabled:cursor-wait"
                  >
                    Mark done
                  </button>
                </div>
              </div>
            )
          })
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
            Recommendation History
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="font-mono text-[10px] text-t3">
              {historyData.suppressed_count || 0} hidden · {historyData.history?.length || 0} recent
            </span>
            <ChevronDown size={12} className={`transition-transform duration-200 ${historyOpen ? 'rotate-180' : ''}`} />
          </span>
        </button>
        <div className={`grid transition-all duration-300 ${historyOpen ? 'grid-rows-[1fr] opacity-100 mt-2' : 'grid-rows-[0fr] opacity-0 mt-0'}`}>
          <div className="overflow-hidden space-y-2">
            {historyData.suppressed_count > 0 ? (
              <div className="space-y-1.5">
                {historyData.suppressed.slice(0, 4).map((entry) => {
                  const restoreBusy = busyKey === `${entry.id}:restore`
                  return (
                    <div key={`sup-${entry.id}`} className="flex items-center justify-between gap-2 rounded-md border border-border bg-surface/60 px-2.5 py-2">
                      <div className="min-w-0">
                        <div className="text-[10px] text-t1 font-mono truncate">{entry.id}</div>
                        <div className="text-[9px] text-t3">
                          {entry.status} until {shortTime(entry.suppress_until)}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => restoreRecommendation(entry.id)}
                        disabled={restoreBusy}
                        className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-md border border-border text-t2 hover:text-t1 hover:bg-surface transition-colors disabled:opacity-60 disabled:cursor-wait"
                      >
                        {restoreBusy ? <RotateCw size={11} className="animate-spin" /> : <Undo2 size={11} />}
                        Restore
                      </button>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="text-[10px] text-t3 px-1 py-1.5">No currently hidden recommendations.</div>
            )}
            {historyData.history?.length > 0 && (
              <div className="border-t border-border pt-2">
                <div className="text-[10px] text-t3 uppercase tracking-wider mb-1.5">Recent actions</div>
                <div className="space-y-1">
                  {historyData.history.slice(0, 6).map((entry, idx) => (
                    <div
                      key={`hist-${entry.id}-${entry.created_at || idx}`}
                      className="text-[10px] text-t3 font-mono flex items-center justify-between rounded px-1.5 py-1 bg-surface/40"
                    >
                      <span className="truncate">{entry.id} · {entry.action}</span>
                      <span className="ml-2 shrink-0">{shortTime(entry.created_at)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
