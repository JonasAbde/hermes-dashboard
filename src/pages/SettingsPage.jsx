import { useState } from 'react'
import { useApi, usePoll } from '../hooks/useApi'
import { Chip } from '../components/ui/Chip'
import {
  Settings, Cpu, Server, RefreshCw, RotateCw,
  CheckCircle, XCircle, AlertTriangle, Terminal,
  Zap, Code2, Sparkles, Activity, Edit3, Save, X
} from 'lucide-react'
import { clsx } from 'clsx'
import { Eye, EyeOff, Lock, Shield, Layout, Settings2 } from 'lucide-react'
import { SectionCard, SkeletonSection } from '../components/ui/Section'
import { SettingRow, ToggleSetting, SelectSetting } from '../components/ui/Form'
import { ErrorState } from '../components/ui/Loaders'
// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatYaml(raw) {
  if (!raw) return null
  if (typeof raw === 'string') return raw
  if (typeof raw === 'object') return JSON.stringify(raw, null, 2)
  return String(raw)
}



// ─── Model Switcher ────────────────────────────────────────────────────────────

function ModelSwitcher({ models, current, onSwitch }) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)

  const handleSwitch = async (model) => {
    if (model === current || loading) return
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch('/api/control/model', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model }),
      })
      const body = await res.json().catch(() => ({}))
      if (res.ok) {
        setResult({ ok: true, message: body.message ?? `Skiftet til ${model}` })
        onSwitch?.(model)
      } else {
        setResult({ ok: false, message: body.error ?? body.message ?? `HTTP ${res.status}` })
      }
    } catch (e) {
      setResult({ ok: false, message: e.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {models.map(m => (
          <button
            key={m.name}
            onClick={() => handleSwitch(m.name)}
            disabled={loading}
            className={clsx(
              'group relative flex flex-col justify-center gap-1.5 px-4 py-3.5 rounded-xl border transition-all text-left overflow-hidden',
              m.name === current
                ? 'bg-green/10 border-green/30 text-green shadow-[0_0_20px_rgba(34,197,94,0.1)]'
                : 'bg-surface2/30 border-white/5 hover:border-white/20 hover:bg-surface2/80 text-t2',
              loading && m.name !== current && 'opacity-50 cursor-wait'
            )}
          >
            {m.name === current && (
              <div className="absolute top-0 right-0 w-24 h-24 bg-green/20 rounded-full blur-[30px] -mr-8 -mt-8 pointer-events-none" />
            )}
            <div className="flex items-center gap-2 relative z-10 w-full">
              <Cpu size={14} className={clsx(m.name === current ? 'text-green' : 'text-t3 group-hover:text-t2', 'flex-shrink-0')} />
              <span className={clsx('flex-1 truncate font-mono text-xs', m.name === current ? 'text-green font-bold' : 'group-hover:text-t1')}>{m.name}</span>
              {m.name === current && (
                <div className="w-2 h-2 rounded-full bg-green shadow-[0_0_8px_rgba(34,197,94,0.8)] flex-shrink-0" />
              )}
              {loading && m.name === current && (
                <RotateCw size={12} className="text-green flex-shrink-0 animate-spin" />
              )}
            </div>
          </button>
        ))}
      </div>

      {result && (
        <div className={clsx(
          'flex items-center gap-2 px-3 py-2 rounded-lg text-[11px] font-mono border backdrop-blur-md animate-in fade-in slide-in-from-top-2',
          result.ok
            ? 'bg-green/10 border-green/20 text-green'
            : 'bg-red/10 border-red/20 text-red'
        )}>
          {result.ok
            ? <CheckCircle size={12} className="flex-shrink-0" />
            : <XCircle size={12} className="flex-shrink-0" />
          }
          {result.message}
        </div>
      )}
    </div>
  )
}

// ─── Personality Switcher ──────────────────────────────────────────────────────

function PersonalitySwitcher({ personalities, current, onSwitch }) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)

  const handleSwitch = async (personality) => {
    if (personality === current || loading) return
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch('/api/control/personality', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personality }),
      })
      const body = await res.json().catch(() => ({}))
      if (res.ok) {
        setResult({ ok: true, message: `Personality switched to ${personality}` })
        onSwitch?.()
      } else {
        setResult({ ok: false, message: body.error ?? `HTTP ${res.status}` })
      }
    } catch (e) {
      setResult({ ok: false, message: e.message })
    } finally {
      setLoading(false)
    }
  }

  if (!personalities || personalities.length === 0) {
    return <div className="text-[11px] text-t3 bg-surface2/30 p-4 rounded-xl border border-white/5 text-center">No personalities found in config</div>
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {personalities.map(p => (
          <button
            key={p}
            onClick={() => handleSwitch(p)}
            disabled={loading}
            className={clsx(
              'group relative flex flex-col justify-center items-center gap-1.5 px-3 py-3 rounded-xl border transition-all text-center overflow-hidden',
              p === current
                ? 'bg-amber/10 border-amber/30 text-amber shadow-[0_0_20px_rgba(245,158,11,0.1)]'
                : 'bg-surface2/30 border-white/5 hover:border-white/20 hover:bg-surface2/80 text-t2',
              loading && p !== current && 'opacity-50 cursor-wait'
            )}
          >
            {p === current && (
              <div className="absolute top-0 right-0 w-24 h-24 bg-amber/20 rounded-full blur-[30px] -mr-8 -mt-8 pointer-events-none" />
            )}
            <div className="flex items-center justify-center gap-2 relative z-10 w-full">
              <Sparkles size={12} className={clsx(p === current ? 'text-amber' : 'text-t3 group-hover:text-t2', 'flex-shrink-0')} />
              <span className={clsx('truncate font-mono text-[11px]', p === current ? 'text-amber font-bold' : 'group-hover:text-t1')}>{p}</span>
              {loading && p === current && (
                <RotateCw size={10} className="text-amber animate-spin absolute right-1" />
              )}
            </div>
          </button>
        ))}
      </div>

      {result && (
        <div className={clsx(
          'flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-[11px] font-mono border backdrop-blur-md animate-in fade-in slide-in-from-top-2',
          result.ok
            ? 'bg-green/10 border-green/20 text-green'
            : 'bg-red/10 border-red/20 text-red'
        )}>
          {result.ok
            ? <CheckCircle size={12} className="flex-shrink-0" />
            : <XCircle size={12} className="flex-shrink-0" />
          }
          {result.message}
        </div>
      )}
    </div>
  )
}

// ─── Gateway Status ────────────────────────────────────────────────────────────

function GatewayStatus({ data, loading }) {
  if (loading) {
    return (
      <div className="space-y-3">
        <div className="skeleton h-5 w-24 rounded" />
        <div className="flex gap-2"><div className="skeleton h-6 w-16 rounded-full" /><div className="skeleton h-6 w-16 rounded-full" /></div>
      </div>
    )
  }

  const isOnline = data?.gateway_online

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className={clsx(
          "w-3 h-3 rounded-full flex-shrink-0 relative",
          isOnline ? "bg-green shadow-[0_0_8px_rgba(34,197,94,0.8)]" : "bg-t3 shadow-[0_0_8px_rgba(255,255,255,0.2)]"
        )}>
          {isOnline && <div className="absolute inset-0 rounded-full bg-green animate-ping opacity-50" />}
        </div>
        <span className={clsx("text-sm font-bold", isOnline ? "text-green" : "text-t2")}>
          {isOnline ? 'System Online' : 'System Offline'}
        </span>
        <span className="ml-auto font-mono text-[10px] sm:text-[11px] text-t3 bg-white/[0.03] px-2 py-0.5 rounded border border-white/[0.05]">
          {data?.model_label ?? 'Unknown Model'}
        </span>
      </div>

      {data?.platforms?.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-2">
          {data.platforms.map(p => {
            const up = p.status === 'connected'
            return (
              <div key={p.name} className={clsx(
                "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border backdrop-blur-sm",
                up ? "bg-green/10 border-green/20 text-green" : "bg-red/10 border-red/20 text-red"
              )}>
                <div className={clsx("w-1.5 h-1.5 rounded-full", up ? "bg-green" : "bg-red")} />
                {p.name.toUpperCase()}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Raw Config Block ──────────────────────────────────────────────────────────

function RawConfig({ raw, loading, refetch }) {
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState(null)

  const handleEdit = () => {
    setDraft(raw || '')
    setIsEditing(true)
    setResult(null)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw_config: draft })
      })
      const body = await res.json().catch(() => ({}))
      if (res.ok) {
        setIsEditing(false)
        setResult(null)
        refetch?.()
      } else {
        setResult({ ok: false, message: body.error || 'Failed to save config' })
      }
    } catch (e) {
      setResult({ ok: false, message: e.message })
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setIsEditing(false)
    setResult(null)
  }

  if (!raw && !loading && !isEditing) {
    return (
      <div className="px-5 py-8 font-mono text-[11px] text-t3 bg-[#0a0a0a] rounded-xl border border-white/5 flex items-center justify-center">
        {loading ? (
          <div className="flex items-center gap-2"><RotateCw size={12} className="animate-spin text-t3" /> Venter på matrix...</div>
        ) : 'Ingen config data tilgængelig'}
      </div>
    )
  }

  return (
    <div className={clsx(
      "relative group rounded-xl overflow-hidden border bg-[#050505] shadow-[inset_0_0_20px_rgba(0,0,0,0.5)] transition-colors duration-500",
      isEditing ? "border-rust/40 shadow-[0_0_30px_rgba(224,95,64,0.15)] ring-1 ring-rust/20" : "border-white/[0.05]"
    )}>
      {/* Hacker Window Controls */}
      <div className="absolute top-0 left-0 right-0 h-9 bg-white/[0.02] border-b border-white/[0.05] flex items-center px-4 gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity z-10 backdrop-blur-md">
        <div className="w-2.5 h-2.5 rounded-full bg-red/70 shadow-[0_0_5px_rgba(239,68,68,0.5)]"></div>
        <div className="w-2.5 h-2.5 rounded-full bg-amber/70 shadow-[0_0_5px_rgba(245,158,11,0.5)]"></div>
        <div className="w-2.5 h-2.5 rounded-full bg-green/70 shadow-[0_0_5px_rgba(34,197,94,0.5)]"></div>
        <div className="ml-auto flex items-center gap-4">
          {result && (
            <div className={clsx("text-[10px] font-mono", result.ok ? "text-green" : "text-rust")}>
              {result.message}
            </div>
          )}
          {!isEditing ? (
            <button 
              onClick={handleEdit} 
              className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-white/[0.05] hover:bg-white/[0.1] text-t2 hover:text-white text-[10px] font-bold tracking-wider transition-colors"
            >
              <Edit3 size={12} /> REDIGER CONFIG
            </button>
          ) : (
            <>
              <button 
                onClick={handleCancel}
                disabled={saving}
                className="flex items-center gap-1 px-3 py-1 text-t3 hover:text-t1 text-[10px] font-bold tracking-wider transition-colors"
              >
                <X size={12} /> ANNULLER
              </button>
              <button 
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-rust/20 hover:bg-rust/30 text-rust border border-rust/30 text-[10px] font-bold tracking-wider transition-colors"
              >
                {saving ? <RotateCw size={12} className="animate-spin" /> : <Save size={12} />} GEM ÆNDRINGER
              </button>
            </>
          )}
          <div className="flex items-center gap-2 text-[9px] font-mono text-t3 tracking-widest uppercase ml-2 border-l border-white/10 pl-4">
            <Terminal size={10} /> config.yaml
          </div>
        </div>
      </div>
      
      {isEditing ? (
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          spellCheck={false}
          className="w-full h-[500px] p-5 pt-12 font-mono text-[11px] text-[#22c55e] leading-relaxed bg-transparent border-none focus:ring-0 resize-none selection:bg-[#22c55e]/20 selection:text-white"
        />
      ) : (
        <pre className="p-5 pt-12 font-mono text-[11px] text-[#22c55e] leading-relaxed whitespace-pre-wrap break-all max-h-[500px] overflow-y-auto selection:bg-[#22c55e]/20 selection:text-white">
          {formatYaml(raw)}
        </pre>
      )}
    </div>
  )
}



// ─── Main Page ────────────────────────────────────────────────────────────────

export function SettingsPage() {
  const { data: configData, loading: configLoading, error: configError, refetch: configRefetch } = useApi('/config')
  const { data: modelsData, loading: modelsLoading } = useApi('/models')
  const { data: gatewayData, loading: gatewayLoading } = useApi('/gateway')

  const [gatewayRestarting, setGatewayRestarting] = useState(false)
  const [gatewayResult, setGatewayResult] = useState(null)

  const cfg = configData?.full_config ?? {}
  const models = modelsData?.models ?? []
  const currentModel = modelsData?.current ?? cfg.model?.default ?? ''
  const [patching, setPatching] = useState(false)

  const handlePatch = async (key, value) => {
    if (patching) return
    setPatching(true)
    try {
      await fetch('/api/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates: { [key]: value } })
      })
      configRefetch()
    } catch (e) {
      console.error('Patch error', e)
    } finally {
      setPatching(false)
    }
  }

  const handleRestartGateway = async () => {
    setGatewayRestarting(true)
    setGatewayResult(null)
    try {
      const res = await fetch('/api/control/gateway/restart', { method: 'POST' })
      const body = await res.json().catch(() => ({}))
      setGatewayResult({
        ok: res.ok,
        message: body.message ?? (res.ok ? 'Gateway genstartes…' : `HTTP ${res.status}`),
      })
    } catch (e) {
      setGatewayResult({ ok: false, message: e.message })
    } finally {
      setGatewayRestarting(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500 pb-20">

      {/* Hero Header */}
      <div className="relative bg-surface/40 backdrop-blur-xl border border-white/[0.05] rounded-3xl p-6 md:p-8 overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-rust/10 rounded-full blur-[80px] pointer-events-none -mr-20 -mt-20" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue/10 rounded-full blur-[80px] pointer-events-none -ml-20 -mb-20" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-surface2 to-surface border border-white/10 flex items-center justify-center shadow-lg relative">
              <div className="absolute inset-0 bg-rust/20 rounded-xl blur-lg pointer-events-none animate-pulse-slow" />
              <Settings size={22} className="text-rust relative z-10" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-black text-t1 tracking-tight flex items-center gap-2">
                SYSTEM CONFIGURATION
              </h1>
              <p className="text-xs md:text-sm text-t3 mt-1 flex items-center gap-1.5 font-medium">
                <Activity size={12} className="text-rust" /> Neural nexus parameters
              </p>
            </div>
          </div>
          <button
            onClick={configRefetch}
            className="self-start md:self-auto flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.03] border border-white/[0.05] text-xs font-bold text-t2 hover:bg-white/[0.08] hover:text-white transition-all group shadow-sm"
          >
            <RefreshCw size={14} className="group-hover:rotate-180 transition-transform duration-500" />
            SYNC CORE
          </button>
        </div>
      </div>

      {/* Error states */}
      {configError && <div className="px-2"><ErrorState message={configError} onRetry={configRefetch} /></div>}

      {/* Grid Layout for Top Settings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        <div className="space-y-6">
          {/* Model & Provider Overview */}
          {configLoading ? (
            <SkeletonSection />
          ) : (
            <SectionCard title="Active Paradigm" icon={Code2} iconColor="text-blue" accent="#3b82f6" className="h-full">
              <div className="space-y-1">
                <SettingRow label="Primary Core" value={cfg.model?.default} mono />
                <SettingRow label="Compute Provider" value={cfg.model?.provider} mono />
                <SettingRow 
                  label="Autonomous Decision Mode" 
                  value={cfg.approvals?.mode === 'auto' ? 'ENGAGED' : 'MANUAL'} 
                  highlight={cfg.approvals?.mode === 'auto'}
                  badge={cfg.approvals?.mode === 'auto' ? 'YOLO' : null}
                />
              </div>
            </SectionCard>
          )}
        </div>

        <div className="space-y-6">
          {/* Gateway Status */}
          <SectionCard title="Gateway Uplink" icon={Zap} iconColor="text-green" accent="#22c55e" className="flex flex-col h-full">
            <GatewayStatus data={gatewayData} loading={gatewayLoading} />

            <div className="mt-auto pt-6">
              <div className="pt-5 border-t border-white/[0.04] flex items-center justify-between">
                <button
                  onClick={handleRestartGateway}
                  disabled={gatewayRestarting}
                  className={clsx(
                    'relative flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md overflow-hidden group',
                    gatewayRestarting 
                      ? 'bg-surface2 text-t3 border border-border cursor-wait opacity-70'
                      : 'bg-gradient-to-r from-surface2 to-surface border border-white/10 text-t2 hover:text-white hover:border-rust/50'
                  )}
                >
                  {!gatewayRestarting && (
                    <div className="absolute inset-0 bg-rust/0 group-hover:bg-rust/10 transition-colors pointer-events-none" />
                  )}
                  <Server size={14} className={clsx(gatewayRestarting && 'animate-pulse text-rust')} />
                  {gatewayRestarting ? 'INITIATING REBOOT...' : 'REBOOT GATEWAY'}
                </button>

                {gatewayResult && (
                  <div className={clsx(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] sm:text-[11px] font-mono border backdrop-blur-sm animate-in slide-in-from-right-2',
                    gatewayResult.ok
                      ? 'bg-green/10 border-green/20 text-green'
                      : 'bg-red/10 border-red/20 text-red'
                  )}>
                    {gatewayResult.message}
                  </div>
                )}
              </div>
            </div>
          </SectionCard>
        </div>

      </div>

      {/* Full Width Model Switcher */}
      <SectionCard title="Model Selection Matrix" icon={Sparkles} iconColor="text-blue" accent="#3b82f6">
        <div className="text-[11px] text-t3 mb-5 px-1 font-medium">
          Current AI Persona: <span className="text-white font-mono bg-white/5 px-2 py-0.5 rounded">{currentModel || '—'}</span>
        </div>
        
        {modelsLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {Array.from({ length: 6 }, (_, i) => (
               <div key={i} className="skeleton h-14 rounded-xl" />
            ))}
          </div>
        ) : models.length === 0 ? (
          <div className="text-xs text-t3 bg-surface2/30 p-4 rounded-xl border border-white/5 text-center">Ingen modeller tilgængelige</div>
        ) : (
          <div className="-mx-1">
            <ModelSwitcher models={models} current={currentModel} />
          </div>
        )}
      </SectionCard>

      {/* Personality Switcher */}
      <SectionCard title="Personality Matrix" icon={Sparkles} iconColor="text-amber" accent="#f59e0b">
        <div className="text-[11px] text-t3 mb-5 px-1 font-medium">
          Current Personality: <span className="text-white font-mono bg-white/5 px-2 py-0.5 rounded">{configData?.current_personality || '—'}</span>
        </div>
        
        {configLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {Array.from({ length: 4 }, (_, i) => (
               <div key={i} className="skeleton h-12 rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="-mx-1">
            <PersonalitySwitcher 
              personalities={configData?.personalities || []} 
              current={configData?.current_personality}
              onSwitch={configRefetch}
            />
          </div>
        )}
      </SectionCard>

      {/* Deep Configuration Grids */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
        <SectionCard title="Agent & Behavior" icon={Cpu} iconColor="text-rust" accent="#e05f40" className="h-full">
          {configLoading ? <div className="skeleton h-24 rounded" /> : (
            <div>
              <SelectSetting 
                label="Reasoning Effort" 
                description="Higher effort gives better results but takes longer."
                value={cfg?.agent?.reasoning_effort || 'medium'}
                options={[
                  { label: 'Low', value: 'low' },
                  { label: 'Medium', value: 'medium' },
                  { label: 'High', value: 'high' }
                ]}
                onChange={(val) => handlePatch('agent.reasoning_effort', val)}
                disabled={patching}
              />
              <ToggleSetting 
                label="Verbose Logging" 
                description="Print detailed inference and tool call tracking to terminal."
                checked={cfg?.agent?.verbose || false}
                onChange={(val) => handlePatch('agent.verbose', val)}
                disabled={patching}
              />
            </div>
          )}
        </SectionCard>

        <SectionCard title="Interface & Display" icon={Layout} iconColor="text-blue" accent="#3b82f6" className="h-full">
          {configLoading ? <div className="skeleton h-24 rounded" /> : (
            <div>
              <ToggleSetting 
                label="Compact Mode" 
                description="Reduce output verbosity and UI spacing."
                checked={cfg?.display?.compact || false}
                onChange={(val) => handlePatch('display.compact', val)}
                disabled={patching}
              />
              <ToggleSetting 
                label="Show Reasoning" 
                description="Display internal model thought processes."
                checked={cfg?.display?.show_reasoning || false}
                onChange={(val) => handlePatch('display.show_reasoning', val)}
                disabled={patching}
              />
              <ToggleSetting 
                label="Inline Diffs" 
                description="Show file changes natively in chat output."
                checked={cfg?.display?.inline_diffs || false}
                onChange={(val) => handlePatch('display.inline_diffs', val)}
                disabled={patching}
              />
            </div>
          )}
        </SectionCard>
        
        <SectionCard title="Memory System" icon={Settings2} iconColor="text-amber" accent="#f59e0b" className="h-full">
          {configLoading ? <div className="skeleton h-24 rounded" /> : (
            <div>
              <ToggleSetting 
                label="Enable Memory" 
                description="Allow Hermes to remember long-term context."
                checked={cfg?.memory?.memory_enabled || false}
                onChange={(val) => handlePatch('memory.memory_enabled', val)}
                disabled={patching}
              />
              <ToggleSetting 
                label="User Profile" 
                description="Learn and recall user preferences over time."
                checked={cfg?.memory?.user_profile_enabled || false}
                onChange={(val) => handlePatch('memory.user_profile_enabled', val)}
                disabled={patching}
              />
            </div>
          )}
        </SectionCard>

        <SectionCard title="Security & Privacy" icon={Shield} iconColor="text-green" accent="#22c55e" className="h-full">
          {configLoading ? <div className="skeleton h-24 rounded" /> : (
            <div>
              <ToggleSetting 
                label="Redact PII" 
                description="Automatically hide personal identifying information."
                checked={cfg?.privacy?.redact_pii || false}
                onChange={(val) => handlePatch('privacy.redact_pii', val)}
                disabled={patching}
              />
              <ToggleSetting 
                label="Redact Secrets" 
                description="Mask API keys and tokens in outputs."
                checked={cfg?.security?.redact_secrets || false}
                onChange={(val) => handlePatch('security.redact_secrets', val)}
                disabled={patching}
              />
            </div>
          )}
        </SectionCard>
      </div>

      {/* Raw config.yaml Hacker Block */}
      <div className="pt-4">
        <SectionCard title="Direct Configuration Matrix" icon={Terminal} iconColor="text-green" accent="#10b981">
          <RawConfig raw={configData?.raw_config} loading={configLoading} refetch={configRefetch} />

          {/* Meta info footer */}
          <div className="mt-5 pt-4 border-t border-white/[0.04] grid grid-cols-1 sm:grid-cols-3 gap-3 text-[10px] font-mono text-t3 bg-surface/30 px-4 py-3 rounded-xl border border-white/[0.02]">
            <div className="flex items-center gap-2">
              <span className="text-t2 uppercase tracking-wider">Engine:</span>
              <span className="text-white">{configData?.version ?? '—'}</span>
            </div>
            <div className="flex items-center gap-2 sm:justify-center truncate">
              <span className="text-t2 uppercase tracking-wider">Path:</span>
              <span className="text-white truncate" title={configData?.config_path}>{configData?.config_path ?? '—'}</span>
            </div>
            <div className="flex items-center gap-2 sm:justify-end truncate">
              <span className="text-t2 uppercase tracking-wider">DB:</span>
              <span className="text-white truncate" title={configData?.db_path}>{configData?.db_path ?? '—'}</span>
            </div>
          </div>
        </SectionCard>
      </div>

    </div>
  )
}

