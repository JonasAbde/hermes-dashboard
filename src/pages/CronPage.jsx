import { useState, useEffect, useCallback } from 'react'
import { useApi, usePoll } from '../hooks/useApi.ts'
import { apiFetch } from '../utils/auth'
import { Chip } from '../components/ui/Chip'
import { clsx } from 'clsx'
import { formatDistanceToNow, format } from 'date-fns'
import { da } from 'date-fns/locale'
import {
  Clock, Play, RotateCw, CheckCircle, XCircle, AlertTriangle,
  RefreshCw, Plus, X, ChevronDown, ChevronUp, Terminal,
  Zap, Calendar, Loader2, Trash2, Edit3,
  Timer, TrendingUp, AlertOctagon, Check, Copy, Eye
} from 'lucide-react'

// ─── Helper: Format timestamp ───────────────────────────────────────────────────

function formatTs(ts) {
  if (!ts) return null
  try {
    let val = ts
    if (typeof val === 'number' && val < 5000000000) val = val * 1000
    const d = new Date(val)
    if (isNaN(d.getTime())) return null
    return d
  } catch { return null }
}

function formatRel(ts) {
  const d = formatTs(ts)
  if (!d) return null
  return formatDistanceToNow(d, { locale: da, addSuffix: true })
}

function formatAbs(ts) {
  const d = formatTs(ts)
  if (!d) return null
  return format(d, 'HH:mm:ss · d. d. MMM')
}

// ─── Countdown Timer ───────────────────────────────────────────────────────────

function CountdownTimer({ targetTs, label }) {
  const [display, setDisplay] = useState('')

  useEffect(() => {
    if (!targetTs) {
      setDisplay('—')
      return
    }

    const update = () => {
      const now = Date.now()
      let target = targetTs
      if (target < 5000000000) target = target * 1000
      const diff = Math.max(0, Math.floor((target - now) / 1000))
      const h = Math.floor(diff / 3600)
      const m = Math.floor((diff % 3600) / 60)
      const s = diff % 60
      if (h > 0) setDisplay(`${h}t ${m}m ${s}s`)
      else if (m > 0) setDisplay(`${m}m ${s}s`)
      else setDisplay(`${s}s`)
    }

    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [targetTs])

  return (
    <span className="font-mono text-[11px] text-rust">
      {label && <span className="text-t3 mr-1">{label}</span>}
      {display}
    </span>
  )
}

// ─── Stats Bar ─────────────────────────────────────────────────────────────────

function StatsBar({ stats, loading }) {
  if (loading && !stats) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-surface border border-border rounded-xl p-4">
            <div className="skeleton h-2 w-2/3 mb-3" />
            <div className="skeleton h-6 w-1/2 mb-1" />
            <div className="skeleton h-2 w-3/4" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {/* Total jobs */}
      <div className="bg-surface border border-border rounded-xl p-4 flex items-start gap-3">
        <div className="p-2 rounded-lg bg-surface2">
          <Clock size={14} className="text-t2" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[9px] font-bold uppercase tracking-widest text-t3 mb-1">Jobs i alt</div>
          <div className="text-xl font-extrabold text-t1">{stats?.total ?? 0}</div>
          <div className="text-[10px] text-t3 mt-0.5">konfigureret</div>
        </div>
      </div>

      {/* Active jobs */}
      <div className="bg-surface border border-border rounded-xl p-4 flex items-start gap-3">
        <div className="p-2 rounded-lg bg-green/10">
          <Zap size={14} className="text-green" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[9px] font-bold uppercase tracking-widest text-t3 mb-1">Aktive</div>
          <div className="text-xl font-extrabold text-green">{stats?.active ?? 0}</div>
          <div className="text-[10px] text-t3 mt-0.5">kører nu</div>
        </div>
      </div>

      {/* Failed today */}
      <div className="bg-surface border border-border rounded-xl p-4 flex items-start gap-3">
        <div className="p-2 rounded-lg bg-rust/10">
          <AlertOctagon size={14} className="text-rust" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[9px] font-bold uppercase tracking-widest text-t3 mb-1">Fejlet i dag</div>
          <div className={clsx('text-xl font-extrabold', (stats?.failed_today ?? 0) > 0 ? 'text-rust' : 'text-t1')}>
            {stats?.failed_today ?? 0}
          </div>
          <div className="text-[10px] text-t3 mt-0.5">
            {stats?.outputs_today != null ? `${stats.outputs_today} outputs` : '—'}
          </div>
        </div>
      </div>

      {/* Next scheduled */}
      <div className="bg-surface border border-border rounded-xl p-4 flex items-start gap-3">
        <div className="p-2 rounded-lg bg-surface2">
          <Timer size={14} className="text-blue" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[9px] font-bold uppercase tracking-widest text-t3 mb-1">Næste kørsel</div>
          {stats?.next_scheduled?.name ? (
            <>
              <div className="text-sm font-bold text-t1 truncate" title={stats.next_scheduled.name}>
                {stats.next_scheduled.name}
              </div>
              <CountdownTimer targetTs={stats.next_scheduled.next_run} />
            </>
          ) : (
            <div className="text-lg font-bold text-t3">—</div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Filter Chips ───────────────────────────────────────────────────────────────

const FILTER_OPTIONS = [
  { key: 'all',      label: 'Alle',     color: 'text-t2' },
  { key: 'active',   label: 'Aktive',   color: 'text-green' },
  { key: 'inactive', label: 'Inaktive', color: 'text-t3' },
]

function FilterChips({ filter, onChange }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-[10px] text-t3 font-bold uppercase tracking-widest mr-1">Filter:</span>
      {FILTER_OPTIONS.map(opt => (
        <button
          key={opt.key}
          onClick={() => onChange(opt.key)}
          className={clsx(
            'px-3 py-1.5 rounded-full text-[11px] font-semibold border transition-all',
            filter === opt.key
              ? 'bg-rust/15 border-rust/30 text-rust'
              : 'bg-surface border-border text-t3 hover:text-t2 hover:border-white/20'
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

// ─── Job Output Panel ─────────────────────────────────────────────────────────

function JobOutputPanel({ jobName }) {
  const { data, loading, error } = useApi(`/cron/${encodeURIComponent(jobName)}/output`)

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-3 py-6 bg-surface2/30 border-t border-border">
        <Loader2 size={14} className="text-t3 animate-spin" />
        <span className="text-[11px] text-t3">Henter output…</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 px-4 py-4 bg-surface2/30 border-t border-border">
        <AlertTriangle size={12} className="text-rust flex-shrink-0" />
        <span className="text-[11px] text-rust">Kunne ikke hente output: {error}</span>
      </div>
    )
  }

  const outputs = data?.outputs ?? []

  if (outputs.length === 0) {
    return (
      <div className="flex items-center gap-2 px-4 py-4 bg-surface2/30 border-t border-border">
        <Terminal size={12} className="text-t3 flex-shrink-0" />
        <span className="text-[11px] text-t3">Ingen output endnu</span>
      </div>
    )
  }

  // Show last 3 outputs
  const recent = outputs.slice(0, 3)

  return (
    <div className="bg-surface2/20 border-t border-border divide-y divide-border">
      <div className="px-4 py-2 flex items-center gap-2">
        <Terminal size={11} className="text-t3" />
        <span className="text-[9px] font-bold uppercase tracking-widest text-t3">
          Seneste output ({outputs.length} total)
        </span>
      </div>
      {recent.map((out, i) => {
        const outTs = out.timestamp
        const d = formatTs(outTs)
        const isError = out.data?.toLowerCase()?.includes('error') || out.filename?.includes('err')

        return (
          <div key={i} className="px-4 py-3">
            <div className="flex items-center gap-2 mb-1.5">
              {isError
                ? <XCircle size={11} className="text-rust flex-shrink-0" />
                : <CheckCircle size={11} className="text-green flex-shrink-0" />
              }
              <span className={clsx('text-[10px] font-mono font-semibold', isError ? 'text-rust' : 'text-green')}>
                {isError ? 'FEJL' : 'OK'}
              </span>
              {d && (
                <span className="text-[10px] text-t3 font-mono" title={formatAbs(outTs)}>
                  {formatRel(outTs)}
                </span>
              )}
              {out.filename && (
                <span className="ml-auto text-[9px] text-t3 font-mono truncate max-w-[160px]">
                  {out.filename}
                </span>
              )}
            </div>
            {out.data && (
              <div className="font-mono text-[10px] text-t2 bg-surface rounded-md p-2 border border-border max-h-24 overflow-y-auto leading-relaxed whitespace-pre-wrap">
                {out.data.slice(0, 400)}
                {out.data.length > 400 && (
                  <span className="text-t3">…</span>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Enable/Disable Toggle Switch ─────────────────────────────────────────────

function ToggleSwitch({ enabled, onChange, loading }) {
  return (
    <button
      onClick={onChange}
      disabled={loading}
      className={clsx(
        'relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-1 focus:ring-rust/40',
        enabled ? 'bg-green/30' : 'bg-surface2',
        loading && 'opacity-50 cursor-wait'
      )}
      role="switch"
      aria-checked={enabled}
    >
      <span
        className={clsx(
          'pointer-events-none inline-block h-4 w-4 transform rounded-full shadow-md ring-0 transition duration-200 ease-in-out',
          enabled ? 'translate-x-4 bg-green' : 'translate-x-0 bg-t3'
        )}
      />
    </button>
  )
}

// ─── Job Card ─────────────────────────────────────────────────────────────────

function JobCard({ job, onTrigger, onToggle, onDelete, onEdit }) {
  const [expanded, setExpanded] = useState(false)
  const [triggerLoading, setTriggerLoading] = useState(false)
  const [toggleLoading, setToggleLoading] = useState(false)
  const [triggerResult, setTriggerResult] = useState(null)

  const isActive = job.enabled !== false

  const handleTrigger = async () => {
    setTriggerLoading(true)
    setTriggerResult(null)
    try {
      const res = await apiFetch(`/api/cron/${encodeURIComponent(job.name)}/trigger`, {
        method: 'POST',
      })
      const body = await res.json().catch(() => ({}))
      const ok = res.ok
      setTriggerResult({
        ok,
        message: body.message ?? (ok ? 'Job kører nu' : `HTTP ${res.status}`),
      })
      if (ok) onTrigger?.()
    } catch (e) {
      setTriggerResult({ ok: false, message: e.message })
    } finally {
      setTimeout(() => setTriggerLoading(false), 800)
    }
  }

  const handleToggle = async () => {
    setToggleLoading(true)
    try {
      const res = await apiFetch(`/api/cron/${encodeURIComponent(job.name)}/enable`, {
        method: 'PATCH',
        body: JSON.stringify({ enabled: !isActive }),
      })
      if (res.ok) onToggle?.(job.name, !isActive)
    } catch (e) { if (import.meta.env.DEV) console.error('[CronPage] toggle error:', e) } finally {
      setToggleLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!window.confirm(`Slet job "${job.name}"?`)) return
    try {
      await apiFetch(`/api/cron/${encodeURIComponent(job.name)}`, { method: 'DELETE' })
      onDelete?.(job.name)
    } catch (e) { if (import.meta.env.DEV) console.error('[CronPage] delete error:', e) }
  }

  const lastRunRel = formatRel(job.last_run)
  const nextRunRel = formatRel(job.next_run)
  const nextRunAbs = formatAbs(job.next_run)

  return (
    <div className={clsx(
      'bg-surface border rounded-xl overflow-hidden transition-all',
      isActive ? 'border-border' : 'border-border/60'
    )}>
      {/* Card header */}
      <div className="p-4">
        <div className="flex items-start gap-3 mb-3">
          {/* Status icon */}
          <div className={clsx(
            'w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors',
            isActive ? 'bg-rust/10' : 'bg-surface2'
          )}>
            <Clock size={15} className={isActive ? 'text-rust' : 'text-t3'} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <div className="text-sm font-bold text-t1 truncate">{job.name}</div>
              <Chip variant={isActive ? 'online' : 'offline'} pulse={isActive}>
                {isActive ? 'Aktiv' : 'Inaktiv'}
              </Chip>
            </div>
            <div className="font-mono text-[10px] text-t3 mt-0.5 flex items-center gap-1.5">
              <Calendar size={9} />
              <span>{job.schedule?.display ?? job.schedule?.expr ?? job.schedule ?? '—'}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <ToggleSwitch enabled={isActive} onChange={handleToggle} loading={toggleLoading} />
          </div>
        </div>

        {/* Timestamps grid */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="bg-surface2/40 rounded-lg p-2.5 border border-white/[0.03]">
            <div className="text-[9px] font-bold uppercase tracking-widest text-t3 mb-1">Sidst kørt</div>
            {lastRunRel
              ? <div className="text-[11px] font-mono text-t2">{lastRunRel}</div>
              : <div className="text-[11px] font-mono text-t3">Aldrig</div>
            }
          </div>
          <div className="bg-surface2/40 rounded-lg p-2.5 border border-white/[0.03]">
            <div className="text-[9px] font-bold uppercase tracking-widest text-t3 mb-1">Næste kørsel</div>
            {nextRunRel
              ? (
                <div className="flex items-center gap-1">
                  <span className="text-[11px] font-mono text-t2">{nextRunRel}</span>
                  {isActive && <CountdownTimer targetTs={job.next_run} />}
                </div>
              )
              : <div className="text-[11px] font-mono text-t3">—</div>
            }
          </div>
        </div>

        {/* Prompt preview */}
        {job.prompt && (
          <div className="mb-3 bg-surface2/30 rounded-lg px-3 py-2 border border-white/[0.03]">
            <div className="text-[9px] font-bold uppercase tracking-widest text-t3 mb-1">Prompt</div>
            <div className="text-[11px] text-t2 line-clamp-2 leading-relaxed">{job.prompt}</div>
          </div>
        )}

        {/* Delivery info */}
        <div className="flex items-center gap-2 mb-3 text-[10px] text-t3">
          {job.deliver && (
            <span className="flex items-center gap-1">
              <TrendingUp size={9} />
              {job.deliver}
            </span>
          )}
          {job.skills?.length > 0 && (
            <span className="flex items-center gap-1">
              <Zap size={9} />
              {job.skills.slice(0, 3).join(', ')}
              {job.skills.length > 3 && ` +${job.skills.length - 3}`}
            </span>
          )}
          {job.repeat != null && (
            <span className="flex items-center gap-1">
              <RotateCw size={9} />
              repeat: {job.repeat ? 'ja' : 'nej'}
            </span>
          )}
        </div>

        {/* Trigger result */}
        {triggerResult && (
          <div className={clsx(
            'flex items-center gap-2 px-3 py-2 rounded-md mb-3 text-[11px] font-mono',
            triggerResult.ok
              ? 'bg-green/10 border border-green/20 text-green'
              : 'bg-rust/10 border border-rust/20 text-rust'
          )}>
            {triggerResult.ok
              ? <CheckCircle size={12} className="flex-shrink-0" />
              : <XCircle size={12} className="flex-shrink-0" />
            }
            <span>{triggerResult.message}</span>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={onTrigger}
            disabled={triggerLoading}
            className={clsx(
              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-semibold border transition-all',
              isActive
                ? 'bg-green/10 border-green/25 text-green hover:bg-green/20'
                : 'bg-surface2 border-border text-t3',
              triggerLoading && 'opacity-50 cursor-wait'
            )}
          >
            {triggerLoading
              ? <RotateCw size={11} className="animate-spin" />
              : <Play size={11} />
            }
            Kør nu
          </button>

          <button
            onClick={() => onEdit?.(job)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-semibold border border-border bg-surface2 text-t3 hover:text-t2 hover:border-white/20 transition-all"
          >
            <Edit3 size={11} />
            Rediger
          </button>

          <button
            onClick={() => setExpanded(v => !v)}
            className={clsx(
              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-semibold border transition-all',
              expanded
                ? 'bg-blue/10 border-blue/25 text-blue'
                : 'bg-surface2 border-border text-t3 hover:text-t2 hover:border-white/20'
            )}
          >
            {expanded ? <ChevronUp size={11} /> : <Eye size={11} />}
            {expanded ? 'Skjul output' : 'Se output'}
          </button>

          <button
            onClick={handleDelete}
            className="ml-auto inline-flex items-center gap-1 px-2 py-1.5 rounded-md text-[11px] font-semibold text-rust/60 border border-rust/10 hover:text-rust hover:border-rust/30 hover:bg-rust/5 transition-all opacity-0 group-hover:opacity-100"
          >
            <Trash2 size={10} />
            Slet
          </button>
        </div>
      </div>

      {/* Expanded output panel */}
      {expanded && <JobOutputPanel jobName={job.name} />}
    </div>
  )
}

// ─── Skeleton Card ─────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="bg-surface border border-border rounded-xl overflow-hidden p-4">
      <div className="flex items-start gap-3 mb-3">
        <div className="skeleton w-9 h-9 rounded-lg flex-shrink-0" />
        <div className="flex-1">
          <div className="skeleton h-3 w-2/3 mb-2" />
          <div className="skeleton h-2 w-1/3" />
        </div>
        <div className="skeleton w-16 h-5 rounded-full" />
      </div>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="skeleton h-12 rounded-lg" />
        <div className="skeleton h-12 rounded-lg" />
      </div>
      <div className="skeleton h-8 w-full rounded-md mb-3" />
      <div className="flex gap-2">
        <div className="skeleton h-7 w-16 rounded-md" />
        <div className="skeleton h-7 w-20 rounded-md" />
      </div>
    </div>
  )
}

// ─── Empty State ───────────────────────────────────────────────────────────────

function EmptyState({ onCreate }) {
  return (
    <div className="bg-surface border border-border rounded-xl py-16 text-center">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-surface2 border border-border mb-4">
        <Clock size={28} className="text-t3" />
      </div>
      <div className="text-base font-bold text-t2 mb-1">Ingen cron jobs endnu</div>
      <div className="text-[12px] text-t3 mb-6 max-w-sm mx-auto leading-relaxed">
        Opret dit første schedulede job for at automatisere repetitive opgaver
      </div>
      <button
        onClick={onCreate}
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-rust text-white text-[12px] font-semibold shadow-[0_8px_20px_rgba(224,95,64,0.25)] hover:bg-[#ea6a4e] transition-colors"
      >
        <Plus size={14} />
        Opret dit første job
      </button>
    </div>
  )
}

// ─── Create Job Modal ──────────────────────────────────────────────────────────

const PRESETS = [
  { label: 'Hver morgen 9:00', value: '0 9 * * *' },
  { label: 'Hver time', value: '0 * * * *' },
  { label: 'Hver dag kl 8', value: '0 8 * * *' },
  { label: 'Hver weekend', value: '0 0 * * 0' },
  { label: 'Hver mandag', value: '0 9 * * 1' },
]

const DELIVER_OPTIONS = [
  { value: 'local', label: 'Local (gemt)' },
  { value: 'telegram', label: 'Telegram' },
  { value: 'discord', label: 'Discord' },
  { value: 'email', label: 'Email' },
]

function CreateJobModal({ open, onClose, onSuccess, initialJob = null }) {
  const [name, setName] = useState('')
  const [schedule, setSchedule] = useState('')
  const [prompt, setPrompt] = useState('')
  const [deliver, setDeliver] = useState('local')
  const [skills, setSkills] = useState('')
  const [enabled, setEnabled] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  const isEdit = !!initialJob

  // Reset or pre-fill on open/close
  useEffect(() => {
    if (open) {
      setName(initialJob?.name ?? '')
      setSchedule(initialJob?.schedule?.expr ?? initialJob?.schedule ?? '')
      setPrompt(initialJob?.prompt ?? '')
      setDeliver(initialJob?.deliver ?? 'local')
      setSkills(initialJob?.skills?.join(', ') ?? '')
      setEnabled(initialJob?.enabled !== false)
      setError(null)
      setSuccess(false)
    }
  }, [open, initialJob])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim() || !schedule.trim() || !prompt.trim()) {
      setError('Udfyld venligst alle obligatoriske felter')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const skillsList = skills.split(',').map(s => s.trim()).filter(Boolean)
      const url = isEdit ? `/api/cron/jobs/${encodeURIComponent(initialJob.name)}` : '/api/cron/jobs'
      const method = isEdit ? 'PATCH' : 'POST'
      
      const res = await apiFetch(url, {
        method,
        body: JSON.stringify({
          name: name.trim(),
          schedule: schedule.trim(),
          prompt: prompt.trim(),
          deliver,
          enabled,
          skills: skillsList,
        }),
      })
      const body = await res.json().catch(() => ({}))

      if (!res.ok) {
        setError(body.error ?? `HTTP ${res.status}`)
        return
      }

      setSuccess(true)
      setTimeout(() => {
        onSuccess?.()
        onClose()
      }, 1200)
    } catch (e) {
      setError(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg bg-surface border border-border rounded-2xl shadow-[0_30px_80px_rgba(0,0,0,0.5)] overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-rust/10">
              <Clock size={14} className="text-rust" />
            </div>
            <span className="text-sm font-bold text-t1">{isEdit ? `Rediger job: ${initialJob.name}` : 'Oprete nyt job'}</span>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-md flex items-center justify-center text-t3 hover:text-t2 hover:bg-surface2 transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-5 space-y-5">

            {/* Job name */}
            {!isEdit && (
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-t3 mb-1.5">
                  Job navn <span className="text-rust">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="fx: Daglig statusrapport"
                  className="w-full bg-surface2 border border-border rounded-lg px-3 py-2.5 text-sm text-t1 placeholder-t3 outline-none focus:border-rust focus:ring-1 focus:ring-rust/20 transition-all"
                  autoFocus
                />
              </div>
            )}

            {/* Schedule */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-t3 mb-1.5">
                Schedule (cron) <span className="text-rust">*</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={schedule}
                  onChange={e => setSchedule(e.target.value)}
                  placeholder="0 9 * * *"
                  className="flex-1 bg-surface2 border border-border rounded-lg px-3 py-2.5 text-sm text-t1 font-mono placeholder-t3 outline-none focus:border-rust focus:ring-1 focus:ring-rust/20 transition-all"
                />
              </div>
              {/* Presets */}
              <div className="flex flex-wrap gap-1.5 mt-2">
                <span className="text-[9px] text-t3 font-bold uppercase tracking-widest mr-1 self-center">Presets:</span>
                {PRESETS.map(p => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setSchedule(p.value)}
                    className={clsx(
                      'px-2 py-1 rounded-md text-[10px] font-semibold border transition-all',
                      schedule === p.value
                        ? 'bg-rust/15 border-rust/30 text-rust'
                        : 'bg-surface2 border-border text-t3 hover:text-t2 hover:border-white/20'
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Prompt */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-t3 mb-1.5">
                Prompt <span className="text-rust">*</span>
              </label>
              <textarea
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                placeholder="Hvad skal jobbet gøre? Beskriv opgaven..."
                rows={4}
                className="w-full bg-surface2 border border-border rounded-lg px-3 py-2.5 text-sm text-t1 placeholder-t3 outline-none focus:border-rust focus:ring-1 focus:ring-rust/20 transition-all resize-none leading-relaxed"
              />
            </div>

            {/* Deliver */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-t3 mb-1.5">
                Levering
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {DELIVER_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setDeliver(opt.value)}
                    className={clsx(
                      'px-2 py-2 rounded-lg text-[11px] font-semibold border transition-all text-center',
                      deliver === opt.value
                        ? 'bg-rust/15 border-rust/30 text-rust'
                        : 'bg-surface2 border-border text-t3 hover:text-t2 hover:border-white/20'
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Skills */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-t3 mb-1.5">
                Skills (kommasepareret)
              </label>
              <input
                type="text"
                value={skills}
                onChange={e => setSkills(e.target.value)}
                placeholder="fx: web_search, calculator"
                className="w-full bg-surface2 border border-border rounded-lg px-3 py-2.5 text-sm text-t1 placeholder-t3 outline-none focus:border-rust focus:ring-1 focus:ring-rust/20 transition-all"
              />
            </div>

            {/* Enabled toggle */}
            <div className="flex items-center justify-between py-2">
              <div>
                <div className="text-sm font-semibold text-t1">Aktiveret</div>
                <div className="text-[11px] text-t3">Jobbet kan køre ifølge schedule</div>
              </div>
              <ToggleSwitch enabled={enabled} onChange={() => setEnabled(v => !v)} loading={false} />
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-rust/10 border border-rust/20 text-[12px] text-rust">
                <AlertTriangle size={13} className="flex-shrink-0" />
                {error}
              </div>
            )}

            {/* Success */}
            {success && (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-green/10 border border-green/20 text-[12px] text-green">
                <CheckCircle size={13} className="flex-shrink-0" />
                {isEdit ? 'Job opdateret!' : 'Job oprettet!'} Lukker…
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-border bg-surface2/30 flex-shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-[12px] font-semibold text-t2 border border-border hover:bg-surface2 transition-colors"
            >
              Annuller
            </button>
            <button
              type="submit"
              disabled={submitting}
              className={clsx(
                'inline-flex items-center gap-2 px-5 py-2 rounded-lg text-[12px] font-semibold bg-rust text-white transition-colors',
                submitting ? 'opacity-50 cursor-wait' : 'hover:bg-[#ea6a4e]'
              )}
            >
              {submitting ? <Loader2 size={13} className="animate-spin" /> : isEdit ? <Edit3 size={13} /> : <Plus size={13} />}
              {isEdit ? 'Gem ændringer' : 'Opret job'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function CronPage() {
  const { data, loading, error, refetch } = usePoll('/cron', 30000)
  const { data: stats, loading: statsLoading, refetch: statsRefetch } = useApi('/cron/stats')

  const [filter, setFilter] = useState('all')
  const [showCreate, setShowCreate] = useState(false)
  const [editingJob, setEditingJob] = useState(null)
  const [jobToggleVersions, setJobToggleVersions] = useState({})

  const jobs = data?.jobs ?? []

  // Apply filter
  const filteredJobs = jobs.filter(job => {
    if (filter === 'active') return job.enabled !== false
    if (filter === 'inactive') return job.enabled === false
    return true
  })

  // Handle toggle from JobCard
  const handleToggle = useCallback((jobName, newEnabled) => {
    // Update local data optimistically
    setJobToggleVersions(prev => ({ ...prev, [jobName]: newEnabled }))
    refetch()
  }, [refetch])

  // Handle delete from JobCard
  const handleDelete = useCallback(() => {
    refetch()
  }, [refetch])

  // Merge toggle versions with job data
  const displayJobs = filteredJobs.map(job => ({
    ...job,
    enabled: jobToggleVersions[job.name] !== undefined ? jobToggleVersions[job.name] : job.enabled,
  }))

  return (
    <div className="max-w-3xl space-y-5">

      {/* Background glow */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-16 left-8 h-48 w-48 rounded-full bg-rust/8 blur-3xl" />
        <div className="absolute top-32 right-[-2rem] h-40 w-40 rounded-full bg-blue/8 blur-3xl" />
      </div>

      {/* Page header */}
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-rust/10 border border-rust/20 flex items-center justify-center flex-shrink-0">
          <Clock size={16} className="text-rust" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-base font-bold text-t1">Scheduled Jobs</div>
          <div className="text-[11px] text-t3 mt-0.5">
            Automatiser repetitive opgaver med cron jobs
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={refetch}
            className="w-7 h-7 rounded-md flex items-center justify-center text-t3 hover:text-t2 hover:bg-surface2 transition-colors"
            title="Opdater"
          >
            <RefreshCw size={13} />
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-rust text-white text-[11px] font-semibold hover:bg-[#ea6a4e] transition-colors shadow-[0_4px_12px_rgba(224,95,64,0.25)]"
          >
            <Plus size={12} />
            Opret job
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <StatsBar stats={stats} loading={statsLoading} />

      {/* Filter chips */}
      <FilterChips filter={filter} onChange={setFilter} />

      {/* Job count summary */}
      {!loading && jobs.length > 0 && (
        <div className="flex items-center gap-2 text-[11px] text-t3 font-mono">
          <span>Viser</span>
          <span className="text-t1 font-semibold">{filteredJobs.length}</span>
          <span>af {jobs.length} jobs</span>
          {filter !== 'all' && (
            <button
              onClick={() => setFilter('all')}
              className="text-rust hover:text-rust/80 underline underline-offset-2"
            >
              Nulstil filter
            </button>
          )}
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="bg-surface border border-border rounded-xl p-6 text-center">
          <AlertTriangle size={18} className="text-rust mx-auto mb-2" />
          <div className="text-sm font-semibold text-rust mb-1">Fejl ved indlæsning</div>
          <div className="text-[11px] text-t3 mb-4">{error}</div>
          <button
            onClick={refetch}
            className="px-3 py-1.5 rounded-md bg-surface2 border border-border text-xs text-t2 hover:text-t1 transition-colors"
          >
            Prøv igen
          </button>
        </div>
      )}

      {/* Job list */}
      <div className="space-y-3">
        {loading
          ? Array.from({ length: 3 }, (_, i) => <SkeletonCard key={i} />)
          : !error && displayJobs.length === 0 && filter === 'all'
            ? <EmptyState onCreate={() => setShowCreate(true)} />
            : !error && displayJobs.length === 0
              ? (
                <div className="bg-surface border border-border rounded-xl py-10 text-center">
                  <div className="text-sm text-t3">Ingen jobs matcher filteret</div>
                  <button
                    onClick={() => setFilter('all')}
                    className="mt-2 text-[11px] text-rust hover:underline"
                  >
                    Vis alle jobs
                  </button>
                </div>
              )
              :              displayJobs.map(job => (
                  <div key={job.name} className="group">
                    <JobCard
                      job={job}
                      onTrigger={refetch}
                      onToggle={handleToggle}
                      onDelete={handleDelete}
                      onEdit={(j) => {
                        setEditingJob(j)
                        setShowCreate(true)
                      }}
                    />
                  </div>
                ))
        }
      </div>

      {/* Create/Edit modal */}
      <CreateJobModal
        open={showCreate}
        initialJob={editingJob}
        onClose={() => {
          setShowCreate(false)
          setEditingJob(null)
        }}
        onSuccess={() => {
          setShowCreate(false)
          setEditingJob(null)
          refetch()
          // Also refresh stats
          if (statsRefetch) statsRefetch()
        }}
      />

      {/* Footer hint */}
      {jobs.length > 0 && (
        <div className="text-center text-[10px] text-t3">
          Opdateres automatisk hvert 30. sekund · <button onClick={refetch} className="text-t2 hover:text-t1 underline underline-offset-2">Opdater nu</button>
        </div>
      )}
    </div>
  )
}


export default CronPage
