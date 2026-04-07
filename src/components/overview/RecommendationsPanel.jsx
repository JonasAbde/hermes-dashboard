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
  if (mode === 'cost-first') return 'Omkostning forst'
  if (mode === 'speed-first') return 'Hastighed forst'
  return 'Stabilitet forst'
}

function shortTime(ts) {
  if (!ts) return 'ukendt tid'
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return 'ukendt tid'
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function formatExpiry(ts) {
  if (!ts) return 'indtil ukendt tid'
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return 'indtil ukendt tid'
  return `indtil ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
}

function recommendationName(entry) {
  return entry?.title || entry?.id || 'Anbefaling'
}

function actionLabel(action) {
  if (action === 'dismissed') return 'Skjult'
  if (action === 'snoozed') return 'Udskudt'
  if (action === 'done') return 'Markeret faerdig'
  if (action === 'restored') return 'Gendannet'
  return action || 'Opdateret'
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
    <div className="min-w-0 rounded-md border border-border bg-surface2/40 px-2 py-1 sm:px-2.5 sm:py-1.5">
      <div className="text-[9px] uppercase tracking-wider text-t3">{label}</div>
      <div className="mt-0.5 text-[10px] font-semibold text-t1 sm:text-[11px]">{value}</div>
    </div>
  )
}

    <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-xl card-amber">
      <div className="border-b border-border px-4 py-3.5 sm:px-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
          <div className="flex min-w-0 items-start gap-2">
  const [expandedIds, setExpandedIds] = useState({})
            <div className="min-w-0">
              <div className="text-xs font-bold text-t2">Næste handlinger</div>
              <div className="mt-0.5 text-[9px] font-mono text-t3/80 sm:text-[10px]">
  const [showAllActive, setShowAllActive] = useState(false)
  const [historyData, setHistoryData] = useState({ history: [], suppressed: [], suppressed_count: 0 })
  const [guard, setGuard] = useState(null)

          <div className="flex items-center justify-between gap-2 text-right sm:flex-col sm:items-end sm:justify-start sm:gap-0.5">
            <div className="font-mono text-[10px] text-t3">{modeLabel(data?.recommendation_mode)}</div>
            <div className="font-mono text-[9px] text-t3/70 sm:mt-0.5">
  )

  const loadHistory = async () => {
    try {
        <div className="mt-3 grid grid-cols-2 gap-1.5 sm:flex sm:flex-wrap sm:gap-2">
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
        setFeedback({ ok: true, message: `${body.title || recommendationName(entry)} gendannet til aktiv vurdering` })
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
      setFeedback({ ok: true, message: `${item.title} · aabnede ${item.action.label}` })
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
  const visibleItems = showAllActive ? items : items.slice(0, 1)

  return (
    <div className="bg-surface border border-border rounded-lg overflow-hidden card-amber">
      <div className="px-4 py-3 border-b border-border">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2">
            <AlertTriangle size={13} className="text-amber mt-0.5" />
            <div>
              <div className="text-xs font-bold text-t2">Næste handlinger</div>
              <div className="text-[9px] font-mono text-t3/80 mt-0.5">
                Dashboard-anbefalinger, ikke gemt i Hermes core-hukommelse
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="font-mono text-[10px] text-t3">{modeLabel(data?.recommendation_mode)}</div>
            <div className="font-mono text-[9px] text-t3/70 mt-0.5">
              {items.length} aktive · {hiddenCount} skjulte
            </div>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <SummaryPill label="Active" value={`${items.length}`} />
          <SummaryPill label="Seneste" value={`${historyData.history?.length || 0}`} />
        </div>
      </div>

      {feedback && (
        <div className={`mx-4 mt-3 px-3 py-2 rounded-md border text-[11px] font-mono ${feedback.ok ? 'text-green border-green/20 bg-green/10' : 'text-red border-red/20 bg-red/10'}`}>
          {feedback.message}
        </div>
      )}

      <div className="space-y-3 p-3 sm:p-4">
        {loading && !items.length ? (
          <div className="text-sm text-t3 py-4 text-center">Analyserer signaler...</div>
        ) : items.length > 0 ? (
          visibleItems.map((item) => {
            const variant = severityVariant[item.severity] || 'model'
            const isBusy = Boolean(busyKey && busyKey.startsWith(`${item.id}:`))
            const isExpanded = Boolean(expandedIds[item.id])
            const hasDetails = Array.isArray(item.details) && item.details.length > 0
            return (
              <div
                key={item.id}
                className={`rounded-xl border border-border bg-surface2/40 px-3 py-3 transition-all duration-300 hover:-translate-y-0.5 hover:border-white/20 hover:bg-surface2/55 ${
                  exitingIds[item.id] ? 'opacity-0 -translate-y-1 scale-[0.98]' : 'opacity-100 translate-y-0 scale-100'
                } ${isBusy ? 'ring-1 ring-white/10' : ''}`}
                style={{ transitionTimingFunction: 'cubic-bezier(0.2, 0.8, 0.2, 1)' }}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-t1">{item.title}</div>
                    <div className="mt-1 text-[11px] leading-relaxed text-t2">{item.reason}</div>
                    {hasDetails && (
                      <div className="mt-2">
                        <button
                          type="button"
                          onClick={() => toggleExpanded(item.id)}
                          className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-t3 hover:text-t1 transition-colors"
                        >
                          <Sparkles size={11} />
                          {isExpanded ? 'Skjul detaljer' : 'Hvorfor denne anbefaling?'}
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
                            <div className="text-[9px] uppercase tracking-wider text-t3">Signalgrundlag</div>
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
                  <div className="flex items-center justify-between gap-2 sm:flex-col sm:items-end sm:justify-start">
                    <Chip variant={variant}>{severityLabel(item.severity)}</Chip>
                    {isBusy && (
                      <div className="inline-flex items-center gap-1 text-[9px] font-mono text-t3">
                        <RotateCw size={10} className="animate-spin" />
                        opdaterer
                      </div>
                    )}
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:gap-2">
                  {item.action?.label && (
                    <button
                      onClick={() => runAction(item)}
                      disabled={isBusy}
                      className="inline-flex min-h-10 w-full items-center justify-between gap-1.5 rounded-md border border-border px-3 py-2 text-[11px] font-semibold text-t2 transition-colors hover:bg-surface hover:text-t1 disabled:cursor-wait disabled:opacity-60 sm:w-auto sm:justify-start"
                      title={getActionGuardrail({ type: 'api', target: item.action.target, method: item.action.method || 'POST', label: item.action.label }) ? 'Kraever bekræftelse før handlingen koeres' : item.action.label}
                    >
                      <span className="inline-flex min-w-0 items-center gap-1.5">
                        {isBusy ? <RotateCw size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                        <span className="truncate">{item.action.label}</span>
                      </span>
                      {!isBusy && <ArrowRight size={12} className="shrink-0" />}
                    </button>
                  )}
                  <button
                    onClick={() => updateRecState(item, 'snooze', 60)}
                    disabled={isBusy}
                    className="min-h-10 w-full rounded-md border border-border px-2.5 py-1.5 text-[10px] font-semibold text-t3 transition-colors hover:bg-surface hover:text-t1 disabled:cursor-wait disabled:opacity-60 sm:w-auto"
                    title="Skjul denne anbefaling i en time"
                  >
                    Snooze 1h
                  </button>
                  <button
                    onClick={() => updateRecState(item, 'dismiss', 24 * 60)}
                    disabled={isBusy}
                    className="min-h-10 w-full rounded-md border border-border px-2.5 py-1.5 text-[10px] font-semibold text-t3 transition-colors hover:bg-surface hover:text-t1 disabled:cursor-wait disabled:opacity-60 sm:w-auto"
                    title="Skjul denne anbefaling i 24 timer"
                  >
                    Skjul 24t
                  </button>
                  <button
                    onClick={() => updateRecState(item, 'done', 120)}
                    disabled={isBusy}
                    className="min-h-10 w-full rounded-md border border-border px-2.5 py-1.5 text-[10px] font-semibold text-t3 transition-colors hover:bg-surface hover:text-t1 disabled:cursor-wait disabled:opacity-60 sm:w-auto"
                    title="Markér håndteret og skjul midlertidigt"
                  >
                    Marker faerdig
                  </button>
                </div>
              </div>
            )
          })
        ) : (
          <div className="rounded-md border border-border bg-surface2/30 px-4 py-4 text-center">
            <div className="text-sm font-semibold text-t1">Ingen aktive handlinger lige nu</div>
            <div className="text-[11px] text-t2 mt-1 leading-relaxed">
              Det aktuelle signalbillede ser roligt ud. Du kan åbne historik for at gendanne eller gennemgå tidligere handlinger.
            </div>
          </div>
        )}

        {items.length > 1 && (
          <div className="pt-1 flex justify-center sm:justify-start">
            <button
              type="button"
              onClick={() => setShowAllActive((v) => !v)}
              className="min-h-9 rounded-md border border-border px-2.5 py-1.5 text-[10px] font-semibold text-t3 transition-colors hover:bg-surface hover:text-t1"
            >
              {showAllActive ? `Vis færre` : `Vis alle (${items.length})`}
            </button>
          </div>
        )}
      </div>

      <div className="border-t border-border bg-surface2/20 px-3 py-2.5 sm:px-4">
        <button
          type="button"
          onClick={() => setHistoryOpen((v) => !v)}
          className="flex w-full flex-col gap-2 text-left text-[11px] text-t2 transition-colors hover:text-t1 sm:flex-row sm:items-center sm:justify-between"
        >
          <span className="inline-flex items-center gap-1.5 font-semibold">
            <History size={12} />
            Skjult og seneste aktivitet
          </span>
          <span className="inline-flex items-center gap-2 self-start sm:self-auto">
            <span className="font-mono text-[10px] text-t3">
              {hiddenCount} skjulte · {historyData.history?.length || 0} seneste
            </span>
            <ChevronDown size={12} className={`transition-transform duration-200 ${historyOpen ? 'rotate-180' : ''}`} />
          </span>
        </button>
        <div className={`grid transition-all duration-300 ${historyOpen ? 'grid-rows-[1fr] opacity-100 mt-2' : 'grid-rows-[0fr] opacity-0 mt-0'}`}>
          <div className="overflow-hidden space-y-3">
            <div className="rounded-md border border-border bg-surface/50 px-3 py-2.5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="text-[10px] uppercase tracking-wider text-t3">Skjulte anbefalinger</div>
                  <div className="text-[11px] text-t2 mt-1">
                    Gendan et skjult element hvis det skal tilbage til aktiv vurdering nu.
                  </div>
                </div>
                <div className="inline-flex items-center gap-1 text-[10px] font-mono text-t3 self-start sm:self-auto">
                  <Clock3 size={11} />
                  {hiddenCount}
                </div>
              </div>
              {historyData.suppressed_count > 0 ? (
                <div className="space-y-2 mt-3">
                  {historyData.suppressed.slice(0, 4).map((entry) => {
                    const restoreBusy = busyKey === `${entry.id}:restore`
                    return (
                      <div key={`sup-${entry.id}`} className="flex flex-col gap-3 rounded-md border border-border bg-surface2/40 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <div className="text-[11px] text-t1 font-semibold truncate">{recommendationName(entry)}</div>
                            {entry.severity && (
                              <Chip variant={severityVariant[entry.severity] || 'model'}>{severityLabel(entry.severity)}</Chip>
                            )}
                          </div>
                          <div className="text-[10px] text-t2 mt-1 leading-relaxed">{entry.reason || 'Midlertidigt skjult fra aktive anbefalinger.'}</div>
                          <div className="text-[9px] text-t3 mt-1">
                            {actionLabel(entry.status)} · {formatExpiry(entry.suppress_until)}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => restoreRecommendation(entry)}
                          disabled={restoreBusy}
                          className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-[10px] font-semibold text-t2 transition-colors hover:bg-surface hover:text-t1 disabled:cursor-wait disabled:opacity-60 sm:ml-auto sm:shrink-0"
                        >
                          {restoreBusy ? <RotateCw size={11} className="animate-spin" /> : <Undo2 size={11} />}
                          Restore now
                        </button>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="text-[10px] text-t3 mt-3">Der er ingen skjulte anbefalinger lige nu.</div>
              )}
            </div>

            <div className="rounded-md border border-border bg-surface/50 px-3 py-2.5">
              <div className="text-[10px] uppercase tracking-wider text-t3">Seneste handlinger</div>
              <div className="text-[11px] text-t2 mt-1">
                En kort lokal historik over recommendation-handlinger gemt af dashboardet.
              </div>
              {historyData.history?.length > 0 ? (
                <div className="space-y-2 mt-3">
                  {historyData.history.slice(0, 6).map((entry, idx) => (
                    <div
                      key={`hist-${entry.id}-${entry.created_at || idx}`}
                      className="rounded-md border border-border bg-surface2/30 px-3 py-2"
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <div className="text-[11px] text-t1 font-semibold truncate">{recommendationName(entry)}</div>
                          <div className="text-[10px] text-t2 mt-1">{entry.reason || 'Ingen ekstra kontekst registreret.'}</div>
                        </div>
                        <div className={`inline-flex shrink-0 self-start rounded-full border px-2 py-1 text-[9px] font-mono sm:self-auto ${actionTone[entry.action] || 'text-t3 border-border bg-surface'}`}>
                          {actionLabel(entry.action)}
                        </div>
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <div className="text-[9px] text-t3">
                          {entry.suppress_until ? formatExpiry(entry.suppress_until) : 'Intet aktivt skjulevindue'}
                        </div>
                        <div className="text-[9px] text-t3 font-mono">{shortTime(entry.created_at)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-[10px] text-t3 mt-3">Ingen recommendation-handlinger er registreret endnu.</div>
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
