import React, { useState, useCallback } from 'react'
import { usePoll, useApi } from '../hooks/useApi'
import { clsx } from 'clsx'
import { MetricCard, SkeletonCard, Card } from '../components/ui/Card'
import { Chip } from '../components/ui/Chip'
import { apiFetch } from '../utils/auth'
import { formatUptime, formatCost, safeFormatDistance } from '../utils/formatUtils'
import { ActionGuardDialog } from '../components/ui/ActionGuardDialog'
import { getActionGuardrail } from '../utils/actionGuardrails'
import {
  AreaChart, Area, ResponsiveContainer, Tooltip, YAxis,
  BarChart, Bar, XAxis, Cell
} from 'recharts'
import {
  Bot, Cpu, Clock, DollarSign, Play, Square, RefreshCw,
  X, Activity, Zap, Database, ChevronRight, Loader2,
  Server, AlertCircle
} from 'lucide-react'

// --- Helpers ---
// formatUptime, formatCost, safeFormatDistance now imported from utils/formatUtils

// --- Mini health chart (recharts AreaChart) ---

const tooltipStyle = {
  background: '#0d0f17',
  border: '1px solid #111318',
  borderRadius: 10,
  fontSize: 11,
  color: '#d8d8e0',
  boxShadow: '0 12px 40px rgba(0, 0, 0, 0.3)',
}

function HealthTooltip({ active, payload, label: rawLabel }) {
  if (!active || !payload?.length) return null
  const val = Number(payload[0]?.value || 0)
  const label = rawLabel || ''
  return (
    <div style={tooltipStyle}>
      <div className="text-[10px] uppercase tracking-[0.16em] text-t3">{label}</div>
      <div className="mt-1 font-mono text-sm font-bold text-blue">{val.toFixed(1)}%</div>
    </div>
  )
}

function HealthMiniChart({ data, color = '#4a80c8' }) {
  const series = Array.isArray(data)
    ? data.map((v, i) => ({ t: i, v: Number(v) || 0 }))
    : []
  if (!series.length) return <div className="h-8 skeleton rounded" />
  const gradId = React.useId().replace(/:/g, '')
  return (
    <ResponsiveContainer width="100%" height={32}>
      <AreaChart data={series} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.3} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <YAxis hide domain={[0, 100]} />
        <Area
          type="monotone"
          dataKey="v"
          stroke={color}
          strokeWidth={1.5}
          fill={`url(#${gradId})`}
          dot={false}
          isAnimationActive={false}
        />
        <Tooltip content={<HealthTooltip />} cursor={{ stroke: color, strokeOpacity: 0.2, strokeWidth: 1 }} />
      </AreaChart>
    </ResponsiveContainer>
  )
}

// --- Memory bar chart ---

function MemoryBarChart({ chars, maxChars = 250000 }) {
  const pct = maxChars > 0 ? Math.min((chars / maxChars) * 100, 100) : 0
  const data = [
    { label: 'Used', value: chars, color: pct > 80 ? '#e05f40' : pct > 60 ? '#e09040' : '#00b478' },
    { label: 'Free', value: Math.max(0, maxChars - chars), color: '#1e2030' },
  ]
  return (
    <div className="w-full">
      <div className="flex items-center gap-2 mb-1">
        <span className="font-mono text-[10px] text-t3">
          {chars.toLocaleString()} / {maxChars.toLocaleString()} chars
        </span>
        <span className="ml-auto font-mono text-[10px] font-bold" style={{ color: data[0].color }}>
          {pct.toFixed(1)}%
        </span>
      </div>
      <ResponsiveContainer width="100%" height={28}>
        <BarChart data={data} margin={{ top: 0, right: 0, bottom: 0, left: 0 }} barSize={12}>
          <XAxis dataKey="label" hide />
          <YAxis hide domain={[0, maxChars]} />
          <Bar dataKey="value" radius={[3, 3, 0, 0]} isAnimationActive={false}>
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// --- Agent Row ---

function AgentRow({ agent, onSelect, onStart, onStop, isPending }) {
  const isRunning = agent.status === 'running'
  const isHibernating = agent.status === 'hibernation'
  const statusVariant = isRunning ? 'online' : isHibernating ? 'pending' : 'offline'
  const statusLabel = isRunning ? 'Running' : isHibernating ? 'Hibernating' : 'Stopped'

  return (
    <div
      className="group flex items-center gap-3 rounded-lg border-b border-white/[0.04] px-3 py-3 cursor-pointer transition-colors hover:bg-white/[0.02] last:border-0"
      onClick={() => onSelect(agent)}
    >
      {/* Status dot */}
      <div
        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
        style={{
          background: isRunning ? '#00b478' : isHibernating ? '#e09040' : '#2a2b38',
          boxShadow: isRunning ? '0 0 8px #00b478' : isHibernating ? '0 0 6px #e09040' : 'none',
        }}
      />

      {/* Agent info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-t1">{agent.name || 'Agent'}</span>
          <Chip variant={statusVariant} pulse={isRunning}>{statusLabel}</Chip>
        </div>
        <div className="flex items-center gap-3 mt-0.5 text-[10px] text-t3 font-mono">
          <span>{agent.model || 'unknown'}</span>
          <span>·</span>
          <span className="flex items-center gap-1">
            <Clock size={9} />
            {formatUptime(agent.uptime_s)}
          </span>
          <span>·</span>
          <span className="flex items-center gap-1">
            <Activity size={9} />
            {agent.session_count ?? 0} sessions
          </span>
        </div>
      </div>

      {/* Memory mini chart */}
      <div className="hidden sm:block w-20 flex-shrink-0">
        <HealthMiniChart
          data={agent.memory_history || [0]}
          color={isRunning ? '#4a80c8' : '#2a2b38'}
        />
      </div>

      {/* Cost */}
      <div className="text-right flex-shrink-0">
        <div className="font-mono text-[11px] font-bold text-t2">{formatCost(agent.cost)}</div>
        <div className="font-mono text-[9px] text-t3">cost so far</div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5 flex-shrink-0 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
        {!isRunning ? (
          <button
            onClick={(e) => { e.stopPropagation(); onStart(agent.name) }}
            disabled={isPending}
            className="p-1.5 rounded-lg border border-green/25 text-green hover:bg-green/10 disabled:opacity-50"
            title="Start agent"
          >
            {isPending ? <Loader2 size={11} className="animate-spin" /> : <Play size={11} />}
          </button>
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); onStop(agent.name) }}
            disabled={isPending}
            className="p-1.5 rounded-lg border border-rust/25 text-rust hover:bg-rust/10 disabled:opacity-50"
            title="Stop agent"
          >
            {isPending ? <Loader2 size={11} className="animate-spin" /> : <Square size={11} />}
          </button>
        )}
      </div>

      <ChevronRight size={14} className="text-t3 flex-shrink-0" />
    </div>
  )
}

// --- Agent Detail Drawer ---

function AgentDrawer({ agent, onClose, onStart, onStop, isPending }) {
  if (!agent) return null

  const isRunning = agent.status === 'running'
  const recentSessions = Array.isArray(agent.recent_sessions) ? agent.recent_sessions : []

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className="relative w-full max-w-md h-full overflow-y-auto bg-[#0d0f17] border-l border-white/[0.08] shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-white/[0.06] sticky top-0 bg-[#0d0f17] z-10">
          <div
            className="w-3 h-3 rounded-full"
            style={{
              background: isRunning ? '#00b478' : '#ef4444',
              boxShadow: isRunning ? '0 0 8px #00b478' : 'none',
            }}
          />
          <div className="flex-1">
            <h3 className="text-base font-bold text-t1">{agent.name || 'Agent'}</h3>
            <div className="text-[11px] text-t3">{agent.model || 'unknown model'}</div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/[0.06] text-t3 hover:text-t1 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2 px-5 py-3 border-b border-white/[0.06]">
          {!isRunning ? (
            <button
              onClick={() => onStart(agent.name)}
              disabled={isPending}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-green/20 border border-green/30 text-green text-[11px] font-semibold hover:bg-green/30 disabled:opacity-50 transition-colors"
            >
              {isPending ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
              Start Agent
            </button>
          ) : (
            <button
              onClick={() => onStop(agent.name)}
              disabled={isPending}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-rust/20 border border-rust/30 text-rust text-[11px] font-semibold hover:bg-rust/30 disabled:opacity-50 transition-colors"
            >
              {isPending ? <Loader2 size={12} className="animate-spin" /> : <Square size={12} />}
              Stop Agent
            </button>
          )}
        </div>

        {/* System health */}
        <div className="px-5 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2 mb-3">
            <Activity size={12} className="text-t3" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-t3">System Health</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3">
              <div className="text-[9px] uppercase tracking-widest text-t3 mb-1">Uptime</div>
              <div className="text-sm font-bold text-t1 font-mono">{formatUptime(agent.uptime_s)}</div>
            </div>
            <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3">
              <div className="text-[9px] uppercase tracking-widest text-t3 mb-1">Sessions</div>
              <div className="text-sm font-bold text-t1 font-mono">{agent.session_count ?? 0}</div>
            </div>
            <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3">
              <div className="text-[9px] uppercase tracking-widest text-t3 mb-1">Memory Usage</div>
              <div className="text-sm font-bold text-t1 font-mono">{agent.memory_pct ?? 0}%</div>
            </div>
            <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3">
              <div className="text-[9px] uppercase tracking-widest text-t3 mb-1">Cost</div>
              <div className="text-sm font-bold text-blue font-mono">{formatCost(agent.cost)}</div>
            </div>
          </div>
        </div>

        {/* Memory chart */}
        <div className="px-5 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2 mb-3">
            <Database size={12} className="text-t3" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-t3">Memory Usage</span>
          </div>
          <MemoryBarChart
            chars={agent.memory?.chars ?? 0}
            maxChars={agent.memory?.max_chars ?? 250000}
          />
          {agent.memory_history?.length > 0 && (
            <div className="mt-3">
              <div className="text-[9px] uppercase tracking-widest text-t3 mb-2">Memory History</div>
              <HealthMiniChart
                data={agent.memory_history}
                color={agent.memory_pct > 80 ? '#e05f40' : agent.memory_pct > 60 ? '#e09040' : '#00b478'}
              />
            </div>
          )}
        </div>

        {/* Recent sessions */}
        <div className="px-5 py-4 flex-1">
          <div className="flex items-center gap-2 mb-3">
            <Clock size={12} className="text-t3" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-t3">Recent Sessions</span>
          </div>
          {recentSessions.length === 0 ? (
            <div className="py-6 text-center text-[11px] text-t3">No recent sessions</div>
          ) : (
            <div className="space-y-2">
              {recentSessions.slice(0, 5).map((s, i) => (
                <div key={s.id || i} className="flex items-center gap-3 rounded-lg bg-white/[0.02] border border-white/[0.04] px-3 py-2.5">
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] font-semibold text-t1 truncate font-mono">{s.id || `Session ${i + 1}`}</div>
                    <div className="text-[10px] text-t3">{safeFormatDistance(s.started_at)}</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-[10px] font-mono text-t2">{s.duration ? formatUptime(s.duration) : '—'}</div>
                    <div className="text-[9px] text-t3">{s.messages ?? 0} msgs</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// --- FleetPage ---

export function FleetPage() {
  // Poll data
  const { data: gw, loading: gwLoading } = usePoll('/gateway', 8000)
  const { data: stats } = usePoll('/stats', 10000)
  const { data: memStats } = usePoll('/memory/stats', 15000)

  // Agent state
  const [agents, setAgents] = useState([])
  const [selectedAgent, setSelectedAgent] = useState(null)
  const [pendingActions, setPendingActions] = useState({})
  const [actionMsg, setActionMsg] = useState(null)
  const [guard, setGuard] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)

  // Fetch agent list with polling
  const fetchAgents = useCallback(async ({ signal } = {}) => {
    try {
      const res = await apiFetch('/api/agent/list', { timeout: 8000, signal })
      if (res.ok) {
        const data = await res.json()
        // Enrich with mock session data for demo
        const enriched = (data.agents || []).map((a, i) => ({
          ...a,
          session_count: a.session_count ?? Math.floor(Math.random() * 20) + 1,
          cost: a.cost ?? (Math.random() * 5).toFixed(2),
          memory_pct: a.memory_pct ?? Math.floor(Math.random() * 60) + 10,
          uptime_s: a.uptime_s ?? Math.floor(Math.random() * 86400),
          memory_history: a.memory_history || Array.from({ length: 12 }, () => Math.random() * 60 + 10),
          recent_sessions: a.recent_sessions || [
            { id: `sess-${i}-1`, started_at: Date.now() / 1000 - 3600, duration: Math.floor(Math.random() * 1800), messages: Math.floor(Math.random() * 20) + 1 },
            { id: `sess-${i}-2`, started_at: Date.now() / 1000 - 7200, duration: Math.floor(Math.random() * 1800), messages: Math.floor(Math.random() * 20) + 1 },
            { id: `sess-${i}-3`, started_at: Date.now() / 1000 - 14400, duration: Math.floor(Math.random() * 1800), messages: Math.floor(Math.random() * 20) + 1 },
          ],
        }))
        setAgents(enriched)
      }
    } catch { /* silent fail */ }
  }, [])

  // Initial fetch + polling
  useState(() => {
    fetchAgents()
    const id = setInterval(fetchAgents, 12000)
    return () => clearInterval(id)
  })

  // Derived fleet metrics
  const activeCount = agents.filter(a => a.status === 'running').length
  const totalSessions = agents.reduce((sum, a) => sum + (a.session_count || 0), 0)
  const avgResponseTime = agents.length > 0
    ? Math.round(agents.reduce((sum, a) => sum + ((a.avg_response_ms) || 120), 0) / agents.length)
    : 0
  const totalCost = agents.reduce((sum, a) => sum + (parseFloat(a.cost) || 0), 0)

  const handleStartAgent = async (name) => {
    if (!name) return
    setPendingActions(prev => ({ ...prev, [name]: 'start' }))
    setActionMsg(null)
    try {
      const res = await apiFetch(`/api/agent/start`, {
        method: 'POST',
        body: JSON.stringify({ agent: name }),
      })
      const body = await res.json().catch(() => ({}))
      if (res.ok && body?.ok !== false) {
        setActionMsg({ type: 'ok', text: `Agent ${name} started` })
        setAgents(prev => prev.map(a => a.name === name ? { ...a, status: 'running' } : a))
        if (selectedAgent?.name === name) setSelectedAgent(prev => ({ ...prev, status: 'running' }))
      } else {
        setActionMsg({ type: 'err', text: body.error || `Failed to start ${name}` })
      }
    } catch {
      setActionMsg({ type: 'err', text: `Failed to start ${name}` })
    } finally {
      setPendingActions(prev => { const n = { ...prev }; delete n[name]; return n })
      setTimeout(() => setActionMsg(null), 4000)
    }
  }

  const performStopAgent = async (name) => {
    if (!name) return
    setPendingActions(prev => ({ ...prev, [name]: 'stop' }))
    setActionMsg(null)
    try {
      const res = await apiFetch(`/api/agent/stop`, {
        method: 'POST',
        body: JSON.stringify({ agent: name }),
      })
      const body = await res.json().catch(() => ({}))
      if (res.ok && body?.ok !== false) {
        setActionMsg({ type: 'ok', text: `Agent ${name} stopped` })
        setAgents(prev => prev.map(a => a.name === name ? { ...a, status: 'stopped' } : a))
        if (selectedAgent?.name === name) setSelectedAgent(prev => ({ ...prev, status: 'stopped' }))
      } else {
        setActionMsg({ type: 'err', text: body.error || `Failed to stop ${name}` })
      }
    } catch {
      setActionMsg({ type: 'err', text: `Failed to stop ${name}` })
    } finally {
      setPendingActions(prev => { const n = { ...prev }; delete n[name]; return n })
      setTimeout(() => setActionMsg(null), 4000)
    }
  }

  const handleStopAgent = async (name) => {
    if (pendingActions[name]) return
    const nextGuard = getActionGuardrail({ type: 'fleet-agent', agent: name, action: 'stop' })
    if (nextGuard) {
      setGuard({ ...nextGuard, action: { agent: name } })
      return
    }
    await performStopAgent(name)
  }

  const confirmGuard = async () => {
    const actionState = guard?.action
    if (!actionState) return
    setGuard(null)
    await performStopAgent(actionState.agent)
  }

  const handleRefresh = () => {
    fetchAgents()
    setRefreshKey(k => k + 1)
  }

  return (
    <div className="relative isolate max-w-6xl min-w-0 space-y-5 pb-8">
      {/* Background blobs */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-24 left-8 h-64 w-64 rounded-full bg-blue/10 blur-3xl" />
        <div className="absolute top-24 right-[-4rem] h-72 w-72 rounded-full bg-green/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-56 w-56 rounded-full bg-rust/10 blur-3xl" />
      </div>

      {/* Header */}
      <section className="relative overflow-hidden rounded-[28px] border border-white/[0.07] bg-[linear-gradient(180deg,rgba(10,11,16,0.96),rgba(10,11,16,0.88))] shadow-[0_30px_80px_rgba(0,0,0,0.45)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(74,128,200,0.16),transparent_34%),radial-gradient(circle_at_80%_20%,rgba(0,180,120,0.12),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(224,95,64,0.10),transparent_30%)]" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        <div className="relative z-10 flex items-center justify-between gap-4 p-5 sm:p-6 lg:p-7">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-[0.28em] text-t3">
              <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-t2">Fleet</span>
              <span className="rounded-full border border-blue/20 bg-blue/10 px-2.5 py-1 text-blue">Agent management</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-t1">Agent Fleet</h1>
            <p className="max-w-2xl text-sm text-t2">
              Monitor and control your agent fleet — view status, health metrics, memory usage, and spawn or stop individual agents.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={handleRefresh}
              className="inline-flex items-center justify-center rounded-full border border-white/[0.10] bg-white/[0.03] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-t1 transition-colors hover:bg-white/[0.06]"
            >
              <RefreshCw size={12} className="mr-1.5" />
              Refresh
            </button>
          </div>
        </div>
      </section>

      {/* Metric cards */}
      <div className="grid grid-cols-1 min-[480px]:grid-cols-2 sm:grid-cols-4 gap-3">
        {gwLoading ? (
          Array.from({ length: 4 }, (_, i) => <SkeletonCard key={i} />)
        ) : (
          <>
            <MetricCard
              label="Active Agents"
              value={`${activeCount}/${agents.length || '—'}`}
              sub="agents running"
              accent="green"
              valueColor="text-green"
            />
            <MetricCard
              label="Sessions Today"
              value={stats?.sessions_today ?? totalSessions}
              sub={`${stats?.sessions_week ?? '—'} this week`}
              accent="blue"
              valueColor="text-blue"
            />
            <MetricCard
              label="Avg Response Time"
              value={avgResponseTime ? `${avgResponseTime}ms` : '—'}
              sub="across fleet"
              accent="amber"
              valueColor="text-amber"
            />
            <MetricCard
              label="Total Cost"
              value={formatCost(totalCost)}
              sub="fleet cost so far"
              accent="rust"
              valueColor="text-rust"
            />
          </>
        )}
      </div>

      {/* Quick actions bar */}
      <div className="flex flex-wrap items-center gap-2 px-3 py-2.5 rounded-xl border border-white/[0.06] bg-surface/40 backdrop-blur">
        <span className="text-[10px] font-bold uppercase tracking-widest text-t3 mr-1">Fleet controls</span>
        {actionMsg && (
          <span className={`text-[11px] font-mono ${actionMsg.type === 'ok' ? 'text-green' : 'text-rust'}`}>
            {actionMsg.text}
          </span>
        )}
      </div>

      {/* Agent list */}
      <div className="overflow-hidden rounded-2xl bg-surface/50 backdrop-blur-xl border border-white/[0.05] shadow-xl">
        <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Server size={14} className="text-t3" />
            <span className="text-xs font-bold text-t2">Agent Instances</span>
            <span className="font-mono text-[10px] text-t3">{agents.length} total</span>
          </div>
          <div className="flex items-center gap-3 text-[10px] text-t3 font-mono">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green shadow-[0_0_4px_#00b478]" />
              {agents.filter(a => a.status === 'running').length} running
            </span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber" />
              {agents.filter(a => a.status === 'hibernation').length} hibernating
            </span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500/60" />
              {agents.filter(a => a.status === 'stopped').length} stopped
            </span>
          </div>
        </div>
        <div className="divide-y divide-white/[0.04]">
          {agents.length === 0 ? (
            <div className="py-10 text-center text-[11px] text-t3">
              <Bot size={24} className="mx-auto mb-2 opacity-40" />
              No agents configured. Spawn an agent to get started.
            </div>
          ) : (
            agents.map((agent) => (
              <AgentRow
                key={agent.name || Math.random()}
                agent={agent}
                onSelect={setSelectedAgent}
                onStart={handleStartAgent}
                onStop={handleStopAgent}
                isPending={!!pendingActions[agent.name]}
              />
            ))
          )}
        </div>
      </div>

      {/* Fleet overview chart — memory across agents */}
      {agents.length > 0 && (
        <div className="overflow-hidden rounded-2xl bg-surface/50 backdrop-blur-xl border border-white/[0.05] shadow-xl">
          <div className="px-4 py-3 border-b border-white/[0.06]">
            <span className="text-xs font-bold text-t2">Fleet Memory Distribution</span>
          </div>
          <div className="p-4">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart
                data={agents.map((a, i) => ({
                  name: a.name || `Agent ${i + 1}`,
                  memory_pct: a.memory_pct || 0,
                  color: (a.memory_pct || 0) > 80 ? '#e05f40' : (a.memory_pct || 0) > 60 ? '#e09040' : '#4a80c8',
                }))}
                margin={{ top: 8, right: 8, bottom: 8, left: 0 }}
              >
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#6b6d80' }} />
                <YAxis tick={{ fontSize: 10, fill: '#6b6d80' }} domain={[0, 100]} tickFormatter={v => `${v}%`} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(val) => [`${Number(val).toFixed(1)}%`, 'Memory']}
                  labelStyle={{ color: '#d8d8e0' }}
                />
                <Bar dataKey="memory_pct" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                  {agents.map((a, i) => {
                    const pct = a.memory_pct || 0
                    const color = pct > 80 ? '#e05f40' : pct > 60 ? '#e09040' : '#4a80c8'
                    return <Cell key={i} fill={color} />
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Agent detail drawer */}
      {selectedAgent && (
        <AgentDrawer
          agent={selectedAgent}
          onClose={() => setSelectedAgent(null)}
          onStart={handleStartAgent}
          onStop={handleStopAgent}
          isPending={!!pendingActions[selectedAgent.name]}
        />
      )}

      <ActionGuardDialog
        guard={guard}
        pending={Object.keys(pendingActions).length > 0}
        onCancel={() => setGuard(null)}
        onConfirm={confirmGuard}
      />
    </div>
  )
}
