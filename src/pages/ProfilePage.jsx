import { useState, useEffect, useRef, useMemo } from 'react'
import { Sparkles, Brain, Zap, Settings, Bell,
        ChevronRight, TrendingUp, Globe, Shield, Camera, X, Activity, Clock3, User, SlidersHorizontal } from 'lucide-react'
import { useApi, usePoll } from '../hooks/useApi'
import { apiFetch } from '../utils/auth'
import { SectionCard } from '../components/ui/Section'
import { PagePrimer } from '../components/ui/PagePrimer'
import { UserAvatar, getCustomAvatar, setCustomAvatar, clearCustomAvatar, CUSTOM_AVATAR_KEY } from '../components/avatar/UserAvatar'
import { clsx } from 'clsx'

// ─── Personalization Score ─────────────────────────────────────────────────────

function ProfileCompleteness({ profile, memStats }) {
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    try {
      const stored = localStorage.getItem('profile-complete-card-dismissed')
      if (stored === '1') setDismissed(true)
    } catch {}
  }, [])

  const factors = [
    { label: 'Navn', done: Boolean(profile?.username), href: '/settings?konto=name' },
    { label: 'Sprog', done: Boolean(profile?.language), href: '/settings?konto=language' },
    { label: 'Tone', done: Boolean(profile?.personality), href: '/settings?arbejdsstil=tone' },
    { label: 'Hukommelse', done: memStats?.memory_pct > 0, href: '/memory' },
  ]
  const filled = factors.filter(f => f.done).length
  const pct = Math.round((filled / factors.length) * 100)

  if (dismissed) {
    return (
      <div className="rounded-xl border border-border/70 bg-surface2/25 px-3 py-2 text-[12px] text-t2 flex items-center justify-between">
        <span>Profil setup skjult i owner-mode.</span>
        <button
          className="text-amber hover:text-amber/80 font-semibold"
          onClick={() => {
            setDismissed(false)
            try { localStorage.removeItem('profile-complete-card-dismissed') } catch {}
          }}
        >
          Vis igen
        </button>
      </div>
    )
  }

  return (
    <SectionCard title="Profil komplet" icon={TrendingUp} iconColor="text-amber" accent="#f59e0b">
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="text-3xl font-black text-amber">{pct}%</div>
            <div className="text-[12px] text-t2 leading-relaxed">
              {pct === 100
                ? 'Din profil er komplet. Du kan altid ændre, hvad Hermes bruger.'
                : `${factors.length - filled === 2 ? 'To' : factors.length - filled} ting mangler stadig.`}
            </div>
          </div>
          {pct >= 75 && (
            <button
              className="text-[11px] text-t3 hover:text-t2"
              onClick={() => {
                setDismissed(true)
                try { localStorage.setItem('profile-complete-card-dismissed', '1') } catch {}
              }}
              title="Skjul denne boks"
            >
              Skjul
            </button>
          )}
        </div>
        <div className="h-2 bg-surface2 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-amber transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {factors.map(f => (
            <a
              key={f.label}
              href={f.href}
              className={clsx(
                'text-[11px] px-2 py-1 rounded-full border font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-rust/40',
                f.done
                  ? 'bg-green/10 border-green/20 text-green hover:bg-green/15'
                  : 'bg-amber/10 border border-dashed border-amber/45 text-amber font-semibold hover:bg-amber/15'
              )}
              title={`Gå til ${f.label.toLowerCase()}`}
            >
              {f.label} {f.done ? '✓' : '○'}
            </a>
          ))}
        </div>
      </div>
    </SectionCard>
  )
}

// ─── Profile Activity Log ─────────────────────────────────────────────────────

function formatRelativeTime(value) {
  if (!value) return 'ukendt tid'
  const ts = typeof value === 'number' ? value : Date.parse(value)
  if (Number.isNaN(ts)) return 'ukendt tid'
  const diff = Date.now() - ts
  const mins = Math.max(1, Math.round(diff / 60000))
  if (mins < 60) return `${mins} min siden`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours} t siden`
  const days = Math.round(hours / 24)
  return `${days} d siden`
}

function ProfileActivityLog({ activity, profileUpdatedAt, loading }) {
  if (loading) {
    return (
      <SectionCard title="Seneste aktiviteter" icon={Activity} iconColor="text-blue" accent="#3b82f6">
        <div className="space-y-2 animate-pulse">
          <div className="h-3 bg-surface2 rounded w-2/3" />
          <div className="h-14 bg-surface2 rounded" />
          <div className="h-14 bg-surface2 rounded" />
        </div>
      </SectionCard>
    )
  }

  const events = (activity || []).slice(0, 3)
  const last = events[0]

  return (
    <SectionCard title="Seneste aktiviteter" icon={Activity} iconColor="text-blue" accent="#3b82f6">
      <div className="space-y-3">
        <div className="text-[12px] text-t2">
          {last
            ? <>Sidste handling: <span className="text-t1 font-semibold">{last.title}</span> · {formatRelativeTime(last.timestamp)}</>
            : 'Ingen nylige handlinger endnu'}
        </div>

        <div className="space-y-2">
          {events.length > 0 ? events.map((event) => (
            <div key={event.id} className="rounded-lg border border-border/70 bg-surface2/40 px-3 py-2">
              <div className="flex items-start justify-between gap-2">
                <div className="text-[12px] font-semibold text-t1 line-clamp-1">{event.title}</div>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-green/25 bg-green/10 text-green">OK</span>
              </div>
              <div className="mt-1 text-[11px] text-t2 flex items-center gap-1"><Clock3 size={10} />{formatRelativeTime(event.timestamp)}</div>
            </div>
          )) : (
            <div className="rounded-lg border border-dashed border-border px-3 py-2 text-[12px] text-t2">
              Ingen aktivitet endnu — når Hermes handler autonomt, vises de seneste hændelser her.
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-border/70 pt-2">
          <div className="text-[11px] text-t2">Profil sidst ændret: {formatRelativeTime(profileUpdatedAt)}</div>
          <a href="/logs" className="text-[11px] text-blue hover:text-blue/80 font-semibold">Se fulde logs</a>
        </div>
      </div>
    </SectionCard>
  )
}

// ─── Quick Toggles ─────────────────────────────────────────────────────────────

function QuickToggles({ initialProaktiv, initialTelegram, initialAuto, gatewayStatus, profileUpdatedAt }) {
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

  const toggleMeta = {
    proaktivitet: {
      behavior: 'Når aktiv: Hermes foreslår selv næste skridt efter opgaver.',
    },
    telegram_notifications: {
      behavior: 'Når aktiv: du får beskeder om valgte hændelser på Telegram.',
    },
    auto_handle: {
      behavior: 'Når aktiv: lav-risiko handlinger kan gennemføres uden manuel godkendelse.',
    },
  }

  const telegramPlatform = Array.isArray(gatewayStatus?.platforms)
    ? gatewayStatus.platforms.find((p) => p.name === 'telegram')
    : null
  const telegramLive = telegramPlatform?.status === 'live_active' || telegramPlatform?.status === 'connected'

  const Toggle = ({ labelKey, label, desc, icon: Icon, value, onChange }) => {
    const isSaving = saving === labelKey
    const wasSaved = saved === labelKey
    return (
      <div className="py-3 border-b border-border last:border-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={clsx(
              'w-9 h-9 rounded-xl flex items-center justify-center',
              value ? 'bg-rust/10' : 'bg-surface2'
            )}>
              <Icon size={15} className={value ? 'text-rust' : 'text-t3'} />
            </div>
            <div>
              <div className="text-sm font-semibold text-t1 flex items-center gap-2">
                {label}
                {labelKey === 'telegram_notifications' && (
                  <span className={clsx(
                    'text-[10px] px-1.5 py-0.5 rounded-full border',
                    telegramLive
                      ? 'border-green/25 bg-green/10 text-green'
                      : 'border-amber/35 bg-amber/10 text-amber'
                  )}>
                    {telegramLive ? 'Live' : 'Offline'}
                  </span>
                )}
              </div>
              <div className="text-[12px] text-t2 leading-relaxed">{desc}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {wasSaved && <span className="text-[11px] text-green animate-in fade-in">Gemt</span>}
            <button
              onClick={() => { const next = !value; onChange(next); save(labelKey, next) }}
              disabled={isSaving}
              className={clsx(
                'relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-rust/40 focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
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
        <div className="pl-12 mt-1 space-y-0.5">
          <div className="text-[11px] text-t2">{toggleMeta[labelKey]?.behavior}</div>
          <div className="text-[10px] text-t3">Sidst ændret: {formatRelativeTime(profileUpdatedAt)}</div>
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
          desc="Hermes kan foreslå næste skridt automatisk"
          icon={Zap}
          value={proaktiv}
          onChange={setProaktiv}
        />
        <Toggle
          labelKey="telegram_notifications"
          label="Telegram-notifikationer"
          desc="Modtag valgfri notifikationer på Telegram"
          icon={Bell}
          value={telegram}
          onChange={setTelegram}
        />
        <Toggle
          labelKey="auto_handle"
          label="Automatisk godkendelse"
          desc="Tillad automatisk godkendelse af udvalgte handlinger"
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
          <div className="text-sm font-semibold text-t1 mb-1">
            {personality
              ? <span className="capitalize text-amber font-semibold">{personality}</span>
              : <span className="text-t1/80 italic">Ikke sat</span>}
          </div>
          <div className="text-[12px] text-t1/75 leading-relaxed">{desc}</div>
          {!personality && (
            <div className="mt-2 rounded-lg border border-dashed border-amber/40 bg-amber/10 px-2.5 py-2 text-[11px] text-amber">
              Vælg tone for mere forudsigelige svar i samme stil hver gang.
            </div>
          )}
          {model && (
            <div className="mt-2 text-[11px] text-t2 font-mono">
              Model: {typeof model === 'string' ? model : model?.default ?? model?.provider ?? '—'}
            </div>
          )}
        </div>
        <a
          href="/settings"
          className="flex items-center gap-1 text-[11px] text-t2 hover:text-amber transition-colors border border-border hover:border-amber/30 rounded-lg px-2 py-1.5"
        >
          Rediger
          <ChevronRight size={10} />
        </a>
      </div>
    </SectionCard>
  )
}

// ─── Known Facts Preview ───────────────────────────────────────────────────────

function KnownFactsPreview({ memStats, profile, personality, loading }) {
  if (loading) {
    return (
      <SectionCard title="Data Hermes bruger til at hjælpe dig" icon={Brain} iconColor="text-green" accent="#00b478">
        <div className="space-y-2 animate-pulse">
          <div className="h-16 bg-surface2 rounded" />
          <div className="h-10 bg-surface2 rounded" />
          <div className="h-2 bg-surface2 rounded" />
        </div>
      </SectionCard>
    )
  }

  const memPct = memStats?.memory_pct ?? 0
  const memChars = memStats?.memory?.chars ?? 0
  const memEntries = memStats?.memory?.entries ?? 0
  const healthColor = memPct > 80 ? '#e63946' : memPct > 60 ? '#f59e0b' : '#22c55e'

  const missing = useMemo(() => {
    const out = []
    if (!profile?.role) out.push({ label: 'Rolle', href: '/profile' })
    if (!profile?.language) out.push({ label: 'Sprog', href: '/settings?konto=language' })
    if (!personality) out.push({ label: 'Tone', href: '/settings?arbejdsstil=tone' })
    return out
  }, [profile?.role, profile?.language, personality])

  const known = Math.max(0, 3 - missing.length)

  return (
    <SectionCard title="Data Hermes bruger til at hjælpe dig" icon={Brain} iconColor="text-green" accent="#00b478">
      <div className="space-y-4">
        <div className="rounded-lg border border-white/[0.06] bg-surface2/40 p-3">
          <div className="text-[12px] text-t2">Status</div>
          <div className="mt-1 text-sm font-semibold text-t1">
            Hermes ved <span className="text-green">{known}</span> af 3 nøglepunkter om dig
          </div>
          <div className="text-[11px] text-t2 mt-1">
            {missing.length === 0
              ? 'Godt setup. Hermes kan arbejde mere præcist med din nuværende kontekst.'
              : `Mangler ${missing.length} punkt${missing.length > 1 ? 'er' : ''} for bedre prioritering.`}
          </div>
        </div>

        {missing.length > 0 && (
          <div className="space-y-1.5">
            {missing.map((item) => (
              <a
                key={item.label}
                href={item.href}
                className="flex items-center justify-between rounded-lg border border-dashed border-amber/40 bg-amber/10 px-2.5 py-2 text-[11px] text-amber hover:bg-amber/15"
              >
                <span>Mangler: {item.label}</span>
                <span className="font-semibold">Udfyld</span>
              </a>
            ))}
          </div>
        )}

        <div>
          <div className="flex justify-between text-[10px] text-t2 mb-1 uppercase tracking-wide">
            <span>Hukommelsesbelastning</span>
            <span>{memChars.toLocaleString('da-DK')} tegn · {memEntries} fakta</span>
          </div>
          <div className="h-2 bg-surface2 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${Math.min(memPct, 100)}%`, background: healthColor }}
            />
          </div>
          <div className="mt-1 text-[10px] text-t3">
            {memPct > 80 ? 'Høj belastning — overvej memory cleanup.' : 'Sund hukommelseskapacitet.'}
          </div>
        </div>

        <a
          href="/memory"
          className="flex items-center justify-center gap-2 text-[12px] text-t2 hover:text-green transition-colors py-1.5 border border-border hover:border-green/30 rounded-lg"
        >
          <Brain size={12} />
          Se og redigér gemte oplysninger
          <ChevronRight size={10} />
        </a>
      </div>
    </SectionCard>
  )
}

// ─── Profile Identity Card ────────────────────────────────────────────────────

function ProfileIdentityCard({ profile, onSaved }) {
  const [name, setName] = useState(profile?.username || '')
  const [role, setRole] = useState(profile?.role || '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setName(profile?.username || '')
    setRole(profile?.role || '')
  }, [profile?.username, profile?.role])

  const handleSave = async (e) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    setSaving(true)
    try {
      const res = await apiFetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed, role: role.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.ok) {
        setSaved(true)
        setTimeout(() => setSaved(false), 1800)
        onSaved?.()
      }
    } catch {
      // silent UI for now
    } finally {
      setSaving(false)
    }
  }

  return (
    <SectionCard title="Profiloplysninger" icon={Globe} iconColor="text-rust" accent="#e05f40">
      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label className="block text-[11px] font-semibold text-t2 mb-1">Hvad hedder du?</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Dit navn"
            className="w-full rounded-lg bg-surface2 border border-border px-3 py-2 text-sm text-t1 focus:outline-none focus-visible:ring-2 focus-visible:ring-rust/40"
            maxLength={80}
          />
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-t2 mb-1">Hvad er din rolle?</label>
          <input
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="Fx Founder, COO, Salgschef"
            className="w-full rounded-lg bg-surface2 border border-border px-3 py-2 text-sm text-t1 focus:outline-none focus-visible:ring-2 focus-visible:ring-rust/40"
            maxLength={80}
          />
          {!role.trim() && (
            <div className="mt-2 rounded-lg border border-dashed border-amber/40 bg-amber/10 px-2.5 py-2 text-[11px] text-amber">
              Tip: En rolle hjælper Hermes med at prioritere svar til dit ansvarsniveau.
            </div>
          )}
        </div>
        <div className="flex items-center justify-between pt-3 border-t border-border/70">
          <span className="text-[11px] text-t2">Kan altid ændres senere.</span>
          <button
            type="submit"
            disabled={saving || !name.trim()}
            className="px-3 py-1.5 rounded-lg text-[12px] font-semibold bg-rust text-white border border-rust/70 shadow-[0_6px_16px_rgba(224,95,64,0.28)] hover:bg-rust/90 disabled:opacity-50"
          >
            {saving ? 'Gemmer…' : (saved ? 'Gemt ✓' : 'Gem')}
          </button>
        </div>
      </form>
    </SectionCard>
  )
}

// ─── Avatar Upload Section ─────────────────────────────────────────────────────

function AvatarUploadSection({ onAvatarChange }) {
  const fileInputRef = useRef(null)
  const [customAvatar, setCustomAvatarState] = useState(null)
  const [showReset, setShowReset] = useState(false)
  const [hovered, setHovered] = useState(false)

  // Read custom avatar from localStorage on mount
  useEffect(() => {
    const stored = getCustomAvatar()
    if (stored) {
      setCustomAvatarState(stored)
      setShowReset(true)
    }
  }, [])

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate it's an image
    if (!file.type.startsWith('image/')) {
      return
    }

    // Read as data URL and store
    const reader = new FileReader()
    reader.onload = (event) => {
      const dataUrl = event.target?.result
      if (dataUrl && typeof dataUrl === 'string') {
        setCustomAvatar(dataUrl)
        setShowReset(true)
        onAvatarChange(dataUrl)
      }
    }
    reader.readAsDataURL(file)

    // Reset input so same file can be selected again
    e.target.value = ''
  }

  const handleReset = () => {
    clearCustomAvatar()
    setCustomAvatarState(null)
    setShowReset(false)
    onAvatarChange(null)
  }

  return (
    <div
      className="relative inline-block"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <UserAvatar size={56} statusDot={false} />

      <button
        onClick={() => fileInputRef.current?.click()}
        className={clsx(
          'absolute inset-0 rounded-2xl bg-black/55 border border-white/10 flex flex-col items-center justify-center transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-amber/40',
          hovered ? 'opacity-100' : 'opacity-0'
        )}
        title="Skift billede"
      >
        <Camera size={12} className="text-amber" />
        <span className="text-[9px] mt-1 text-white font-semibold tracking-wide uppercase">Skift billede</span>
      </button>

      {/* Reset button (shown when custom avatar exists) */}
      {showReset && (
        <button
          onClick={handleReset}
          className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-rust/80 border border-rust flex items-center justify-center hover:bg-rust transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-rust/50"
          title="Nulstil til standardikon"
        >
          <X size={12} className="text-white" />
        </button>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

function ProfilePageComponent() {
  const { data: profile, loading: loadingProfile, refetch: refetchProfile } = useApi('/profile')
  const { data: gw } = useApi('/gateway')
  const { data: memStats, loading: loadingMemory } = usePoll('/memory/stats', 15000)
  const { data: config, loading: loadingConfig } = useApi('/config')
  const { data: activityData, loading: loadingActivity } = useApi('/activity?limit=3')
  const [avatarKey, setAvatarKey] = useState(0) // Force re-render on avatar change

  const username = profile?.username || '—'
  const role = profile?.role || null
  const language = profile?.language || null
  const timezone = profile?.timezone || null
  const personality = config?.current_personality || config?.personality || profile?.personality || null
  const model = gw?.model || null

  const proaktivitet = profile?.proaktivitet
  const telegram_notifications = profile?.telegram_notifications
  const auto_handle = profile?.auto_handle
  const profileUpdatedAt = profile?.updated_at
  const activity = activityData?.events || []
  const loadingCards = loadingProfile || loadingMemory || loadingConfig || loadingActivity

  const handleAvatarChange = (newAvatar) => {
    // Force re-render of UserAvatar by changing key
    setAvatarKey(k => k + 1)
  }

  return (
    <div className="max-w-5xl mx-auto pb-20 animate-in fade-in duration-300">
      <PagePrimer
        title="Din profil"
        body="Her vælger du, hvordan Hermes arbejder for dig — arbejdsstil, tone og hvilke oplysninger der gemmes."
        tip="Du bestemmer selv, hvor meget du vil udfylde. Mere kontekst kan give hurtigere og mere præcise svar."
      />

      {/* Profile header */}
      <div className="mb-7 rounded-2xl border border-border/80 bg-surface2/40 px-5 py-5 shadow-[0_10px_30px_rgba(0,0,0,0.18)]">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center shrink-0">
            <AvatarUploadSection onAvatarChange={handleAvatarChange} key={avatarKey} />
          </div>
          <div className="min-w-0 space-y-1">
            <div className="text-2xl font-black text-t1 leading-none truncate">{username}</div>
            <div className="flex items-center gap-1.5 text-[12px] text-t2/90 mt-1">
              {role
                ? <><Globe size={10} />{role}</>
                : (
                  <span className="inline-flex items-center rounded-full border border-amber/35 bg-amber/10 px-2 py-0.5 text-[11px] font-semibold text-amber">
                    Rolle ikke sat
                  </span>
                )}
              {(language || timezone) ? ` · ${language || 'Sprog ikke sat'}${timezone ? ` · ${timezone}` : ''}` : ''}
            </div>
          </div>
        </div>
      </div>

      <div className="xl:hidden fixed bottom-3 left-3 right-3 z-20">
        <div className="rounded-2xl border border-border/80 bg-surface2/85 backdrop-blur px-3 py-2 flex items-center justify-between shadow-[0_8px_24px_rgba(0,0,0,0.25)]">
          <a href="/profile" className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-t2 hover:text-rust">
            <User size={12} /> Profil
          </a>
          <a href="/settings" className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-t2 hover:text-amber">
            <SlidersHorizontal size={12} /> Indstillinger
          </a>
          <a href="/memory" className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-t2 hover:text-green">
            <Brain size={12} /> Memory
          </a>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="space-y-6">
          <ProfileIdentityCard profile={profile} onSaved={refetchProfile} />
          <ProfileCompleteness profile={profile} memStats={memStats} />
          <ToneCard personality={personality} model={model} />
        </div>
        <div className="space-y-6">
          <ProfileActivityLog activity={activity} profileUpdatedAt={profileUpdatedAt} loading={loadingActivity} />
          <KnownFactsPreview memStats={memStats} profile={profile} personality={personality} loading={loadingMemory || loadingConfig || loadingProfile} />
          {loadingCards ? (
            <SectionCard title="Hurtige indstillinger" icon={Settings} iconColor="text-blue" accent="#3b82f6">
              <div className="space-y-2 animate-pulse">
                <div className="h-12 bg-surface2 rounded" />
                <div className="h-12 bg-surface2 rounded" />
                <div className="h-12 bg-surface2 rounded" />
              </div>
            </SectionCard>
          ) : (
            <QuickToggles
              initialProaktiv={proaktivitet}
              initialTelegram={telegram_notifications}
              initialAuto={auto_handle}
              gatewayStatus={gw}
              profileUpdatedAt={profileUpdatedAt}
            />
          )}
        </div>
      </div>
    </div>
  )
}

export const ProfilePage = ProfilePageComponent
export default ProfilePageComponent
