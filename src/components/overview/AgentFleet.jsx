import { useState } from 'react'
import { clsx } from 'clsx'
import { HermesAvatar, rhythmToVariant } from '../avatar/HermesAvatar'
import { Bot, Zap, Shield, Activity, Users } from 'lucide-react'
import { usePoll } from '../../hooks/useApi'

export function AgentFleet() {
  const { data: fleet, loading } = usePoll('/api/agent/fleet', 5000)
  
  // Default fallback hvis API ikke er klar
  const agents = fleet?.agents || [
    { id: 'monday', name: 'Monday', role: 'Lead Operator', status: 'active', rhythm: 'steady' },
    { id: 'rawan', name: 'Rawan-AI', role: 'Support & Sales', status: 'idle', rhythm: 'hibernation' }
  ]

  return (
    <div className="bg-surface border border-border rounded-xl overflow-hidden shadow-sm">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between bg-white/[0.02]">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rust/10 text-rust">
            <Users size={18} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-t1 tracking-tight">Hold 1: Agent Fleet</h3>
            <p className="text-[11px] text-t3 uppercase tracking-[0.1em] mt-0.5">Real-time Operative Status</p>
          </div>
        </div>
        <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-green/10 border border-green/20">
          <span className="w-1.5 h-1.5 rounded-full bg-green animate-pulse" />
          <span className="text-[10px] font-bold text-green uppercase tracking-wider">Fleet Synced</span>
        </div>
      </div>

      <div className="p-4 grid grid-cols-1 gap-3">
        {agents.map((agent) => (
          <div 
            key={agent.id} 
            className="flex items-center gap-4 p-4 rounded-xl border border-border bg-surface2 transition-all hover:border-rust/30 group"
          >
            <div className="relative">
              <HermesAvatar 
                variant={rhythmToVariant(agent.rhythm)} 
                size={42} 
                pulse={agent.status === 'active'} 
              />
              <div className={clsx(
                "absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-surface2 flex items-center justify-center text-[8px] font-bold text-black",
                agent.status === 'active' ? 'bg-green' : 'bg-t3'
              )}>
                {agent.status === 'active' ? '●' : '○'}
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-t1">{agent.name}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded border border-white/5 bg-white/5 text-t3 font-medium uppercase tracking-tight">
                  {agent.role}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-3">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Activity size={12} className={clsx(agent.metrics.tps > 0 ? "text-green" : "text-t3")} />
                  <span className="text-xs text-t2 truncate font-mono">
                    {agent.metrics.tps > 0 ? `${agent.metrics.tps} tok/s` : 'IDLE'}
                  </span>
                  {agent.metrics.latency > 0 && (
                    <span className="text-[10px] text-t3 opacity-60 ml-1">
                      ({agent.metrics.latency}ms)
                    </span>
                  )}
                </div>
              </div>
            </div>

            <button className="opacity-0 group-hover:opacity-100 transition-opacity p-2 rounded-lg hover:bg-white/5 border border-transparent hover:border-white/10">
              <Zap size={15} className="text-t3" />
            </button>
          </div>
        ))}
      </div>

      <div className="px-5 py-3 bg-white/[0.02] border-t border-border flex items-center justify-between text-[11px]">
        <div className="flex items-center gap-2 text-t3 font-medium">
          <Bot size={13} />
          <span>Active Sub-agents: 04</span>
        </div>
        <button className="text-rust font-bold uppercase tracking-wider hover:brightness-110">
          Manage Fleet
        </button>
      </div>
    </div>
  )
}
