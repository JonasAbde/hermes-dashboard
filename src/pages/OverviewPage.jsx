import React from 'react'
import { usePoll, useApi } from '../hooks/useApi'
import { MetricCard, SkeletonCard } from '../components/ui/Card'
import { Chip } from '../components/ui/Chip'
import { formatDistanceToNow } from 'date-fns'
import { da } from 'date-fns/locale'
import { EkgChart } from '../components/charts/EkgChart'
import { CostChart } from '../components/charts/CostChart'
import { Heatmap } from '../components/charts/Heatmap'

function safeFormatDistance(dateStrOrNum) {
  try {
     if (!dateStrOrNum) return "—";
     const val = typeof dateStrOrNum === 'number' ? dateStrOrNum * 1000 : dateStrOrNum;
     const d = new Date(val);
     if (isNaN(d.getTime())) return "—";
     return formatDistanceToNow(d, { locale: da, addSuffix: true });
  } catch(e) {
     return "—";
  }
}


function PlatformRow({ name, status, last_seen, stale }) {
  const isLive = status === 'live_active'
  const isConnected = status === 'connected'
  const isOnline = isLive || isConnected

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-border last:border-0">
      <div className="flex-1 text-sm font-medium text-t1 capitalize">{name}</div>
      <Chip variant={isOnline ? 'online' : 'offline'} pulse={isLive}>
        {isLive ? 'Live' : isConnected ? 'Forbundet' : 'Offline'}
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
    </div>
  )
}

function McpServerRow({ name, status, command, url }) {
  const isRunning = status === 'running'
  return (
    <div className="flex items-center gap-3 py-2 border-b border-border last:border-0">
      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: isRunning ? '#00b478' : '#2a2b38', boxShadow: isRunning ? '0 0 6px #00b478' : 'none' }} />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-t1 capitalize">{name}</div>
        <div className="font-mono text-[9px] text-t3 truncate">{url || command?.slice(0, 60) || '—'}</div>
      </div>
      <Chip variant={isRunning ? 'online' : 'offline'}>
        {isRunning ? 'Kører' : 'Stoppet'}
      </Chip>
    </div>
  )
}

export function OverviewPage() {
  const { data: stats, loading: statsLoading } = usePoll('/stats', 10000)
  const { data: gw }                           = usePoll('/gateway', 8000)
  const { data: ekg }                          = usePoll('/ekg', 5000)
  const { data: heatmap }                      = useApi('/heatmap')
  const { data: mcp }                          = usePoll('/mcp', 30000)

  const platforms = gw?.platforms ?? []
  const isStateStale = gw?.state_fresh === false && gw?.state_age_s != null
  const stateAgeMin = isStateStale ? Math.round(gw.state_age_s / 60) : null

  return (
    <div className="space-y-5 max-w-6xl">

      {/* Stale state warning */}
      {isStateStale && (
        <div className="bg-amber/10 border border-amber/30 rounded-lg px-4 py-2.5 flex items-center gap-2 text-xs">
          <span className="text-amber">⚠</span>
          <span className="text-amber">Gateway state er {stateAgeMin} min gammel</span>
          <span className="text-t3">— platform status comes from live logs</span>
        </div>
      )}

      {/* Metric cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
              accent="green"
              valueColor="text-green"
            />
            <MetricCard
              label="Cost april"
              value={stats?.cost_month > 0 ? `$${stats.cost_month.toFixed(2)}` : '—'}
              sub={stats?.cost_month > 0 ? `budget: $${stats?.budget ?? '5.00'}` : 'ingen token data'}
              accent="blue"
              valueColor="text-blue"
            />
          </>
        )}
      </div>

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
                latency: <span className="text-t2">{stats?.avg_latency_s ? `${stats.avg_latency_s.toFixed(1)}s` : '—'}</span>
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
          <div className="text-xs font-bold text-t2 mb-3">Activity Heatmap — seneste 7 dage × 24 timer</div>
          <Heatmap data={heatmap?.grid} />
        </div>
      </div>

      {/* MCP Servers + Platforms + Recent sessions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">

        {/* MCP Servers */}
        <div className="bg-surface border border-border rounded-lg">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <span className="text-xs font-bold text-t2">MCP Servers</span>
            <span className="font-mono text-[10px] text-t3">{mcp?.servers?.length ?? '—'} config</span>
          </div>
          <div className="px-2">
            {!mcp
              ? <div className="py-4 text-sm text-t3 text-center">Indlæser…</div>
              : mcp.servers.length === 0
              ? <div className="py-4 text-sm text-t3 text-center">Ingen MCP servere</div>
              : mcp.servers.map(s => <McpServerRow key={s.name} {...s} />)
            }
          </div>
        </div>

        {/* Platform Connections */}
        <div className="bg-surface border border-border rounded-lg">
          <div className="px-4 py-3 border-b border-border text-xs font-bold text-t2">Platform Connections</div>
          <div className="px-4">
            {platforms.length === 0
              ? <div className="py-4 text-sm text-t3 text-center">Ingen platforme</div>
              : platforms.map(p => <PlatformRow key={p.name} {...p} />)
            }
          </div>
        </div>

        {/* Recent Sessions */}
        <div className="bg-surface border border-border rounded-lg">
          <div className="px-4 py-3 border-b border-border text-xs font-bold text-t2">Seneste sessions</div>
          <div className="divide-y divide-border">
            {stats?.recent_sessions?.map(s => (
              <div key={s.id} className="px-4 py-2.5 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-t1 truncate">{s.title || s.id.slice(-12)}</div>
                  <div className="font-mono text-[10px] text-t3">{s.source} · {s.model}</div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="font-mono text-[11px] text-t2">${(s.cost ?? 0).toFixed(4)}</div>
                  <div className="font-mono text-[10px] text-t3">
                    {safeFormatDistance(s.started_at)}
                  </div>
                </div>
              </div>
            )) ?? <div className="px-4 py-4 text-sm text-t3">Ingen sessions endnu</div>}
          </div>
        </div>
      </div>
    </div>
  )
}