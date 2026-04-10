import { useEffect, useMemo, useState, useCallback, useRef, useId } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Activity, Play, RefreshCw, Square, ScrollText, Server, Clock, Cpu, HardDrive, Wifi, Zap, Bot, X, ChevronRight, Loader2, DollarSign, Database, AlertCircle } from 'lucide-react'
import { usePoll, useApi } from '../hooks/useApi'
import { apiFetch } from '../utils/auth'
import { Chip } from '../components/ui/Chip'
import { Card } from '../components/ui/Card'
import { PagePrimer } from '../components/ui/PagePrimer'
import { clsx } from 'clsx'
import { formatDistanceToNow } from 'date-fns'
import {
  RadialBarChart, RadialBar, ResponsiveContainer,
  AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, Cell,
} from 'recharts'

// ═══════════════════════════════════════════════════════════════
// TAB CONFIGURATION
// ═══════════════════════════════════════════════════════════════

const TABS = [
  { key: 'services', label: 'Services', icon: Server },
  { key: 'health', label: 'Health', icon: Activity },
  { key: 'fleet', label: 'Fleet', icon: Bot },
]

// ═══════════════════════════════════════════════════════════════
// SHARED HELPERS
// ═══════════════════════════════════════════════════════════════

function formatUptime(s) {
  if (!s && s !== 0) return '—'
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

function formatCost(val) {
  if (val == null || val === 0) return '$0.00'
  if (val < 0.01) return `$${val.toFixed(4)}`
  return `$${val.toFixed(2)}`
}

function safeFormatDistance(dateStrOrNum) {
  if (!dateStrOrNum) return '—'
  try {
    let val = dateStrOrNum
    if (typeof val === 'number' && val < 5000000000) val = val * 1000
    else if (typeof val === 'string' && !isNaN(val) && val.length <= 10) val = parseFloat(val) * 1000
    const d = new Date(val)
    if (isNaN(d.getTime())) return '—'
    const year = d.getFullYear()
    if (year < 1970 || year > 2100) return '—'
    return formatDistanceToNow(d, { addSuffix: true })
  } catch {
    return '—'
  }
}

// ═══════════════════════════════════════════════════════════════
// HEALTH TAB COMPONENTS (from HealthPage)
// ═══════════════════════════════════════════════════════════════

function gaugeColor(pct) {
  if (pct < 60) return '#00b478'
  if (pct < 80) return '#e09040'
  return '#e05f40'
}

function latencyColor(ms) {
  if (ms < 200) return '#00b478'
  if (ms < 1000) return '#e09040'
  return '#e05f40'
}

function RadialGauge({ label, value, unit = '%', icon: Icon, size = 120 }) {
  const pct = Math.min(100, Math.max(0, value ?? 0))
  const color = gaugeColor(pct)
  const chartId = useId().replace(/:/g, '')

  const data = [
    { name: 'bg', value: 100, fill: 'rgba(255,255,255,0.04)' },
    { name: 'fill', value: pct, fill: color },
  ]

  return (
    <div className="flex flex-col items-center gap-2">
      <div style={{ width: size, height: size }}>
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart
            cx="50%" cy="50%" innerRadius="68%" outerRadius="92%" barSize={10} data={data}
            startAngle={220} endAngle={-40}
          >
            <defs>
              <linearGradient id={`grad-${chartId}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.9} />
                <stop offset="100%" stopColor={color} stopOpacity={0.5} />
              </linearGradient>
            </defs>
            <RadialBar background={{ fill: 'rgba(255,255,255,0.03)' }} dataKey="value" fill={`url(#grad-${chartId})`} cornerRadius={5} isAnimationActive />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ top: '-8px' }}>
          {Icon && <Icon size={14} className="mb-1 text-t3" />}
          <span className="text-lg font-extrabold" style={{ color }}>{pct}{unit}</span>
        </div>
      </div>
      <span className="text-[10px] font-bold uppercase tracking-widest text-t3">{label}</span>
    </div>
  )
}

function LatencyRow({ name, latency, status }) {
  const ms = latency ?? 0
  const color = latencyColor(ms)
  const ok = status === 'ok' || status === 'running'
  return (
    <div className="flex items-center gap-3 rounded-lg border-b border-white/[0.04] px-2 py-2.5 last:border-0">
      <div className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: ok ? '#00b478' : '#e05f40', boxShadow: ok ? '0 0 6px #00b478' : '0 0 6px #e05f40' }} />
      <span className="flex-1 text-xs font-medium text-t1 capitalize">{name}</span>
      <span className="font-mono text-xs" style={{ color }}>{ms > 0 ? `${ms}ms` : '—'}</span>
    </div>
  )
}

function ProcessRow({ name, cpu, mem }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border-b border-white/[0.04] px-2 py-2 last:border-0">
      <div className="w-2 h-2 rounded-full bg-t3 flex-shrink-0" />
      <span className="flex-1 truncate text-xs font-medium text-t1">{name}</span>
      <span className="font-mono text-[10px] text-t3 w-12 text-right">{cpu}% CPU</span>
      <span className="font-mono text-[10px] text-t3 w-12 text-right">{mem}% MEM</span>
    </div>
  )
}

function UptimeChart({ data }) {
  const series = Array.isArray(data) ? data : []
  if (!series.length) return <div className="h-32 skeleton rounded-xl" />
  return (
    <ResponsiveContainer width="100%" height={120}>
      <AreaChart data={series} margin={{ top: 8, right: 4, bottom: 0, left: -20 }}>
        <defs>
          <linearGradient id="uptimeGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#00b478" stopOpacity={0.3} />
            <stop offset="100%" stopColor="#00b478" stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id="latencyGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4a80c8" stopOpacity={0.3} />
            <stop offset="100%" stopColor="#4a80c8" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
        <XAxis dataKey="time" tick={{ fontSize: 9, fill: '#2a2b38' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
        <YAxis yAxisId="left" tick={{ fontSize: 9, fill: '#2a2b38' }} tickLine={false} axisLine={false} width={30} />
        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 9, fill: '#2a2b38' }} tickLine={false} axisLine={false} width={30} />
        <Tooltip contentStyle={{ background: '#0d0f17', border: '1px solid #111318', borderRadius: 10, fontSize: 11, color: '#d8d8e0' }} />
        <Area yAxisId="left" type="monotone" dataKey="uptime" stroke="#00b478" strokeWidth={1.5} fill="url(#uptimeGrad)" dot={false} />
        <Area yAxisId="right" type="monotone" dataKey="latency" stroke="#4a80c8" strokeWidth={1.5} fill="url(#latencyGrad)" dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  )
}

function generateMockHistory() {
  const now = Date.now()
  return Array.from({ length: 24 }, (_, i) => {
    const t = new Date(now - (23 - i) * 3600 * 1000)
    return { time: t.getHours() + ':00', uptime: Math.round(95 + Math.random() * 5), latency: Math.round(80 + Math.random() * 120) }
  })
}

function mockProcessList() {
  return [
    { name: 'hermes-gateway', cpu: 8.2, mem: 12.4 },
    { name: 'node /app/server.js', cpu: 5.1, mem: 8.7 },
    { name: 'postgres: writer', cpu: 3.4, mem: 15.2 },
    { name: 'redis-server', cpu: 1.8, mem: 3.1 },
    { name: 'nginx: worker', cpu: 0.6, mem: 1.2 },
  ]
}

const MOCK_API_ENDPOINTS = [
  { name: 'gateway', latency: 45, status: 'ok' },
  { name: 'memory', latency: 120, status: 'ok' },
  { name: 'sessions', latency: 89, status: 'ok' },
  { name: 'skills', latency: 210, status: 'ok' },
  { name: 'ekg', latency: 38, status: 'ok' },
  { name: 'stats', latency: 67, status: 'ok' },
]

// ═══════════════════════════════════════════════════════════════
// FLEET TAB COMPONENTS (from FleetPage)
// ═══════════════════════════════════════════════════════════════

const healthTooltipStyle = {
  background: '#0d0f17', border: '1px solid #111318', borderRadius: 10, fontSize: 11, color: '#d8d8e0', boxShadow: '0 12px 40px rgba(0,0,0,0.3)',
}

function HealthTooltip({ active, payload, label: rawLabel }) {
  if (!active || !payload?.length) return null
  const val = Number(payload[0]?.value || 0)
  const label = rawLabel || ''
  return (
    <div style={healthTooltipStyle}>
      <div className="text-[10px] uppercase tracking-[0.16em] text-t3">{label}</div>
      <div className="mt-1 font-mono text-sm font-bold text-blue">{val.toFixed(1)}%</div>
    </div>
  )
}

function HealthMiniChart({ data, color = '#4a80c8' }) {
  const series = Array.isArray(data) ? data.map((v, i) => ({ t: i, v: Number(v) || 0 })) : []
  if (!series.length) return <div className="h-8 skeleton rounded" />
  const gradId = useId().replace(/:/g, '')
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
        <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} fill={`url(#${gradId})`} dot={false} isAnimationActive={false} />
        <Tooltip content={<HealthTooltip />} cursor={{ stroke: color, strokeOpacity: 0.2, strokeWidth: 1 }} />
      </AreaChart>
    </ResponsiveContainer>
  )
}

function MemoryBarChart({ chars, maxChars = 250000 }) {
  const pct = maxChars > 0 ? Math.min((chars / maxChars) * 100, 100) : 0
  const data = [
    { label: 'Used', value: chars, color: pct > 80 ? '#e05f40' : pct > 60 ? '#e09040' : '#00b478' },
    { label: 'Free', value: Math.max(0, maxChars - chars), color: '#1e2030' },
  ]
  return (
    <div className="w-full">
      <div className="flex items-center gap-2 mb-1">
        <span className="font-mono text-[10px] text-t3">{chars.toLocaleString()} / {maxChars.toLocaleString()} chars</span>
        <span className="ml-auto font-mono text-[10px] font-bold" style={{ color: data[0].color }}>{pct.toFixed(1)}%</span>
      </div>
      <ResponsiveContainer width="100%" height={28}>
        <BarChart data={data} margin={{ top: 0, right: 0, bottom: 0, left: 0 }} barSize={12}>
          <XAxis dataKey="label" hide />
          <YAxis hide domain={[0, maxChars]} />
          <Bar dataKey="value" radius={[3, 3, 0, 0]} isAnimationActive={false}>
            {data.map((entry, i) => (<Cell key={i} fill={entry.color} />))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function AgentRow({ agent, onSelect, onStart, onStop, isPending }) {
  const isRunning = agent.status === 'running'
  const isHibernating = agent.status === 'hibernation'
  const statusVariant = isRunning ? 'online' : isHibernating ? 'pending' : 'offline'
  const statusLabel = isRunning ? 'Kørende' : isHibernating ? 'Dvale' : 'Stoppet'

  return (
    <div className="group flex items-center gap-3 rounded-lg border-b border-white/[0.04] px-3 py-3 cursor-pointer transition-colors hover:bg-white/[0.02] last:border-0" onClick={() => onSelect(agent)}>
      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: isRunning ? '#00b478' : isHibernating ? '#e09040' : '#2a2b38', boxShadow: isRunning ? '0 0 8px #00b478' : isHibernating ? '0 0 6px #e09040' : 'none' }} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-t1">{agent.name || 'Agent'}</span>
          <Chip variant={statusVariant} pulse={isRunning}>{statusLabel}</Chip>
        </div>
        <div className="flex items-center gap-3 mt-0.5 text-[10px] text-t3 font-mono">
          <span>{agent.model || 'unknown'}</span>
          <span>·</span>
          <span className="flex items-center gap-1"><Clock size={9} />{formatUptime(agent.uptime_s)}</span>
          <span>·</span>
          <span className="flex items-center gap-1"><Activity size={9} />{agent.session_count ?? 0} sessions</span>
        </div>
      </div>
      <div className="hidden sm:block w-20 flex-shrink-0">
        <HealthMiniChart data={agent.memory_history || [0]} color={isRunning ? '#4a80c8' : '#2a2b38'} />
      </div>
      <div className="text-right flex-shrink-0">
        <div className="font-mono text-[11px] font-bold text-t2">{formatCost(agent.cost)}</div>
        <div className="font-mono text-[9px] text-t3">cost so far</div>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
        {!isRunning ? (
          <button onClick={(e) => { e.stopPropagation(); onStart(agent.name) }} disabled={isPending} className="p-1.5 rounded-lg border border-green/25 text-green hover:bg-green/10 disabled:opacity-50" title="Start agent">
            {isPending ? <Loader2 size={11} className="animate-spin" /> : <Play size={11} />}
          </button>
        ) : (
          <button onClick={(e) => { e.stopPropagation(); onStop(agent.name) }} disabled={isPending} className="p-1.5 rounded-lg border border-rust/25 text-rust hover:bg-rust/10 disabled:opacity-50" title="Stop agent">
            {isPending ? <Loader2 size={11} className="animate-spin" /> : <Square size={11} />}
          </button>
        )}
      </div>
      <ChevronRight size={14} className="text-t3 flex-shrink-0" />
    </div>
  )
}

function AgentDrawer({ agent, onClose, onStart, onStop, isPending }) {
  if (!agent) return null
  const isRunning = agent.status === 'running'
  const recentSessions = Array.isArray(agent.recent_sessions) ? agent.recent_sessions : []

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md h-full overflow-y-auto bg-[#0d0f17] border-l border-white/[0.08] shadow-2xl flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-5 py-4 border-b border-white/[0.06] sticky top-0 bg-[#0d0f17] z-10">
          <div className="w-3 h-3 rounded-full" style={{ background: isRunning ? '#00b478' : '#ef4444', boxShadow: isRunning ? '0 0 8px #00b478' : 'none' }} />
          <div className="flex-1">
            <h3 className="text-base font-bold text-t1">{agent.name || 'Agent'}</h3>
            <div className="text-[11px] text-t3">{agent.model || 'unknown model'}</div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/[0.06] text-t3 hover:text-t1 transition-colors"><X size={16} /></button>
        </div>
        <div className="flex items-center gap-2 px-5 py-3 border-b border-white/[0.06]">
          {!isRunning ? (
            <button onClick={() => onStart(agent.name)} disabled={isPending} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-green/20 border border-green/30 text-green text-[11px] font-semibold hover:bg-green/30 disabled:opacity-50 transition-colors">
              {isPending ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />} Start Agent
            </button>
          ) : (
            <button onClick={() => onStop(agent.name)} disabled={isPending} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-rust/20 border border-rust/30 text-rust text-[11px] font-semibold hover:bg-rust/30 disabled:opacity-50 transition-colors">
              {isPending ? <Loader2 size={12} className="animate-spin" /> : <Square size={12} />} Stop Agent
            </button>
          )}
        </div>
        <div className="px-5 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2 mb-3"><Activity size={12} className="text-t3" /><span className="text-[10px] font-bold uppercase tracking-widest text-t3">System Health</span></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3"><div className="text-[9px] uppercase tracking-widest text-t3 mb-1">Uptime</div><div className="text-sm font-bold text-t1 font-mono">{formatUptime(agent.uptime_s)}</div></div>
            <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3"><div className="text-[9px] uppercase tracking-widest text-t3 mb-1">Sessions</div><div className="text-sm font-bold text-t1 font-mono">{agent.session_count ?? 0}</div></div>
            <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3"><div className="text-[9px] uppercase tracking-widest text-t3 mb-1">Hukommelse</div><div className="text-sm font-bold text-t1 font-mono">{agent.memory_pct ?? 0}%</div></div>
            <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3"><div className="text-[9px] uppercase tracking-widest text-t3 mb-1">Cost</div><div className="text-sm font-bold text-blue font-mono">{formatCost(agent.cost)}</div></div>
          </div>
        </div>
        <div className="px-5 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2 mb-3"><Database size={12} className="text-t3" /><span className="text-[10px] font-bold uppercase tracking-widest text-t3">Hukommelse</span></div>
          <MemoryBarChart chars={agent.memory?.chars ?? 0} maxChars={agent.memory?.max_chars ?? 250000} />
          {agent.memory_history?.length > 0 && (
            <div className="mt-3">
              <div className="text-[9px] uppercase tracking-widest text-t3 mb-2">Hukommelse historik</div>
              <HealthMiniChart data={agent.memory_history} color={agent.memory_pct > 80 ? '#e05f40' : agent.memory_pct > 60 ? '#e09040' : '#00b478'} />
            </div>
          )}
        </div>
        <div className="px-5 py-4 flex-1">
          <div className="flex items-center gap-2 mb-3"><Clock size={12} className="text-t3" /><span className="text-[10px] font-bold uppercase tracking-widest text-t3">Recent Sessions</span></div>
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

// ═══════════════════════════════════════════════════════════════
// SERVICES TAB (original OperationsPage content)
// ═══════════════════════════════════════════════════════════════

function ServiceCard({ service, busyAction, onAction, onOpenLogs }) {
  const isBusy = Boolean(busyAction)
  const platformIssues = useMemo(() => {
    if (!Array.isArray(service?.platforms)) return []
    return service.platforms.filter((p) => p?.error)
  }, [service])

  const canStop = service?.key === 'hermes-gateway'
  const canStart = service?.key === 'hermes-gateway' && !service?.active
  const isReadOnly = service?.key === 'hermes-dashboard-api'

  return (
    <div className="bg-surface border border-border rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-t1 truncate">{service?.label || service?.key}</div>
          <div className="text-[10px] font-mono text-t3 truncate">{service?.unit || 'n/a'}</div>
        </div>
        <Chip variant={service?.active ? 'online' : 'offline'}>{service?.active ? 'Kørende' : 'Stoppet'}</Chip>
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
          <div className="text-[10px] font-mono text-t3 truncate" title={service.cmdline}>{service.cmdline}</div>
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
              <button onClick={() => onAction(service.key, 'start')} disabled={isBusy} className="px-2.5 py-1 rounded text-[10px] font-semibold text-green border border-green/30 hover:bg-green/10 disabled:opacity-50">
                <Play size={10} className="inline mr-1" /> Start
              </button>
            )}
            <button onClick={() => onAction(service.key, 'restart')} disabled={isBusy} className="px-2.5 py-1 rounded text-[10px] font-semibold text-amber border border-amber/30 hover:bg-amber/10 disabled:opacity-50">
              <RefreshCw size={10} className={`inline mr-1 ${isBusy ? 'animate-spin' : ''}`} /> Restart
            </button>
            {canStop && (
              <button onClick={() => onAction(service.key, 'stop')} disabled={isBusy} className="px-2.5 py-1 rounded text-[10px] font-semibold text-rust border border-rust/30 hover:bg-rust/10 disabled:opacity-50">
                <Square size={10} className="inline mr-1" /> Stop
              </button>
            )}
            <button onClick={() => onOpenLogs(service.key)} className="px-2.5 py-1 rounded text-[10px] font-semibold text-blue border border-blue/30 hover:bg-blue/10">
              <ScrollText size={10} className="inline mr-1" /> Logfiler
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════

export function OperationsPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = searchParams.get('tab') || 'services'

  const { data, loading, refetch, lastUpdated } = usePoll('/control/services', 5000)
  const { data: gw, loading: gwLoading } = usePoll('/gateway', 8000)
  const { data: stats } = usePoll('/stats', 10000)
  const { data: memStats } = usePoll('/memory/stats', 15000)
  const { data: sysInfo } = usePoll('/system/info', 30000)
  const { data: ekg } = usePoll('/ekg', 30000)

  const [busyAction, setBusyAction] = useState(null)
  const [msg, setMsg] = useState(null)
  const [loadingTimedOut, setLoadingTimedOut] = useState(false)

  // Health tab state
  const [healthHistory, setHealthHistory] = useState([])
  const [apiEndpoints, setApiEndpoints] = useState(MOCK_API_ENDPOINTS)
  const [lastHealthRefresh, setLastHealthRefresh] = useState(new Date())

  // Fleet tab state
  const [agents, setAgents] = useState([])
  const [selectedAgent, setSelectedAgent] = useState(null)
  const [pendingActions, setPendingActions] = useState({})
  const [actionMsg, setActionMsg] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const services = data?.services || []

  useEffect(() => {
    if (!loading) { setLoadingTimedOut(false); return }
    const id = setTimeout(() => setLoadingTimedOut(true), 8000)
    return () => clearTimeout(id)
  }, [loading])

  // Health data fetch
  useEffect(() => {
    if (activeTab !== 'health') return
    setHealthHistory(generateMockHistory())
    setLastHealthRefresh(new Date())
    setApiEndpoints(prev => prev.map(ep => ({ ...ep, latency: Math.max(10, ep.latency + Math.round((Math.random() - 0.5) * 40)) })))
    const id = setInterval(() => {
      setHealthHistory(generateMockHistory())
      setLastHealthRefresh(new Date())
      setApiEndpoints(prev => prev.map(ep => ({ ...ep, latency: Math.max(10, ep.latency + Math.round((Math.random() - 0.5) * 40)) })))
    }, 30000)
    return () => clearInterval(id)
  }, [activeTab])

  // Fleet data fetch
  const fetchAgents = useCallback(async ({ signal } = {}) => {
    try {
      const res = await apiFetch('/api/agent/list', { timeout: 8000, signal })
      if (res.ok) {
        const data = await res.json()
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

  useEffect(() => {
    if (activeTab !== 'fleet') return
    fetchAgents()
    const id = setInterval(fetchAgents, 12000)
    return () => clearInterval(id)
  }, [activeTab, fetchAgents])

  const onAction = async (service, action) => {
    const key = `${service}:${action}`
    setBusyAction(key)
    setMsg(null)
    try {
      const res = await apiFetch(`/api/control/services/${service}/${action}`, { method: 'POST' })
      const body = await res.json().catch(e => { if (import.meta.env.DEV) console.warn('[Operations] parse error:', e); return {} })
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
    if (service === 'hermes-dashboard-api') { navigate('/logs?file=agent'); return }
    navigate('/logs?file=gateway')
  }

  // Fleet actions
  const handleStartAgent = async (name) => {
    if (!name) return
    setPendingActions(prev => ({ ...prev, [name]: 'start' }))
    setActionMsg(null)
    try {
      const res = await apiFetch(`/api/agent/start`, { method: 'POST', body: JSON.stringify({ agent: name }) })
      const body = await res.json().catch(() => ({}))
      if (res.ok && body?.ok !== false) {
        setActionMsg({ type: 'ok', text: `Agent ${name} started` })
        setAgents(prev => prev.map(a => a.name === name ? { ...a, status: 'running' } : a))
        if (selectedAgent?.name === name) setSelectedAgent(prev => ({ ...prev, status: 'running' }))
      } else { setActionMsg({ type: 'err', text: body.error || `Failed to start ${name}` }) }
    } catch { setActionMsg({ type: 'err', text: `Failed to start ${name}` }) }
    finally { setPendingActions(prev => { const n = { ...prev }; delete n[name]; return n }); setTimeout(() => setActionMsg(null), 4000) }
  }

  const handleStopAgent = async (name) => {
    if (!name) return
    setPendingActions(prev => ({ ...prev, [name]: 'stop' }))
    setActionMsg(null)
    try {
      const res = await apiFetch(`/api/agent/stop`, { method: 'POST', body: JSON.stringify({ agent: name }) })
      const body = await res.json().catch(() => ({}))
      if (res.ok && body?.ok !== false) {
        setActionMsg({ type: 'ok', text: `Agent ${name} stopped` })
        setAgents(prev => prev.map(a => a.name === name ? { ...a, status: 'stopped' } : a))
        if (selectedAgent?.name === name) setSelectedAgent(prev => ({ ...prev, status: 'stopped' }))
      } else { setActionMsg({ type: 'err', text: body.error || `Failed to stop ${name}` }) }
    } catch { setActionMsg({ type: 'err', text: `Failed to stop ${name}` }) }
    finally { setPendingActions(prev => { const n = { ...prev }; delete n[name]; return n }); setTimeout(() => setActionMsg(null), 4000) }
  }

  // Health metrics
  const cpuPct = sysInfo?.cpu_count ?? 0
  const memPct = sysInfo?.mem_pct ?? 0
  const diskPct = sysInfo?.disk_pct ?? Math.round(35 + Math.random() * 30)
  const networkPct = sysInfo?.network_pct ?? Math.round(20 + Math.random() * 40)
  const uptimeS = sysInfo?.uptime_s ?? 0
  const hostname = sysInfo?.hostname ?? '—'
  const plat = sysInfo?.platform ?? '—'
  const arch = sysInfo?.arch ?? '—'
  const avgLatency = ekg?.avg_latency_ms ?? 0

  // Fleet metrics
  const activeCount = agents.filter(a => a.status === 'running').length
  const totalSessions = agents.reduce((sum, a) => sum + (a.session_count || 0), 0)
  const totalCost = agents.reduce((sum, a) => sum + (parseFloat(a.cost) || 0), 0)

  return (
    <div className="space-y-4 max-w-6xl">
      <PagePrimer
        title="Drift"
        body="Services, system health og agent-flåde samlet ét sted."
        tip="Restart først ved mistanke om stale status. Stop er kun til emergencies."
      />

      {/* Tab Navigation */}
      <div className="flex items-center gap-1 border-b border-border pb-0">
        {TABS.map(tab => {
          const Icon = tab.icon
          const isActive = activeTab === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => setSearchParams({ tab: tab.key })}
              className={clsx(
                'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors',
                isActive
                  ? 'border-amber text-t1'
                  : 'border-transparent text-t3 hover:text-t2 hover:border-t3/30'
              )}
            >
              <Icon size={14} />
              {tab.label}
              {tab.key === 'services' && <span className="font-mono text-[10px] text-t3">{services.length}</span>}
              {tab.key === 'health' && avgLatency > 0 && (
                <span className="font-mono text-[10px]" style={{ color: avgLatency < 200 ? '#00b478' : avgLatency < 1000 ? '#e09040' : '#e05f40' }}>{avgLatency}ms</span>
              )}
              {tab.key === 'fleet' && (
                <span className="font-mono text-[10px] text-t3">{activeCount}/{agents.length}</span>
              )}
            </button>
          )
        })}
      </div>

      {/* Messages */}
      {msg && (
        <div className={`text-[11px] font-mono px-3 py-2 rounded border ${msg.type === 'ok' ? 'text-green border-green/30 bg-green/10' : 'text-rust border-rust/30 bg-rust/10'}`}>
          {msg.text}
        </div>
      )}
      {actionMsg && (
        <div className={`text-[11px] font-mono px-3 py-2 rounded border ${actionMsg.type === 'ok' ? 'text-green border-green/30 bg-green/10' : 'text-rust border-rust/30 bg-rust/10'}`}>
          {actionMsg.text}
        </div>
      )}

      {/* ═══ SERVICES TAB ═══ */}
      {activeTab === 'services' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Server size={16} className="text-amber" />
              <h2 className="text-lg font-bold text-t1">Services</h2>
              <span className="font-mono text-[10px] text-t3">
                {lastUpdated ? `synkroniseret ${Math.max(0, Math.round((Date.now() - lastUpdated) / 1000))}s siden` : 'synkroniserer…'}
              </span>
            </div>
            <button onClick={() => refetch()} className="px-3 py-1.5 rounded text-[11px] border border-border text-t2 hover:bg-surface2">
              <RefreshCw size={12} className={`inline mr-1 ${loading ? 'animate-spin' : ''}`} /> Opdater
            </button>
          </div>

          {loading && services.length === 0 && !loadingTimedOut ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="bg-surface border border-border rounded-lg p-5 animate-pulse">
                  <div className="flex items-center gap-3 mb-4"><div className="w-5 h-5 rounded bg-border" /><div className="h-4 w-32 rounded bg-border" /></div>
                  <div className="space-y-2"><div className="h-3 w-3/4 rounded bg-border" /><div className="h-3 w-1/2 rounded bg-border" /></div>
                </div>
              ))}
            </div>
          ) : loading && services.length === 0 && loadingTimedOut ? (
            <div className="bg-surface border border-rust/30 rounded-lg p-6 text-center">
              <div className="text-sm font-semibold text-rust">Kunne ikke hente services endnu</div>
              <div className="text-[11px] text-t3 mt-1">API kan være offline eller utilgængelig.</div>
              <button onClick={() => { setLoadingTimedOut(false); refetch() }} className="mt-3 px-3 py-1.5 rounded text-[11px] border border-border text-t2 hover:bg-surface2">
                Prøv igen
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {services.map(s => (
                <ServiceCard key={s.key} service={s} busyAction={busyAction && busyAction.startsWith(`${s.key}:`) ? busyAction : null} onAction={onAction} onOpenLogs={onOpenLogs} />
              ))}
            </div>
          )}

          <div className="text-[10px] text-t3 font-mono">
            <Activity size={10} className="inline mr-1" /> Polling hvert 5. sekund
          </div>
        </div>
      )}

      {/* ═══ HEALTH TAB ═══ */}
      {activeTab === 'health' && (
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Activity size={16} className="text-green" />
              <h2 className="text-lg font-bold text-t1">System Health</h2>
              <span className="font-mono text-[10px] text-t3">{hostname} · {plat} {arch}</span>
              <span className="font-mono text-[10px] text-t3">Uptime: {formatUptime(uptimeS)}</span>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-t3">
              <RefreshCw size={10} /> Sidst opdateret: <span className="font-mono text-t2">{lastHealthRefresh.toLocaleTimeString()}</span>
              {avgLatency > 0 && (
                <Chip variant={avgLatency < 200 ? 'online' : avgLatency < 1000 ? 'pending' : 'offline'}>API avg: {avgLatency}ms</Chip>
              )}
            </div>
          </div>

          {/* Gauges */}
          <div className="grid grid-cols-2 min-[600px]:grid-cols-4 gap-3">
            <Card accent="green" className="p-4">
              <div className="flex justify-center"><RadialGauge label="CPU" value={cpuPct} icon={Cpu} size={110} /></div>
              <div className="mt-2 text-center text-[10px] text-t3">{sysInfo?.cpu_count ? `${sysInfo.cpu_count} cores` : '—'}</div>
            </Card>
            <Card accent="blue" className="p-4">
              <div className="flex justify-center"><RadialGauge label="Memory" value={memPct} icon={HardDrive} size={110} /></div>
              <div className="mt-2 text-center text-[10px] text-t3">{sysInfo?.used_mem_mb && sysInfo?.free_mem_mb ? `${sysInfo.used_mem_mb}MB used · ${sysInfo.free_mem_mb}MB free` : '—'}</div>
            </Card>
            <Card accent="amber" className="p-4">
              <div className="flex justify-center"><RadialGauge label="Disk" value={diskPct} icon={HardDrive} size={110} /></div>
              <div className="mt-2 text-center text-[10px] text-t3">Storage usage</div>
            </Card>
            <Card accent="rust" className="p-4">
              <div className="flex justify-center"><RadialGauge label="Network" value={networkPct} icon={Wifi} size={110} /></div>
              <div className="mt-2 text-center text-[10px] text-t3">Bandwidth</div>
            </Card>
          </div>

          {/* API Health + Processes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Card className="overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                <Zap size={13} className="text-blue" /><span className="text-xs font-bold text-t2">API Health</span>
                <span className="ml-auto font-mono text-[10px] text-t3">latency</span>
              </div>
              <div className="px-2 py-1">{apiEndpoints.map(ep => (<LatencyRow key={ep.name} {...ep} />))}</div>
            </Card>
            <Card className="overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                <Cpu size={13} className="text-green" /><span className="text-xs font-bold text-t2">Top Processes</span>
                <span className="ml-auto font-mono text-[10px] text-t3">CPU / MEM</span>
              </div>
              <div className="px-2 py-1">{mockProcessList().map((p, i) => (<ProcessRow key={i} {...p} />))}</div>
            </Card>
          </div>

          {/* Uptime Timeline */}
          <Card accent="green" className="overflow-hidden">
            <div className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Activity size={13} className="text-green" />
                <span className="text-xs font-bold text-t2">Uptime & Response Time — last 24h</span>
                <span className="ml-auto flex items-center gap-4 font-mono text-[10px] text-t3">
                  <span><span className="inline-block w-3 h-0.5 bg-green rounded mr-1" />Uptime %</span>
                  <span><span className="inline-block w-3 h-0.5 bg-blue rounded mr-1" />Latency ms</span>
                </span>
              </div>
              <UptimeChart data={healthHistory} />
            </div>
          </Card>
        </div>
      )}

      {/* ═══ FLEET TAB ═══ */}
      {activeTab === 'fleet' && (
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Bot size={16} className="text-blue" />
              <h2 className="text-lg font-bold text-t1">Agentflåde</h2>
              <span className="font-mono text-[10px] text-t3">{activeCount}/{agents.length} kørende</span>
              <span className="font-mono text-[10px] text-t3">{totalSessions} sessioner</span>
              <span className="font-mono text-[10px] text-t2">{formatCost(totalCost)}</span>
            </div>
            <button onClick={() => { fetchAgents(); setRefreshKey(k => k + 1) }} className="px-3 py-1.5 rounded text-[11px] border border-border text-t2 hover:bg-surface2">
              <RefreshCw size={12} className="inline mr-1" /> Opdater
            </button>
          </div>

          {/* Fleet metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-surface border border-border rounded-lg p-4">
              <div className="text-[10px] text-t3 uppercase tracking-wider">Aktive agenter</div>
              <div className="text-2xl font-bold text-green mt-1">{activeCount}</div>
            </div>
            <div className="bg-surface border border-border rounded-lg p-4">
              <div className="text-[10px] text-t3 uppercase tracking-wider">Total sessioner</div>
              <div className="text-2xl font-bold text-t1 mt-1">{totalSessions}</div>
            </div>
            <div className="bg-surface border border-border rounded-lg p-4">
              <div className="text-[10px] text-t3 uppercase tracking-wider">Samlet cost</div>
              <div className="text-2xl font-bold text-blue mt-1">{formatCost(totalCost)}</div>
            </div>
            <div className="bg-surface border border-border rounded-lg p-4">
              <div className="text-[10px] text-t3 uppercase tracking-wider">Memory</div>
              <div className="text-2xl font-bold text-amber mt-1">{memStats?.chars ? `${Math.round(memStats.chars / 1000)}k` : '—'}</div>
            </div>
          </div>

          {/* Agent list */}
          <Card className="overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center gap-2">
              <Bot size={13} className="text-blue" /><span className="text-xs font-bold text-t2">Agenter</span>
            </div>
            {agents.length === 0 ? (
              <div className="py-8 text-center text-[11px] text-t3">Ingen agenter fundet</div>
            ) : (
              agents.map(a => (
                <AgentRow key={a.name} agent={a} onSelect={setSelectedAgent} onStart={handleStartAgent} onStop={handleStopAgent} isPending={!!pendingActions[a.name]} />
              ))
            )}
          </Card>

          <div className="text-[10px] text-t3 font-mono">
            <Activity size={10} className="inline mr-1" /> Agent polling hvert 12. sekund
          </div>
        </div>
      )}

      {/* Agent Drawer (fleet) */}
      {selectedAgent && (
        <AgentDrawer agent={selectedAgent} onClose={() => setSelectedAgent(null)} onStart={handleStartAgent} onStop={handleStopAgent} isPending={!!pendingActions[selectedAgent.name]} />
      )}
    </div>
  )
}

export default OperationsPage
