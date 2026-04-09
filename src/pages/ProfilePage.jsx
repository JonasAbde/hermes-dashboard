import { useState, useEffect } from 'react'
import { User, Sparkles, Brain, Zap, MessageSquare, Settings, Bell,
         ChevronRight, TrendingUp, Clock, Globe, Shield } from 'lucide-react'
import { useApi, usePoll } from '../hooks/useApi'
import { apiFetch } from '../utils/auth'
import { SectionCard } from '../components/ui/Section'
import { PagePrimer } from '../components/ui/PagePrimer'
import { clsx } from 'clsx'

// ─── Personalization Score ─────────────────────────────────────────────────────

function ProfileCompleteness({ profile, memStats }) {
  const factors = [
    { label: 'Navn', done: Boolean(profile?.username) },
    { label: 'Sprog', done: Boolean(profile?.language) },
    { label: 'Tone', done: Boolean(profile?.personality) },
    { label: 'Memory', done: memStats?.memory_pct > 0 },
  ]
  const filled = factors.filter(f => f.done).length
  const pct = Math.round((filled / factors.length) * 100)

  return (
    <SectionCard title="Profil komplet" icon={TrendingUp} iconColor="text-amber" accent="#f59e0b">
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="text-4xl font-black text-amber">{pct}%</div>
          <div className="text-[11px] text-t3 leading-relaxed">
            {pct === 100
              ? 'Din profil er komplet. Hermes har det hele.'
              : `${factors.length - filled} ting mangler stadig.`}
          </div>
        </div>
        <div className="h-2 bg-surface2 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-amber transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {factors.map(f => (
            <span
              key={f.label}
              className={clsx(
                'text-[10px] px-2 py-1 rounded-full border font-medium',
                f.done
                  ? 'bg-green/10 border-green/20 text-green'
                  : 'bg-surface2 border-border text-t3'
              )}
            >
              {f.label} {f.done ? '✓' : '○'}
            </span>
          ))}
        </div>
      </div>
    </SectionCard>
  )
}

// ─── Quick Toggles ─────────────────────────────────────────────────────────────

function QuickToggles({ initialProaktiv, initialTelegram, initialAuto }) {
  const [proaktiv, setProaktiv] = useState(initialProaktiv ?? true)
  const [telegram, setTelegram] = useState(initialTelegram ?? true)
  const [autoHandle, setAutoHandle] = useState(initialAuto ?? false)
  const [saving, setSaving] = useState(null)
  const [saved, setSaved] = useState(null)

  // Sync when initial props change
  useEffect(() => { if (initialProaktiv !== undefined) setProaktiv(initialProaktiv) }, [initialProaktiv])
  useEffect(() => { if (initialTelegram !== undefined) setTelegram(initialTelegram) }, [initialTelegram])
  useEffect(() => { if (initialAuto !== undefined) setAutoHandle(initialAuto) }, [initialAuto])

  const save = async (key, value) => {
    setSaving(key)
    try {
      const res = await apiFetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: value }),
      })
      const data = await res.json()
      if (data.ok) {
        setSaved(key)
        setTimeout(() => setSaved(null), 2000)
      }
    } catch(e) {
      console.error('profile save failed:', e)
    } finally {
      setSaving(null)
    }
  }

  const Toggle = ({ labelKey, label, desc, icon: Icon, value, onChange }) => {
    const isSaving = saving === labelKey
    const wasSaved = saved === labelKey
    return (
      <div className="flex items-center justify-between py-3 border-b border-border last:border-0">
        <div className="flex items-center gap-3">
          <div className={clsx(
            'w-9 h-9 rounded-xl flex items-center justify-center',
            value ? 'bg-rust/10' : 'bg-surface2'
          )}>
            <Icon size={15} className={value ? 'text-rust' : 'text-t3'} />
          </div>
          <div>
            <div className="text-sm font-semibold text-t1">{label}</div>
            <div className="text-[11px] text-t3">{desc}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {wasSaved && <span className="text-[10px] text-green animate-in fade-in">Gemt</span>}
          <button
            onClick={() => { const next = !value; onChange(next); save(labelKey, next) }}
            disabled={isSaving}
            className={clsx(
              'relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none',
              value ? 'bg-green/30' : 'bg-surface2',
            )}
            role="switch"
            aria-checked={value}
          >
            <span
              className={clsx(
                'pointer-events-none inline-block h-4 w-4 transform rounded-full shadow-md transition duration-200',
                value ? 'translate-x-4 bg-green' : 'translate-x-0 bg-t3'
              )}
            />
          </button>
        </div>
      </div>
    )
  }

  return (
    <SectionCard title="Hurtige indstillinger" icon={Settings} iconColor="text-blue" accent="#3b82f6">
      <div>
        <Toggle
          labelKey="proaktivitet"
          label="Proaktivitet"
          desc="Hermes handler uden at spørge"
          icon={Zap}
          value={proaktiv}
          onChange={setProaktiv}
        />
        <Toggle
          labelKey="telegram_notifications"
          label="Telegram-notifikationer"
          desc="Få beskeder fra Hermes på Telegram"
          icon={Bell}
          value={telegram}
          onChange={setTelegram}
        />
        <Toggle
          labelKey="auto_handle"
          label="Auto-handle"
          desc="Godkend handlinger automatisk"
          icon={Shield}
          value={autoHandle}
          onChange={setAutoHandle}
        />
      </div>
    </SectionCard>
  )
}

// ─── Current Tone Card ─────────────────────────────────────────────────────────

function ToneCard({ personality, model }) {
  const toneDescriptions = {
    'concise': 'Kort, præcist, direkte — ingen unødvendig snak.',
    'detailed': 'Uddybende, grundig, fyldestgørende svar.',
    'balanced': 'Afbalanceret — hverken for kort eller for lang.',
    'default': personality ? `Personality: ${personality}` : 'Standard tone',
  }
  const desc = personality ? (toneDescriptions[personality.toLowerCase()] ?? toneDescriptions.default) : 'Indstil din foretrukne arbejdsstil.'

  return (
    <SectionCard title="Arbejdsstil & Tone" icon={Sparkles} iconColor="text-amber" accent="#f59e0b">
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <div className="text-sm font-medium text-t2 mb-1">
            {personality
              ? <span className="capitalize text-amber font-mono">{personality}</span>
              : <span className="text-t3 italic">Ikke sat</span>}
          </div>
          <div className="text-[12px] text-t2 leading-relaxed">{desc}</div>
          {model && (
            <div className="mt-2 text-[10px] text-t3 font-mono">
              Model: {typeof model === 'string' ? model : model?.default ?? model?.provider ?? '—'}
            </div>
          )}
        </div>
        <a
          href="/settings"
          className="flex items-center gap-1 text-[10px] text-t3 hover:text-amber transition-colors border border-border hover:border-amber/30 rounded-lg px-2 py-1.5"
        >
          Rediger
          <ChevronRight size={10} />
        </a>
      </div>
    </SectionCard>
  )
}

// ─── Known Facts Preview ───────────────────────────────────────────────────────

function KnownFactsPreview({ memStats }) {
  const memPct = memStats?.memory_pct ?? 0
  const memChars = memStats?.memory?.chars ?? 0
  const memEntries = memStats?.memory?.entries ?? 0
  const healthColor = memPct > 80 ? '#e63946' : memPct > 60 ? '#f59e0b' : '#22c55e'

  return (
    <SectionCard title="Hvad Hermes ved om dig" icon={Brain} iconColor="text-green" accent="#00b478">
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-surface2/40 rounded-lg p-2.5 border border-white/[0.03] text-center">
            <div className="text-lg font-black text-t1">{memEntries}</div>
            <div className="text-[9px] text-t3 uppercase tracking-widest">Facts</div>
          </div>
          <div className="bg-surface2/40 rounded-lg p-2.5 border border-white/[0.03] text-center">
            <div className={clsx('text-lg font-black', memPct > 60 ? 'text-amber' : 'text-green')}>
              {memPct}%
            </div>
            <div className="text-[9px] text-t3 uppercase tracking-widest">Memory</div>
          </div>
        </div>

        <div>
          <div className="flex justify-between text-[9px] text-t3 mb-1 uppercase tracking-widest">
            <span>Hukommelse</span>
            <span>{memChars.toLocaleString('da-DK')} chars</span>
          </div>
          <div className="h-2 bg-surface2 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${Math.min(memPct, 100)}%`, background: healthColor }}
            />
          </div>
        </div>

        <a
          href="/memory"
          className="flex items-center justify-center gap-2 text-[11px] text-t3 hover:text-green transition-colors py-1.5 border border-border hover:border-green/30 rounded-lg"
        >
          <Brain size={12} />
          Se alle facts i Memory
          <ChevronRight size={10} />
        </a>
      </div>
    </SectionCard>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function ProfilePage() {
  const { data: profile } = useApi('/profile')
  const { data: gw } = useApi('/gateway')
  const { data: memStats } = usePoll('/memory/stats', 15000)
  const { data: config } = useApi('/config')

  const username = profile?.username || '—'
  const language = profile?.language || null
  const timezone = profile?.timezone || null
  const personality = config?.personality || profile?.personality || null
  const model = gw?.model || null

  const proaktivitet = profile?.proaktivitet
  const telegram_notifications = profile?.telegram_notifications
  const auto_handle = profile?.auto_handle

  return (
    <div className="max-w-2xl mx-auto pb-20 animate-in fade-in duration-300">
      <PagePrimer
        title="Din profil"
        body="Det her styrer hvordan Hermes arbejder med dig — din arbejdsstil, tone og hvad Hermes husker."
        tip="En komplet profil giver hurtigere, mere præcise svar."
      />

      {/* Profile header */}
      <div className="flex items-center gap-4 mb-6">
        <div className="w-14 h-14 rounded-2xl bg-rust/10 border border-rust/20 flex items-center justify-center">
          <User size={24} className="text-rust" />
        </div>
        <div>
          <div className="text-xl font-black text-t1">{username}</div>
          {language && (
            <div className="flex items-center gap-1.5 text-[11px] text-t3 mt-0.5">
              <Globe size={10} />
              {language} {timezone ? `· ${timezone}` : ''}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-5">
        <ProfileCompleteness profile={profile} memStats={memStats} />
        <ToneCard personality={personality} model={model} />
        <KnownFactsPreview memStats={memStats} />
        <QuickToggles
          initialProaktiv={proaktivitet}
          initialTelegram={telegram_notifications}
          initialAuto={auto_handle}
        />
      </div>
    </div>
  )
}
