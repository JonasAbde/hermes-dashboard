import { useState } from 'react'
import { useApi } from '../hooks/useApi'
import { Chip } from '../components/ui/Chip'
import { Clock, Play, RotateCw, CheckCircle, XCircle, AlertTriangle, RefreshCw } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { da } from 'date-fns/locale'
import { clsx } from 'clsx'

// ─── Cron Job Card ─────────────────────────────────────────────────────────────

function JobCard({ job, onTrigger, onToggle }) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null) // { ok: bool, message: string }
  const isActive = job.enabled !== false

  const handleTrigger = async () => {
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch(`/api/cron/${encodeURIComponent(job.name)}/trigger`, { method: 'POST' })
      const body = await res.json().catch(() => ({}))
      setResult({ ok: res.ok, message: body.message ?? (res.ok ? 'Triggered' : `HTTP ${res.status}`) })
    } catch (e) {
      setResult({ ok: false, message: e.message })
    } finally {
      setLoading(false)
      onTrigger?.()
    }
  }

  return (
    <div className={clsx(
      'bg-surface border rounded-lg overflow-hidden transition-colors',
      isActive ? 'border-border' : 'border-border opacity-70'
    )}>
      {/* Card accent line */}
      <div style={{
        height: 1,
        background: isActive
          ? 'linear-gradient(90deg, transparent, #e05f40, transparent)'
          : 'linear-gradient(90deg, transparent, #1e2130, transparent)',
      }} />

      <div className="p-4">
        <div className="flex items-start gap-3 mb-3">
          {/* Status icon */}
          <div className={clsx(
            'w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0',
            isActive ? 'bg-rust/10' : 'bg-surface2'
          )}>
            <Clock size={15} className={isActive ? 'text-rust' : 'text-t3'} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-t1 truncate">{job.name}</div>
            <div className="font-mono text-[10px] text-t3 mt-0.5">{job.schedule}</div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <Chip variant={isActive ? 'online' : 'offline'} pulse={isActive}>
              {isActive ? 'Aktiv' : 'Inaktiv'}
            </Chip>
          </div>
        </div>

        {/* Timestamps */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <div className="text-[9px] font-bold uppercase tracking-widest text-t3 mb-1">Sidst kørt</div>
            {job.last_run
              ? (
                <div className="font-mono text-[11px] text-t2">
                  {formatDistanceToNow(new Date(job.last_run * 1000), { locale: da, addSuffix: true })}
                </div>
              )
              : <div className="font-mono text-[11px] text-t3">Aldrig</div>
            }
          </div>
          <div>
            <div className="text-[9px] font-bold uppercase tracking-widest text-t3 mb-1">Næste kørsel</div>
            {job.next_run
              ? (
                <div className="font-mono text-[11px] text-t2">
                  {formatDistanceToNow(new Date(job.next_run * 1000), { locale: da, addSuffix: true })}
                </div>
              )
              : <div className="font-mono text-[11px] text-t3">—</div>
            }
          </div>
        </div>

        {/* Trigger result */}
        {result && (
          <div className={clsx(
            'flex items-center gap-2 px-3 py-2 rounded-md mb-3 text-[11px] font-mono',
            result.ok
              ? 'bg-green/10 border border-green/20 text-green'
              : 'bg-red/10 border border-red/20 text-red'
          )}>
            {result.ok
              ? <CheckCircle size={12} className="flex-shrink-0" />
              : <XCircle size={12} className="flex-shrink-0" />
            }
            <span>{result.message}</span>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleTrigger}
            disabled={loading}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors',
              isActive
                ? 'bg-green/10 border border-green/25 text-green hover:bg-green/20'
                : 'bg-surface2 border border-border text-t3 hover:text-t2',
              loading && 'opacity-50 cursor-wait'
            )}
          >
            {loading
              ? <RotateCw size={11} className="animate-spin" />
              : <Play size={11} />
            }
            Kør nu
          </button>

          <span className="text-[10px] text-t3 ml-2">
            {isActive ? 'Tester jobbet med det samme' : 'Job er deaktiveret'}
          </span>
        </div>
      </div>
    </div>
  )
}

function SkeletonCard() {
  return (
    <div className="bg-surface border border-border rounded-lg overflow-hidden p-4">
      <div className="flex items-start gap-3 mb-3">
        <div className="skeleton w-9 h-9 rounded-lg flex-shrink-0" />
        <div className="flex-1">
          <div className="skeleton h-3 w-2/3 mb-2" />
          <div className="skeleton h-2 w-1/3" />
        </div>
        <div className="skeleton w-16 h-5 rounded-full" />
      </div>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="skeleton h-8" />
        <div className="skeleton h-8" />
      </div>
      <div className="skeleton h-7 w-20 rounded-md" />
    </div>
  )
}

function ErrorState({ message, onRetry }) {
  return (
    <div className="bg-surface border border-border rounded-lg p-8 text-center">
      <AlertTriangle size={18} className="text-rust mx-auto mb-2" />
      <div className="text-sm font-semibold text-rust">Fejl ved indlæsning</div>
      <div className="text-[11px] text-t3 mt-1 mb-4">{message}</div>
      <button
        onClick={onRetry}
        className="px-3 py-1.5 rounded-md bg-surface2 border border-border text-xs text-t2 hover:text-t1 transition-colors"
      >
        Prøv igen
      </button>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="bg-surface border border-border rounded-lg py-14 text-center">
      <Clock size={22} className="text-t3 mx-auto mb-3" />
      <div className="text-sm font-semibold text-t2">Ingen cron jobs konfigureret</div>
      <div className="text-[11px] text-t3 mt-1 max-w-xs mx-auto">
        Scheduled jobs vises her når de er konfigureret i Hermes config
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function CronPage() {
  const { data, loading, error, refetch } = useApi('/cron')
  const jobs = data?.jobs ?? []
  const activeCount = jobs.filter(j => j.enabled !== false).length

  return (
    <div className="max-w-2xl space-y-5">

      {/* Page Header */}
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-rust/10 border border-rust/20 flex items-center justify-center flex-shrink-0">
          <Clock size={16} className="text-rust" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-bold text-t1">Scheduled Jobs</div>
          <div className="text-[11px] text-t3 mt-0.5">
            Manage and trigger Hermes cron job routines
          </div>
        </div>
        <button
          onClick={refetch}
          className="w-7 h-7 rounded-md flex items-center justify-center text-t3 hover:text-t2 hover:bg-surface2 transition-colors flex-shrink-0"
          title="Refresh"
        >
          <RefreshCw size={13} />
        </button>
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-3 text-[11px] font-mono">
        <span className="text-t3">{jobs.length} jobs konfigureret</span>
        <span className="text-border">·</span>
        <span className="text-green">{activeCount} aktive</span>
        <span className="text-border">·</span>
        <span className="text-t3">{jobs.length - activeCount} inaktive</span>
      </div>

      {/* Error state */}
      {error && (
        <ErrorState message={error} onRetry={refetch} />
      )}

      {/* Job cards */}
      <div className="space-y-3">
        {loading
          ? Array.from({ length: 4 }, (_, i) => <SkeletonCard key={i} />)
          : !error && jobs.length === 0
            ? <EmptyState />
            : jobs.map(job => (
                <JobCard
                  key={job.name}
                  job={job}
                  onTrigger={refetch}
                />
              ))
        }
      </div>
    </div>
  )
}
