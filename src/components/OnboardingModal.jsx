import { useState, useEffect } from 'react'
import { Zap, MessageCircle, CheckCircle, ChevronRight, ChevronLeft, Loader, AlertCircle, WifiOff, Info, X } from 'lucide-react'

const PROVIDERS = {
  kilocode:   {
    label: 'Kilocode',
    models: ['kilo-auto/balanced', 'kilo-auto/fast', 'kilo-auto/reasoning'],
    needsKey: false,
    hint: 'Anbefalet — ingen API-nøgle krævet. Hermes bruger Kilocode som standard routing-lag.',
  },
  openrouter: {
    label: 'OpenRouter',
    models: ['anthropic/claude-3.5-sonnet', 'openai/gpt-4o', 'google/gemini-2.0-flash'],
    needsKey: true,
    hint: 'Giver adgang til 200+ modeller via én API-nøgle. God til fleksibilitet.',
  },
  anthropic:  {
    label: 'Anthropic',
    models: ['claude-opus-4-6', 'claude-sonnet-4', 'claude-haiku-3'],
    needsKey: true,
    hint: 'Direkte forbindelse til Claude-modeller. Høj kvalitet, højere pris.',
  },
  openai:     {
    label: 'OpenAI',
    models: ['gpt-4o', 'gpt-4o-mini', 'o3-mini'],
    needsKey: true,
    hint: 'Direkte forbindelse til GPT-modeller fra OpenAI.',
  },
  groq:       {
    label: 'Groq',
    models: ['llama-3.3-70b-versatile', 'mixtral-8x7b-32768'],
    needsKey: true,
    hint: 'Ekstremt hurtig inferens på open-source modeller. Gratis tier tilgængeligt.',
  },
  together:   {
    label: 'Together AI',
    models: ['meta-llama/Llama-4-Maverick', 'deepseek-ai/DeepSeek-V3-0324'],
    needsKey: true,
    hint: 'Open-source modeller med god pris/ydelse-ratio.',
  },
}

const MODEL_HINTS = {
  'kilo-auto/balanced': 'God balance mellem hastighed og kvalitet. Anbefalet til daglig brug.',
  'kilo-auto/fast':     'Prioriterer hastighed. Velegnet til hurtige svar og simple opgaver.',
  'kilo-auto/reasoning':'Dybere tænkning. Bruges til komplekse og analytiske opgaver.',
}

const TOTAL_STEPS = 4

// Hermes sigil — matcher den etablerede identitet i designsystemet
function HermesSigil({ size = 28, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
      <path d="M16 3L28 9.5V22.5L16 29L4 22.5V9.5L16 3Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M16 3V29M4 9.5L28 22.5M28 9.5L4 22.5" stroke="currentColor" strokeWidth="1" strokeOpacity="0.4" />
      <circle cx="16" cy="16" r="3" fill="currentColor" fillOpacity="0.7" />
    </svg>
  )
}

export function OnboardingModal({ open, onClose, onDone }) {
  const [step, setStep]               = useState(1)
  const [config, setConfig]           = useState({ provider: 'kilocode', model: 'kilo-auto/balanced', apiKey: '', telegramToken: '' })
  const [saving, setSaving]           = useState(false)
  const [error, setError]             = useState('')
  const [testResult, setTestResult]   = useState(null)
  const [gatewayOnline, setGatewayOnline] = useState('checking')
  const [showDismissHint, setShowDismissHint] = useState(false)

  useEffect(() => {
    if (!open) return
    setStep(1); setError(''); setTestResult(null)
    const controller = new AbortController()
    const timeout = setTimeout(() => { controller.abort(); setGatewayOnline(false) }, 8000)
    setGatewayOnline('checking')
    fetch('/api/gateway', { signal: controller.signal })
      .then(r => r.json())
      .then(data => { clearTimeout(timeout); setGatewayOnline(!!data.connected || !!data.running || !!data.status?.connected) })
      .catch(e => { clearTimeout(timeout); if (e?.name !== 'AbortError') setGatewayOnline(false) })
    return () => { controller.abort(); clearTimeout(timeout) }
  }, [open])

  const needsKey = PROVIDERS[config.provider]?.needsKey ?? false

  const update = (key, val) => {
    setConfig(prev => ({ ...prev, [key]: val }))
    setError(''); setTestResult(null)
    if (key === 'provider') {
      const models = PROVIDERS[val]?.models || []
      if (models.length) setConfig(prev => ({ ...prev, provider: val, model: models[0], apiKey: '' }))
    }
  }

  const testConnection = async () => {
    setError(''); setTestResult(null)
    if (gatewayOnline === false) { setTestResult('offline'); return }
    try {
      const res = await fetch('/api/models')
      if (!res.ok) { setTestResult('fail'); return }
      const data = await res.json()
      setTestResult(data.models?.length > 0 ? 'ok' : 'fail')
    } catch { setTestResult('offline') }
  }

  const handleFinish = async () => {
    setSaving(true); setError('')
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: config.provider, model: config.model, apiKey: needsKey ? config.apiKey : '', telegramToken: config.telegramToken }),
      })
      const data = await res.json()
      if (data.ok) { localStorage.removeItem('onboarding_complete'); if (onDone) onDone(); else window.location.href = '/' }
      else setError(data.error || 'Kunne ikke gemme konfiguration')
    } catch { setError('Forbindelsesfejl. Prøv igen.') }
    finally { setSaving(false) }
  }

  if (!open) return null

  const providerHint = PROVIDERS[config.provider]?.hint
  const modelHint    = MODEL_HINTS[config.model]

  return (
    // FIX #10: Øget overlay til bg-black/80 for at reducere kognitiv støj fra baggrunden
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4" onClick={onClose}>
      <div className="w-full max-w-md" onClick={e => e.stopPropagation()}>

        {/* FIX #7: X-knap med dismiss-hint tooltip */}
        <div className="flex justify-end mb-2">
          <div className="relative">
            <button
              onClick={onClose}
              onMouseEnter={() => setShowDismissHint(true)}
              onMouseLeave={() => setShowDismissHint(false)}
              className="p-1.5 rounded-lg hover:bg-white/10 text-t3 hover:text-t1 transition-colors"
              aria-label="Luk onboarding"
            >
              <X size={18} />
            </button>
            {showDismissHint && (
              <div className="absolute right-0 top-full mt-1.5 w-52 rounded-lg border border-border bg-surface p-2.5 text-[11px] text-t2 shadow-lg z-10 pointer-events-none">
                <p className="font-medium text-t1 mb-0.5">Gem opsætning til senere?</p>
                <p className="text-t3">Dine valg gemmes ikke. Onboarding vises igen næste gang, du åbner dashboardet.</p>
              </div>
            )}
          </div>
        </div>

        {/* Header */}
        <div className="mb-4 flex flex-col items-center text-center">
          {/* FIX #4: Hermes sigil i stedet for generisk shield */}
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl border border-border"
               style={{ background: 'linear-gradient(135deg, #0d1510 0%, #182010 100%)' }}>
            <HermesSigil size={28} className="text-[var(--green)]" />
          </div>
          <h1 className="text-xl font-bold text-t1">Hermes Dashboard</h1>
          <p className="mt-1 text-sm text-t2">Kom online på under 2 minutter</p>
        </div>

        {/* FIX #3 + #9: Korrekt progress-bar med 4 segmenter — fjerner redundant trin-tæller i bunden */}
        <div className="mb-4 flex items-center gap-1.5">
          {Array.from({ length: TOTAL_STEPS }, (_, i) => (
            <div key={i}
              className="h-1 flex-1 rounded-full transition-all duration-300"
              style={{ background: i < step ? 'var(--green)' : 'var(--border)' }}
            />
          ))}
        </div>

        {/* FIX #1: Gateway-banner UDENFOR step-card og kun vist på relevante trin (2+) */}
        {step >= 2 && gatewayOnline === false && (
          <div className="mb-3 flex items-start gap-2.5 rounded-lg border border-amber-800/30 bg-amber-950/20 px-3 py-2.5 text-xs">
            <WifiOff size={13} className="mt-0.5 shrink-0 text-amber-400" />
            <p className="text-amber-300/80">
              Gateway offline — ingen akut handling nødvendig nu.{' '}
              <code className="rounded bg-amber-950/50 px-1 text-amber-200">hermes gateway start</code>
            </p>
          </div>
        )}

        {/* Step cards */}
        <div className="rounded-xl border border-border bg-surface p-6 shadow-2xl shadow-black/50">

          {/* STEP 1: FIX #5 — fokuseret CTA fremfor feature-liste. FIX #6 — rigtig knap-styling */}
          {step === 1 && (
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-[var(--bg)]">
                  <Zap size={20} className="text-[var(--green)]" />
                </div>
                <div>
                  <h2 className="font-semibold text-t1">Velkommen</h2>
                  <p className="text-sm text-t2">Du er ét setup væk fra fuld kontrol</p>
                </div>
              </div>

              <div className="rounded-lg border border-border bg-[var(--bg)] p-4 space-y-3">
                <p className="text-sm font-medium text-t1">Vi sætter 3 ting op:</p>
                <div className="space-y-2">
                  {[
                    { n: '1', label: 'Din AI-model', sub: 'Vælg provider og routing' },
                    { n: '2', label: 'Telegram (valgfrit)', sub: 'Notifikationer til din telefon' },
                    { n: '3', label: 'Bekræft og åbn', sub: 'Hermes er klar til brug' },
                  ].map(({ n, label, sub }) => (
                    <div key={n} className="flex items-center gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--green)]/15 text-xs font-bold text-[var(--green)]">{n}</span>
                      <div>
                        <p className="text-xs font-medium text-t1">{label}</p>
                        <p className="text-[11px] text-t3">{sub}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={() => setStep(2)}
                className="flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 font-semibold text-sm transition-all hover:brightness-110 active:scale-[0.98]"
                style={{ background: 'var(--green)', color: '#050608' }}
              >
                Kom i gang <ChevronRight size={16} />
              </button>
            </div>
          )}

          {/* STEP 2: FIX #2 — Næste aldrig disabled. FIX #8 — hjælpetekst på dropdowns */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-[var(--bg)]">
                  <Zap size={20} className="text-[var(--green)]" />
                </div>
                <div>
                  <h2 className="font-semibold text-t1">Din AI-model</h2>
                  <p className="text-sm text-t2">Vælg provider og model — kan ændres senere</p>
                </div>
              </div>

              <div className="space-y-3">
                {/* Provider dropdown + hint */}
                <div>
                  <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-t2">
                    Provider
                  </label>
                  <select
                    value={config.provider}
                    onChange={e => update('provider', e.target.value)}
                    className="w-full rounded-lg border border-border bg-[var(--bg)] px-3 py-2 text-sm text-t1 focus:border-[var(--green)] focus:outline-none focus:ring-1 focus:ring-[var(--green)]/30"
                  >
                    {Object.entries(PROVIDERS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                  {providerHint && (
                    <p className="mt-1.5 flex items-start gap-1.5 text-[11px] text-t3">
                      <Info size={11} className="mt-0.5 shrink-0 text-t3" />
                      {providerHint}
                    </p>
                  )}
                </div>

                {/* Model dropdown + hint */}
                <div>
                  <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-t2">
                    Model
                  </label>
                  <select
                    value={config.model}
                    onChange={e => update('model', e.target.value)}
                    className="w-full rounded-lg border border-border bg-[var(--bg)] px-3 py-2 text-sm text-t1 focus:border-[var(--green)] focus:outline-none focus:ring-1 focus:ring-[var(--green)]/30"
                  >
                    {PROVIDERS[config.provider]?.models.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                  {modelHint && (
                    <p className="mt-1.5 flex items-start gap-1.5 text-[11px] text-t3">
                      <Info size={11} className="mt-0.5 shrink-0 text-t3" />
                      {modelHint}
                    </p>
                  )}
                </div>

                {needsKey && (
                  <div>
                    <label className="mb-1 block text-xs font-medium text-t2">API Key</label>
                    <input
                      type="password"
                      value={config.apiKey}
                      onChange={e => update('apiKey', e.target.value)}
                      placeholder="sk-..."
                      className="w-full rounded-lg border border-border bg-[var(--bg)] px-3 py-2 text-sm text-t1 placeholder-t3 focus:border-[var(--green)] focus:outline-none focus:ring-1 focus:ring-[var(--green)]/30"
                    />
                  </div>
                )}

                {testResult && (
                  <div className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
                    testResult === 'ok'      ? 'border border-green-900/40 bg-green-950/30 text-green-400' :
                    testResult === 'offline' ? 'border border-amber-800/40 bg-amber-950/30 text-amber-400'
                                            : 'border border-red-900/40 bg-red-950/30 text-red-400'
                  }`}>
                    {testResult === 'ok' ? <CheckCircle size={14} /> : testResult === 'offline' ? <WifiOff size={14} /> : <AlertCircle size={14} />}
                    {testResult === 'ok'      ? 'Forbindelse OK — modeller fundet' :
                     testResult === 'offline' ? 'Gateway offline — du kan teste forbindelsen igen når den er startet.'
                                             : 'Kunne ikke hente modeller. Tjek API key.'}
                  </div>
                )}

                {gatewayOnline !== false && (
                  <button
                    onClick={testConnection}
                    disabled={needsKey && !config.apiKey}
                    className="text-xs text-t3 underline hover:text-t1 disabled:opacity-40 transition-colors"
                  >
                    Test forbindelse
                  </button>
                )}
              </div>

              <div className="flex gap-2 pt-1">
                <button onClick={() => setStep(1)}
                  className="flex items-center gap-1 rounded-lg border border-border px-4 py-2.5 text-sm text-t2 transition-colors hover:border-t3 hover:text-t1">
                  <ChevronLeft size={14} /> Tilbage
                </button>
                {/* FIX #2: Næste er ALDRIG disabled — gateway-status blokerer ikke flowet */}
                <button
                  onClick={() => setStep(3)}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 font-semibold text-sm transition-all hover:brightness-110 active:scale-[0.98]"
                  style={{ background: 'var(--green)', color: '#050608' }}
                >
                  {gatewayOnline === false ? 'Fortsæt alligevel' : 'Næste'} <ChevronRight size={16} />
                </button>
              </div>
              {gatewayOnline === false && (
                <p className="text-center text-[11px] text-t3">Du kan teste forbindelsen senere i Indstillinger</p>
              )}
            </div>
          )}

          {/* STEP 3: Telegram */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-[var(--bg)]">
                  <MessageCircle size={20} className="text-[var(--green)]" />
                </div>
                <div>
                  <h2 className="font-semibold text-t1">Telegram <span className="text-xs font-normal text-t3 ml-1">(valgfrit)</span></h2>
                  <p className="text-sm text-t2">Få beskeder direkte til din telefon</p>
                </div>
              </div>
              <div className="flex items-start gap-2 rounded-lg border border-border bg-[var(--bg)] px-3 py-2.5 text-xs text-t2">
                <Info size={13} className="mt-0.5 shrink-0 text-t3" />
                <p>Telegram aktiveres automatisk når gateway kører. Du behøver ikke sætte det op nu.</p>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-t2">Bot Token</label>
                  <input
                    type="password"
                    value={config.telegramToken}
                    onChange={e => update('telegramToken', e.target.value)}
                    placeholder="123456789:ABCdefGHI..."
                    className="w-full rounded-lg border border-border bg-[var(--bg)] px-3 py-2 text-sm text-t1 placeholder-t3 focus:border-[var(--green)] focus:outline-none focus:ring-1 focus:ring-[var(--green)]/30"
                  />
                </div>
                <p className="text-xs text-t3">
                  Find token ved at skrive <code className="rounded bg-[var(--bg)] px-1 text-t2">/newbot</code> til{' '}
                  <a href="https://t.me/BotFather" target="_blank" rel="noreferrer" className="text-[var(--green)] hover:underline">@BotFather</a>
                </p>
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={() => setStep(2)}
                  className="flex items-center gap-1 rounded-lg border border-border px-4 py-2.5 text-sm text-t2 transition-colors hover:border-t3 hover:text-t1">
                  <ChevronLeft size={14} /> Tilbage
                </button>
                <button onClick={() => setStep(4)}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 font-semibold text-sm transition-all hover:brightness-110 active:scale-[0.98]"
                  style={{ background: 'var(--green)', color: '#050608' }}>
                  Næste <ChevronRight size={16} />
                </button>
              </div>
              <button onClick={() => setStep(4)} className="w-full text-center text-xs text-t3 hover:text-t2 transition-colors underline">
                Spring over — opsæt Telegram i Indstillinger senere
              </button>
            </div>
          )}

          {/* STEP 4: Review */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-[var(--bg)]">
                  <CheckCircle size={20} className="text-[var(--green)]" />
                </div>
                <div>
                  <h2 className="font-semibold text-t1">Du er klar!</h2>
                  <p className="text-sm text-t2">Bekræft opsætningen og åbn dashboardet</p>
                </div>
              </div>
              <div className="space-y-2 rounded-lg border border-border bg-[var(--bg)] p-4">
                <div className="flex justify-between text-sm"><span className="text-t2">Provider</span><span className="text-t1 font-medium">{PROVIDERS[config.provider]?.label}</span></div>
                <div className="flex justify-between text-sm"><span className="text-t2">Model</span><span className="text-t1 font-medium">{config.model}</span></div>
                <div className="flex justify-between text-sm"><span className="text-t2">Telegram</span><span className="text-t1 font-medium">{config.telegramToken ? 'Konfigureret' : 'Springes over'}</span></div>
                {gatewayOnline === false && (
                  <div className="mt-2 flex items-center gap-1.5 rounded bg-amber-950/30 px-2 py-1.5 text-xs text-amber-400/80">
                    <WifiOff size={11} />
                    <span>Gateway offline — start med <code className="rounded bg-amber-950/50 px-0.5 text-amber-300">hermes gateway start</code></span>
                  </div>
                )}
              </div>
              {error && (
                <div className="flex items-center gap-2 rounded-lg border border-red-900/40 bg-red-950/30 px-3 py-2 text-sm text-red-400">
                  <AlertCircle size={14} /> {error}
                </div>
              )}
              <div className="flex gap-2 pt-1">
                <button onClick={() => setStep(3)}
                  className="flex items-center gap-1 rounded-lg border border-border px-4 py-2.5 text-sm text-t2 transition-colors hover:border-t3 hover:text-t1">
                  <ChevronLeft size={14} /> Tilbage
                </button>
                <button
                  onClick={handleFinish}
                  disabled={saving}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 font-semibold text-sm transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: 'var(--green)', color: '#050608' }}
                >
                  {saving ? <><Loader size={14} className="animate-spin" /> Gemmer...</> : <>Åbn Dashboard <ChevronRight size={16} /></>}
                </button>
              </div>
            </div>
          )}
        </div>
        {/* FIX #9: Fjernet redundant "Trin X af Y" — progress-bar kommunikerer dette alene */}
      </div>
    </div>
  )
}

export default OnboardingModal
