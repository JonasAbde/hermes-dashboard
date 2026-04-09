import { useState, useCallback } from 'react'
import { clsx } from 'clsx'
import {
  Cpu, Server as ServerIcon, Sparkles, Brain, HardDrive,
  RotateCw, CheckCircle, XCircle, Play, Square, Zap,
  Clock, Wifi, WifiOff, RefreshCw, CreditCard, TrendingUp, Shield, ArrowUpRight
} from 'lucide-react'
import { useApi, usePoll } from '../hooks/useApi'
import { apiFetch } from '../utils/auth'
import { SectionCard } from '../components/ui/Section'
import { PagePrimer } from '../components/ui/PagePrimer'

// ─── Tab Navigation ──────────────────────────────────────────────────────────

const TABS = [
  { id: 'konto',        label: 'Konto',      icon: CreditCard },
  { id: 'arbejdsstil', label: 'Arbejdsstil', icon: Sparkles },
  { id: 'viden',        label: 'Hvad Hermes ved', icon: Brain },
  { id: 'model',        label: 'Model',      icon: Cpu },
  { id: 'avanceret',    label: 'Avanceret', icon: HardDrive },
]

function TabNav({ active, onChange }) {
  return (
    <div className="flex gap-1 p-1 bg-surface2/50 rounded-xl border border-white/5 mb-6 overflow-x-auto">
      {TABS.map(tab => {
        const Icon = tab.icon
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={clsx(
              'flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-xs font-bold transition-all min-w-0 flex-shrink-0',
              active === tab.id
                ? 'bg-rust/15 text-rust border border-rust/25 shadow-sm'
                : 'text-t3 hover:text-t2 hover:bg-white/5'
            )}
          >
            <Icon size={14} />
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        )
      })}
    </div>
  )
}

// ─── Model Tab ──────────────────────────────────────────────────────────────

function ModelTab() {
  const { data, loading, refetch } = useApi('/models')
  const [switching, setSwitching] = useState(false)
  const [result, setResult] = useState(null)
  const [optimistic, setOptimistic] = useState(null)

  const models = data?.models ?? []
  const current = optimistic ?? data?.current ?? '—'

  const handleSwitch = async (model) => {
    if (model === current || switching) return
    setSwitching(true)
    setResult(null)
    // Optimistic update — show new model immediately, revert on failure
    setOptimistic(model)
    try {
      const res = await apiFetch('/api/control/model', {
        method: 'POST',
        body: JSON.stringify({ model }),
      })
      const body = await res.json().catch(() => ({}))
      if (res.ok) {
        setResult({ ok: true, message: `Switched to ${model}` })
        refetch()
        setOptimistic(null)
      } else {
        setResult({ ok: false, message: body.error ?? `HTTP ${res.status}` })
        setOptimistic(null)
      }
    } catch (e) {
      setResult({ ok: false, message: e.message })
      setOptimistic(null)
    } finally {
      setSwitching(false)
    }
  }

  return (
    <SectionCard title="Model Selection" icon={Cpu} iconColor="text-blue" accent="#3b82f6">
      {loading ? (
        <div className="space-y-3">
          <div className="skeleton h-12 w-full rounded-xl" />
          <div className="skeleton h-20 w-full rounded-xl" />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Current model display */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-surface2/30 border border-white/5">
            <div>
              <div className="text-[10px] text-t3 uppercase tracking-widest mb-1">Active Model</div>
              <div className="text-lg font-black font-mono text-t1">{current}</div>
            </div>
            <div className="w-3 h-3 rounded-full bg-green shadow-[0_0_10px_rgba(34,197,94,0.6)]" />
          </div>

          {/* Model grid */}
          <div className="text-[10px] text-t3 uppercase tracking-widest mb-2">Available Models</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {models.map(m => (
              <button
                key={m.name}
                onClick={() => handleSwitch(m.name)}
                disabled={switching}
                className={clsx(
                  'flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-left',
                  m.name === current
                    ? 'bg-green/10 border-green/30 text-green'
                    : 'bg-surface2/30 border-white/5 hover:border-white/20 text-t2 hover:text-t1',
                  switching && 'opacity-50'
                )}
              >
                <div className={clsx(
                  'w-2 h-2 rounded-full',
                  m.name === current ? 'bg-green shadow-[0_0_8px_rgba(34,197,94,0.8)]' : 'bg-t3'
                )} />
                <span className="font-mono text-sm truncate">{m.name}</span>
                {switching && m.name === current && (
                  <RotateCw size={12} className="ml-auto animate-spin" />
                )}
              </button>
            ))}
          </div>

          {result && (
            <div className={clsx(
              'flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-mono border',
              result.ok ? 'bg-green/10 border-green/20 text-green' : 'bg-red/10 border-red/20 text-red'
            )}>
              {result.ok ? <CheckCircle size={12} /> : <XCircle size={12} />}
              {result.message}
            </div>
          )}
        </div>
      )}
    </SectionCard>
  )
}

// ─── Arbejdsstil Tab ──────────────────────────────────────────────────────────

function ArbejdsstilTab() {
  const { data, loading } = useApi('/config')
  const [switching, setSwitching] = useState(false)
  const [result, setResult] = useState(null)

  const personalities = data?.personalities ?? []
  const current = data?.current_personality ?? '—'

  const handleSwitch = async (p) => {
    if (p === current) return
    setSwitching(true)
    setResult(null)
    try {
      const res = await apiFetch('/api/control/personality', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personality: p }),
      })
      const data = await res.json()
      if (data.ok) {
        setResult({ ok: true, message: `${p} — aktiveret` })
      } else {
        setResult({ ok: false, message: data.error || 'Kunne ikke skifte' })
      }
    } catch(e) {
      setResult({ ok: false, message: e.message })
    } finally {
      setSwitching(false)
    }
  }

  return (
    <SectionCard title="Arbejdsstil & Tone" icon={Sparkles} iconColor="text-amber" accent="#f59e0b">
      {loading ? (
        <div className="space-y-3">
          <div className="skeleton h-12 w-full rounded-xl" />
          <div className="grid grid-cols-3 gap-2">
            {[1, 2, 3].map(i => <div key={i} className="skeleton h-16 rounded-xl" />)}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Current personality */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-surface2/30 border border-white/5">
            <div>
              <div className="text-[10px] text-t3 uppercase tracking-widest mb-1">Aktiv arbejdsstil</div>
              <div className="text-lg font-black text-amber">{current}</div>
            </div>
            <Sparkles size={24} className="text-amber/50" />
          </div>

          {/* Personality grid */}
          <div className="text-[10px] text-t3 uppercase tracking-widest mb-2">Vælg arbejdsstil</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {personalities.map(p => (
              <button
                key={p}
                onClick={() => handleSwitch(p)}
                disabled={switching}
                className={clsx(
                  'flex flex-col items-center justify-center gap-2 px-3 py-4 rounded-xl border transition-all',
                  p === current
                    ? 'bg-amber/10 border-amber/30 text-amber'
                    : 'bg-surface2/30 border-white/5 text-t2 hover:border-white/20 hover:text-t1',
                  switching && p !== current && 'opacity-50'
                )}
              >
                <div className={clsx(
                  'w-2 h-2 rounded-full',
                  p === current ? 'bg-amber shadow-[0_0_8px_rgba(245,158,11,0.8)]' : 'bg-t3'
                )} />
                <span className="font-mono text-xs truncate">{p}</span>
                {switching && p === current && (
                  <RotateCw size={10} className="animate-spin" />
                )}
              </button>
            ))}
          </div>

          {result && (
            <div className={clsx(
              'flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-mono border',
              result.ok ? 'bg-green/10 border-green/20 text-green' : 'bg-red/10 border-red/20 text-red'
            )}>
              {result.ok ? <CheckCircle size={12} /> : <XCircle size={12} />}
              {result.message}
            </div>
          )}
        </div>
      )}
    </SectionCard>
  )
}

// ─── MCP Tab ─────────────────────────────────────────────────────────────────

function McpTab() {
  const { data, loading, refetch } = useApi('/mcp')
  const [actionPending, setActionPending] = useState(null)
  const [toast, setToast] = useState(null)

  const servers = data?.servers ?? []
  const running = data?.running_count ?? 0
  const total = data?.total ?? 0

  const showToast = (msg, type = 'ok') => {
    setToast({ message: msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const handleAction = useCallback(async (name, action) => {
    if (!name) return
    setActionPending(`${name}:${action}`)
    try {
      const res = await apiFetch(`/api/mcp/${encodeURIComponent(name)}/${action}`, {
        method: 'POST',
      })
      const body = await res.json().catch(() => ({}))
      if (res.ok) {
        showToast(`${name}: ${action} — OK`, 'ok')
      } else {
        showToast(`${name}: ${action} failed — ${body.error || `HTTP ${res.status}`}`, 'err')
      }
    } catch (e) {
      showToast(`${name}: ${action} failed — ${e.message}`, 'err')
    } finally {
      setActionPending(null)
      await refetch()
    }
  }, [refetch])

  return (
    <SectionCard
      title="MCP Servers"
      icon={ServerIcon}
      iconColor="text-green"
      accent="#00b478"
      headerRight={
        <span className="font-mono text-[10px] text-t3">
          {running}/{total} running
        </span>
      }
    >
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <div key={i} className="skeleton h-14 rounded-xl" />)}
        </div>
      ) : servers.length === 0 ? (
        <div className="text-center py-8 text-t3 text-sm">
          No MCP servers found
        </div>
      ) : (
        <div className="space-y-2">
          {servers.map(server => {
            const isRunning = server.status === 'running'
            const busy = actionPending?.startsWith(`${server.name}:`)
            return (
              <div
                key={server.name}
                className="flex items-center gap-3 px-4 py-3 rounded-xl bg-surface2/40 border border-white/5"
              >
                {/* Status dot */}
                <div className={clsx(
                  'w-2.5 h-2.5 rounded-full flex-shrink-0',
                  isRunning ? 'bg-green shadow-[0_0_8px_rgba(34,197,94,0.8)]' : 'bg-t3'
                )} />

                {/* Server info */}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-t1 capitalize truncate">{server.name}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={clsx('font-mono text-[10px]', isRunning ? 'text-green' : 'text-t3')}>
                      {isRunning ? 'Running' : 'Stopped'}
                    </span>
                    {server.pid && (
                      <span className="font-mono text-[10px] text-t3">pid {server.pid}</span>
                    )}
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {isRunning ? (
                    <>
                      <button
                        onClick={() => handleAction(server.name, 'restart')}
                        disabled={busy}
                        className="p-2 rounded-lg text-t3 hover:text-amber hover:bg-amber/10 border border-transparent hover:border-amber/20 transition-all disabled:opacity-40"
                        title="Restart"
                      >
                        <RotateCw size={14} />
                      </button>
                      <button
                        onClick={() => handleAction(server.name, 'stop')}
                        disabled={busy}
                        className="p-2 rounded-lg text-t3 hover:text-red hover:bg-red/10 border border-transparent hover:border-red/20 transition-all disabled:opacity-40"
                        title="Stop"
                      >
                        <Square size={14} />
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => handleAction(server.name, 'start')}
                      disabled={busy}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-t3 hover:text-green hover:bg-green/10 border border-transparent hover:border-green/20 transition-all disabled:opacity-40 text-xs font-bold"
                    >
                      {busy ? <RotateCw size={12} className="animate-spin" /> : <Play size={12} />}
                      Start
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {toast && (
        <div className={clsx(
          'mt-3 px-3 py-2 rounded-lg text-xs font-mono border',
          toast.type === 'ok' ? 'bg-green/10 border-green/20 text-green' : 'bg-red/10 border-red/20 text-red'
        )}>
          {toast.message}
        </div>
      )}
    </SectionCard>
  )
}

// ─── Viden Tab ────────────────────────────────────────────────────────────────

function VidenTab() {
  const { data, loading, refetch } = usePoll('/memory/stats', 10000)
  const [compacting, setCompacting] = useState(false)
  const [compactResult, setCompactResult] = useState(null)

  const MAX_CHARS = data?.max_chars ?? 250000
  const memPct = data?.memory_pct ?? 0
  const memChars = data?.memory?.chars ?? 0
  const memLines = data?.memory?.lines ?? 0
  const memEntries = data?.memory?.entries ?? 0
  const healthColor = memPct > 80 ? '#e63946' : memPct > 60 ? '#f59e0b' : '#22c55e'

  const handleCompact = async () => {
    if (!confirm('Compact MEMORY.md? A backup is saved automatically.')) return
    setCompacting(true)
    setCompactResult(null)
    try {
      const res = await apiFetch('/api/memory/compact', { method: 'POST' })
        .catch(e => { if (import.meta.env.DEV) console.warn('Memory compact request failed:', e.message); throw e })
      const body = await res.json()
      if (res.ok) {
        setCompactResult({ ok: true, saved: body.saved_chars, pct: body.saved_pct })
        refetch()
      } else {
        setCompactResult({ ok: false, message: body.error })
      }
    } catch (e) {
      setCompactResult({ ok: false, message: e.message })
    } finally {
      setCompacting(false)
    }
  }

  const formatBytes = (chars) => {
    if (chars < 1000) return `${chars}`
    if (chars < 1000000) return `${(chars / 1000).toFixed(1)}k`
    return `${(chars / 1000000).toFixed(2)}M`
  }

  return (
    <SectionCard title="Hvad Hermes husker" icon={Brain} iconColor="text-amber" accent="#f59e0b">
      {loading ? (
        <div className="space-y-4">
          <div className="skeleton h-16 w-full rounded-xl" />
          <div className="skeleton h-12 w-full rounded-xl" />
        </div>
      ) : (
        <div className="space-y-5">
          {/* Capacity bar */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold text-t3 uppercase tracking-widest">MEMORY.md</span>
              <span className="font-mono text-[10px] text-t3">
                {formatBytes(memChars)} / {formatBytes(MAX_CHARS)} chars
              </span>
            </div>
            <div className="h-4 bg-surface2 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${Math.min(memPct, 100)}%`,
                  background: healthColor,
                  boxShadow: `0 0 12px ${healthColor}66`,
                }}
              />
            </div>
            <div className="flex items-center justify-between mt-2">
              <span className={clsx(
                'text-xl font-black',
                memPct > 80 ? 'text-red' : memPct > 60 ? 'text-amber' : 'text-green'
              )}>
                {memPct}%
              </span>
              <span className="text-[10px] text-t3">
                {memPct > 80 ? '⚠ Høj belastning' : memPct > 60 ? '◐ Moderat' : '✓ Stabil'}
              </span>
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-surface2/30 rounded-xl p-3 text-center border border-white/5">
              <div className="text-xl font-black text-t1">{data?.memory?.size_kb ?? 0}</div>
              <div className="text-[9px] text-t3 uppercase tracking-widest mt-0.5">Hukommelse</div>
            </div>
            <div className="bg-surface2/30 rounded-xl p-3 text-center border border-white/5">
              <div className="text-xl font-black text-t1">{memLines}</div>
              <div className="text-[9px] text-t3 uppercase tracking-widest mt-0.5">Lines</div>
            </div>
            <div className="bg-surface2/30 rounded-xl p-3 text-center border border-white/5">
              <div className="text-xl font-black text-t1">{memEntries}</div>
              <div className="text-[9px] text-t3 uppercase tracking-widest mt-0.5">Entries</div>
            </div>
          </div>

          {/* USER.md indicator */}
          {data?.user?.exists && (
            <div className="flex items-center justify-between text-[11px] text-t2 bg-surface2/20 rounded-lg px-3 py-2 border border-white/5">
              <span className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-blue" />
                USER.md
              </span>
              <span className="font-mono text-t3">
                {data.user.size_kb} KB · {data.user.lines} lines
              </span>
            </div>
          )}

          {/* Compact button */}
          <button
            onClick={handleCompact}
            disabled={compacting || memChars < 1000}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-amber/10 border border-amber/30 text-amber text-xs font-bold hover:bg-amber/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {compacting ? (
              <><RotateCw size={14} className="animate-spin" /> Compacting...</>
            ) : (
              <><HardDrive size={14} /> Compact MEMORY.md</>
            )}
          </button>

          {compactResult && (
            <div className={clsx(
              'text-xs font-mono px-3 py-2 rounded-lg border',
              compactResult.ok
                ? 'bg-green/10 border-green/20 text-green'
                : 'bg-red/10 border-red/20 text-red'
            )}>
              {compactResult.ok
                ? `✓ Compacted — saved ${compactResult.saved} chars (${compactResult.pct}%)`
                : `✗ ${compactResult.message}`
              }
            </div>
          )}
        </div>
      )}
    </SectionCard>
  )
}

// ─── System Tab ──────────────────────────────────────────────────────────────

function SystemTab() {
  const { data, loading, refetch } = usePoll('/system/info', 15000)

  const formatUptime = (s) => {
    if (!s) return '—'
    const d = Math.floor(s / 86400)
    const h = Math.floor((s % 86400) / 3600)
    const m = Math.floor((s % 3600) / 60)
    if (d > 0) return `${d}d ${h}h`
    if (h > 0) return `${h}h ${m}m`
    return `${m}m`
  }

  return (
    <SectionCard title="System Info" icon={HardDrive} iconColor="text-blue" accent="#3b82f6">
      {loading ? (
        <div className="space-y-4">
          <div className="skeleton h-20 w-full rounded-xl" />
          <div className="skeleton h-20 w-full rounded-xl" />
        </div>
      ) : (
        <div className="space-y-4">
          {/* System status */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-surface2/30 border border-white/5">
            <div>
              <div className="text-[10px] text-t3 uppercase tracking-widest mb-1">System</div>
              <div className="text-lg font-black text-t1">{data?.hostname ?? '—'}</div>
            </div>
            <div className={clsx(
              'flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold',
              data?.uptime_s != null ? 'bg-green/10 text-green border border-green/20' : 'bg-red/10 text-red border border-red/20'
            )}>
              <div className="w-2 h-2 rounded-full bg-green shadow-[0_0_6px_rgba(34,197,94,0.8)]" />
              Online
            </div>
          </div>

          {/* Info grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-surface2/30 rounded-xl p-4 border border-white/5">
              <div className="text-[9px] text-t3 uppercase tracking-widest mb-1">Platform</div>
              <div className="text-sm font-mono text-t1">{data?.platform ?? '—'}</div>
              <div className="text-[10px] text-t3 mt-0.5">{data?.arch ?? ''}</div>
            </div>
            <div className="bg-surface2/30 rounded-xl p-4 border border-white/5">
              <div className="text-[9px] text-t3 uppercase tracking-widest mb-1">Kernel</div>
              <div className="text-sm font-mono text-t1 truncate">{data?.release?.split('-')[0] ?? '—'}</div>
            </div>
            <div className="bg-surface2/30 rounded-xl p-4 border border-white/5">
              <div className="text-[9px] text-t3 uppercase tracking-widest mb-1">CPUs</div>
              <div className="text-sm font-mono text-t1">{data?.cpu_count ?? '?'} cores</div>
            </div>
            <div className="bg-surface2/30 rounded-xl p-4 border border-white/5">
              <div className="text-[9px] text-t3 uppercase tracking-widest mb-1">Uptime</div>
              <div className="text-sm font-mono text-t1">{formatUptime(data?.uptime_s)}</div>
            </div>
          </div>

          {/* Memory usage */}
          <div className="bg-surface2/30 rounded-xl p-4 border border-white/5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[9px] text-t3 uppercase tracking-widest">System RAM</span>
              <span className="font-mono text-sm text-green">{data?.mem_pct ?? 0}%</span>
            </div>
            <div className="h-2 bg-surface rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-green transition-all"
                style={{ width: `${data?.mem_pct ?? 0}%` }}
              />
            </div>
            <div className="flex justify-between mt-1.5 text-[10px] font-mono text-t3">
              <span>{data?.used_mem_mb ?? '?'} MB used</span>
              <span>{data?.free_mem_mb ?? '?'} MB free</span>
            </div>
          </div>

          {/* Hermes info */}
          <div className="bg-surface2/30 rounded-xl p-4 border border-white/5">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[9px] text-t3 uppercase tracking-widest mb-1">Hermes Gateway</div>
                <div className="text-sm font-mono text-t1">Dashboard {data?.dashboard_version ?? '—'}</div>
              </div>
              <div className="text-right">
                <div className="text-[9px] text-t3 uppercase tracking-widest mb-1">Gateway Uptime</div>
                <div className="text-sm font-mono text-t1">{formatUptime(data?.gw_uptime_s)}</div>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-white/5 text-[10px] text-t3">
              Root: <span className="font-mono text-t2 truncate">{data?.hermes_root ?? '—'}</span>
            </div>
          </div>
        </div>
      )}
    </SectionCard>
  )
}

// ─── Avanceret Tab (MCP + System) ─────────────────────────────────────────────

function AvanceretTab() {
  return (
    <div className="space-y-6">
      <McpTab />
      <SystemTab />
    </div>
  )
}

// ─── Konto Tab (Subscription & Billing) ──────────────────────────────────────

function KontoTab() {
  // In a real SaaS, this would come from an API
  const plan = {
    name: 'Pro',
    price: '9.99',
    period: 'måned',
    renewsIn: 14, // days
    status: 'active',
    features: ['Ubegrænsede queries', 'Alle workflows', 'Prioriteret support', 'Custom skills'],
  }

  const usage = {
    queries: { used: 847, limit: '∞', pct: null },
    agents:  { used: 3,  limit: 10,  pct: 30 },
    storage: { used: 2.4, limit: 10, pct: 24 },
    sessions:{ used: 23, limit: '∞', pct: null },
  }

  const usageItems = [
    { label: 'AI Queries', used: usage.queries.used, limit: usage.queries.limit, pct: usage.queries.pct, color: 'brand' },
    { label: 'Aktive Agenter', used: usage.agents.used, limit: usage.agents.limit, pct: usage.agents.pct, color: 'blue' },
    { label: 'Storage (GB)', used: usage.storage.used, limit: usage.storage.limit, pct: usage.storage.pct, color: 'purple' },
    { label: 'Sessions (30d)', used: usage.sessions.used, limit: usage.sessions.limit, pct: usage.sessions.pct, color: 'green' },
  ]

  return (
    <div className="space-y-6">
      {/* Plan banner */}
      <div className="rounded-xl border border-brand/30 bg-brand/5 p-5 shadow-[0_0_30px_rgba(200,160,70,0.05)]">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-5 h-5 rounded-md bg-brand/20 flex items-center justify-center">
                <Shield size={11} className="text-brand" />
              </div>
              <span className="text-[10px] uppercase tracking-widest font-bold text-brand">Aktiv Plan</span>
            </div>
            <div className="text-2xl font-black text-text">Hermes <span className="text-brand">Pro</span></div>
            <div className="text-sm text-t3 mt-0.5">€{plan.price} <span className="text-t3">/ {plan.period}</span></div>
          </div>
          <div className="text-right">
            <div className="text-[9px] uppercase tracking-widest text-t3 mb-0.5">Fornyes om</div>
            <div className="text-lg font-bold text-green">{plan.renewsIn} dage</div>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[10px] text-t3 mb-4">
          <div className="w-1.5 h-1.5 rounded-full bg-green animate-pulse" />
          <span>Abbonnement aktivt — faktureres automatisk</span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {plan.features.map(f => (
            <div key={f} className="flex items-center gap-1.5 text-[10px] text-t3">
              <CheckCircle size={10} className="text-brand flex-shrink-0" />
              {f}
            </div>
          ))}
        </div>
      </div>

      {/* Usage stats */}
      <SectionCard title="Usage denne måned" icon={TrendingUp} iconClass="text-blue">
        <div className="space-y-4">
          {usageItems.map(item => (
            <div key={item.label}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium text-t2">{item.label}</span>
                <span className="text-[10px] font-mono text-t3">
                  {item.used}{typeof item.limit === 'number' ? ` / ${item.limit}` : ''}
                </span>
              </div>
              <div className="h-1.5 bg-surface2 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    item.color === 'brand' ? 'bg-brand' :
                    item.color === 'blue'   ? 'bg-blue-400' :
                    item.color === 'purple' ? 'bg-purple-400' :
                    'bg-green'
                  }`}
                  style={{ width: item.pct ? `${item.pct}%` : '100%' }}
                />
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Billing actions */}
      <SectionCard title="Fakturering" icon={CreditCard} iconClass="text-t3">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-t2">Næste faktura</div>
              <div className="text-[10px] text-t3 mt-0.5">23. maj 2026</div>
            </div>
            <div className="text-right">
              <div className="text-xs font-semibold text-text">€9.99</div>
              <div className="text-[9px] text-t3">inkl. moms</div>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => window.open('https://billing.stripe.com', '_blank')}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-border text-[10px] font-semibold text-t3 hover:text-t2 hover:border-border/80 transition-all"
            >
              <CreditCard size={11} /> Se fakturaer
            </button>
            <button
              onClick={() => window.open('https://billing.stripe.com/portal', '_blank')}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-brand/10 border border-brand/20 text-brand text-[10px] font-semibold hover:bg-brand/20 transition-all"
            >
              <TrendingUp size={11} /> Administrer
            </button>
          </div>
        </div>
      </SectionCard>

      {/* Upgrade / Change plan */}
      <SectionCard title="Skift Plan" icon={ArrowUpRight} iconClass="text-brand">
        <div className="grid grid-cols-3 gap-2">
          {[
            { name: 'Free', price: '0', features: ['1 agent', '50 queries/dag'], cta: 'Free', current: false },
            { name: 'Pro',  price: '9.99', features: ['10 agenter', 'Ubegrænsede queries'], cta: 'Pro ✓', current: true  },
            { name: 'Enterprise', price: 'Custom', features: ['UBEGRÆNSET', 'API-adgang'], cta: 'Kontakt', current: false },
          ].map(p => (
            <div key={p.name}
                 className={`p-3 rounded-xl border text-center ${
                   p.current
                     ? 'border-brand/40 bg-brand/5'
                     : 'border-border/40 bg-surface/30 hover:border-border/70 cursor-pointer'
                 }`}>
              <div className="text-xs font-bold text-text mb-0.5">{p.name}</div>
              <div className="text-sm font-black text-text">€{p.price}</div>
              {p.price !== '0' && p.price !== 'Custom' && (
                <div className="text-[8px] text-t3 mb-2">/måned</div>
              )}
              <div className="space-y-0.5 mb-2">
                {p.features.map(f => (
                  <div key={f} className="text-[9px] text-t3">{f}</div>
                ))}
              </div>
              <div className={`text-[9px] font-semibold px-2 py-1 rounded-md ${
                p.current ? 'bg-brand/20 text-brand' : 'bg-surface2 text-t3'
              }`}>
                {p.cta}
              </div>
            </div>
          ))}
        </div>
        <p className="text-[9px] text-t3 mt-3 text-center">
          Enterprise-plan inkluderer white-label, API-adgang og dedikeret support.
          <a href="mailto:enterprise@hermes-agent.io" className="text-brand ml-1 hover:underline">Kontakt os →</a>
        </p>
      </SectionCard>
    </div>
  )
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState('arbejdsstil')

  const renderTab = () => {
    switch (activeTab) {
      case 'konto':        return <KontoTab />
      case 'arbejdsstil':  return <ArbejdsstilTab />
      case 'viden':        return <VidenTab />
      case 'model':        return <ModelTab />
      case 'avanceret':    return <AvanceretTab />
      default:             return <ArbejdsstilTab />
    }
  }

  return (
    <div className="max-w-3xl mx-auto pb-20 animate-in fade-in duration-300">
      <PagePrimer
        title="Indstillinger"
        body="Styr hvordan Hermes arbejder med dig — arbejdsstil, model, hukommelse og avancerede indstillinger."
        tip="Skift en indstilling ad gangen og tjek status på Oversigt."
      />
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-black text-t1 tracking-tight">Indstillinger</h1>
        <p className="text-sm text-t3 mt-1">Arbejdsstil, model og avanceret konfiguration</p>
      </div>

      {/* Tab navigation */}
      <TabNav active={activeTab} onChange={setActiveTab} />

      {/* Tab content */}
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-200">
        {renderTab()}
      </div>
    </div>
  )
}
