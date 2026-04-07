import { useState } from 'react'
import { Shield, Zap, MessageCircle, CheckCircle, ChevronRight, ChevronLeft, Loader, AlertCircle } from 'lucide-react'

const PROVIDERS = {
  kilocode:   { label: 'Kilocode', models: ['kilo-auto/balanced', 'kilo-auto/fast', 'kilo-auto/reasoning'], needsKey: false },
  openrouter:  { label: 'OpenRouter', models: ['anthropic/claude-3.5-sonnet', 'openai/gpt-4o', 'google/gemini-2.0-flash'], needsKey: true },
  anthropic:   { label: 'Anthropic', models: ['claude-opus-4-6', 'claude-sonnet-4', 'claude-haiku-3'], needsKey: true },
  openai:      { label: 'OpenAI', models: ['gpt-4o', 'gpt-4o-mini', 'o3-mini'], needsKey: true },
  groq:        { label: 'Groq', models: ['llama-3.3-70b-versatile', 'mixtral-8x7b-32768'], needsKey: true },
  together:    { label: 'Together AI', models: ['meta-llama/Llama-4-Maverick', 'deepseek-ai/DeepSeek-V3-0324'], needsKey: true },
}

const TOTAL_STEPS = 4

export function OnboardingPage() {
  const [step, setStep] = useState(1)
  const [config, setConfig] = useState({
    provider: 'kilocode',
    model: 'kilo-auto/balanced',
    apiKey: '',
    telegramToken: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [testResult, setTestResult] = useState(null) // null | 'ok' | 'fail'

  const needsKey = PROVIDERS[config.provider]?.needsKey ?? false

  const update = (key, val) => {
    setConfig(prev => ({ ...prev, [key]: val }))
    setError('')
    setTestResult(null)
    // Auto-update model when provider changes
    if (key === 'provider') {
      const models = PROVIDERS[val]?.models || []
      if (models.length) setConfig(prev => ({ ...prev, model: models[0], apiKey: '' }))
    }
  }

  const testConnection = async () => {
    setError('')
    setTestResult(null)
    try {
      const res = await fetch('/api/models')
      const data = await res.json()
      setTestResult(data.models?.length > 0 ? 'ok' : 'fail')
    } catch {
      setTestResult('fail')
    }
  }

  const handleFinish = async () => {
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: config.provider,
          model: config.model,
          apiKey: needsKey ? config.apiKey : '',
          telegramToken: config.telegramToken,
        }),
      })
      const data = await res.json()
      if (data.ok) {
        localStorage.setItem('onboarding_complete', 'true')
        window.location.href = '/'
      } else {
        setError(data.error || 'Kunne ikke gemme konfiguration')
      }
    } catch (e) {
      setError('Forbindelsesfejl. Prøv igen.')
    } finally {
      setSaving(false)
    }
  }

  const skipStep = () => setStep(s => Math.min(s + 1, TOTAL_STEPS))

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg p-4">
      <div className="w-full max-w-md">

        {/* Header */}
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl border border-border"
               style={{ background: 'linear-gradient(135deg, #1a1510 0%, #2a2015 100%)' }}>
            <Shield size={28} className="text-brand" />
          </div>
          <h1 className="text-xl font-bold text-text">Hermes Dashboard</h1>
          <p className="mt-1 text-sm text-muted">Kom i gang med 3 enkle trin</p>
        </div>

        {/* Progress */}
        <div className="mb-6 flex items-center gap-1.5">
          {Array.from({ length: TOTAL_STEPS }, (_, i) => (
            <div key={i} className="h-1 flex-1 rounded-full transition-all"
                 style={{ background: i < step ? 'var(--brand)' : 'var(--border)' }} />
          ))}
        </div>

        {/* Step cards */}
        <div className="rounded-xl border border-border bg-surface p-6 shadow-lg">

          {/* Step 1: Welcome */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-bg">
                  <Zap size={20} className="text-brand" />
                </div>
                <div>
                  <h2 className="font-semibold text-text">Velkommen</h2>
                  <p className="text-sm text-muted">Lad os sætte dig op på under 2 minutter</p>
                </div>
              </div>
              <div className="space-y-2 text-sm text-muted">
                <p>Dette dashboard giver dig fuld kontrol over din Hermes AI-agent:</p>
                <ul className="list-inside list-disc space-y-1 pl-2">
                  <li>Overblik over samtaler og sessions</li>
                  <li>Hukommelse og kontekst</li>
                  <li>Scheduled jobs og cron</li>
                  <li>Skills og værktøjer</li>
                </ul>
              </div>
              <button onClick={() => setStep(2)}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 py-3 font-medium text-black transition-all hover:brightness-110">
                Kom i gang <ChevronRight size={16} />
              </button>
            </div>
          )}

          {/* Step 2: AI Provider */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-bg">
                  <Zap size={20} className="text-brand" />
                </div>
                <div>
                  <h2 className="font-semibold text-text">Din AI-model</h2>
                  <p className="text-sm text-muted">Vælg provider og model</p>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted">Provider</label>
                  <select value={config.provider} onChange={e => update('provider', e.target.value)}
                    className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text
                               focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/30">
                    {Object.entries(PROVIDERS).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-muted">Model</label>
                  <select value={config.model} onChange={e => update('model', e.target.value)}
                    className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text
                               focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/30">
                    {PROVIDERS[config.provider]?.models.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>

                {needsKey && (
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted">API Key</label>
                    <input type="password" value={config.apiKey}
                      onChange={e => update('apiKey', e.target.value)}
                      placeholder="sk-..."
                      className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text
                                 placeholder-muted focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/30" />
                  </div>
                )}

                {testResult && (
                  <div className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
                    testResult === 'ok' ? 'border border-green-900/40 bg-green-950/30 text-green-400'
                                        : 'border border-red-900/40 bg-red-950/30 text-red-400'
                  }`}>
                    {testResult === 'ok' ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                    {testResult === 'ok' ? 'Forbindelse OK — modeller fundet' : 'Kunne ikke hente modeller. Tjek API key.'}
                  </div>
                )}

                <button onClick={testConnection} disabled={needsKey && !config.apiKey}
                  className="text-xs text-muted underline hover:text-text disabled:opacity-40">
                  Test forbindelse
                </button>
              </div>

              <div className="flex gap-2">
                <button onClick={() => setStep(1)}
                  className="flex items-center gap-1 rounded-lg border border-border px-4 py-3 text-sm text-muted transition-colors hover:border-border/80 hover:text-text">
                  <ChevronLeft size={14} /> Tilbage
                </button>
                <button onClick={() => setStep(3)}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-brand px-4 py-3 font-medium text-black transition-all hover:brightness-110">
                  Næste <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Telegram (optional) */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-bg">
                  <MessageCircle size={20} className="text-brand" />
                </div>
                <div>
                  <h2 className="font-semibold text-text">Telegram (valgfrit)</h2>
                  <p className="text-sm text-muted">Få beskeder direkte til din telefon</p>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted">Bot Token</label>
                  <input type="password" value={config.telegramToken}
                    onChange={e => update('telegramToken', e.target.value)}
                    placeholder="123456789:ABCdefGHI..."
                    className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text
                               placeholder-muted focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/30" />
                </div>
                <p className="text-xs text-muted">
                  Find din token ved at skrive <code className="rounded bg-bg px-1">/newbot</code> til{' '}
                  <a href="https://t.me/BotFather" target="_blank" rel="noreferrer"
                     className="text-brand hover:underline">@BotFather</a>
                </p>
              </div>

              <div className="flex gap-2">
                <button onClick={() => setStep(2)}
                  className="flex items-center gap-1 rounded-lg border border-border px-4 py-3 text-sm text-muted transition-colors hover:border-border/80 hover:text-text">
                  <ChevronLeft size={14} /> Tilbage
                </button>
                <button onClick={() => setStep(4)}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-brand px-4 py-3 font-medium text-black transition-all hover:brightness-110">
                  Næste <ChevronRight size={16} />
                </button>
              </div>
              <button onClick={skipStep} className="w-full text-center text-xs text-muted underline hover:text-text">
                Spring over — kan gøres senere i Indstillinger
              </button>
            </div>
          )}

          {/* Step 4: Review */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-bg">
                  <CheckCircle size={20} className="text-brand" />
                </div>
                <div>
                  <h2 className="font-semibold text-text">Du er klar!</h2>
                  <p className="text-sm text-muted">Bekræft opsætningen og åbn dashboardet</p>
                </div>
              </div>

              <div className="space-y-2 rounded-lg border border-border bg-bg p-4">
                <div className="flex justify-between text-sm">
                  <span className="text-muted">Provider</span>
                  <span className="text-text">{PROVIDERS[config.provider]?.label}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted">Model</span>
                  <span className="text-text">{config.model}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted">Telegram</span>
                  <span className="text-text">{config.telegramToken ? 'Konfigureret ✓' : 'Springet over'}</span>
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 rounded-lg border border-red-900/40 bg-red-950/30 px-3 py-2 text-sm text-red-400">
                  <AlertCircle size={14} /> {error}
                </div>
              )}

              <div className="flex gap-2">
                <button onClick={() => setStep(3)}
                  className="flex items-center gap-1 rounded-lg border border-border px-4 py-3 text-sm text-muted transition-colors hover:border-border/80 hover:text-text">
                  <ChevronLeft size={14} /> Tilbage
                </button>
                <button onClick={handleFinish} disabled={saving}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-brand px-4 py-3 font-medium text-black transition-all hover:brightness-110 disabled:opacity-50">
                  {saving ? <><Loader size={14} className="animate-spin" /> Gemmer...</> : <>Åbn Dashboard <ChevronRight size={16} /></>}
                </button>
              </div>
            </div>
          )}

        </div>

        {/* Step counter */}
        <p className="mt-3 text-center text-xs text-muted">
          Trin {step} af {TOTAL_STEPS}
        </p>
      </div>
    </div>
  )
}
