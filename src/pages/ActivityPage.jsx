import React, { useState, useMemo, useCallback } from 'react'
import { usePoll } from '../hooks/useApi'
import { Card } from '../components/ui/Card'
import { Chip } from '../components/ui/Chip'
import {
  Activity,
  Zap,
  Bot,
  MessageSquare,
  AlertCircle,
  Clock,
  Filter,
  X,
  RefreshCw,
  User,
  Terminal,
  CheckCircle2,
  XCircle,
  ChevronDown,
} from 'lucide-react'

// ── Event type configuration ──────────────────────────────────────────────────

const EVENT_TYPES = {
  session_start: {
    label: 'Session Start',
    color: '#00b478',
    bgColor: 'rgba(0,180,120,0.1)',
    icon: Bot,
  },
  session_end: {
    label: 'Session End',
    color: '#6b6b80',
    bgColor: 'rgba(107,107,128,0.1)',
    icon: Bot,
  },
  message: {
    label: 'Message',
    color: '#4a80c8',
    bgColor: 'rgba(74,128,200,0.1)',
    icon: MessageSquare,
  },
  error: {
    label: 'Error',
    color: '#e05f40',
    bgColor: 'rgba(224,95,64,0.12)',
    icon: AlertCircle,
  },
  skill_executed: {
    label: 'Skill',
    color: '#9b59b6',
    bgColor: 'rgba(155,89,182,0.1)',
    icon: Zap,
  },
  command: {
    label: 'Command',
    color: '#e09040',
    bgColor: 'rgba(224,144,64,0.1)',
    icon: Terminal,
  },
  approval: {
    label: 'Approval',
    color: '#f59e0b',
    bgColor: 'rgba(245,158,11,0.1)',
    icon: CheckCircle2,
  },
  approval_rejected: {
    label: 'Rejected',
    color: '#ef4444',
    bgColor: 'rgba(239,68,68,0.1)',
    icon: XCircle,
  },
  cron_trigger: {
    label: 'Cron',
    color: '#8b5cf6',
    bgColor: 'rgba(139,92,246,0.1)',
    icon: Clock,
  },
}

const ALL_EVENT_KEYS = Object.keys(EVENT_TYPES)

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatTimestamp(ts) {
  if (!ts) return ''
  try {
    const date = new Date(ts)
    if (isNaN(date.getTime())) return ''
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
  } catch {
    return ''
  }
}

function formatRelativeTime(ts) {
  if (!ts) return ''
  try {
    const date = new Date(ts)
    if (isNaN(date.getTime())) return ''
    const diff = Date.now() - date.getTime()
    if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
    return `${Math.floor(diff / 86400000)}d ago`
  } catch {
    return ''
  }
}

function truncate(str, maxLen = 80) {
  if (!str) return ''
  if (str.length <= maxLen) return str
  return str.slice(0, maxLen) + '…'
}

// ── Activity Event Row ─────────────────────────────────────────────────────────

function ActivityEvent({ event, isNew }) {
  const config = EVENT_TYPES[event.type] || EVENT_TYPES.message
  const Icon = config.icon

  return (
    <div
      className={`
        group flex items-start gap-3 px-4 py-3 border-b border-white/[0.04]
        transition-all duration-300 hover:bg-white/[0.02]
        ${isNew ? 'animate-pulse-once' : ''}
      `}
    >
      {/* Icon */}
      <div
        className="flex-shrink-0 mt-0.5 w-7 h-7 rounded-full flex items-center justify-center"
        style={{
          background: config.bgColor,
          border: `1px solid ${config.color}33`,
        }}
      >
        <Icon size={13} style={{ color: config.color }} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide"
            style={{
              background: config.bgColor,
              color: config.color,
              border: `1px solid ${config.color}44`,
            }}
          >
            {config.label}
          </span>

          {event.user && (
            <span className="inline-flex items-center gap-1 text-[10px] text-t3">
              <User size={9} />
              {event.user}
            </span>
          )}

          {event.platform && (
            <Chip variant="model" className="text-[9px]">
              {event.platform}
            </Chip>
          )}
        </div>

        {/* Message */}
        <p className="mt-1 text-xs text-t2 leading-relaxed">
          {truncate(event.message || event.summary || event.description || 'No details', 120)}
        </p>

        {/* Metadata */}
        {(event.session_id || event.skill || event.command) && (
          <div className="mt-1.5 flex flex-wrap gap-2 text-[10px] font-mono text-t3">
            {event.session_id && (
              <span className="truncate max-w-[150px]" title={event.session_id}>
                sid: {event.session_id.slice(0, 8)}…
              </span>
            )}
            {event.skill && (
              <span className="text-purple-400/70">skill: {event.skill}</span>
            )}
            {event.command && (
              <span className="text-amber-400/70 truncate max-w-[120px]">
                {truncate(event.command, 30)}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Timestamp */}
      <div className="flex-shrink-0 text-right">
        <div className="text-[10px] font-mono text-t3 tabular-nums">
          {formatTimestamp(event.timestamp)}
        </div>
        <div className="text-[9px] text-t3/60 mt-0.5">
          {formatRelativeTime(event.timestamp)}
        </div>
      </div>
    </div>
  )
}

// ── Filter Bar ────────────────────────────────────────────────────────────────

function FilterBar({ activeFilters, onToggleFilter, onClearFilters, counts }) {
  const allActive = activeFilters.length === 0

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex items-center gap-1.5 text-[10px] text-t3 mr-1">
        <Filter size={11} />
        <span>Filter:</span>
      </div>

      <button
        onClick={onClearFilters}
        className={`
          px-2 py-1 rounded-full text-[10px] font-semibold transition-all
          ${allActive
            ? 'bg-white/10 text-t1 border border-white/20'
            : 'bg-white/[0.03] text-t3 border border-white/[0.06] hover:bg-white/[0.06]'
          }
        `}
      >
        All
        <span className="ml-1 opacity-60">({counts.total})</span>
      </button>

      {ALL_EVENT_KEYS.map((type) => {
        const config = EVENT_TYPES[type]
        const isActive = activeFilters.includes(type)
        const count = counts[type] || 0

        if (count === 0 && !isActive) return null

        return (
          <button
            key={type}
            onClick={() => onToggleFilter(type)}
            className={`
              px-2 py-1 rounded-full text-[10px] font-semibold transition-all
              ${isActive
                ? 'text-white'
                : 'bg-white/[0.03] text-t3 border border-white/[0.06] hover:bg-white/[0.06]'
              }
            `}
            style={isActive ? { background: config.bgColor, borderColor: `${config.color}44`, color: config.color } : undefined}
          >
            {config.label}
            <span className="ml-1 opacity-60">({count})</span>
          </button>
        )
      })}
    </div>
  )
}

// ── Stats Bar ──────────────────────────────────────────────────────────────────

function StatsBar({ events, lastUpdated, loading }) {
  const stats = useMemo(() => {
    const counts = {}
    ALL_EVENT_KEYS.forEach((type) => {
      counts[type] = events.filter((e) => e.type === type).length
    })
    counts.total = events.length
    return counts
  }, [events])

  return (
    <div className="flex items-center justify-between gap-4 flex-wrap">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <Activity size={14} className="text-green" />
          <span className="text-xs font-semibold text-t1">{stats.total}</span>
          <span className="text-[10px] text-t3">events</span>
        </div>

        {stats.error > 0 && (
          <div className="flex items-center gap-1">
            <AlertCircle size={11} className="text-rust" />
            <span className="text-[10px] text-rust">{stats.error} errors</span>
          </div>
        )}
      </div>

      {lastUpdated && (
        <div className="flex items-center gap-1.5 text-[10px] text-t3">
          {loading ? (
            <>
              <RefreshCw size={10} className="animate-spin" />
              <span>Updating…</span>
            </>
          ) : (
            <>
              <Clock size={10} />
              <span>Last update: {formatRelativeTime(lastUpdated)}</span>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ── Empty State ────────────────────────────────────────────────────────────────

function EmptyState({ hasFilters }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-16 h-16 rounded-full bg-white/[0.03] flex items-center justify-center mb-4">
        <Activity size={28} className="text-t3/40" />
      </div>
      <h3 className="text-sm font-semibold text-t2 mb-1">
        {hasFilters ? 'No matching events' : 'No activity yet'}
      </h3>
      <p className="text-xs text-t3 max-w-[260px]">
        {hasFilters
          ? 'Try adjusting your filters to see more events'
          : 'Activity events will appear here as they happen'
        }
      </p>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export function ActivityPage() {
  const POLL_INTERVAL = 3000
  const MAX_EVENTS = 100

  const { data, loading, lastUpdated, refetch } = usePoll('/api/activity', POLL_INTERVAL)
  const [activeFilters, setActiveFilters] = useState([])
  const [showFilters, setShowFilters] = useState(true)
  const [newEventIds, setNewEventIds] = useState(new Set())

  // Process events from API
  const events = useMemo(() => {
    const raw = data?.events || data?.activity || []
    return Array.isArray(raw) ? raw.slice(0, MAX_EVENTS) : []
  }, [data])

  // Track new events for animation
  React.useEffect(() => {
    if (events.length > 0 && newEventIds.size > 0) {
      const timer = setTimeout(() => setNewEventIds(new Set()), 500)
      return () => clearTimeout(timer)
    }
  }, [events, newEventIds])

  // Count events by type
  const counts = useMemo(() => {
    const c = {}
    ALL_EVENT_KEYS.forEach((type) => {
      c[type] = events.filter((e) => e.type === type).length
    })
    c.total = events.length
    return c
  }, [events])

  // Filter events
  const filteredEvents = useMemo(() => {
    if (activeFilters.length === 0) return events
    return events.filter((e) => activeFilters.includes(e.type))
  }, [events, activeFilters])

  // Toggle filter
  const toggleFilter = useCallback((type) => {
    setActiveFilters((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    )
  }, [])

  // Clear all filters
  const clearFilters = useCallback(() => {
    setActiveFilters([])
  }, [])

  const hasFilters = activeFilters.length > 0

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-lg font-bold text-t1 flex items-center gap-2">
            <Activity size={20} className="text-green" />
            Activity Feed
          </h1>
          <p className="text-xs text-t3 mt-0.5">Real-time system events</p>
        </div>

        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-t2 bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.06] transition-colors"
        >
          <Filter size={12} />
          {showFilters ? 'Hide' : 'Show'} Filters
          <ChevronDown
            size={12}
            className={`transition-transform ${showFilters ? 'rotate-180' : ''}`}
          />
        </button>
      </div>

      {/* Stats & Filters */}
      <Card>
        <div className="p-4 space-y-3">
          <StatsBar events={events} lastUpdated={lastUpdated} loading={loading} />

          {showFilters && (
            <div className="border-t border-white/[0.04] pt-3">
              <FilterBar
                activeFilters={activeFilters}
                onToggleFilter={toggleFilter}
                onClearFilters={clearFilters}
                counts={counts}
              />
            </div>
          )}
        </div>
      </Card>

      {/* Event Feed */}
      <Card>
        <div className="divide-y divide-white/[0.04]">
          {filteredEvents.length === 0 ? (
            <EmptyState hasFilters={hasFilters} />
          ) : (
            filteredEvents.map((event, index) => (
              <ActivityEvent
                key={event.id || event.timestamp || index}
                event={event}
                isNew={newEventIds.has(event.id || index)}
              />
            ))
          )}
        </div>

        {filteredEvents.length > 0 && filteredEvents.length === MAX_EVENTS && (
          <div className="px-4 py-2 text-center text-[10px] text-t3 border-t border-white/[0.04]">
            Showing latest {MAX_EVENTS} events
          </div>
        )}
      </Card>
    </div>
  )
}
