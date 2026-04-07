import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePoll, useApi } from '../hooks/useApi'
import { MetricCard, SkeletonCard } from '../components/ui/Card'
import { Chip } from '../components/ui/Chip'
import { formatDistanceToNow } from 'date-fns'
import { EkgChart } from '../components/charts/EkgChart'
import { CostChart } from '../components/charts/CostChart'
import { Heatmap } from '../components/charts/Heatmap'
import { NeuralShift } from '../components/NeuralShift'
import { RecommendationsPanel } from '../components/overview/RecommendationsPanel'


function safeFormatDistance(dateStrOrNum) {
  if (!dateStrOrNum) return "—";
  try {
     let val = dateStrOrNum;
     // If it looks like a UNIX timestamp in seconds (10 digits), convert to ms
     if (typeof val === 'number' && val < 5000000000) {
       val = val * 1000;
     } else if (typeof val === 'string' && !isNaN(val) && val.length <= 10) {
       val = parseFloat(val) * 1000;
     }
     
     const d = new Date(val);
     if (isNaN(d.getTime())) return "—";
     
     // Additional guard for extreme dates that might still pass isNaN but fail formatDistance
     const year = d.getFullYear();
     if (year < 1970 || year > 2100) return "—";
     
     return formatDistanceToNow(d, { addSuffix: true });
  } catch(e) {
     console.warn("Date formatting error:", e, dateStrOrNum);
     return "—";
  }
}

function formatCost(val) {
  if (val == null || val === 0) return '$0.00'
  if (val < 0.01) return `$${val.toFixed(4)}`
  return `$${val.toFixed(2)}`
}


function PlatformRow({ name, status, last_seen, stale, onConfigure }) {
  const isLive = status === 'live_active'
  const isConnected = status === 'connected'
  const isOnline = isLive || isConnected
  const isWebhook = name?.toLowerCase() === 'webhook'
  const isOffline = !isOnline

  return (
    <div className="flex items-start sm:items-center gap-3 py-2.5 border-b border-border last:border-0 group">
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
    <div className="flex items-start sm:items-center gap-2 py-2 border-b border-border last:border-0 group">
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
  const { data: stats, loading: statsLoading } = usePoll('/stats', 10000)
  const { data: gw }                           = usePoll('/gateway', 8000)
  const { data: ekg }                          = usePoll('/ekg', 5000)
  const { data: heatmap }                      = useApi('/heatmap')
  const { data: mcp, refetch: refetchMcp }      = usePoll('/mcp', 30000)
  const { data: agent, refetch: refetchAgent } = usePoll('/agent/status', 5000)
  const { data: recommendations, loading: recLoading, refetch: refetchRecommendations } = usePoll('/recommendations', 15000)

  const platforms = gw?.platforms ?? []
  const isStateStale = gw?.state_fresh === false && gw?.state_age_s != null
  const stateAgeMin = isStateStale ? Math.round(gw.state_age_s / 60) : null
  const mcpRunning = mcp?.running_count ?? 0
  const mcpTotal = mcp?.total ?? 0

  // Handle MCP server start (show notification, actual start via backend)
  const handleMcpStart = async (serverName) => {
    if (!serverName) return
    // For now, show a notification - backend endpoint for starting MCP servers can be added later
    console.log(`Request to start MCP server: ${serverName}`)
  }

  // Navigate to settings page (opens to platform config section if available)
  const handleConfigureWebhook = () => {
    navigate('/settings')
  }

  const handleGatewayControl = async (action) => {
    setGatewayActionPending(action)
    setGatewayActionMsg(null)
    try {
      const res = await fetch(`/api/control/gateway/${action}`, { method: 'POST' })
      const body = await res.json().catch(() => ({}))
      if (res.ok) {
        setGatewayActionMsg({ type: 'ok', text: `Gateway ${action} triggered` })
      } else {
        setGatewayActionMsg({ type: 'err', text: body.error || `Gateway ${action} failed` })
      }
    } catch {
      setGatewayActionMsg({ type: 'err', text: `Gateway ${action} failed` })
    } finally {
      setGatewayActionPending(null)
      setTimeout(() => setGatewayActionMsg(null), 4000)
    }
  }

  return (
    <div className="space-y-5 max-w-6xl min-w-0">

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="md:col-span-1">
          <NeuralShift current={agent?.rhythm} onShift={() => refetchAgent()} />
        </div>
        <div className="md:col-span-3 grid grid-cols-1 min-[480px]:grid-cols-2 sm:grid-cols-4 gap-3">
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
                label="Beskeder i dag"
                value={stats?.tokens_today != null ? stats.tokens_today.toLocaleString() : '—'}
                sub={`${stats?.sessions_today ?? '—'} sessions · ${stats?.sessions_week ?? '—'} denne uge`}
                accent="rust"
                valueColor="text-rust"
              />
              <MetricCard
                label="Monthly Cost"
                value={stats?.cost_month != null ? `$${stats.cost_month.toFixed(2)}` : '—'}
                sub={`budget: $${stats?.budget ?? '25.00'}`}
                accent="blue"
                valueColor="text-blue"
              />
              <MetricCard
                label="MCP Servers"
                value={mcp?.running_count != null ? `${mcp.running_count}/${mcp.total ?? '—'}` : '—'}
                sub={`${mcp?.servers?.filter(s => s.status === 'running').map(s => s.name).join(', ') || 'Loading...'}`}
                accent="green"
                valueColor="text-green"
              />
            </>
          )}
        </div>
      </div>

      <RecommendationsPanel
        data={recommendations}
        loading={recLoading}
        onRefresh={refetchRecommendations}
      />

      {/* EKG + Cost */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="bg-surface border border-border rounded-lg overflow-hidden card-green">
          <div className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-bold text-t2">Live Heartbeat EKG</span>
              <span className="font-mono text-[10px] text-green flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green shadow-[0_0_5px_#00b478] pulse inline-block" />
                live
              </span>
              <span className="ml-auto font-mono text-[10px] text-t3">
                latency: <span className="text-t2">{ekg?.last_beat ? `${((Date.now() - ekg.last_beat) / 1000).toFixed(1)}s` : '—'}</span>
              </span>
            </div>
            <EkgChart data={ekg?.points} />
          </div>
        </div>

        <div className="bg-surface border border-border rounded-lg overflow-hidden card-blue">
          <div className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-bold text-t2">Daily cost</span>
              <span className="ml-auto font-mono text-sm font-bold text-blue">
                ${stats?.cost_month?.toFixed(2) ?? '—'}
              </span>
            </div>
            <CostChart data={stats?.daily_costs} />
          </div>
        </div>
      </div>

      {/* Heatmap */}
      <div className="bg-surface border border-border rounded-lg overflow-hidden card-rust">
        <div className="p-4">
          <div className="text-xs font-bold text-t2 mb-3">Activity Heatmap — past 7 days × 24 hours</div>
          <Heatmap data={heatmap?.grid} />
        </div>
      </div>

      {/* MCP Servers + Platforms + Recent sessions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">

        {/* MCP Servers */}
        <div className="bg-surface border border-border rounded-lg">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <span className="text-xs font-bold text-t2">MCP Servers</span>
            <span className="font-mono text-[10px] text-t3">
              {mcp?.running_count ?? '—'}/{mcp?.total ?? '—'} running
            </span>
          </div>
          <div className="px-2">
            {!mcp
              ? <div className="py-4 text-sm text-t3 text-center">Loading…</div>
              : mcp.servers.length === 0
              ? <div className="py-4 text-sm text-t3 text-center">No MCP servers</div>
              : mcp.servers.map(s => <McpServerRow key={s.name} {...s} onStart={handleMcpStart} />)
            }
          </div>
        </div>

        {/* Platform Connections */}
        <div className="bg-surface border border-border rounded-lg">
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
            {gatewayActionMsg && (
              <div className={`mt-2 text-[10px] font-mono ${gatewayActionMsg.type === 'ok' ? 'text-green' : 'text-rust'}`}>
                {gatewayActionMsg.text}
              </div>
            )}
          </div>
          <div className="px-4">
            {platforms.length === 0
              ? <div className="py-4 text-sm text-t3 text-center">No platforms</div>
              : platforms.map(p => <PlatformRow key={p.name} {...p} onConfigure={handleConfigureWebhook} />)
            }
          </div>
        </div>

        {/* Recent Sessions */}
        <div className="bg-surface border border-border rounded-lg">
          <div className="px-4 py-3 border-b border-border text-xs font-bold text-t2">Recent Sessions</div>
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
