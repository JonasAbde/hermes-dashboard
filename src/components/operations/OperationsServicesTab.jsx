// src/components/operations/OperationsServicesTab.jsx
// Services tab for Operations page — production-hardened.
// Shows real service status from backend. No mock data, no fake metrics.

import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Activity, Play, RefreshCw, Square, ScrollText, Server, Clock, Loader2 } from 'lucide-react'
import { Chip } from '../ui/Chip'
import { clsx } from 'clsx'
import { useServicesData } from '../../hooks/useServicesData'

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatUptime(s) {
  if (s == null) return null
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

function formatLastSync(date) {
  if (!date) return 'ikke synkroniseret'
  const secs = Math.max(0, Math.round((Date.now() - date.getTime()) / 1000))
  if (secs < 2) return 'lige nu'
  if (secs < 60) return `${secs}s siden`
  return `${Math.floor(secs / 60)}m siden`
}

// ── ServiceCard ──────────────────────────────────────────────────────────────

function ServiceCard({ service, busyAction, onAction, onOpenLogs }) {
  const isBusy = Boolean(busyAction)

  // Determine which actions are available
  const isGateway = service.key === 'hermes-gateway'
  const isDashboardApi = service.key === 'hermes-dashboard-api'
  const canStart = isGateway && !service.active
  const canStop = isGateway && service.active
  const canRestart = isGateway

  return (
    <div className="bg-surface border border-border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-t1 truncate">{service.label}</div>
          {service.unit && (
            <div className="text-[10px] font-mono text-t3 truncate">{service.unit}</div>
          )}
        </div>
        <Chip variant={service.active ? 'online' : 'offline'}>
          {service.active ? 'Kørende' : 'Stoppet'}
        </Chip>
      </div>

      {/* Details */}
      <div className="px-4 py-3 space-y-3">
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
          <div className="text-t3">Status</div>
          <div className="text-t2 font-mono text-right">
            {service.state || service.substate || 'ukendt'}
          </div>

          <div className="text-t3">PID</div>
          <div className="text-t2 font-mono text-right">
            {service.pid ?? '—'}
          </div>

          <div className="text-t3">Uptime</div>
          <div className="text-t2 font-mono text-right flex items-center justify-end gap-1">
            {formatUptime(service.uptime_s) ? (
              <>
                <Clock size={9} className="text-t3" />
                {formatUptime(service.uptime_s)}
              </>
            ) : (
              <span className="text-t3">—</span>
            )}
          </div>
        </div>

        {service.cmdline && (
          <div
            className="text-[10px] font-mono text-t3 truncate"
            title={service.cmdline}
          >
            {service.cmdline}
          </div>
        )}

        {/* Actions */}
        {isDashboardApi ? (
          <div className="text-[10px] text-t3 italic">
            Informational only — use <code className="bg-surface2 px-1 rounded">npm run api</code> to manage
          </div>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {canStart && (
              <button
                onClick={() => onAction(service.key, 'start')}
                disabled={isBusy}
                className="px-2.5 py-1 rounded text-[10px] font-semibold text-green border border-green/30 hover:bg-green/10 disabled:opacity-50"
              >
                {isBusy ? <Loader2 size={10} className="inline mr-1 animate-spin" /> : <Play size={10} className="inline mr-1" />}
                Start
              </button>
            )}

            {canRestart && (
              <button
                onClick={() => onAction(service.key, 'restart')}
                disabled={isBusy}
                className="px-2.5 py-1 rounded text-[10px] font-semibold text-amber border border-amber/30 hover:bg-amber/10 disabled:opacity-50"
              >
                {isBusy
                  ? <Loader2 size={10} className="inline mr-1 animate-spin" />
                  : <RefreshCw size={10} className="inline mr-1" />
                }
                Restart
              </button>
            )}

            {canStop && (
              <button
                onClick={() => onAction(service.key, 'stop')}
                disabled={isBusy}
                className="px-2.5 py-1 rounded text-[10px] font-semibold text-rust border border-rust/30 hover:bg-rust/10 disabled:opacity-50"
              >
                {isBusy
                  ? <Loader2 size={10} className="inline mr-1 animate-spin" />
                  : <Square size={10} className="inline mr-1" />
                }
                Stop
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

// ── Main Tab Component ───────────────────────────────────────────────────────

export default function OperationsServicesTab() {
  const navigate = useNavigate()
  const {
    services,
    loading,
    error,
    lastUpdated,
    refetch,
    busyAction,
    actionMsg,
    onAction,
  } = useServicesData(true)

  const onOpenLogs = (serviceKey) => {
    if (serviceKey === 'hermes-dashboard-api') {
      navigate('/logs?file=agent')
    } else {
      navigate('/logs?file=gateway')
    }
  }

  // Loading state (initial load with no data yet)
  const isInitialLoading = loading && services.length === 0 && !error

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Server size={16} className="text-amber" />
          <h2 className="text-lg font-bold text-t1">Services</h2>
          <span className="font-mono text-[10px] text-t3">
            {formatLastSync(lastUpdated)}
          </span>
        </div>
        <button
          onClick={() => refetch()}
          disabled={loading}
          className="px-3 py-1.5 rounded text-[11px] border border-border text-t2 hover:bg-surface2 disabled:opacity-50"
        >
          <RefreshCw size={12} className={clsx('inline mr-1', loading && 'animate-spin')} />
          Opdater
        </button>
      </div>

      {/* Action feedback */}
      {actionMsg && (
        <div className={clsx(
          'text-[11px] font-mono px-3 py-2 rounded border',
          actionMsg.type === 'ok'
            ? 'text-green border-green/30 bg-green/10'
            : 'text-rust border-rust/30 bg-rust/10',
        )}>
          {actionMsg.text}
        </div>
      )}

      {/* Error state */}
      {error && services.length === 0 && (
        <div className="bg-surface border border-rust/30 rounded-lg p-6 text-center">
          <div className="text-sm font-semibold text-rust">Kunne ikke hente services</div>
          <div className="text-[11px] text-t3 mt-1">{error}</div>
          <button
            onClick={() => refetch()}
            className="mt-3 px-3 py-1.5 rounded text-[11px] border border-border text-t2 hover:bg-surface2"
          >
            Prøv igen
          </button>
        </div>
      )}

      {/* Initial loading skeleton */}
      {isInitialLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {[1, 2].map(i => (
            <div key={i} className="bg-surface border border-border rounded-lg p-5 animate-pulse">
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
      )}

      {/* Empty state */}
      {!isInitialLoading && !error && services.length === 0 && (
        <div className="bg-surface border border-border rounded-lg p-8 text-center">
          <Server size={24} className="mx-auto mb-2 text-t3" />
          <div className="text-sm text-t2">Ingen services fundet</div>
          <div className="text-[11px] text-t3 mt-1">
            Backend returnerede ingen service-data
          </div>
        </div>
      )}

      {/* Service cards */}
      {!isInitialLoading && services.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {services.map(s => (
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

      {/* Polling indicator */}
      <div className="text-[10px] text-t3 font-mono">
        <Activity size={10} className="inline mr-1" />
        Polling hvert 5. sekund
      </div>
    </div>
  )
}
