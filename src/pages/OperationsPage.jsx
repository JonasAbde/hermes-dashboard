import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Activity, Play, RefreshCw, Square, ScrollText, Server, Clock } from 'lucide-react'
import { usePoll } from '../hooks/useApi'
import { apiFetch } from '../utils/auth'
import { Chip } from '../components/ui/Chip'
import { PagePrimer } from '../components/ui/PagePrimer'

function formatUptime(s) {
  if (!s && s !== 0) return '—'
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

function ServiceCard({ service, busyAction, onAction, onOpenLogs }) {
  const isBusy = Boolean(busyAction)
  const platformIssues = useMemo(() => {
    if (!Array.isArray(service?.platforms)) return []
    return service.platforms.filter((p) => p?.error)
  }, [service])

  // Stop button: only for hermes-gateway, not dashboard-api
  const canStop = service?.key === 'hermes-gateway'
  // Start button: only when inactive
  const canStart = service?.key === 'hermes-gateway' && !service?.active
  // Dashboard API is informational only — no control buttons
  const isReadOnly = service?.key === 'hermes-dashboard-api'

  return (
    <div className="bg-surface border border-border rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-t1 truncate">{service?.label || service?.key}</div>
          <div className="text-[10px] font-mono text-t3 truncate">{service?.unit || 'n/a'}</div>
        </div>
        <Chip variant={service?.active ? 'online' : 'offline'}>
          {service?.active ? 'Kørende' : 'Stoppet'}
        </Chip>
      </div>

      <div className="px-4 py-3 space-y-3">
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
          <div className="text-t3">Status</div>
          <div className="text-t2 font-mono text-right">{service?.substate || service?.state || 'unknown'}</div>

          <div className="text-t3">PID</div>
          <div className="text-t2 font-mono text-right">{service?.pid ?? '—'}</div>

          <div className="text-t3">Uptime</div>
          <div className="text-t2 font-mono text-right flex items-center justify-end gap-1">
            <Clock size={9} className="text-t3" />
            {service?.uptime_s != null ? formatUptime(service.uptime_s) : '—'}
          </div>
        </div>

        {service?.cmdline && (
          <div className="text-[10px] font-mono text-t3 truncate" title={service.cmdline}>
            {service.cmdline}
          </div>
        )}

        {platformIssues.length > 0 && (
          <div className="text-[10px] bg-rust/10 border border-rust/30 text-rust rounded p-2">
            {platformIssues.length} platform issue(s)
          </div>
        )}

        {isReadOnly ? (
          <div className="text-[10px] text-t3 italic">
            Informational only — use <code className="bg-surface px-1 rounded">npm run api</code> to manage
          </div>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {canStart && (
              <button
                onClick={() => onAction(service.key, 'start')}
                disabled={isBusy}
                className="px-2.5 py-1 rounded text-[10px] font-semibold text-green border border-green/30 hover:bg-green/10 disabled:opacity-50"
              >
                <Play size={10} className="inline mr-1" /> Start
              </button>
            )}
            <button
              onClick={() => onAction(service.key, 'restart')}
              disabled={isBusy}
              className="px-2.5 py-1 rounded text-[10px] font-semibold text-amber border border-amber/30 hover:bg-amber/10 disabled:opacity-50"
            >
              <RefreshCw size={10} className={`inline mr-1 ${isBusy ? 'animate-spin' : ''}`} /> Restart
            </button>
            {canStop && (
              <button
                onClick={() => onAction(service.key, 'stop')}
                disabled={isBusy}
                className="px-2.5 py-1 rounded text-[10px] font-semibold text-rust border border-rust/30 hover:bg-rust/10 disabled:opacity-50"
              >
                <Square size={10} className="inline mr-1" /> Stop
              </button>
            )}
            <button
              onClick={() => onOpenLogs(service.key)}
              className="px-2.5 py-1 rounded text-[10px] font-semibold text-blue border border-blue/30 hover:bg-blue/10"
            >
              <ScrollText size={10} className="inline mr-1" /> Logfiler
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export function OperationsPage() {
  const navigate = useNavigate()
  const { data, loading, refetch, lastUpdated } = usePoll('/control/services', 5000)
  const [busyAction, setBusyAction] = useState(null)
  const [msg, setMsg] = useState(null)
  const [loadingTimedOut, setLoadingTimedOut] = useState(false)

  const services = data?.services || []

  useEffect(() => {
    if (!loading) {
      setLoadingTimedOut(false)
      return
    }
    const id = setTimeout(() => setLoadingTimedOut(true), 8000)
    return () => clearTimeout(id)
  }, [loading])

  const onAction = async (service, action) => {
    const key = `${service}:${action}`
    setBusyAction(key)
    setMsg(null)
    try {
      const res = await apiFetch(`/api/control/services/${service}/${action}`, { method: 'POST' })
      const body = await res.json().catch(e => {
        if (import.meta.env.DEV) console.warn('[Operations] parse error:', e)
        return {}
      })
      const applied = body?.applied !== false
      if (res.ok && body?.ok !== false && applied) {
        const detail = body?.gateway_state ? ` (${body.gateway_state})` : ''
        setMsg({ type: 'ok', text: `${service} ${action} applied${detail}` })
      } else {
        setMsg({ type: 'err', text: body?.error || `${service} ${action} not applied` })
      }
      refetch({ background: true })
    } catch {
      setMsg({ type: 'err', text: `${service} ${action} failed` })
    } finally {
      setBusyAction(null)
      setTimeout(() => setMsg(null), 5000)
    }
  }

  const onOpenLogs = (service) => {
    if (service === 'hermes-dashboard-api') {
      navigate('/logs?file=agent')
      return
    }
    navigate('/logs?file=gateway')
  }

  return (
    <div className="space-y-4 max-w-6xl">
      <PagePrimer
        title="Operations"
        body="Use this page to start, restart, or stop core Hermes services."
        tip="Restart first when status looks stale. Stop is only for emergency control."
      />
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Server size={16} className="text-amber" />
          <h1 className="text-lg font-bold text-t1">Operations</h1>
          <span className="font-mono text-[10px] text-t3">{services.length} services</span>
          <span className="font-mono text-[10px] text-t3">
            {lastUpdated ? `synkroniseret ${Math.max(0, Math.round((Date.now() - lastUpdated) / 1000))}s siden` : 'synkroniserer…'}
          </span>
        </div>
        <button
          onClick={() => refetch()}
          className="px-3 py-1.5 rounded text-[11px] border border-border text-t2 hover:bg-surface2"
        >
          <RefreshCw size={12} className={`inline mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {msg && (
        <div className={`text-[11px] font-mono px-3 py-2 rounded border ${msg.type === 'ok' ? 'text-green border-green/30 bg-green/10' : 'text-rust border-rust/30 bg-rust/10'}`}>
          {msg.text}
        </div>
      )}

      {loading && services.length === 0 && !loadingTimedOut ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-surface border border-border rounded-lg p-5 animate-pulse"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-5 h-5 rounded bg-border" />
                <div className="h-4 w-32 rounded bg-border" />
              </div>
              <div className="space-y-2">
                <div className="h-3 w-3/4 rounded bg-border" />
                <div className="h-3 w-1/2 rounded bg-border" />
              </div>
            </div>
          ))}
        </div>
      ) : loading && services.length === 0 && loadingTimedOut ? (
        <div className="bg-surface border border-rust/30 rounded-lg p-6 text-center">
          <div className="text-sm font-semibold text-rust">Kunne ikke hente services endnu</div>
          <div className="text-[11px] text-t3 mt-1">API kan være offline eller utilgængelig.</div>
          <button
            onClick={() => {
              setLoadingTimedOut(false)
              refetch()
            }}
            className="mt-3 px-3 py-1.5 rounded text-[11px] border border-border text-t2 hover:bg-surface2"
          >
            Prøv igen
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {services.map((s) => (
            <ServiceCard
              key={s.key}
              service={s}
              busyAction={busyAction && busyAction.startsWith(`${s.key}:`) ? busyAction : null}
              onAction={onAction}
              onOpenLogs={onOpenLogs}
            />
          ))}
        </div>
      )}

      <div className="text-[10px] text-t3 font-mono">
        <Activity size={10} className="inline mr-1" /> Polling hvert 5. sekund
      </div>
    </div>
  )
}


export default OperationsPage
