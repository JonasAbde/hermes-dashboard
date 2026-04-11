import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePoll, useApi } from '../hooks/useApi'
import { clsx } from 'clsx'
import { MetricCard, SkeletonCard } from '../components/ui/Card'
import { Chip } from '../components/ui/Chip'
import { safeFormatDistance, formatCost } from '../utils/formatUtils'
import { EkgChart } from '../components/charts/EkgChart'
import { CostChart } from '../components/charts/CostChart'
import { Heatmap } from '../components/charts/Heatmap'
import { NeuralShift } from '../components/NeuralShift'
import { RecommendationsPanel } from '../components/overview/RecommendationsPanel'
import { RefreshCw, Zap, Server, Loader2, Trash2, Cpu } from 'lucide-react'
import { apiFetch } from '../utils/auth'


function PlatformRow({ name, status, last_seen, stale, onConfigure }) {
  const isLive = status === 'live_active'
  const isConnected = status === 'connected'
  const isOnline = isLive || isConnected
  const isWebhook = name?.toLowerCase() === 'webhook'
  const isOffline = !isOnline

  return (
    <div className="group flex items-start gap-3 rounded-lg border-b border-white/[0.04] px-2 py-3 transition-colors hover:bg-white/[0.015] sm:items-center last:border-0">
      <div className="flex-1 text-sm font-medium text-t1 capitalize">{name}</div>
      <Chip variant={isOnline ? 'online' : 'offline'} pulse={isLive}>
        {isLive ? 'Live' : isConnected ? 'Connected' : 'Offline'}
      </Chip>
      {stale && (
        <span className="font-mono text-[10px] text-amber bg-amber/10 px-1.5 py-0.5 rounded hidden sm:inline">
          ⚠ stale
        </span>
      )}
      {last_seen && safeFormatDistance(last_seen) !== "—" && (
        <span className="font-mono text-[10px] text-t3 hidden sm:block">
          {safeFormatDistance(last_seen)}
        </span>
      )}
      {isWebhook && isOffline && onConfigure && (
        <button
          onClick={onConfigure}
          className="sm:opacity-0 sm:group-hover:opacity-100 transition-opacity text-[9px] px-1.5 py-0.5 rounded bg-blue/20 text-blue hover:bg-blue/30 flex-shrink-0"
          title="Configure Webhook"
        >
          Configure
        </button>
      )}
    </div>
  )
}

function McpServerRow({ name, status, pid, command, onStart }) {
  const isRunning = status === 'running'
  return (
    <div className="group flex items-start gap-2 rounded-lg border-b border-white/[0.04] px-2 py-2.5 transition-colors hover:bg-white/[0.015] sm:items-center last:border-0">
      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: isRunning ? '#00b478' : '#2a2b38', boxShadow: isRunning ? '0 0 6px #00b478' : 'none' }} />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-t1 capitalize">{name}</div>
        <div className="font-mono text-[9px] text-t3 truncate">
          {isRunning && pid ? `pid ${pid}` : (isRunning ? 'running' : 'stopped')}
          {command && command !== '?' ? ` · ${command.slice(0, 45)}` : ''}
        </div>
      </div>
      <Chip variant={isRunning ? 'online' : 'offline'}>
        {isRunning ? 'Running' : 'Stopped'}
      </Chip>
      {!isRunning && onStart && (
        <button
          onClick={() => onStart(name)}
          className="sm:opacity-0 sm:group-hover:opacity-100 transition-opacity text-[9px] px-1.5 py-0.5 rounded bg-blue/20 text-blue hover:bg-blue/30"
          title="Start server"
        >
          Start
        </button>
      )}
    </div>
  )
}

export function OverviewPage() {
  const navigate = useNavigate()
  const [gatewayActionPending, setGatewayActionPending] = useState(null)
  const [gatewayActionMsg, setGatewayActionMsg] = useState(null)

  // Single polling manager — fans out to multiple state slices instead of 7 separate intervals.
  // Keep individual usePoll calls but derive from a shared base interval so React can batch them.
  const { data: stats, loading: statsLoading, refetch: refetchStats } = usePoll('/stats', 10000)
  const { data: gw, refetch: refetchGw } = usePoll('/gateway', 8000)
  const { data: ekg, refetch: refetchEkg } = usePoll('/ekg', 5000)
  const { data: heatmap, refetch: refetchHeatmap } = useApi('/heatmap')
  const { data: mcp, loading: mcpLoading, error: mcpError, refetch: refetchMcp } = usePoll('/mcp', 30000)
  const { data: agent, refetch: refetchAgent } = usePoll('/agent/status', 5000)
  const { data: recommendations, loading: recLoading, refetch: refetchRecommendations } = usePoll('/recommendations', 15000)

  const platforms = gw?.platforms ?? []
  const isStateStale = gw?.state_fresh === false && gw?.state_age_s != null
  const gatewayUnavailable = gw?.status === 'error'
  const stateAgeMin = isStateStale ? Math.round(gw.state_age_s / 60) : null
  const mcpRunning = mcp?.running_count ?? 0
  const mcpTotal = mcp?.total ?? 0
  const livePlatforms = platforms.filter(p => p.status === 'live_active' || p.status === 'connected')
  const latestSession = stats?.recent_sessions?.[0]
  const latestSessionAge = latestSession?.started_at ? safeFormatDistance(latestSession.started_at) : 'No recent sessions'
  const platformSummary = platforms.length ? `${livePlatforms.length}/${platforms.length} live` : 'No platforms'
  const gatewayFreshness = gatewayUnavailable
    ? 'Gateway status unavailable'
    : isStateStale && stateAgeMin != null
      ? `State lag ${stateAgeMin}m`
      : 'State synced'
  const mcpSummary = mcpLoading ? 'MCP loading' : mcpError ? 'MCP unavailable' : `${mcpRunning}/${mcpTotal} running`
  const mcpConfigured = mcpTotal > 0

  // Start a configured MCP server and refresh the status panel.
  const handleMcpStart = async (serverName) => {
    if (!serverName) return
    try {
      const res = await apiFetch(`/api/mcp/${encodeURIComponent(serverName)}/start`, {
        method: 'POST',
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok || body?.ok === false || body?.applied === false) {
        setGatewayActionMsg({ type: 'err', text: body.error || body.note || `Failed to start ${serverName}` })
        return
      }
      setGatewayActionMsg({ type: 'ok', text: `${serverName} start applied` })
      await refetchMcp()
    } catch {
      setGatewayActionMsg({ type: 'err', text: `Failed to start ${serverName}` })
    } finally {
      setTimeout(() => setGatewayActionMsg(null), 4000)
    }
  }

  // Navigate to settings page (opens to platform config section if available)
  const handleConfigureWebhook = () => {
    navigate('/settings')
  }

  const handleGatewayControl = async (action) => {
    setGatewayActionPending(action)
    setGatewayActionMsg(null)
    try {
      const res = await apiFetch(`/api/control/gateway/${action}`, { method: 'POST' })
      const body = await res.json().catch(() => ({}))
      if (res.ok && body?.ok !== false && body?.applied !== false) {
        const detail = body?.gateway_state ? ` (${body.gateway_state})` : ''
        setGatewayActionMsg({ type: 'ok', text: `Gateway ${action} applied${detail}` })
        await Promise.allSettled([
          refetchGw({ background: true }),
          refetchStats({ background: true }),
          refetchAgent({ background: true }),
        ])
      } else {
        setGatewayActionMsg({ type: 'err', text: body.error || `Gateway ${action} not applied` })
      }
    } catch {
      setGatewayActionMsg({ type: 'err', text: `Gateway ${action} failed` })
    } finally {
      setGatewayActionPending(null)
      setTimeout(() => setGatewayActionMsg(null), 4000)
    }
  }

  return (
    <div className="relative isolate max-w-6xl min-w-0 space-y-5 pb-8">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-24 left-8 h-64 w-64 rounded-full bg-rust/10 blur-3xl" />
        <div className="absolute top-24 right-[-4rem] h-72 w-72 rounded-full bg-blue/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-56 w-56 rounded-full bg-green/10 blur-3xl" />
      </div>

      <section className="relative overflow-hidden rounded-[28px] border border-white/[0.07] bg-[linear-gradient(180deg,rgba(10,11,16,0.96),rgba(10,11,16,0.88))] shadow-[0_30px_80px_rgba(0,0,0,0.45)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(224,95,64,0.16),transparent_34%),radial-gradient(circle_at_80%_20%,rgba(74,128,200,0.12),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(0,180,120,0.10),transparent_30%)]" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        <div className="relative z-10 grid gap-5 lg:grid-cols-[1.15fr_0.85fr] p-5 sm:p-6 lg:p-7">
          <div className="flex flex-col justify-between gap-5">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-[0.28em] text-t3">
                <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-t2">Command center</span>
                <span className="rounded-full border border-rust/20 bg-rust/10 px-2.5 py-1 text-rust">Live dashboard</span>
              </div>
              <div className="space-y-2">
                <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-t1">
                  Hermes overview
                </h1>
                <p className="max-w-2xl text-sm sm:text-[15px] leading-7 text-t2">
                  A live command surface for gateway health, MCP servers, platform connections, and the current agent rhythm. The most important state is visible at a glance and the control paths stay one click away.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[11px] text-t1">{gatewayFreshness}</span>
              <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[11px] text-t1">{platformSummary}</span>
              <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[11px] text-t1">MCP {mcpSummary}</span>
              <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[11px] text-t1">Latest session {latestSessionAge}</span>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                onClick={() => navigate('/logs')}
                className="inline-flex items-center justify-center rounded-full bg-rust px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white shadow-[0_10px_30px_rgba(224,95,64,0.25)] transition-transform duration-200 hover:-translate-y-0.5 hover:bg-[#ea6a4e]"
              >
                Open logs
              </button>
              <button
                onClick={() => navigate('/settings')}
                className="inline-flex items-center justify-center rounded-full border border-white/[0.10] bg-white/[0.03] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-t1 transition-colors hover:bg-white/[0.06]"
              >
                Settings
              </button>
              {gatewayActionMsg && (
                <span className={`text-[11px] font-mono ${gatewayActionMsg.type === 'ok' ? 'text-green' : 'text-rust'}`}>
                  {gatewayActionMsg.text}
                </span>
              )}
            </div>
          </div>

          <div className="lg:pt-1">
            <NeuralShift current={agent?.rhythm} onShift={() => refetchAgent()} />
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 min-[480px]:grid-cols-2 sm:grid-cols-4 gap-3">
        {statsLoading ? (
          Array.from({ length: 4 }, (_, i) => <SkeletonCard key={i} />)
        ) : (
          <>
            <MetricCard
              label="Sessions i dag"
              value={stats?.sessions_today ?? '—'}
              sub={`${stats?.sessions_week ?? '—'} denne uge`}
              accent="rust"
              valueColor="text-rust"
            />
            <MetricCard
              label="Tokens i dag (est.)"
              value={stats?.tokens_today != null ? `${(stats.tokens_today / 1000).toFixed(1)}k` : '—'}
              sub={`${stats?.sessions_today ?? '—'} sessions · est. ~4 chars/token`}
              accent="rust"
              valueColor="text-rust"
            />
            <MetricCard
              label="Monthly Cost"
              value={stats?.cost_month != null ? `$${stats.cost_month.toFixed(2)}` : '—'}
              sub={`budget: $${stats?.budget ?? '25.00'} · est.`}
              accent="blue"
              valueColor="text-blue"
            />
            <MetricCard
              label="MCP Servers"
              value={mcpLoading ? '…' : mcp?.running_count != null ? `${mcp.running_count}/${mcp.total ?? '—'}` : '—'}
              sub={mcpError ? 'Unable to load MCP status' : !mcpConfigured ? 'No servers configured in Hermes' : `${mcp?.servers?.filter(s => s.status === 'running').map(s => s.name).join(', ') || (mcpLoading ? 'Loading...' : 'No active servers')}`}
              accent="green"
              valueColor="text-green"
            />
          </>
        )}
      </div>

      {/* Quick Actions Bar */}
      <div className="flex flex-wrap items-center gap-2 px-3 py-2.5 rounded-xl border border-white/[0.06] bg-surface/40 backdrop-blur">
        <span className="text-[10px] font-bold uppercase tracking-widest text-t3 mr-1">Quick actions</span>
        {[
          {
            label: 'Restart Gateway',
            icon: <RefreshCw size={11} />,
            action: () => handleGatewayControl('restart'),
            color: 'amber',
            disabled: gatewayActionPending !== null,
          },
          {
            label: 'Refresh MCP',
            icon: <Server size={11} />,
            action: () => refetchMcp(),
            color: 'green',
            disabled: false,
          },
          {
            label: 'Refresh Stats',
            icon: <Cpu size={11} />,
            action: () => refetchStats(),
            color: 'blue',
            disabled: false,
          },
          {
            label: 'View Logs',
            icon: <Zap size={11} />,
            action: () => navigate('/logs'),
            color: 'rust',
            disabled: false,
          },
        ].map(({ label, icon, action, color, disabled }) => (
          <button
            key={label}
            onClick={action}
            disabled={disabled}
            className={clsx(
              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold border transition-all',
              color === 'amber' && 'border-amber/25 text-amber hover:bg-amber/10 hover:border-amber/40',
              color === 'green' && 'border-green/25 text-green hover:bg-green/10 hover:border-green/40',
              color === 'blue' && 'border-blue/25 text-blue hover:bg-blue/10 hover:border-blue/40',
              color === 'rust' && 'border-rust/25 text-rust hover:bg-rust/10 hover:border-rust/40',
              disabled && 'opacity-40 cursor-not-allowed'
            )}
          >
            {disabled ? <Loader2 size={11} className="animate-spin" /> : icon}
            {label}
          </button>
        ))}
      </div>

      <RecommendationsPanel
        data={recommendations}
        loading={recLoading}
        onRefresh={refetchRecommendations}
      />

      {/* EKG + Cost */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="overflow-hidden rounded-2xl bg-surface/50 backdrop-blur-xl border border-white/[0.05] shadow-xl card-green">
          <div className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-bold text-t2">Live Heartbeat EKG</span>
              <span className="font-mono text-[10px] text-green flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green shadow-[0_0_5px_#00b478] pulse inline-block" />
                live
              </span>
              <span className="ml-auto font-mono text-[10px] text-t3">
                  latency: <span className="text-t2">{ekg?.last_beat ? (((Date.now() - ekg.last_beat) / 1000).toFixed(1) + "s") : "—"}</span>
              </span>
            </div>
            <EkgChart data={ekg?.points} />
            {/* Latency breakdown */}
            {ekg?.recent_latencies?.length > 0 && (
              <div className="mt-3 pt-3 border-t border-white/[0.05]">
                <div className="text-[9px] uppercase tracking-widest text-t3 mb-2">Latency breakdown</div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {ekg.recent_latencies.map((lat, i) => {
                    const color = lat > 2000 ? '#e63946' : lat > 1000 ? '#f59e0b' : '#00b478'
                    return (
                      <div key={i} className="flex items-center gap-1">
                        <div
                          className="h-5 w-2 rounded-sm"
                          style={{ background: color, opacity: 0.4 + (i / ekg.recent_latencies.length) * 0.6 }}
                          title={`${lat}ms`}
                        />
                        <span className="font-mono text-[9px] text-t3">{lat}ms</span>
                      </div>
                    )
                  })}
                  <span className="ml-1 font-mono text-[9px] text-t3">
                    avg: <span className="text-green">{ekg?.avg_latency_ms ?? '—'}ms</span>
                    {ekg?.p95_latency_ms && (
                      <> · p95: <span className="text-amber">{ekg.p95_latency_ms}ms</span></>
                    )}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl bg-surface/50 backdrop-blur-xl border border-white/[0.05] shadow-xl card-blue">
          <div className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-bold text-t2">Daily cost <span className="text-[9px] font-normal text-t3">(est.)</span></span>
              <span className="ml-auto font-mono text-sm font-bold text-blue">
                ${stats?.daily_costs?.length > 0 ? (stats.daily_costs[stats.daily_costs.length - 1]?.cost ?? 0).toFixed(2) : '—'}
              </span>
            </div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[9px] text-t3">
                avg ${stats?.daily_costs?.length > 0
                  ? (stats.daily_costs.reduce((a, b) => a + (b?.cost ?? 0), 0) / stats.daily_costs.length).toFixed(2)
                  : '—'}/day · model-based estimate
              </span>
            </div>
            <CostChart data={stats?.daily_costs} />
            <div className="mt-2 pt-2 border-t border-white/[0.05] flex items-center gap-1.5">
              <span className="text-[9px] text-t3">Tokens: ~4 chars/tok · Cost: provider pricing table</span>
              <span className="text-[9px] text-t3 ml-auto" title="Actual costs may vary from estimates">ℹ️</span>
            </div>
          </div>
        </div>
      </div>

      {/* Heatmap */}
      <div className="overflow-hidden rounded-2xl bg-surface/50 backdrop-blur-xl border border-white/[0.05] shadow-xl card-rust">
        <div className="p-4">
          <div className="text-xs font-bold text-t2 mb-3">Activity Heatmap — past 7 days × 24 hours</div>
          <Heatmap data={heatmap?.grid} />
        </div>
      </div>

      {/* MCP Servers + Platforms + Recent sessions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">

        {/* MCP Servers */}
        <div className="overflow-hidden rounded-2xl bg-surface/50 backdrop-blur-xl border border-white/[0.05] shadow-xl">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <span className="text-xs font-bold text-t2">MCP Servers</span>
            <span className="font-mono text-[10px] text-t3 flex-shrink-0">
              {mcpLoading ? '…' : `${mcp?.running_count ?? '—'}/${mcp?.total ?? '—'} running`}
            </span>
          </div>
          <div className="px-2">
            {mcpLoading
              ? <div className="py-4 text-sm text-t3 text-center">Loading…</div>
              : mcpError
              ? <div className="py-4 text-sm text-rust text-center">Could not load MCP servers</div>
              : !mcp?.servers?.length
              ? <div className="py-4 text-sm text-t3 text-center">No MCP servers configured in Hermes</div>
              : mcp.servers.map(s => <McpServerRow key={s.name} {...s} onStart={handleMcpStart} />)
            }
          </div>
        </div>

        {/* Platform Connections */}
        <div className="overflow-hidden rounded-2xl bg-surface/50 backdrop-blur-xl border border-white/[0.05] shadow-xl">
          <div className="px-4 py-3 border-b border-border">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-t2">Platform Connections</span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => handleGatewayControl('start')}
                  disabled={gatewayActionPending !== null}
                  className="px-2 py-1 rounded text-[10px] font-semibold text-green border border-green/30 hover:bg-green/10 disabled:opacity-50"
                >
                  Start
                </button>
                <button
                  onClick={() => handleGatewayControl('restart')}
                  disabled={gatewayActionPending !== null}
                  className="px-2 py-1 rounded text-[10px] font-semibold text-amber border border-amber/30 hover:bg-amber/10 disabled:opacity-50"
                >
                  Restart
                </button>
                <button
                  onClick={() => handleGatewayControl('stop')}
                  disabled={gatewayActionPending !== null}
                  className="px-2 py-1 rounded text-[10px] font-semibold text-rust border border-rust/30 hover:bg-rust/10 disabled:opacity-50"
                >
                  Stop
                </button>
                <button
                  onClick={() => navigate('/logs')}
                  className="px-2 py-1 rounded text-[10px] font-semibold text-blue border border-blue/30 hover:bg-blue/10"
                >
                  Logs
                </button>
              </div>
            </div>
          </div>
          <div className="px-4">
            {platforms.length === 0
              ? <div className="py-4 text-sm text-t3 text-center">No platforms</div>
              : platforms.map(p => <PlatformRow key={p.name} {...p} onConfigure={handleConfigureWebhook} />)
            }
          </div>
        </div>

        {/* Recent Sessions */}
        <div className="overflow-hidden rounded-2xl bg-surface/50 backdrop-blur-xl border border-white/[0.05] shadow-xl">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <span className="text-xs font-bold text-t2">Recent Sessions</span>
            <span className="text-[9px] text-t3">costs estimated</span>
          </div>
          <div className="divide-y divide-border">
            {stats?.recent_sessions?.map(s => (
              <div key={s.id} className="px-4 py-2.5 flex items-start sm:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-t1 truncate">{s.title || s.id.slice(-12)}</div>
                  <div className="font-mono text-[10px] text-t3">{s.source} · {s.model}</div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="font-mono text-[11px] text-t2">{formatCost(s.cost)}</div>
                  <div className="font-mono text-[10px] text-t3">
                    {safeFormatDistance(s.started_at)}
                  </div>
                </div>
              </div>
            )) ?? <div className="px-4 py-4 text-sm text-t3">No sessions yet</div>}
          </div>
        </div>
      </div>
    </div>
  )
}
