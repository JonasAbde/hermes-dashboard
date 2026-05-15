// src/components/operations/OperationsFleetTab.jsx
// Fleet tab for Operations page — production-hardened.
// Shows real agent data from backend. No mock, no random enrichment, no fake metrics.

import { useState } from 'react'
import { Activity, Play, Square, Clock, Bot, ChevronRight, Loader2, X } from 'lucide-react'
import { Chip } from '../ui/Chip'
import { Card } from '../ui/Card'
import { clsx } from 'clsx'
import { useFleetData } from '../../hooks/useFleetData'

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatUptime(s) {
  if (s == null) return null
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

function statusToVariant(status) {
  if (status === 'active') return 'online'
  if (status === 'idle') return 'offline'
  return 'pending'
}

function statusLabel(status) {
  if (status === 'active') return 'Kørende'
  if (status === 'idle') return 'Dvale'
  return 'Ukendt'
}

// ── AgentRow ─────────────────────────────────────────────────────────────────

function AgentRow({ agent, onSelect, onStart, onStop, isPending }) {
  const isActive = agent.status === 'active'

  return (
    <div
      className="group flex items-center gap-3 rounded-lg border-b border-white/[0.04] px-3 py-3 cursor-pointer transition-colors hover:bg-white/[0.02] last:border-0"
      onClick={() => onSelect(agent)}
    >
      {/* Status dot */}
      <div
        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
        style={{
          background: isActive ? '#00b478' : '#2a2b38',
          boxShadow: isActive ? '0 0 8px #00b478' : 'none',
        }}
      />

      {/* Agent info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-t1">{agent.name}</span>
          <Chip variant={statusToVariant(agent.status)} pulse={isActive}>
            {statusLabel(agent.status)}
          </Chip>
        </div>
        <div className="flex items-center gap-3 mt-0.5 text-[10px] text-t3 font-mono">
          {agent.role ? (
            <span>{agent.role}</span>
          ) : (
            <span className="text-t3 italic">Ingen rolle</span>
          )}
          {agent.rhythm && (
            <>
              <span>·</span>
              <span>{agent.rhythm}</span>
            </>
          )}
          {agent.metrics?.latency != null && agent.metrics.latency > 0 && (
            <>
              <span>·</span>
              <span>{agent.metrics.latency}ms</span>
            </>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5 flex-shrink-0 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
        {!isActive ? (
          <button
            onClick={(e) => { e.stopPropagation(); onStart(agent.id) }}
            disabled={isPending}
            className="p-1.5 rounded-lg border border-green/25 text-green hover:bg-green/10 disabled:opacity-50"
            title="Start agent"
          >
            {isPending
              ? <Loader2 size={11} className="animate-spin" />
              : <Play size={11} />
            }
          </button>
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); onStop(agent.id) }}
            disabled={isPending}
            className="p-1.5 rounded-lg border border-rust/25 text-rust hover:bg-rust/10 disabled:opacity-50"
            title="Stop agent"
          >
            {isPending
              ? <Loader2 size={11} className="animate-spin" />
              : <Square size={11} />
            }
          </button>
        )}
      </div>

      <ChevronRight size={14} className="text-t3 flex-shrink-0" />
    </div>
  )
}

// ── Agent Drawer ─────────────────────────────────────────────────────────────
// Shows only real data. Missing fields → honest "Not reported" state.

function AgentDrawer({ agent, onClose, onStart, onStop, isPending }) {
  if (!agent) return null
  const isActive = agent.status === 'active'

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative w-full max-w-md h-full overflow-y-auto bg-[#0d0f17] border-l border-white/[0.08] shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-white/[0.06] sticky top-0 bg-[#0d0f17] z-10">
          <div
            className="w-3 h-3 rounded-full"
            style={{
              background: isActive ? '#00b478' : '#2a2b38',
              boxShadow: isActive ? '0 0 8px #00b478' : 'none',
            }}
          />
          <div className="flex-1">
            <h3 className="text-base font-bold text-t1">{agent.name}</h3>
            <div className="text-[11px] text-t3">
              {agent.role || 'Ingen rolle tildelt'}
              {agent.rhythm && ` · ${agent.rhythm}`}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/[0.06] text-t3 hover:text-t1 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 px-5 py-3 border-b border-white/[0.06]">
          {!isActive ? (
            <button
              onClick={() => onStart(agent.id)}
              disabled={isPending}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-green/20 border border-green/30 text-green text-[11px] font-semibold hover:bg-green/30 disabled:opacity-50 transition-colors"
            >
              {isPending ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
              Start Agent
            </button>
          ) : (
            <button
              onClick={() => onStop(agent.id)}
              disabled={isPending}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-rust/20 border border-rust/30 text-rust text-[11px] font-semibold hover:bg-rust/30 disabled:opacity-50 transition-colors"
            >
              {isPending ? <Loader2 size={12} className="animate-spin" /> : <Square size={12} />}
              Stop Agent
            </button>
          )}
        </div>

        {/* Agent details — only real data */}
        <div className="px-5 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2 mb-3">
            <Activity size={12} className="text-t3" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-t3">Detaljer</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3">
              <div className="text-[9px] uppercase tracking-widest text-t3 mb-1">Status</div>
              <div className="text-sm font-bold text-t1 font-mono">{statusLabel(agent.status)}</div>
            </div>
            <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3">
              <div className="text-[9px] uppercase tracking-widest text-t3 mb-1">Rolle</div>
              <div className="text-sm font-bold text-t1 font-mono truncate" title={agent.role || undefined}>
                {agent.role || <span className="text-t3 text-[11px]">Ikke rapporteret</span>}
              </div>
            </div>
            <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3">
              <div className="text-[9px] uppercase tracking-widest text-t3 mb-1">Rhythm</div>
              <div className="text-sm font-bold text-t1 font-mono">
                {agent.rhythm || <span className="text-t3 text-[11px]">Ikke rapporteret</span>}
              </div>
            </div>
            <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3">
              <div className="text-[9px] uppercase tracking-widest text-t3 mb-1">Latency</div>
              <div className="text-sm font-bold text-t1 font-mono">
                {agent.metrics?.latency != null && agent.metrics.latency > 0
                  ? `${agent.metrics.latency}ms`
                  : <span className="text-t3 text-[11px]">Ikke rapporteret</span>
                }
              </div>
            </div>
          </div>
        </div>

        {/* Backend data note */}
        <div className="px-5 py-4 flex-1">
          <div className="text-[10px] text-t3">
            Agent-data kommer fra <code className="bg-surface2 px-1 rounded">gateway_state.json</code>.
            Felter som sessions, cost og hukommelse er ikke tilgængelige fra backend endnu.
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main Tab Component ───────────────────────────────────────────────────────

export default function OperationsFleetTab() {
  const [selectedAgent, setSelectedAgent] = useState(null)
  const {
    agents,
    loading,
    error,
    lastUpdated,
    refetch,
    pendingActions,
    actionMsg,
    handleStartAgent,
    handleStopAgent,
  } = useFleetData(true)

  const activeCount = agents.filter(a => a.status === 'active').length

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Bot size={16} className="text-blue" />
          <h2 className="text-lg font-bold text-t1">Agentflåde</h2>
          <span className="font-mono text-[10px] text-t3">
            {agents.length > 0
              ? `${activeCount}/${agents.length} kørende`
              : 'ingen data'
            }
          </span>
        </div>
        <button
          onClick={() => refetch()}
          disabled={loading}
          className="px-3 py-1.5 rounded text-[11px] border border-border text-t2 hover:bg-surface2 disabled:opacity-50"
        >
          <RefreshCw size={12} className={clsx('inline mr-1', loading && 'animate-spin')} />
          Opdater
        </button>
      </div>

      {/* Action feedback */}
      {actionMsg && (
        <div className={clsx(
          'text-[11px] font-mono px-3 py-2 rounded border',
          actionMsg.type === 'ok'
            ? 'text-green border-green/30 bg-green/10'
            : 'text-rust border-rust/30 bg-rust/10',
        )}>
          {actionMsg.text}
        </div>
      )}

      {/* Error state */}
      {error && agents.length === 0 && (
        <div className="bg-surface border border-rust/30 rounded-lg p-6 text-center">
          <div className="text-sm font-semibold text-rust">Kunne ikke hente agenter</div>
          <div className="text-[11px] text-t3 mt-1">{error}</div>
          <button
            onClick={() => refetch()}
            className="mt-3 px-3 py-1.5 rounded text-[11px] border border-border text-t2 hover:bg-surface2"
          >
            Prøv igen
          </button>
        </div>
      )}

      {/* Fleet metrics — only if we have real data */}
      {agents.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div className="bg-surface border border-border rounded-lg p-4">
            <div className="text-[10px] text-t3 uppercase tracking-wider">Aktive agenter</div>
            <div className="text-2xl font-bold text-green mt-1">{activeCount}</div>
          </div>
          <div className="bg-surface border border-border rounded-lg p-4">
            <div className="text-[10px] text-t3 uppercase tracking-wider">Total agenter</div>
            <div className="text-2xl font-bold text-t1 mt-1">{agents.length}</div>
          </div>
          <div className="bg-surface border border-border rounded-lg p-4">
            <div className="text-[10px] text-t3 uppercase tracking-wider">Med rhythm</div>
            <div className="text-2xl font-bold text-amber mt-1">
              {agents.filter(a => a.rhythm).length}
            </div>
          </div>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && agents.length === 0 && !error && (
        <Card className="overflow-hidden">
          {[1, 2].map(i => (
            <div key={i} className="flex items-center gap-3 px-3 py-3 border-b border-white/[0.04] last:border-0 animate-pulse">
              <div className="w-2.5 h-2.5 rounded-full bg-border" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3.5 w-24 rounded bg-border" />
                <div className="h-2.5 w-36 rounded bg-border" />
              </div>
            </div>
          ))}
        </Card>
      )}

      {/* Empty state */}
      {!loading && !error && agents.length === 0 && (
        <div className="bg-surface border border-border rounded-lg p-8 text-center">
          <Bot size={24} className="mx-auto mb-2 text-t3" />
          <div className="text-sm text-t2">Ingen agenter fundet</div>
          <div className="text-[11px] text-t3 mt-1">
            Backend returnerede ingen agent-data. Kontroller <code className="bg-surface2 px-1 rounded">gateway_state.json</code>.
          </div>
        </div>
      )}

      {/* Agent list */}
      {!loading && agents.length > 0 && (
        <Card className="overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <Bot size={13} className="text-blue" />
            <span className="text-xs font-bold text-t2">Agenter</span>
          </div>
          {agents.map(agent => (
            <AgentRow
              key={agent.id}
              agent={agent}
              onSelect={setSelectedAgent}
              onStart={handleStartAgent}
              onStop={handleStopAgent}
              isPending={!!pendingActions[agent.id]}
            />
          ))}
        </Card>
      )}

      {/* Polling indicator */}
      <div className="text-[10px] text-t3 font-mono">
        <Activity size={10} className="inline mr-1" />
        Agent polling hvert 12. sekund
      </div>

      {/* Agent drawer */}
      {selectedAgent && (
        <AgentDrawer
          agent={selectedAgent}
          onClose={() => setSelectedAgent(null)}
          onStart={handleStartAgent}
          onStop={handleStopAgent}
          isPending={!!pendingActions[selectedAgent.id]}
        />
      )}
    </div>
  )
}
