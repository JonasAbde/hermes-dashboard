import { useState, useEffect, useCallback, useRef } from 'react'
import { useApi } from '../hooks/useApi'
import { apiFetch } from '../utils/auth'
import { Chip } from '../components/ui/Chip'
import { Card } from '../components/ui/Card'
import { formatDistanceToNow, format } from 'date-fns'
import { da } from 'date-fns/locale'
import {
  Search, X, ChevronLeft, ChevronRight, Clock,
  Zap, MessageSquare, Terminal, Calendar,
  AlertCircle, Loader2, SlidersHorizontal, User,
  Filter, DollarSign, MessageCircle
} from 'lucide-react'
import { clsx } from 'clsx'
import { SessionReplay } from '../components/SessionReplay'

// ─── Design Tokens (inline) ──────────────────────────────────────────────────
const T = {
  bg:      '#060608',
  surface: '#0d0f17',
  surface2:'#0f1119',
  border:  '#111318',
  text:    '#d8d8e0',
  muted:   '#6b6b80',
  green:   '#00b478',
  rust:    '#e05f40',
  blue:    '#4a80c8',
  amber:   '#e09040',
}

// ─── Source badge config ──────────────────────────────────────────────────────
const SOURCE_CONFIG = {
  telegram: { variant: 'online',  label: 'Telegram' },
  cli:      { variant: 'blue',    label: 'CLI'      },
  cron:     { variant: 'pending', label: 'Cron'     },
  api:      { variant: 'blue',    label: 'API'      },
  web:      { variant: 'model',   label: 'Web'      },
}
const getSourceConfig = (src) => SOURCE_CONFIG[src?.toLowerCase()] ?? { variant: 'model', label: src ?? '—' }

// ─── Role colors for trace ────────────────────────────────────────────────────
const ROLE_COLORS = {
  tool:      '#4a80c8',
  assistant: '#00b478',
  user:      '#e05f40',
  reasoning: '#e09040',
  system:    '#6b6b80',
}

// ─── Stat Cards ───────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, icon: Icon, accent }) {
  const accentColors = {
    green: 'text-green',
    rust:  'text-rust',
    blue:  'text-blue',
    amber: 'text-amber',
  }
  return (
    <div className="bg-surface border border-border rounded-lg p-4 flex items-start gap-3">
      <div className={clsx('p-2 rounded-lg bg-surface2', accentColors[accent])}>
        <Icon size={16} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[9px] font-bold uppercase tracking-widest text-t3 mb-1">{label}</div>
        <div className={clsx('text-xl font-extrabold tracking-tight', accentColors[accent])}>{value ?? '—'}</div>
        {sub && <div className="text-[10px] text-t3 mt-0.5 truncate">{sub}</div>}
      </div>
    </div>
  )
}

function StatsHeader({ stats, loading, loadingTimedOut = false }) {
  const budgetLabel = stats?.budget != null ? `$${Number(stats.budget).toFixed(2)}` : 'Ikke tilgængelig'

  if (loading && !stats && !loadingTimedOut) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-surface border border-border rounded-lg p-4">
            <div className="skeleton h-2 w-2/3 mb-3" />
            <div className="skeleton h-7 w-1/2 mb-1" />
            <div className="skeleton h-2 w-3/4" />
          </div>
        ))}
      </div>
    )
  }

  if (loading && loadingTimedOut && !stats) {
    return (
      <div className="mb-6 bg-surface border border-rust/30 rounded-lg p-4">
        <p className="text-sm text-rust font-medium">Kunne ikke hente statistik endnu</p>
        <p className="text-[11px] text-t3 mt-0.5">API kan være offline. Siden viser cached/tilgængelige data når muligt.</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
      <StatCard
        label="Sessions i dag"
        value={stats?.sessions_today ?? 0}
        sub={`${stats?.sessions_week ?? 0} denne uge`}
        icon={Zap}
        accent="rust"
      />
      <StatCard
        label="Tokens i dag"
        value={stats?.tokens_today != null ? `${(stats.tokens_today / 1000).toFixed(1)}k` : '—'}
        sub={`cache: ${stats?.cache_pct ?? '—'}%`}
        icon={SlidersHorizontal}
        accent="green"
      />
      <StatCard
        label="Memory"
        value={stats?.memory_pct != null ? `${stats.memory_pct}%` : '—'}
        sub={stats?.memory_pct >= 90 ? '⚠ flush snart' : 'OK'}
        icon={AlertCircle}
        accent={stats?.memory_pct >= 90 ? 'amber' : 'blue'}
      />
      <StatCard
        label="Cost april"
        value={stats?.cost_month != null ? `$${stats.cost_month.toFixed(2)}` : '—'}
        sub={`budget: ${budgetLabel}`}
        icon={MessageSquare}
        accent="blue"
      />
    </div>
  )
}

// ─── Session Table ────────────────────────────────────────────────────────────
function SessionTableSkeleton() {
  return (
    <>
      {[...Array(8)].map((_, i) => (
        <tr key={i} className="border-b border-border">
          <td className="px-4 py-3.5">
            <div className="skeleton h-3 w-16" />
          </td>
          <td className="px-3 py-3.5">
            <div className="space-y-1.5 min-w-[120px]">
              <div className="skeleton h-3.5 w-3/4" />
              <div className="skeleton h-2 w-1/4" />
            </div>
          </td>
          <td className="px-3 py-3.5">
            <div className="skeleton h-5 w-16 rounded-full" />
          </td>
          <td className="px-3 py-3.5 hidden md:table-cell">
            <div className="skeleton h-3 w-24" />
          </td>
          <td className="px-3 py-3.5 hidden lg:table-cell">
            <div className="skeleton h-3 w-16" />
          </td>
          <td className="px-3 py-3.5">
            <div className="skeleton h-3 w-12" />
          </td>
          <td className="px-4 py-3.5 hidden sm:table-cell">
            <div className="skeleton h-3 w-12" />
          </td>
        </tr>
      ))}
    </>
  )
}

function SessionTableRow({ session, selected, onClick }) {
  const sourceCfg = getSourceConfig(session.source)
  const cost = session.estimated_cost_usd ?? session.actual_cost_usd ?? 0
  const dur = session.ended_at && session.started_at
    ? ((session.ended_at - session.started_at) / 1000).toFixed(1)
    : null

  return (
    <tr
      onClick={onClick}
      className={clsx(
        'border-b border-border cursor-pointer transition-all duration-150',
        selected
          ? 'bg-surface2/80'
          : 'hover:bg-surface2/50'
      )}
    >
      {/* Time */}
      <td className="px-4 py-3.5 whitespace-nowrap">
        <div className="flex flex-col">
          <span className="text-[11px] font-mono text-t1">
            {format(new Date(session.started_at * 1000), 'HH:mm:ss')}
          </span>
          <span className="text-[9px] text-t3 mt-0.5">
            {formatDistanceToNow(new Date(session.started_at * 1000), { locale: da, addSuffix: true })}
          </span>
        </div>
      </td>

      {/* Title */}
      <td className="px-3 py-3.5 min-w-0">
        <div className="text-sm font-medium text-t1 truncate max-w-[240px]" title={session.title}>
          {session.title || <span className="text-t3 italic">Untitled session</span>}
        </div>
        <div className="font-mono text-[9px] text-t3 mt-0.5">{session.id.slice(-12)}</div>
      </td>

      {/* Source badge */}
      <td className="px-3 py-3.5">
        <Chip variant={sourceCfg.variant}>{sourceCfg.label}</Chip>
      </td>

      {/* Model */}
      <td className="px-3 py-3.5 hidden md:table-cell">
        <span className="font-mono text-[11px] text-t2 bg-surface2 px-1.5 py-0.5 rounded border border-border">
          {session.model?.split('/').pop() ?? '—'}
        </span>
      </td>

      {/* Tokens */}
      <td className="px-3 py-3.5 hidden lg:table-cell">
        <span className="font-mono text-[11px] text-t2">
          {((session.input_tokens + session.output_tokens) / 1000).toFixed(1)}k
        </span>
      </td>

      {/* Cost */}
      <td className="px-3 py-3.5">
        <span className={clsx(
          'font-mono text-[11px]',
          cost > 0.05 ? 'text-amber' : cost > 0 ? 'text-t2' : 'text-t3'
        )}>
          ${cost.toFixed(4)}
        </span>
      </td>

      {/* Duration */}
      <td className="px-4 py-3.5 hidden sm:table-cell">
        <div className="flex items-center gap-1">
          <Clock size={10} className="text-t3" />
          <span className="font-mono text-[10px] text-t3">
            {dur ? `${dur}s` : '—'}
          </span>
        </div>
      </td>
    </tr>
  )
}

function SessionTable({ sessions, loading, selectedId, onSelect }) {
  return (
    <div className="bg-surface border border-border rounded-lg overflow-hidden safe-scroll-x">
      <table className="w-full min-w-[680px]">
        <thead>
          <tr className="border-b border-border bg-surface2/30">
            <th className="px-4 py-2.5 text-left text-[9px] font-bold uppercase tracking-widest text-t3 w-24">Tid</th>
            <th className="px-3 py-2.5 text-left text-[9px] font-bold uppercase tracking-widest text-t3">Session</th>
            <th className="px-3 py-2.5 text-left text-[9px] font-bold uppercase tracking-widest text-t3">Kilde</th>
            <th className="px-3 py-2.5 text-left text-[9px] font-bold uppercase tracking-widest text-t3 hidden md:table-cell">Model</th>
            <th className="px-3 py-2.5 text-left text-[9px] font-bold uppercase tracking-widest text-t3 hidden lg:table-cell">Tokens</th>
            <th className="px-3 py-2.5 text-left text-[9px] font-bold uppercase tracking-widest text-t3">Cost</th>
            <th className="px-4 py-2.5 text-left text-[9px] font-bold uppercase tracking-widest text-t3 hidden sm:table-cell">Varighed</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <SessionTableSkeleton />
          ) : sessions.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-4 py-16 text-center">
                <div className="flex flex-col items-center gap-3">
                  <Terminal size={32} className="text-t3" />
                  <p className="text-sm text-t3">Ingen sessions fundet</p>
                  <p className="text-[11px] text-t3">Prøv en anden søgning eller vent på nye sessions</p>
                </div>
              </td>
            </tr>
          ) : (
            sessions.map(s => (
              <SessionTableRow
                key={s.id}
                session={s}
                selected={s.id === selectedId}
                onClick={() => onSelect(s)}
              />
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

// ─── Pagination ──────────────────────────────────────────────────────────────
function Pagination({ page, total, limit, onPageChange }) {
  const totalPages = Math.ceil(total / limit)
  if (totalPages <= 1) return null

  const pages = []
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= page - 1 && i <= page + 1)) {
      pages.push(i)
    } else if (pages[pages.length - 1] !== '...') {
      pages.push('...')
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-center gap-1 py-3 border-t border-border bg-surface/50 px-2">
      <button
        onClick={() => onPageChange(Math.max(1, page - 1))}
        disabled={page === 1}
        className="flex items-center gap-1 px-3 py-1.5 rounded text-sm text-t2 hover:bg-surface2 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        <ChevronLeft size={14} />
        <span className="hidden sm:inline">Forrige</span>
      </button>

      <div className="flex items-center gap-1 mx-2">
        {pages.map((p, i) => (
          p === '...' ? (
            <span key={`ellipsis-${i}`} className="px-2 text-t3">…</span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              className={clsx(
                'w-8 h-8 rounded text-[11px] font-mono transition-colors',
                p === page
                  ? 'bg-rust text-white'
                  : 'text-t2 hover:bg-surface2'
              )}
            >
              {p}
            </button>
          )
        ))}
      </div>

      <button
        onClick={() => onPageChange(Math.min(totalPages, page + 1))}
        disabled={page >= totalPages}
        className="flex items-center gap-1 px-3 py-1.5 rounded text-sm text-t2 hover:bg-surface2 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        <span className="hidden sm:inline">Næste</span>
        <ChevronRight size={14} />
      </button>

      <span className="ml-3 font-mono text-[10px] text-t3 hidden sm:inline">
        Side {page} / {totalPages} ({total} total)
      </span>
    </div>
  )
}

// ─── Search Input ───────────────────────────────────────────────────────────
function SearchInput({ value, onChange, onClear }) {
  return (
    <div className="relative flex items-center">
      <Search size={14} className="absolute left-3 text-t3 pointer-events-none" />
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="Søg i sessions, traces, messages…"
        className="w-full sm:max-w-md bg-surface border border-border rounded-lg pl-9 pr-8 py-2.5 text-sm text-t1 placeholder-t3 outline-none focus:border-rust focus:ring-1 focus:ring-rust/30 transition-all"
      />
      {value && (
        <button
          onClick={onClear}
          className="absolute right-3 text-t3 hover:text-t2 transition-colors"
        >
          <X size={14} />
        </button>
      )}
    </div>
  )
}

// ─── Filter Chips ──────────────────────────────────────────────────────────
const SOURCE_FILTERS = [
  { key: 'all',      label: 'Alle' },
  { key: 'telegram', label: 'Telegram' },
  { key: 'cli',      label: 'CLI' },
  { key: 'cron',     label: 'Cron' },
  { key: 'api',      label: 'API' },
]

const COST_FILTERS = [
  { key: 'all',  label: 'Alle' },
  { key: 'free', label: 'Gratis' },
  { key: 'low',  label: '< $0.01' },
  { key: 'mid',  label: '$0.01-0.05' },
  { key: 'high', label: '> $0.05' },
]

function FilterChips({ sourceFilter, onSourceChange, costFilter, onCostChange, stats }) {
  const sources = SOURCE_FILTERS
  const costs = COST_FILTERS

  const todaySessions = stats?.sessions_today ?? 0
  const weekSessions = stats?.sessions_week ?? 0
  const todayCost = stats?.cost_month ?? 0

  return (
    <div className="space-y-2">
      {/* Quick stats row */}
      <div className="flex flex-wrap items-center gap-4 text-[10px] font-mono text-t3">
        <span className="flex items-center gap-1.5">
          <MessageCircle size={10} className="text-rust" />
          <span className="text-t1 font-semibold">{todaySessions}</span> i dag
        </span>
        <span className="flex items-center gap-1.5">
          <Clock size={10} />
          <span className="text-t1 font-semibold">{weekSessions}</span> denne uge
        </span>
        <span className="flex items-center gap-1.5">
          <DollarSign size={10} className="text-green" />
          <span className="text-t1 font-semibold">${todayCost.toFixed(2)}</span> this month
        </span>
      </div>

      {/* Source filter chips */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 text-[10px] text-t3 mr-1">
          <Filter size={10} />
          Kilde:
        </div>
        {sources.map(s => (
          <button
            key={s.key}
            onClick={() => onSourceChange(s.key)}
            className={clsx(
              'px-2.5 py-1 rounded-full text-[10px] font-semibold border transition-all',
              sourceFilter === s.key
                ? 'bg-rust/20 border-rust/40 text-rust'
                : 'bg-surface border-border text-t3 hover:text-t2 hover:border-white/20'
            )}
          >
            {s.label}
          </button>
        ))}

        <div className="h-4 w-px bg-border mx-1" />

        {/* Cost filter chips */}
        <div className="flex items-center gap-1.5 text-[10px] text-t3 mr-1">
          <DollarSign size={10} />
          Cost:
        </div>
        {costs.map(c => (
          <button
            key={c.key}
            onClick={() => onCostChange(c.key)}
            className={clsx(
              'px-2.5 py-1 rounded-full text-[10px] font-semibold border transition-all',
              costFilter === c.key
                ? 'bg-green/20 border-green/40 text-green'
                : 'bg-surface border-border text-t3 hover:text-t2 hover:border-white/20'
            )}
          >
            {c.label}
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── FTS Search Results Panel ────────────────────────────────────────────────
function SearchResults({ results, loading, onSelect }) {
  if (!results && !loading) return null
  if (loading) {
    return (
      <div className="bg-surface border border-border rounded-lg p-6 flex items-center justify-center gap-3">
        <Loader2 size={16} className="text-t3 animate-spin" />
        <span className="text-sm text-t3">Søger…</span>
      </div>
    )
  }
  if (!results?.results?.length) return null

  return (
    <div className="bg-surface border border-border rounded-lg overflow-hidden">
      <div className="px-4 py-2.5 border-b border-border flex items-center gap-2">
        <Search size={12} className="text-t3" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-t3">
          Søgeresultater ({results.results.length})
        </span>
      </div>
      <div className="divide-y divide-border max-h-80 overflow-y-auto">
        {results.results.map(r => {
          const sourceCfg = getSourceConfig(r.source)
          return (
            <button
              key={r.id}
              onClick={() => onSelect(r)}
              className="w-full text-left px-4 py-3 hover:bg-surface2/60 transition-colors"
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-medium text-t1 truncate flex-1">
                  {r.title || 'Untitled'}
                </span>
                <Chip variant={sourceCfg.variant}>{sourceCfg.label}</Chip>
              </div>
              {r.snippet && (
                <p
                  className="text-[11px] text-t2 line-clamp-2 [&>mark]:bg-amber-500/20 [&>mark]:text-amber-200 [&>mark]:rounded-sm [&>mark]:px-0.5"
                  dangerouslySetInnerHTML={{
                    __html: r.snippet
                      .replace(/&/g, '&amp;')
                      .replace(/</g, '&lt;')
                      .replace(/>/g, '&gt;')
                      .replace(/"/g, '&quot;')
                  }}
                />
              )}
              <div className="mt-1.5 flex items-center gap-2">
                <Calendar size={10} className="text-t3" />
                <span className="font-mono text-[9px] text-t3">
                  {r.started_at
                    ? formatDistanceToNow(new Date(r.started_at * 1000), { locale: da, addSuffix: true })
                    : ''}
                </span>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Trace Timeline Component ────────────────────────────────────────────────
function TraceTimeline({ steps, loading, error }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 gap-3">
        <Loader2 size={16} className="text-t3 animate-spin" />
        <span className="text-sm text-t3">Indlæser trace…</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 py-6 text-sm text-rust">
        <AlertCircle size={16} />
        <span>Kunne ikke indlæse trace: {error}</span>
      </div>
    )
  }

  if (!steps?.length) {
    return (
      <div className="py-8 text-center">
        <Terminal size={24} className="text-t3 mx-auto mb-2" />
        <p className="text-sm text-t3">Ingen trace data tilgængelig</p>
      </div>
    )
  }

  // Limit to 12 steps as per requirement
  const displaySteps = steps.slice(0, 12)
  const totalMs = steps.reduce((sum, s) => sum + (s.ms || 0), 0)

  return (
    <div className="space-y-3">
      {/* Summary */}
      <div className="flex items-center gap-4 text-[10px] font-mono text-t3 mb-4">
        <span>{displaySteps.length} trin</span>
        <span>·</span>
        <span>{totalMs.toFixed(0)}ms total</span>
        <span>·</span>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: '#e05f40' }} />
          <span>user</span>
          <span className="w-2 h-2 rounded-full ml-1" style={{ background: '#00b478' }} />
          <span>assistant</span>
          <span className="w-2 h-2 rounded-full ml-1" style={{ background: '#4a80c8' }} />
          <span>tool</span>
          <span className="w-2 h-2 rounded-full ml-1" style={{ background: '#e09040' }} />
          <span>reasoning</span>
        </div>
      </div>

      {/* Gantt-style bars */}
      <div className="space-y-1">
        {displaySteps.map((step, i) => {
          const color = step.color || ROLE_COLORS[step.role] || ROLE_COLORS.assistant
          return (
            <div key={i} className="group">
              {/* Bar row */}
              <div className="flex items-center gap-2">
                <div className="w-32 flex-shrink-0">
                  <span
                    className="font-mono text-[10px] text-t2 truncate block"
                    title={step.label}
                  >
                    {step.label}
                  </span>
                </div>
                <div className="flex-1 h-6 bg-surface2 rounded overflow-hidden relative">
                  <div
                    className="absolute h-full rounded flex items-center px-2 transition-all duration-200"
                    style={{
                      left: `${step.offset_pct || 0}%`,
                      width: `${Math.max(step.width_pct || 0, 2)}%`,
                      background: `${color}22`,
                      borderLeft: `2px solid ${color}`,
                    }}
                    title={`${step.label} — ${step.ms}ms`}
                  />
                </div>
                <div className="w-16 text-right flex-shrink-0">
                  <span className="font-mono text-[10px] text-t2">
                    {step.ms?.toFixed(0) ?? '?'}ms
                  </span>
                </div>
              </div>

              {/* Tooltip / expanded info */}
              <div className="ml-34 pl-34 hidden group-hover:block mt-1">
                <div className="flex items-center gap-3 text-[9px] font-mono text-t3">
                  <span style={{ color }}>● {step.role || 'unknown'}</span>
                  <span>{step.ms?.toFixed(2) ?? '?'}ms</span>
                  <span>offset: {(step.offset_pct || 0).toFixed(1)}%</span>
                  <span>width: {(step.width_pct || 0).toFixed(1)}%</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Session Detail Panel ────────────────────────────────────────────────────
function SessionDetailPanel({ session, onClose }) {
  const [activeTab, setActiveTab] = useState('trace')

  const { data: trace, loading: traceLoading, error: traceError } = useApi(
    session ? `/sessions/${session.id}/trace` : null
  )

  const { data: chat, loading: chatLoading, error: chatError } = useApi(
    session ? `/sessions/${session.id}/messages` : null
  )

  if (!session) return null

  const cost = session.estimated_cost_usd ?? session.actual_cost_usd ?? 0
  const dur = session.ended_at && session.started_at
    ? ((session.ended_at - session.started_at) / 1000).toFixed(1)
    : null

  return (
    <div
      className="fixed inset-y-0 right-0 sm:left-auto w-full sm:max-w-lg bg-surface border-l border-border shadow-2xl z-50 flex flex-col animate-slide-in"
      style={{ animation: 'slideInRight 0.2s ease-out' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-surface2/30">
        <div className="flex items-center gap-2">
          <Terminal size={16} className="text-t3" />
          <h2 className="text-sm font-bold text-t1 truncate max-w-[260px]">
            {session.title || 'Session Detail'}
          </h2>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded hover:bg-surface2 text-t3 hover:text-t2 transition-colors"
        >
          <X size={18} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* Session info */}
        <div className="bg-surface2/50 rounded-lg p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <div className="text-[9px] font-bold uppercase tracking-widest text-t3 mb-1">Session ID</div>
              <div className="font-mono text-[11px] text-t2 truncate" title={session.id}>
                {session.id.slice(-16)}
              </div>
            </div>
            <div>
              <div className="text-[9px] font-bold uppercase tracking-widest text-t3 mb-1">Kilde</div>
              <Chip variant={getSourceConfig(session.source).variant}>
                {getSourceConfig(session.source).label}
              </Chip>
            </div>
            <div>
              <div className="text-[9px] font-bold uppercase tracking-widest text-t3 mb-1">Model</div>
              <div className="font-mono text-[11px] text-t2 truncate">
                {session.model ?? '—'}
              </div>
            </div>
            <div>
              <div className="text-[9px] font-bold uppercase tracking-widest text-t3 mb-1">Cost</div>
              <div className={clsx(
                'font-mono text-[11px]',
                cost > 0.05 ? 'text-amber' : 'text-t2'
              )}>
                ${cost.toFixed(4)}
              </div>
            </div>
            <div>
              <div className="text-[9px] font-bold uppercase tracking-widest text-t3 mb-1">Tokens</div>
              <div className="font-mono text-[11px] text-t2">
                {((session.input_tokens + session.output_tokens) / 1000).toFixed(1)}k
                <span className="text-t3 ml-1">
                  ({session.input_tokens?.toLocaleString() ?? '?'}in / {session.output_tokens?.toLocaleString() ?? '?'}out)
                </span>
              </div>
            </div>
            <div>
              <div className="text-[9px] font-bold uppercase tracking-widest text-t3 mb-1">Varighed</div>
              <div className="font-mono text-[11px] text-t2">
                {dur ? `${dur}s` : '—'}
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-border">
            <div className="text-[9px] font-bold uppercase tracking-widest text-t3 mb-1">Startet</div>
            <div className="flex items-center gap-2">
              <Calendar size={11} className="text-t3" />
              <span className="font-mono text-[11px] text-t2">
                {format(new Date(session.started_at * 1000), 'dd. MMM yyyy HH:mm:ss')}
              </span>
              <span className="text-t3 text-[10px]">
                ({formatDistanceToNow(new Date(session.started_at * 1000), { locale: da, addSuffix: true })})
              </span>
            </div>
          </div>
        </div>

        {/* Tabs for Trace / Replay */}
        <div className="flex items-center gap-1 border-b border-border pb-1 flex-wrap">
          <button
            onClick={() => setActiveTab('trace')}
            className={clsx(
              "px-3 py-1.5 text-xs font-bold rounded-t-md transition-colors flex items-center gap-2",
              activeTab === 'trace' ? "bg-surface2 text-t1 border-b-2 border-rust" : "text-t3 hover:text-t2"
            )}
          >
            <Zap size={13} />
            Agent Trace
          </button>
          <button
            onClick={() => setActiveTab('replay')}
            className={clsx(
              "px-3 py-1.5 text-xs font-bold rounded-t-md transition-colors flex items-center gap-2",
              activeTab === 'replay' ? "bg-surface2 text-t1 border-b-2 border-blue" : "text-t3 hover:text-t2"
            )}
          >
            <User size={13} />
            Turn-by-turn Replay
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-hidden min-h-[300px]">
          {activeTab === 'trace' && (
            <div className="bg-surface2/30 rounded-lg p-3 h-full overflow-y-auto">
              <TraceTimeline
                steps={trace?.steps}
                loading={traceLoading}
                error={traceError}
              />
            </div>
          )}
          
          {activeTab === 'replay' && (
             <div className="h-full">
               <SessionReplay 
                 messages={chat?.messages} 
                 loading={chatLoading} 
               />
               {chatError && (
                 <div className="text-sm text-rust mt-2 flex items-center gap-2">
                   <AlertCircle size={14} />
                   Fejl ved indlæsning: {chatError}
                 </div>
               )}
             </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-border bg-surface2/30 flex items-center justify-between">
        <span className="text-[10px] font-mono text-t3">
          {session.id}
        </span>
        <button
          onClick={onClose}
          className="px-3 py-1.5 rounded text-[11px] font-medium bg-surface2 hover:bg-border text-t2 transition-colors"
        >
          Luk
        </button>
      </div>

      {/* Slide in animation */}
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  )
}

// ─── Main SessionsPage ────────────────────────────────────────────────────────
export function SessionsPage() {
  const [page, setPage] = useState(1)
  const [searchQuery, setSearchQuery] = useState('')
  const [ftsQuery, setFtsQuery] = useState('')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [costFilter, setCostFilter] = useState('all')
  const [selectedSession, setSelectedSession] = useState(null)
  const [ftsResults, setFtsResults] = useState(null)
  const [ftsLoading, setFtsLoading] = useState(false)
  const [showFts, setShowFts] = useState(false)
  const [loadingTimedOut, setLoadingTimedOut] = useState(false)

  const searchTimeoutRef = useRef(null)
  const ftsTimeoutRef = useRef(null)

  // Fetch sessions list
  const { data: sessionsData, loading: sessionsLoading, error: sessionsError } = useApi(
    `/sessions?page=${page}&q=${encodeURIComponent(searchQuery)}`,
    [page, searchQuery]
  )

  // Fetch stats
  const { data: stats, loading: statsLoading } = useApi('/stats')

  // FTS search with debounce
  const performFtsSearch = useCallback(async (query) => {
    if (!query.trim()) {
      setFtsResults(null)
      setShowFts(false)
      return
    }
    setFtsLoading(true)
    try {
      const res = await apiFetch(`/api/search?q=${encodeURIComponent(query)}`)
      if (res.ok) {
        const data = await res.json()
        setFtsResults(data)
        setShowFts(true)
      }
    } catch (e) {
      if (import.meta.env.DEV) console.error('FTS search failed:', e)
    } finally {
      setFtsLoading(false)
    }
  }, [])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [])

  // Debounced search handler
  const handleSearchChange = useCallback((value) => {
    setSearchQuery(value)

    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    // Debounce FTS search
    searchTimeoutRef.current = setTimeout(() => {
      performFtsSearch(value)
    }, 300)
  }, [performFtsSearch])

  // Clear search
  const handleClearSearch = useCallback(() => {
    setSearchQuery('')
    setFtsQuery('')
    setFtsResults(null)
    setShowFts(false)
    setPage(1)
  }, [])

  // Handle session selection from FTS or table
  const handleSelectSession = useCallback((session) => {
    setSelectedSession(session)
    setPage(1) // Reset to first page to help user see context
  }, [])

  // Close detail panel
  const handleClosePanel = useCallback(() => {
    setSelectedSession(null)
  }, [])

  const sessions = sessionsData?.sessions ?? []
  const total = sessionsData?.total ?? 0
  const limit = sessionsData?.limit ?? 25

  useEffect(() => {
    if (!sessionsLoading) {
      setLoadingTimedOut(false)
      return
    }
    const id = setTimeout(() => setLoadingTimedOut(true), 8000)
    return () => clearTimeout(id)
  }, [sessionsLoading])

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <h1 className="text-lg font-bold text-t1 flex items-center gap-2">
              <Terminal size={20} className="text-rust" />
              Sessions
            </h1>
            <p className="text-[11px] text-t3 mt-0.5">
              Agent execution sessions with traces og full-text search
            </p>
          </div>
          <div className="font-mono text-[11px] text-t3">
            {total > 0 ? `${total} total` : ''}
          </div>
        </div>

        {/* Stats */}
        <StatsHeader stats={stats} loading={statsLoading} loadingTimedOut={loadingTimedOut && statsLoading} />

        {/* Filter chips */}
        <div className="mt-4">
          <FilterChips
            sourceFilter={sourceFilter}
            onSourceChange={setSourceFilter}
            costFilter={costFilter}
            onCostChange={setCostFilter}
            stats={stats}
          />
        </div>

        {/* Search */}
        <div className="mt-3">
          <SearchInput
            value={searchQuery}
            onChange={handleSearchChange}
            onClear={handleClearSearch}
          />
        </div>
      </div>

      {/* FTS Results */}
      {showFts && (
        <div className="mb-4">
          <SearchResults
            results={ftsResults}
            loading={ftsLoading}
            onSelect={handleSelectSession}
          />
        </div>
      )}

      {/* Error state */}
      {sessionsError && (
        <div className="mb-4 p-4 bg-surface border border-rust/30 rounded-lg flex items-center gap-3">
          <AlertCircle size={16} className="text-rust flex-shrink-0" />
          <div>
            <p className="text-sm text-rust font-medium">Fejl ved indlæsning af sessions</p>
            <p className="text-[11px] text-t3 mt-0.5">{sessionsError}</p>
          </div>
        </div>
      )}

      {/* Sessions Table */}
      <SessionTable
        sessions={sessions}
        loading={sessionsLoading && !loadingTimedOut}
        selectedId={selectedSession?.id}
        onSelect={handleSelectSession}
      />
      {sessionsLoading && loadingTimedOut && (
        <div className="mt-3 p-4 bg-surface border border-rust/30 rounded-lg flex items-center gap-3">
          <AlertCircle size={16} className="text-rust flex-shrink-0" />
          <div>
            <p className="text-sm text-rust font-medium">Data indlæses for længe</p>
            <p className="text-[11px] text-t3 mt-0.5">Vi kunne ikke hente sessions fra API endnu.</p>
          </div>
        </div>
      )}

      {/* Pagination */}
      {!sessionsLoading && sessions.length > 0 && (
        <Pagination
          page={page}
          total={total}
          limit={limit}
          onPageChange={setPage}
        />
      )}

      {/* Session Detail Panel */}
      {selectedSession && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 z-40"
            onClick={handleClosePanel}
          />
          <SessionDetailPanel
            session={selectedSession}
            onClose={handleClosePanel}
          />
        </>
      )}
    </div>
  )
}
