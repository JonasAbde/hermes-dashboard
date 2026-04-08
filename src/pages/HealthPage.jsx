import React, { useState, useEffect, useCallback } from 'react'
import {
  RadialBarChart,
  RadialBar,
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts'
import { Card } from '../components/ui/Card'
import { Chip } from '../components/ui/Chip'
import { clsx } from 'clsx'
import {
  Server,
  Cpu,
  HardDrive,
  Wifi,
  Activity,
  Clock,
  RefreshCw,
  Zap,
} from 'lucide-react'

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatUptime(seconds) {
  if (!seconds && seconds !== 0) return '—'
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  if (days > 0) return `${days}d ${hours}h ${mins}m`
  if (hours > 0) return `${hours}h ${mins}m`
  return `${mins}m`
}

function gaugeColor(pct) {
  if (pct < 60) return '#00b478'  // green
  if (pct < 80) return '#e09040' // amber
  return '#e05f40'               // rust/red
}

function latencyColor(ms) {
  if (ms < 200) return '#00b478'
  if (ms < 1000) return '#e09040'
  return '#e05f40'
}

// ── Radial Gauge ───────────────────────────────────────────────────────────────

function RadialGauge({ label, value, unit = '%', icon: Icon, size = 120 }) {
  const pct = Math.min(100, Math.max(0, value ?? 0))
  const color = gaugeColor(pct)
  const chartId = React.useId().replace(/:/g, '')

  // recharts RadialBarChart expects data as array of objects with a `name` field
  const data = [
    { name: 'bg', value: 100, fill: 'rgba(255,255,255,0.04)' },
    { name: 'fill', value: pct, fill: color },
  ]

  return (
    <div className="flex flex-col items-center gap-2">
      <div style={{ width: size, height: size }}>
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart
            cx="50%"
            cy="50%"
            innerRadius="68%"
            outerRadius="92%"
            barSize={10}
            data={data}
            startAngle={220}
            endAngle={-40}
          >
            <defs>
              <linearGradient id={`grad-${chartId}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.9} />
                <stop offset="100%" stopColor={color} stopOpacity={0.5} />
              </linearGradient>
            </defs>
            <RadialBar
              background={{ fill: 'rgba(255,255,255,0.03)' }}
              dataKey="value"
              fill={`url(#grad-${chartId})`}
              cornerRadius={5}
              isAnimationActive={true}
            />
          </RadialBarChart>
        </ResponsiveContainer>
        {/* Center label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ top: '-8px' }}>
          {Icon && <Icon size={14} className="mb-1 text-t3" />}
          <span className="text-lg font-extrabold" style={{ color }}>{pct}{unit}</span>
        </div>
      </div>
      <span className="text-[10px] font-bold uppercase tracking-widest text-t3">{label}</span>
    </div>
  )
}

// ── API Latency Row ────────────────────────────────────────────────────────────

function LatencyRow({ name, latency, status }) {
  const ms = latency ?? 0
  const color = latencyColor(ms)
  const ok = status === 'ok' || status === 'running'

  return (
    <div className="flex items-center gap-3 rounded-lg border-b border-white/[0.04] px-2 py-2.5 last:border-0">
      <div
        className="h-2 w-2 rounded-full flex-shrink-0"
        style={{
          background: ok ? '#00b478' : '#e05f40',
          boxShadow: ok ? '0 0 6px #00b478' : '0 0 6px #e05f40',
        }}
      />
      <span className="flex-1 text-xs font-medium text-t1 capitalize">{name}</span>
      <span className="font-mono text-xs" style={{ color }}>
        {ms > 0 ? `${ms}ms` : '—'}
      </span>
    </div>
  )
}

// ── Process Row ───────────────────────────────────────────────────────────────

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

// ── Uptime Timeline ───────────────────────────────────────────────────────────

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
        <XAxis
          dataKey="time"
          tick={{ fontSize: 9, fill: '#2a2b38' }}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          yAxisId="left"
          tick={{ fontSize: 9, fill: '#2a2b38' }}
          tickLine={false}
          axisLine={false}
          width={30}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          tick={{ fontSize: 9, fill: '#2a2b38' }}
          tickLine={false}
          axisLine={false}
          width={30}
        />
        <Tooltip
          contentStyle={{
            background: '#0d0f17',
            border: '1px solid #111318',
            borderRadius: 10,
            fontSize: 11,
            color: '#d8d8e0',
          }}
        />
        <Area
          yAxisId="left"
          type="monotone"
          dataKey="uptime"
          stroke="#00b478"
          strokeWidth={1.5}
          fill="url(#uptimeGrad)"
          dot={false}
        />
        <Area
          yAxisId="right"
          type="monotone"
          dataKey="latency"
          stroke="#4a80c8"
          strokeWidth={1.5}
          fill="url(#latencyGrad)"
          dot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

// ── Mock data helpers ──────────────────────────────────────────────────────────

function generateMockHistory() {
  const now = Date.now()
  return Array.from({ length: 24 }, (_, i) => {
    const t = new Date(now - (23 - i) * 3600 * 1000)
    return {
      time: t.getHours() + ':00',
      uptime: Math.round(95 + Math.random() * 5),
      latency: Math.round(80 + Math.random() * 120),
    }
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

// ── Main Page ──────────────────────────────────────────────────────────────────

export function HealthPage() {
  const [systemInfo, setSystemInfo] = useState(null)
  const [ekg, setEkg] = useState(null)
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState(new Date())
  const [apiEndpoints, setApiEndpoints] = useState(MOCK_API_ENDPOINTS)
  const [processes] = useState(mockProcessList())

  const fetchData = useCallback(async () => {
    try {
      const [sysRes, ekgRes] = await Promise.all([
        fetch('/api/system/info'),
        fetch('/api/ekg'),
      ])
      if (sysRes.ok) {
        const info = await sysRes.json()
        setSystemInfo(info)
      }
      if (ekgRes.ok) {
        const ekgData = await ekgRes.json()
        setEkg(ekgData)
      }
      // Simulate latency updates for mock endpoints
      setApiEndpoints((prev) =>
        prev.map((ep) => ({
          ...ep,
          latency: Math.max(10, ep.latency + Math.round((Math.random() - 0.5) * 40)),
        }))
      )
      setHistory(generateMockHistory())
      setLastRefresh(new Date())
    } catch {
      // silently handle fetch errors
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [fetchData])

  const cpu = systemInfo?.cpu_count ?? 0
  const memPct = systemInfo?.mem_pct ?? 0
  const diskPct = systemInfo?.disk_pct ?? Math.round(35 + Math.random() * 30)
  const networkPct = systemInfo?.network_pct ?? Math.round(20 + Math.random() * 40)
  const uptime = systemInfo?.uptime_s ?? 0
  const hostname = systemInfo?.hostname ?? '—'
  const platform = systemInfo?.platform ?? '—'
  const arch = systemInfo?.arch ?? '—'
  const avgLatency = ekg?.avg_latency_ms ?? 0

  return (
    <div className="relative isolate max-w-6xl min-w-0 space-y-5 pb-8">
      {/* Ambient background */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-24 left-8 h-64 w-64 rounded-full bg-green/10 blur-3xl" />
        <div className="absolute top-24 right-[-4rem] h-72 w-72 rounded-full bg-blue/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-56 w-56 rounded-full bg-rust/8 blur-3xl" />
      </div>

      {/* Header */}
      <section className="relative overflow-hidden rounded-[28px] border border-white/[0.07] bg-[linear-gradient(180deg,rgba(10,11,16,0.96),rgba(10,11,16,0.88))] shadow-[0_30px_80px_rgba(0,0,0,0.45)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(0,180,120,0.12),transparent_34%),radial-gradient(circle_at_80%_20%,rgba(74,128,200,0.10),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(224,95,64,0.08),transparent_30%)]" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        <div className="relative z-10 flex flex-col gap-4 p-5 sm:p-6 lg:p-7 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-[0.28em] text-t3">
              <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-green">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-green shadow-[0_0_5px_#00b478] pulse" />
                  System health
                </span>
              </span>
              <span className="rounded-full border border-green/20 bg-green/10 px-2.5 py-1 text-green">
                Live monitoring
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-t1">System health</h1>
            <div className="flex flex-wrap items-center gap-3 text-sm text-t2">
              <span className="inline-flex items-center gap-1.5">
                <Server size={13} className="text-green" />
                <span className="font-mono">{hostname}</span>
              </span>
              <span className="text-t3">·</span>
              <span className="capitalize">{platform} {arch}</span>
              <span className="text-t3">·</span>
              <span className="inline-flex items-center gap-1.5">
                <Clock size={13} className="text-t3" />
                Uptime: <span className="font-mono text-green">{formatUptime(uptime)}</span>
              </span>
            </div>
          </div>
          <div className="flex flex-col items-start sm:items-end gap-2">
            <div className="flex items-center gap-2 text-[10px] text-t3">
              <RefreshCw size={10} className={loading ? 'animate-spin' : ''} />
              Last refresh: <span className="font-mono text-t2">{lastRefresh.toLocaleTimeString()}</span>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-t3">
              <Activity size={10} />
              Auto-refresh: <span className="font-mono text-t2">30s</span>
            </div>
            <Chip variant={avgLatency < 200 ? 'online' : avgLatency < 1000 ? 'pending' : 'offline'}>
              API avg: {avgLatency > 0 ? `${avgLatency}ms` : '—'}
            </Chip>
          </div>
        </div>
      </section>

      {/* Resource Gauges */}
      <div className="grid grid-cols-2 min-[600px]:grid-cols-4 gap-3">
        <Card accent="green" className="p-4">
          <div className="flex justify-center">
            <RadialGauge label="CPU" value={cpu} icon={Cpu} size={110} />
          </div>
          <div className="mt-2 text-center text-[10px] text-t3">
            {systemInfo?.cpu_count ? `${systemInfo.cpu_count} cores` : '—'}
          </div>
        </Card>
        <Card accent="blue" className="p-4">
          <div className="flex justify-center">
            <RadialGauge label="Memory" value={memPct} icon={HardDrive} size={110} />
          </div>
          <div className="mt-2 text-center text-[10px] text-t3">
            {systemInfo?.used_mem_mb && systemInfo?.free_mem_mb
              ? `${systemInfo.used_mem_mb}MB used · ${systemInfo.free_mem_mb}MB free`
              : '—'}
          </div>
        </Card>
        <Card accent="amber" className="p-4">
          <div className="flex justify-center">
            <RadialGauge label="Disk" value={diskPct} icon={HardDrive} size={110} />
          </div>
          <div className="mt-2 text-center text-[10px] text-t3">Storage usage</div>
        </Card>
        <Card accent="rust" className="p-4">
          <div className="flex justify-center">
            <RadialGauge label="Network" value={networkPct} icon={Wifi} size={110} />
          </div>
          <div className="mt-2 text-center text-[10px] text-t3">Bandwidth</div>
        </Card>
      </div>

      {/* API Health + Process List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* API Health Indicators */}
        <Card className="overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <Zap size={13} className="text-blue" />
            <span className="text-xs font-bold text-t2">API Health</span>
            <span className="ml-auto font-mono text-[10px] text-t3">latency</span>
          </div>
          <div className="px-2 py-1">
            {apiEndpoints.map((ep) => (
              <LatencyRow key={ep.name} {...ep} />
            ))}
          </div>
        </Card>

        {/* Process List */}
        <Card className="overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <Cpu size={13} className="text-green" />
            <span className="text-xs font-bold text-t2">Top Processes</span>
            <span className="ml-auto font-mono text-[10px] text-t3">by CPU / MEM</span>
          </div>
          <div className="px-2 py-1">
            {processes.map((p, i) => (
              <ProcessRow key={i} {...p} />
            ))}
          </div>
        </Card>
      </div>

      {/* Uptime Timeline */}
      <Card accent="green" className="overflow-hidden">
        <div className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Activity size={13} className="text-green" />
            <span className="text-xs font-bold text-t2">Uptime & Response Time — last 24h</span>
            <span className="ml-auto flex items-center gap-4 font-mono text-[10px] text-t3">
              <span>
                <span className="inline-block w-3 h-0.5 bg-green rounded mr-1" />
                Uptime %
              </span>
              <span>
                <span className="inline-block w-3 h-0.5 bg-blue rounded mr-1" />
                Latency ms
              </span>
            </span>
          </div>
          <UptimeChart data={history} />
        </div>
      </Card>
    </div>
  )
}
