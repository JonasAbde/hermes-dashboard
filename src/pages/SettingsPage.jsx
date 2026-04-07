import { useState, useEffect, useRef } from 'react'
import { useApi, usePoll } from '../hooks/useApi'
import { Chip } from '../components/ui/Chip'
import {
  Settings, Cpu, Server, RefreshCw, RotateCw,
  CheckCircle, XCircle, AlertTriangle, Terminal,
  Zap, Code2, Sparkles, Activity, Edit3, Save, X, Copy, Key
} from 'lucide-react'
import { clsx } from 'clsx'
import { Eye, EyeOff, Lock, Shield, Layout, Settings2, User, Link } from 'lucide-react'
import { SectionCard, SkeletonSection } from '../components/ui/Section'
import { SettingRow, ToggleSetting, SelectSetting } from '../components/ui/Form'
import { ErrorState } from '../components/ui/Loaders'

const SectionHeader = ({ title, description }) => (
  <div className="pt-8 pb-3 mb-4 mt-6 border-b border-white/[0.04]">
    <h2 className="text-xl font-bold text-t1 tracking-tight">{title}</h2>
    {description && <p className="text-xs text-t3 mt-1.5">{description}</p>}
  </div>
)

const Badge = ({ children, type }) => {
  const colors = {
    core: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    dashboard: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    experimental: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    low: "bg-green-500/10 text-green-400 border-green-500/20",
    runtime: "bg-orange-500/10 text-orange-400 border-orange-500/20",
    sensitive: "bg-red-500/10 text-red-400 border-red-500/20"
  }
  return <span className={`px-2 py-0.5 rounded text-[9px] font-bold tracking-widest uppercase border ${colors[type]}`}>{children}</span>
}

const CardHeaderRight = ({ badges }) => (
  <div className="flex items-center gap-1.5">{badges.map((b, i) => <Badge key={i} type={b.type}>{b.label}</Badge>)}</div>
)

// ─── Helpers ──────────────────────────────────────────────────────────────────


function formatYaml(raw) {
  if (!raw) return null
  if (typeof raw === 'string') return raw
  if (typeof raw === 'object') return JSON.stringify(raw, null, 2)
  return String(raw)
}

// ─── Masked / Compacted config in view mode ───────────────────────────────

function MaskedConfig({ raw, redactSecrets = true }) {
  const lines = (raw || '').split('\n')
  let inPersonalities = false

  const resultLines = lines.map((line, i) => {
    // Skip lines in the personalities block
    if (line.match(/^\s{2}personalities:\s*$/)) { inPersonalities = true; return null }
    if (inPersonalities) {
      if (!line.match(/^\s/)) { inPersonalities = false }
      else return null
    }

    // Skip duplicate personality entry (the bug we fixed)
    if (line && line.match(/^\s{3}personality:\s*default\s*$/) && lines[i-1]?.match(/\s{3}compact:/)) return null

    // Mask API keys and env var values (respects redactSecrets toggle)
    let l = redactSecrets
      ? line.replace(/(NVIDIA_API_KEY|ANTHROPIC_API_KEY|OPENAI_API_KEY|GITHUB_TOKEN|kilo_[a-zA-Z0-9]+|ghp_[a-zA-Z0-9]+)/g, 'REDACTED')
           .replace(/(api_key_env|api_key):\s*'([^']+)'/g, '$1: [KEY]')
           .replace(/(api_key_env|api_key):\s*([^\s#]+)/g, '$1: [KEY]')
      : line

    return l
  }).filter(Boolean)

  // Inject personalities summary
  let final = []
  let injected = false
  for (let i = 0; i < resultLines.length; i++) {
    final.push(resultLines[i])
    if (!injected && resultLines[i].match(/^\s{2}personalities:\s*$/)) {
      final.push('    # 7 personalities loaded (prompts collapsed for display)')
      injected = true
    }
  }

  return (
    <pre className="p-5 pt-12 font-mono text-[11px] text-[#22c55e] leading-relaxed whitespace-pre-wrap break-all max-h-[500px] overflow-y-auto selection:bg-[#22c55e]/20 selection:text-white">
      {final.join('\n')}
    </pre>
  )
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
        setResult({ ok: true, message: body.message ?? `Switched to ${model}` })
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

// ─── User Profile ─────────────────────────────────────────────────────────────

const RECOMMENDATION_MODES = [
  { id: 'stability-first', label: 'Stability First', description: 'Prioritize runtime health and reliability actions first.' },
  { id: 'cost-first', label: 'Cost First', description: 'Prioritize spend and budget actions before other suggestions.' },
  { id: 'speed-first', label: 'Speed First', description: 'Prioritize throughput and unblock actions quickly.' },
]

function UserProfile({ data, loading, refetch }) {
  const [isEditing, setIsEditing] = useState(false)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [recommendationMode, setRecommendationMode] = useState('stability-first')
  const [modeSaving, setModeSaving] = useState(false)
  const [modeResult, setModeResult] = useState(null)

  useEffect(() => {
    if (data?.username) setName(data.username)
  }, [data])

  useEffect(() => {
    if (data?.recommendationMode) {
      setRecommendationMode(data.recommendationMode)
    }
  }, [data])

  const handleSave = async () => {
    if (!name.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      })
      if (res.ok) {
        setIsEditing(false)
        refetch()
        // Force refresh topbar via window event
        window.dispatchEvent(new CustomEvent('profile-updated'))
      }
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  const handleModeChange = async (nextMode) => {
    if (!nextMode || nextMode === recommendationMode || modeSaving) return
    const previousMode = recommendationMode
    setRecommendationMode(nextMode)
    setModeSaving(true)
    setModeResult(null)
    try {
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recommendationMode: nextMode }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setRecommendationMode(previousMode)
        setModeResult({ ok: false, message: body.error || `HTTP ${res.status}` })
        return
      }
      setModeResult({ ok: true, message: 'Recommendation mode updated' })
      refetch()
      window.dispatchEvent(new CustomEvent('profile-updated'))
    } catch (e) {
      setRecommendationMode(previousMode)
      setModeResult({ ok: false, message: e.message || 'Failed to update mode' })
    } finally {
      setModeSaving(false)
    }
  }

  if (loading) return <SkeletonSection />

  return (
    <SectionCard title="Agent Identity" icon={User} iconColor="text-purple-400" accent="#a855f7" className="h-full">
      <div className="space-y-4">
        {isEditing ? (
          <div className="space-y-3 pt-2">
            <div className="space-y-1">
              <label className="text-[10px] text-t3 uppercase font-bold ml-1">Display Name</label>
              <input 
                value={name}
                onChange={e => setName(e.target.value)}
                autoFocus
                className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-4 py-3 text-sm text-t1 focus:border-rust/40 focus:ring-0 outline-none transition-all font-mono"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <button 
                onClick={handleSave} 
                disabled={saving}
                className="flex-1 bg-rust text-white py-3 rounded-xl text-xs font-black tracking-widest hover:brightness-110 active:scale-[0.98] transition-all shadow-lg shadow-rust/10 flex items-center justify-center gap-2"
              >
                {saving ? <RotateCw size={14} className="animate-spin" /> : <Save size={14} />} SAVE IDENTITY
              </button>
              <button 
                onClick={() => setIsEditing(false)}
                className="px-6 py-3 border border-white/10 text-t3 hover:text-t1 hover:bg-white/5 rounded-xl text-xs font-bold transition-all"
              >
                CANCEL
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="flex items-center gap-5">
              <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-purple-500/10 to-blue-500/10 border border-white/10 flex items-center justify-center text-purple-400 shadow-inner relative group">
                <div className="absolute inset-0 bg-purple-500/5 blur-xl rounded-full group-hover:bg-purple-500/10 transition-colors" />
                <User size={28} className="relative z-10" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xl font-black text-t1 tracking-tight truncate">{data?.username}</div>
                <div className="text-[10px] text-t3 flex items-center gap-2 font-mono uppercase tracking-widest mt-1">
                   <div className="w-2 h-2 rounded-full bg-green/80 shadow-[0_0_8px_rgba(34,197,94,0.4)]" /> System Node: {data?.systemUser}
                </div>
              </div>
              <button 
                onClick={() => setIsEditing(true)} 
                className="w-10 h-10 flex items-center justify-center text-t3 hover:text-white bg-white/[0.03] hover:bg-white/10 border border-white/10 rounded-xl transition-all"
                title="Edit Identity"
              >
                <Edit3 size={16} />
              </button>
            </div>
            
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-white/[0.04]">
              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.02] hover:bg-white/[0.04] transition-colors">
                <div className="text-[9px] text-t3 uppercase font-black tracking-widest mb-1 opacity-50">Kernel Ark</div>
                <div className="text-[11px] text-t2 font-mono uppercase">{data?.platform} {data?.release?.split('-')[0]}</div>
              </div>
              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.02] hover:bg-white/[0.04] transition-colors">
                <div className="text-[9px] text-t3 uppercase font-black tracking-widest mb-1 opacity-50">Root Cell</div>
                <div className="text-[11px] text-t2 font-mono truncate" title={data?.homedir}>{data?.homedir?.replace(data?.systemUser, '***')}</div>
              </div>
            </div>

            <div className="pt-2 border-t border-white/[0.04] space-y-2">
              <div className="text-[10px] text-t3 uppercase font-black tracking-widest opacity-70">
                Recommendation Priority
              </div>
              <div className="text-[10px] text-t3/80 font-mono">
                Dashboard preference only · stored outside Hermes core memory.
              </div>
              <div className="grid grid-cols-1 gap-2">
                {RECOMMENDATION_MODES.map((mode) => {
                  const isActive = recommendationMode === mode.id
                  return (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => handleModeChange(mode.id)}
                      disabled={modeSaving}
                      className={clsx(
                        'text-left px-3 py-2 rounded-lg border transition-colors',
                        isActive
                          ? 'border-rust/40 bg-rust/10 text-t1'
                          : 'border-white/10 bg-white/[0.02] text-t2 hover:border-white/20 hover:bg-white/[0.04]',
                        modeSaving && 'opacity-70 cursor-wait'
                      )}
                    >
                      <div className="text-[11px] font-bold">{mode.label}</div>
                      <div className="text-[10px] text-t3 mt-0.5">{mode.description}</div>
                    </button>
                  )
                })}
              </div>
              {modeResult && (
                <div className={clsx(
                  'text-[10px] font-mono px-2.5 py-1.5 rounded-md border',
                  modeResult.ok ? 'text-green border-green/20 bg-green/10' : 'text-red border-red/20 bg-red/10'
                )}>
                  {modeResult.message}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </SectionCard>
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

// ─── Webhook Config ─────────────────────────────────────────────────────────────

function WebhookConfig() {
  const [webhookUrl, setWebhookUrl] = useState('')
  const [secret, setSecret] = useState('')
  const [enabled, setEnabled] = useState(false)
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(true)
  const { data: gatewayData } = usePoll('/gateway', 8000)

  // Load webhook config from backend
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/webhook/config')
        if (res.ok) {
          const data = await res.json()
          setWebhookUrl(data.url || '')
          setSecret(data.secret || '')
          setEnabled(data.enabled || false)
        }
      } catch (e) {
        console.error('Failed to load webhook config:', e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const handleSave = async () => {
    setSaving(true)
    setResult(null)
    try {
      const res = await fetch('/api/webhook/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: webhookUrl, secret, enabled }),
      })
      const data = await res.json()
      if (res.ok) {
        setResult({ ok: true, message: data.message || 'Webhook configuration saved' })
      } else {
        setResult({ ok: false, message: data.error || 'Failed to save webhook configuration' })
      }
    } catch (e) {
      setResult({ ok: false, message: e.message })
    } finally {
      setSaving(false)
    }
  }

  // Get webhook platform status from gateway data
  const webhookPlatform = gatewayData?.platforms?.find(p => p.name?.toLowerCase() === 'webhook')
  const isConnected = webhookPlatform?.status === 'connected' || webhookPlatform?.status === 'live_active'

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="skeleton h-5 w-32 rounded" />
        <div className="skeleton h-20 w-full rounded-xl" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className={clsx(
          "w-3 h-3 rounded-full flex-shrink-0",
          isConnected ? "bg-green shadow-[0_0_8px_rgba(34,197,94,0.8)]" : "bg-t3"
        )} />
        <span className={clsx("text-sm font-bold", isConnected ? "text-green" : "text-t2")}>
          {isConnected ? 'Webhook Connected' : 'Webhook Offline'}
        </span>
        {webhookPlatform?.error && (
          <span className="text-[10px] text-red/70 font-mono ml-2" title={webhookPlatform.error}>
            ⚠ error
          </span>
        )}
      </div>

      <div className="space-y-3 pt-2">
        <div className="space-y-1.5">
          <label className="text-[10px] text-t3 uppercase font-bold ml-1 tracking-wider">Webhook URL</label>
          <input
            type="url"
            value={webhookUrl}
            onChange={e => setWebhookUrl(e.target.value)}
            placeholder="https://your-webhook-endpoint.com/callback"
            className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-t1 focus:border-blue/40 focus:ring-0 outline-none transition-all font-mono"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] text-t3 uppercase font-bold ml-1 tracking-wider">Secret Key</label>
          <input
            type="password"
            value={secret}
            onChange={e => setSecret(e.target.value)}
            placeholder="Optional secret for signature verification"
            className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-t1 focus:border-blue/40 focus:ring-0 outline-none transition-all font-mono"
          />
        </div>

        <div className="flex items-center gap-3 pt-1">
          <button
            onClick={() => setEnabled(!enabled)}
            className={clsx(
              'relative w-11 h-6 rounded-full transition-colors',
              enabled ? 'bg-green' : 'bg-white/10'
            )}
          >
            <div className={clsx(
              'absolute top-1 w-4 h-4 rounded-full bg-white transition-transform',
              enabled ? 'translate-x-6' : 'translate-x-1'
            )} />
          </button>
          <span className="text-[11px] text-t2 font-medium">Enable Webhook</span>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-2.5 rounded-xl bg-blue/20 border border-blue/30 text-blue text-xs font-bold hover:bg-blue/30 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {saving ? <RotateCw size={12} className="animate-spin" /> : <Link size={12} />}
          {saving ? 'SAVING...' : 'SAVE WEBHOOK CONFIG'}
        </button>

        {result && (
          <div className={clsx(
            'text-[11px] font-mono px-3 py-2 rounded-lg border',
            result.ok ? 'bg-green/10 border-green/20 text-green' : 'bg-red/10 border-red/20 text-red'
          )}>
            {result.ok ? <CheckCircle size={12} className="inline mr-1.5" /> : <XCircle size={12} className="inline mr-1.5" />}
            {result.message}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── YAML Validation & Diff Helpers ───────────────────────────────────────────

function validateYaml(text) {
  // Simple YAML validation - checks for common syntax issues
  const errors = []
  const lines = text.split('\n')
  let indentStack = []
  let inBlock = false
  let blockIndent = 0
  let lineNum = 0
  
  for (let i = 0; i < lines.length; i++) {
    lineNum = i + 1
    const line = lines[i]
    
    // Skip empty lines and comments
    if (!line.trim() || line.trim().startsWith('#')) continue
    
    // Detect block scalars (|, >)
    if (line.match(/^\s*[|>][+-]?\s*$/)) {
      inBlock = true
      blockIndent = line.match(/^(\s*)/)[1].length
      continue
    }
    
    if (inBlock) {
      if (!line.match(/^\s/) && line.trim()) {
        inBlock = false
      } else {
        continue
      }
    }
    
    // Check for tabs (YAML forbids tabs for indentation)
    if (line.match(/\t/)) {
      errors.push({ line: lineNum, message: 'Tabs not allowed in YAML (use spaces)', type: 'error' })
    }
    
    // Check for trailing whitespace (style issue)
    if (line.match(/\s+$/)) {
      errors.push({ line: lineNum, message: 'Trailing whitespace', type: 'warning' })
    }
    
    // Check for duplicate keys at same level (basic check)
    const leadingSpaces = line.match(/^(\s*)/)[1].length
    const content = line.trim()
    
    // Key-value pattern: "key: value" or "key:"
    if (content.match(/^[\w-]+:\s*.*$/)) {
      const key = content.match(/^([\w-]+):/)?.[1]
      
      // Maintain indent stack
      while (indentStack.length > 0 && indentStack[indentStack.length - 1].indent >= leadingSpaces) {
        indentStack.pop()
      }
      
      // Check for duplicate at same level
      const sameLevel = indentStack.find(h => h.indent === leadingSpaces && h.key === key)
      if (sameLevel) {
        errors.push({ line: lineNum, message: `Duplicate key '${key}' at this level`, type: 'warning' })
      }
      
      indentStack.push({ indent: leadingSpaces, key })
    }
  }
  
  return errors
}

function computeDiff(original, modified) {
  const origLines = (original || '').split('\n')
  const modLines = (modified || '').split('\n')
  const diff = []
  const maxLen = Math.max(origLines.length, modLines.length)
  
  // Simple line-by-line diff using LCS concept
  let i = 0
  while (i < maxLen) {
    if (i >= origLines.length) {
      diff.push({ num: i + 1, type: 'added', content: modLines[i] })
    } else if (i >= modLines.length) {
      diff.push({ num: i + 1, type: 'removed', content: origLines[i] })
    } else if (origLines[i] !== modLines[i]) {
      // Check if it's a modification or just added/removed lines
      const origInMod = modLines.indexOf(origLines[i], i + 1)
      const modInOrig = origLines.indexOf(modLines[i], i + 1)
      
      if (origInMod === -1 && modInOrig === -1) {
        // Modified line
        diff.push({ num: i + 1, type: 'modified', content: modLines[i] })
      } else if (origInMod !== -1 && (modInOrig === -1 || origInMod - i < i - modInOrig)) {
        // Lines added
        for (let j = i; j < origInMod; j++) {
          diff.push({ num: j + 1, type: 'added', content: modLines[j] })
        }
        i = origInMod - 1
      } else if (modInOrig !== -1) {
        // Lines removed
        for (let j = i; j < modInOrig; j++) {
          diff.push({ num: j + 1, type: 'removed', content: origLines[j] })
        }
        i = modInOrig - 1
      }
    } else {
      diff.push({ num: i + 1, type: 'unchanged', content: origLines[i] })
    }
    i++
  }
  
  return diff
}

// ─── Enhanced Editor Component ─────────────────────────────────────────────────

function YamlEditor({ value, onChange, errors }) {
  const lines = value.split('\n')
  const textareaRef = useRef(null)
  
  const handleScroll = (e) => {
    const lineNumbers = e.target.previousSibling
    if (lineNumbers) {
      lineNumbers.scrollTop = e.target.scrollTop
    }
  }
  
  return (
    <div className="relative flex bg-[#050505]">
      {/* Line Numbers */}
      <div className="flex-shrink-0 py-5 pt-12 pl-4 pr-3 text-right select-none border-r border-white/5">
        <div 
          className="font-mono text-[11px] leading-relaxed text-t3/50 space-y-0"
          style={{ minWidth: '3em' }}
        >
          {lines.map((_, i) => {
            const lineNum = i + 1
            const hasError = errors?.some(e => e.line === lineNum && e.type === 'error')
            const hasWarning = errors?.some(e => e.line === lineNum && e.type === 'warning')
            return (
              <div 
                key={i} 
                className={clsx(
                  hasError ? 'text-red' : hasWarning ? 'text-amber' : ''
                )}
              >
                {lineNum}
              </div>
            )
          })}
        </div>
      </div>
      
      {/* Editor */}
      <div className="flex-1 relative">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onScroll={handleScroll}
          spellCheck={false}
          className="w-full h-[500px] p-5 pt-12 font-mono text-[11px] leading-relaxed bg-transparent border-none focus:ring-0 resize-none selection:bg-[#22c55e]/20 selection:text-white focus:outline-none"
          style={{ tabSize: 2 }}
        />
        
        {/* Syntax Highlight Overlay */}
        <div 
          className="absolute inset-0 pointer-events-none p-5 pt-12 font-mono text-[11px] leading-relaxed overflow-hidden"
          aria-hidden="true"
        >
          {lines.map((line, i) => (
            <div key={i} className="flex h-[1.4rem]">
              <HighlightedLine line={line} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function HighlightedLine({ line }) {
  // Simple YAML syntax highlighting
  let content = line
  
  // Preserve leading whitespace
  const leadingSpace = content.match(/^(\s*)/)?.[1] || ''
  content = content.trim()
  
  if (!content) return <span className="whitespace-pre">{' '}</span>
  
  // Comment
  if (content.startsWith('#')) {
    return <span className="whitespace-pre text-t3 italic">{leadingSpace}{content}</span>
  }
  
  // Key-value pair
  const kvMatch = content.match(/^([\w_-]+)(\s*:\s*)(.*)$/)
  if (kvMatch) {
    const [, key, colon, value] = kvMatch
    return (
      <span className="whitespace-pre">
        <span className="text-purple-400">{leadingSpace}{key}</span>
        <span className="text-t2">{colon}</span>
        <span className={value.startsWith("'") || value.startsWith('"') ? 'text-amber' : 'text-[#22c55e]'}>
          {value}
        </span>
      </span>
    )
  }
  
  // List item
  const listMatch = content.match(/^(\s*[-*]\s*)(.*)$/)
  if (listMatch) {
    const [, marker, item] = listMatch
    return (
      <span className="whitespace-pre">
        <span className="text-cyan-400">{leadingSpace}{marker}</span>
        <span className="text-[#22c55e]">{item}</span>
      </span>
    )
  }
  
  // Block scalar indicators
  if (content.match(/^[|>]/)) {
    return <span className="whitespace-pre text-amber">{leadingSpace}{content}</span>
  }
  
  // Anchor/Alias
  if (content.match(/^[*&][\w-]+/)) {
    return <span className="whitespace-pre text-pink-400">{leadingSpace}{content}</span>
  }
  
  return <span className="whitespace-pre text-[#22c55e]">{leadingSpace}{content}</span>
}

// ─── Diff View Component ───────────────────────────────────────────────────────

function DiffView({ original, modified }) {
  const diff = computeDiff(original, modified)
  const addedCount = diff.filter(d => d.type === 'added' || d.type === 'modified').length
  const removedCount = diff.filter(d => d.type === 'removed').length
  
  return (
    <div className="bg-[#050505] rounded-lg border border-white/10 overflow-hidden">
      {/* Diff Header */}
      <div className="flex items-center gap-4 px-4 py-2 bg-white/[0.02] border-b border-white/5 text-[10px] font-mono">
        <span className="text-t2 uppercase tracking-wider">Changes</span>
        <div className="flex items-center gap-3 ml-auto">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded bg-green/70"></span>
            <span className="text-green">{addedCount} added</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded bg-red/70"></span>
            <span className="text-red">{removedCount} removed</span>
          </span>
        </div>
      </div>
      
      {/* Diff Content */}
      <div className="max-h-[200px] overflow-y-auto font-mono text-[10px] leading-relaxed">
        {diff.map((line, i) => (
          <div 
            key={i}
            className={clsx(
              'flex items-start px-4 py-0.5',
              line.type === 'added' && 'bg-green/10',
              line.type === 'removed' && 'bg-red/10',
              line.type === 'modified' && 'bg-amber/10',
            )}
          >
            <span className="w-8 flex-shrink-0 text-t3/50 select-none mr-3 text-right">
              {line.type !== 'unchanged' ? line.num : ''}
            </span>
            <span className="w-4 flex-shrink-0 mr-2">
              {line.type === 'added' && <span className="text-green">+</span>}
              {line.type === 'removed' && <span className="text-red">-</span>}
              {line.type === 'modified' && <span className="text-amber">~</span>}
            </span>
            <span className={clsx(
              'flex-1 truncate',
              line.type === 'added' && 'text-green',
              line.type === 'removed' && 'text-red line-through opacity-70',
              line.type === 'modified' && 'text-amber',
              line.type === 'unchanged' && 'text-t3/50',
            )}>
              {line.content || ' '}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Raw Config Block ──────────────────────────────────────────────────────────

function RawConfig({ raw, loading, refetch, redactSecrets = true }) {
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState(null)
  const [showDiff, setShowDiff] = useState(false)
  const [validationErrors, setValidationErrors] = useState([])

  const handleEdit = () => {
    setDraft(raw || '')
    setIsEditing(true)
    setResult(null)
    setShowDiff(false)
    setValidationErrors([])
  }

  const handleDraftChange = (value) => {
    setDraft(value)
    // Validate on change
    const errors = validateYaml(value)
    setValidationErrors(errors.filter(e => e.type === 'error'))
  }

  const handleSave = async () => {
    // Final validation before save
    const errors = validateYaml(draft)
    const fatalErrors = errors.filter(e => e.type === 'error')
    
    if (fatalErrors.length > 0) {
      setValidationErrors(fatalErrors)
      setResult({ ok: false, message: `YAML syntax error: ${fatalErrors[0].message} (line ${fatalErrors[0].line})` })
      return
    }
    
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
        setShowDiff(false)
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
    setShowDiff(false)
    setValidationErrors([])
  }

  const hasChanges = draft !== (raw || '')

  if (!raw && !loading && !isEditing) {
    return (
      <div className="px-5 py-8 font-mono text-[11px] text-t3 bg-[#0a0a0a] rounded-xl border border-white/5 flex items-center justify-center">
        {loading ? (
          <div className="flex items-center gap-2"><RotateCw size={12} className="animate-spin text-t3" /> Waiting for matrix...</div>
        ) : 'No config data available'}
      </div>
    )
  }

  return (
    <div className={clsx(
      "relative group rounded-xl overflow-hidden border bg-[#050505] shadow-[inset_0_0_20px_rgba(0,0,0,0.5)] transition-colors duration-500",
      isEditing ? "border-rust/40 shadow-[0_0_30px_rgba(224,95,64,0.15)] ring-1 ring-rust/20" : "border-white/[0.05]"
    )}>
      {/* Hacker Window Controls */}
      <div className="absolute top-0 left-0 right-0 h-9 bg-white/[0.02] border-b border-white/[0.05] flex items-center px-4 gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity z-20 backdrop-blur-md">
        <div className="w-2.5 h-2.5 rounded-full bg-red/70 shadow-[0_0_5px_rgba(239,68,68,0.5)]"></div>
        <div className="w-2.5 h-2.5 rounded-full bg-amber/70 shadow-[0_0_5px_rgba(245,158,11,0.5)]"></div>
        <div className="w-2.5 h-2.5 rounded-full bg-green/70 shadow-[0_0_5px_rgba(34,197,94,0.5)]"></div>
        <div className="ml-auto flex items-center gap-3">
          {result && (
            <div className={clsx("text-[10px] font-mono flex items-center gap-1.5", result.ok ? "text-green" : "text-rust")}>
              {result.ok ? <CheckCircle size={12} /> : <XCircle size={12} />}
              {result.message}
            </div>
          )}
          {!isEditing ? (
            <button 
              onClick={handleEdit} 
              className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-white/[0.05] hover:bg-white/[0.1] text-t2 hover:text-white text-[10px] font-bold tracking-wider transition-colors"
            >
              <Edit3 size={12} /> EDIT CONFIG
            </button>
          ) : (
            <>
              {hasChanges && (
                <button 
                  onClick={() => setShowDiff(!showDiff)}
                  className={clsx(
                    "flex items-center gap-1 px-3 py-1 rounded-md text-[10px] font-bold tracking-wider transition-colors",
                    showDiff 
                      ? "bg-blue/20 text-blue border border-blue/30" 
                      : "text-t3 hover:text-t1 hover:bg-white/5"
                  )}
                >
                  <Activity size={12} /> {showDiff ? 'HIDE DIFF' : 'SHOW DIFF'}
                </button>
              )}
              <button 
                onClick={handleCancel}
                disabled={saving}
                className="flex items-center gap-1 px-3 py-1 text-t3 hover:text-t1 text-[10px] font-bold tracking-wider transition-colors"
              >
                <X size={12} /> CANCEL
              </button>
              <button 
                onClick={handleSave}
                disabled={saving || validationErrors.length > 0}
                className={clsx(
                  "flex items-center gap-1.5 px-3 py-1 rounded-md border text-[10px] font-bold tracking-wider transition-colors",
                  validationErrors.length > 0
                    ? "bg-red/10 text-red border-red/30 cursor-not-allowed opacity-50"
                    : hasChanges
                      ? "bg-green/20 hover:bg-green/30 text-green border-green/30"
                      : "bg-white/5 text-t3 border-white/10 cursor-not-allowed opacity-50"
                )}
              >
                {saving ? <RotateCw size={12} className="animate-spin" /> : <Save size={12} />} 
                {saving ? 'SAVING...' : 'SAVE CHANGES'}
              </button>
            </>
          )}
          <div className="flex items-center gap-2 text-[9px] font-mono text-t3 tracking-widest uppercase ml-2 border-l border-white/10 pl-4">
            <Terminal size={10} /> config.yaml
          </div>
        </div>
      </div>
      
      {isEditing ? (
        <div>
          <YamlEditor 
            value={draft} 
            onChange={handleDraftChange}
            errors={validationErrors}
          />
          
          {/* Validation Errors */}
          {validationErrors.length > 0 && (
            <div className="px-4 py-2 bg-red/10 border-t border-red/20">
              <div className="flex items-start gap-2 text-[10px] font-mono text-red">
                <AlertTriangle size={12} className="flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold">YAML Syntax Error</div>
                  <div className="text-red/70 mt-1">
                    {validationErrors.map((e, i) => (
                      <div key={i}>Line {e.line}: {e.message}</div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Warnings */}
          {validationErrors.filter(e => e.type === 'warning').length > 0 && (
            <div className="px-4 py-2 bg-amber/5 border-t border-amber/10">
              <div className="flex items-start gap-2 text-[10px] font-mono text-amber">
                <AlertTriangle size={12} className="flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold">Warnings</div>
                  <div className="text-amber/70 mt-1">
                    {validationErrors.filter(e => e.type === 'warning').map((e, i) => (
                      <div key={i}>Line {e.line}: {e.message}</div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Diff View */}
          {showDiff && hasChanges && (
            <div className="p-4 border-t border-white/5">
              <DiffView original={raw || ''} modified={draft} />
            </div>
          )}
        </div>
      ) : (
        <MaskedConfig raw={formatYaml(raw)} redactSecrets={redactSecrets} />
      )}
    </div>
  )
}



// ─── Secrets Modal ──────────────────────────────────────────────────────────

function SecretsModal({ configData, onClose }) {
  const [env, setEnv] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState(null)
  const [copiedKey, setCopiedKey] = useState(null)

  // Parse secrets from config.yaml
  const configSecrets = []

  if (configData?.full_config) {
    const cfg = configData.full_config

    // Extract api_key_env values
    if (cfg.model?.api_key_env) {
      Object.entries(cfg.model.api_key_env).forEach(([key, value]) => {
        configSecrets.push({ name: key, source: 'model.api_key_env' })
      })
    }

    // Extract api_key values
    if (cfg.model?.api_key) {
      configSecrets.push({ name: 'api_key', source: 'model.api_key' })
    }
  }

  // Masked secret patterns to look for in raw config
  const maskedPatterns = [
    'NVIDIA_API_KEY', 'ANTHROPIC_API_KEY', 'OPENAI_API_KEY',
    'GITHUB_TOKEN', 'kilo_', 'ghp_'
  ]

  const fetchEnv = async () => {
    try {
      const res = await fetch('/api/env')
      const data = await res.json()
      setEnv(data.env || '')
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchEnv() }, [])

  const handleCopy = async (key) => {
    await navigator.clipboard.writeText(key)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(null), 2000)
  }

  const handleSave = async () => {
    setSaving(true)
    setResult(null)
    try {
      const res = await fetch('/api/env', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ env })
      })
      if (res.ok) {
        setResult({ ok: true, message: 'Secrets updated successfully' })
      } else {
        setResult({ ok: false, message: 'Failed to update secrets' })
      }
    } catch (e) {
      setResult({ ok: false, message: e.message })
    } finally {
      setSaving(false)
    }
  }

  // Parse env file into secrets array
  const envSecrets = env.split('\n')
    .filter(line => line && !line.startsWith('#') && line.includes('='))
    .map(line => {
      const idx = line.indexOf('=')
      const key = line.substring(0, idx)
      const isMasked = maskedPatterns.some(p => key.includes(p))
      return { name: key, masked: isMasked }
    })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div 
        className="relative w-full max-w-2xl max-h-[80vh] bg-[#0a0b10] border border-[#111318] rounded-xl shadow-2xl flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#111318] bg-[#060608]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-md bg-rust/10 border border-rust/20 flex items-center justify-center">
              <Lock size={14} className="text-rust" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[#d8d8e0]">Edit Secrets</h2>
              <p className="text-[10px] text-[#6b6b80]">Manage environment variables and API keys</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-md text-[#6b6b80] hover:text-[#d8d8e0] hover:bg-[#0d0f17] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Secrets from .env file */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Key size={12} className="text-rust" />
              <span className="text-[11px] font-bold tracking-widest text-t1 uppercase">Environment Variables</span>
              <span className="text-[10px] text-t3 bg-white/5 px-2 py-0.5 rounded">.env</span>
            </div>

            {loading ? (
              <div className="h-32 flex items-center justify-center">
                <RotateCw size={16} className="animate-spin text-rust/40" />
              </div>
            ) : envSecrets.length === 0 ? (
              <div className="text-[11px] text-t3 bg-surface2/20 p-4 rounded-lg border border-white/5 text-center">
                No environment variables found
              </div>
            ) : (
              <div className="space-y-2">
                {envSecrets.map((secret, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-black/30 rounded-lg border border-white/5 group hover:border-rust/20 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-2 h-2 rounded-full bg-rust/50 flex-shrink-0" />
                      <span className="text-[11px] font-mono text-t2 truncate">{secret.name}</span>
                      {secret.masked && (
                        <span className="text-[9px] text-rust/60 uppercase tracking-wider">Redacted</span>
                      )}
                    </div>
                    <button
                      onClick={() => handleCopy(secret.name)}
                      className="p-1.5 rounded-md text-t3 hover:text-white hover:bg-white/10 transition-colors opacity-0 group-hover:opacity-100"
                      title="Copy variable name"
                    >
                      {copiedKey === secret.name ? (
                        <CheckCircle size={14} className="text-green" />
                      ) : (
                        <Copy size={14} />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Edit Section */}
          <div className="space-y-3 pt-4 border-t border-white/5">
            <div className="flex items-center gap-2">
              <Edit3 size={12} className="text-blue" />
              <span className="text-[11px] font-bold tracking-widest text-t1 uppercase">Edit Raw .env</span>
            </div>
            <textarea 
              value={env}
              onChange={(e) => setEnv(e.target.value)}
              className="w-full h-48 bg-black/40 border border-white/10 rounded-xl p-4 font-mono text-[11px] text-[#22c55e] focus:border-rust/40 focus:ring-0 outline-none transition-all resize-none"
              placeholder="KEY=VALUE"
              spellCheck={false}
            />
            <div className="flex items-center gap-3">
              <button 
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-3 rounded-xl bg-rust text-white font-black text-xs tracking-widest hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-lg shadow-rust/20 disabled:opacity-50"
              >
                {saving ? <RotateCw size={14} className="animate-spin" /> : <Save size={14} />} SAVE CHANGES
              </button>
              <button 
                onClick={onClose}
                className="px-6 py-3 rounded-xl border border-white/10 text-t3 hover:text-white hover:bg-white/5 text-xs font-bold transition-all"
              >
                CLOSE
              </button>
            </div>
          </div>
        </div>

        {/* Footer result message */}
        {result && (
          <div className={clsx(
            "px-5 py-3 border-t border-[#111318] text-[11px] flex items-center gap-2 font-mono",
            result.ok ? "bg-green/10 text-green" : "bg-red/10 text-red"
          )}>
            {result.ok ? <CheckCircle size={14} /> : <XCircle size={14} />}
            {result.message}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Secret Manager (.env) ──────────────────────────────────────────────────

function SecretManager({ onRestart }) {
  const [showModal, setShowModal] = useState(false)
  const { data: configData } = useApi('/config')

  return (
    <>
      <div className="space-y-4">
        <div className="bg-surface2/20 rounded-2xl border border-white/5 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-white/5 bg-white/5">
            <div className="flex items-center gap-2">
              <Lock size={14} className="text-rust" />
              <span className="text-[11px] font-bold tracking-widest text-t1 uppercase">Environment Secrets (.env)</span>
            </div>
            <button 
              onClick={() => setShowModal(true)}
              className="text-[10px] text-t3 hover:text-white transition-colors uppercase font-bold flex items-center gap-1.5"
            >
              <Edit3 size={12} /> Edit Secrets
            </button>
          </div>
          
          <div className="p-5 bg-black/20">
            <p className="text-[11px] text-t3/60 leading-relaxed">
              Manage API keys and environment variables. Click "Edit Secrets" to open the secure vault.
            </p>
          </div>
        </div>
      </div>

      {showModal && (
        <SecretsModal 
          configData={configData} 
          onClose={() => setShowModal(false)} 
        />
      )}
    </>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function SettingsPage() {
  const { data: configData, loading: configLoading, error: configError, refetch: configRefetch } = useApi('/config')
  const { data: modelsData, loading: modelsLoading } = useApi('/models')
  const { data: gatewayData, loading: gatewayLoading } = useApi('/gateway')
  const { data: profileData, loading: profileLoading, refetch: profileRefetch } = useApi('/profile')

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
        message: body.message ?? (res.ok ? 'Gateway restarting...' : `HTTP ${res.status}`),
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

      

      {/* --- DASHBOARD PREFERENCES SECTION --- */}
      <SectionHeader title="Dashboard Preferences" description="Local interface and identity settings." />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="space-y-6">
          {/* User Profile */}
          <UserProfile data={profileData} loading={profileLoading} refetch={profileRefetch} />

          
        </div>
        <div className="space-y-6">
          <SectionCard title="Interface & Display" headerRight={<CardHeaderRight badges={[{type: "dashboard", label: "Dashboard Only"}]} />} icon={Layout} iconColor="text-blue" accent="#3b82f6" className="h-full">
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
        
        
        </div>
      </div>

      {/* --- HERMES CORE SECTION --- */}
      <SectionHeader title="Hermes Core" description="Primary engine, reasoning, and behavior controls." />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="space-y-6">
          {/* Model & Provider Overview */}
          {configLoading ? (
            <SkeletonSection />
          ) : (
            <SectionCard title="Active Paradigm" headerRight={<CardHeaderRight badges={[{type: "core", label: "Hermes Core"}, {type: "low", label: "Low Risk"}]} />} icon={Code2} iconColor="text-blue" accent="#3b82f6" className="h-full">
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
          <SectionCard title="Gateway Uplink" headerRight={<CardHeaderRight badges={[{type: "core", label: "Hermes Core"}, {type: "runtime", label: "Affects Runtime"}]} />} icon={Zap} iconColor="text-green" accent="#22c55e" className="flex flex-col h-full">
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

      <div className="space-y-6 mb-6">
        {/* Full Width Model Switcher */}
      <SectionCard title="Model Selection Matrix" headerRight={<CardHeaderRight badges={[{type: "core", label: "Hermes Core"}]} />} icon={Sparkles} iconColor="text-blue" accent="#3b82f6">
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
          <div className="text-xs text-t3 bg-surface2/30 p-4 rounded-xl border border-white/5 text-center">No models available</div>
        ) : (
          <div className="-mx-1">
            <ModelSwitcher models={models} current={currentModel} />
          </div>
        )}
      </SectionCard>


        {/* Personality Switcher */}
      <SectionCard title="Personality Matrix" headerRight={<CardHeaderRight badges={[{type: "core", label: "Hermes Core"}]} />} icon={Sparkles} iconColor="text-amber" accent="#f59e0b">
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


      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <SectionCard title="Agent & Behavior" headerRight={<CardHeaderRight badges={[{type: "core", label: "Hermes Core"}]} />} icon={Cpu} iconColor="text-rust" accent="#e05f40" className="h-full">
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

        
        <SectionCard title="Memory System" headerRight={<CardHeaderRight badges={[{type: "core", label: "Hermes Core"}]} />} icon={Settings2} iconColor="text-amber" accent="#f59e0b" className="h-full">
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

        
      </div>

      {/* --- INTEGRATIONS SECTION --- */}
      <SectionHeader title="Integrations" description="External connections and endpoints." />
      <div className="grid grid-cols-1 gap-6 mb-8">
        {/* Webhook Config */}
        <SectionCard title="Webhook Integration" headerRight={<CardHeaderRight badges={[{type: "core", label: "Hermes Core"}, {type: "sensitive", label: "Sensitive"}]} />} icon={Link} iconColor="text-blue" accent="#3b82f6" className="h-full">
          <WebhookConfig />
        </SectionCard>

      
      </div>

      {/* --- SECURITY SECTION --- */}
      <SectionHeader title="Security" description="Cryptographic secrets and privacy bounds." />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <SectionCard title="Security & Privacy" headerRight={<CardHeaderRight badges={[{type: "core", label: "Hermes Core"}, {type: "sensitive", label: "Sensitive"}]} />} icon={Shield} iconColor="text-green" accent="#22c55e" className="h-full">
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
      
        <div className="space-y-6">
          {/* Secret Manager */}
      <SectionCard title="Cryptographic Vault" headerRight={<CardHeaderRight badges={[{type: "core", label: "Hermes Core"}, {type: "sensitive", label: "Sensitive"}]} />} icon={Shield} iconColor="text-rust" accent="#f43f5e">
        <SecretManager onRestart={handleRestartGateway} />
      </SectionCard>


        </div>
      </div>

      {/* --- EXPERIMENTAL SECTION --- */}
      <SectionHeader title="Experimental" description="Advanced controls and direct configuration bypasses." />
      <div className="space-y-6">
        {/* Raw config.yaml Hacker Block */}
      <div className="pt-4">
        <SectionCard title="Direct Configuration Matrix" headerRight={<CardHeaderRight badges={[{type: "experimental", label: "Experimental"}, {type: "sensitive", label: "Sensitive"}]} />} icon={Terminal} iconColor="text-green" accent="#10b981">
          <RawConfig raw={configData?.raw_config} loading={configLoading} refetch={configRefetch} redactSecrets={cfg?.security?.redact_secrets ?? true} />

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
</div>
  )
}
