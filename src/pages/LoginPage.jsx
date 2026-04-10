import { useState } from 'react'
import { Shield, AlertCircle, Loader, Zap, Brain, Clock, Users, Check, ArrowRight, Star } from 'lucide-react'
import { setCsrfToken } from '../utils/auth.ts'

const FEATURES = [
  { icon: Zap,      title: 'Agent Fleet',        desc: 'Overvåg alle dine AI-agenter i realtid' },
  { icon: Brain,    title: 'Neural Memory',      desc: 'Deleger opgaver uden at gentage dig selv' },
  { icon: Clock,    title: 'Automated Workflows', desc: 'Schedulér jobs og cron uden kode' },
  { icon: Users,    title: 'Team-ready',         desc: 'Approvals, delte workflows, og audit logs' },
]

const PLANS = [
  { name: 'Free',    price: '0',   period: 'forever',  features: ['1 agent', '50 queries/dag', 'Basis overvågning', 'Community support'], cta: 'Kom i gang', highlight: false },
  { name: 'Pro',     price: '9',   period: '/måned',   features: ['Ubegrænsede queries', 'Alle workflows', 'Prioriteret support', 'Custom skills'], cta: 'Start Pro',   highlight: true  },
  { name: 'Enterprise', price: 'Custom', period: '',  features: ['White-label', 'API-adgang', 'Custom modeller', 'Dedikeret SLA'], cta: 'Kontakt os',  highlight: false },
]

export function LoginPage() {
  const TOKEN_KEY = 'hermes_dashboard_token'
  const [token, setToken] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!token.trim()) return
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: token.trim() }),
      })
      const data = await res.json()

      if (data.ok) {
        if (data?.csrfToken) setCsrfToken(data.csrfToken)
        localStorage.setItem(TOKEN_KEY, token.trim())
        window.location.href = '/'
      } else {
        setError('Forkert token. Prøv igen.')
        setLoading(false)
      }
    } catch {
      setError('Kunne ikke forbinde til serveren. Er API\'et online?')
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen bg-bg">
      {/* ─── Left: Branding & Features ─────────────────────────────── */}
      <div className="hidden lg:flex flex-col w-[58%] p-10 xl:p-14 border-r border-border/50"
           style={{ background: 'linear-gradient(160deg, #0e0e14 0%, #12121a 50%, #0a0a10 100%)' }}>

        {/* Logo + tagline */}
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-border/60"
                 style={{ background: 'linear-gradient(135deg, #1a1510 0%, #2a2015 100%)' }}>
              <Shield size={22} className="text-brand" />
            </div>
            <div>
              <div className="text-base font-bold text-text">Hermes Agent Platform</div>
              <div className="text-xs text-muted">AI-assistenten der arbejder for dig</div>
            </div>
          </div>

          <h1 className="text-3xl xl:text-4xl font-bold text-text leading-tight mb-3">
            Din AI-arbejdsstyrke,<br />
            <span className="text-brand">visuelt styret.</span>
          </h1>
          <p className="text-sm text-muted leading-relaxed max-w-md">
            Hermes giver dig fuld kontrol over autonome AI-agenter. Deploy, overvåg og 
            skaler din AI-infrastruktur fra ét professionelt dashboard.
          </p>
        </div>

        {/* Social proof */}
        <div className="flex items-center gap-3 mb-10 p-3 rounded-lg bg-surface/50 border border-border/40 w-fit">
          <div className="flex -space-x-2">
            <div className="w-7 h-7 rounded-full border-2 border-bg flex items-center justify-center text-[9px] font-bold text-emerald-400 bg-emerald-500/20">
              ✓
            </div>
          </div>
          <div className="text-xs text-muted">
            <span className="text-emerald-400 font-semibold">Vi er i produktion</span> — rendetalje.købe
          </div>
        </div>

        {/* Features grid */}
        <div className="grid grid-cols-2 gap-3 mb-10">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="p-4 rounded-xl bg-surface/40 border border-border/30">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-md bg-brand/10 flex items-center justify-center">
                  <Icon size={13} className="text-brand" />
                </div>
                <span className="text-xs font-semibold text-text">{title}</span>
              </div>
              <p className="text-[10px] text-muted leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>

        {/* Pricing */}
        <div>
          <div className="text-[10px] uppercase tracking-widest font-bold text-muted mb-3">Prisside</div>
          <div className="grid grid-cols-3 gap-2">
            {PLANS.map(plan => (
              <div key={plan.name}
                   className={`p-3 rounded-xl border text-center ${plan.highlight
                     ? 'border-brand/40 bg-brand/5 shadow-[0_0_20px_rgba(200,160,70,0.06)]'
                     : 'border-border/40 bg-surface/30'
                   }`}>
                {plan.highlight && (
                  <div className="text-[8px] font-bold text-amber-300 uppercase tracking-wider mb-1 bg-amber-500/20 px-2 py-0.5 rounded">Mest populær</div>
                )}
                <div className="text-sm font-bold text-text">{plan.name}</div>
                <div className="flex items-baseline justify-center gap-0.5 mt-1 mb-2">
                  <span className="text-lg font-bold text-text">€{plan.price}</span>
                  {plan.period && <span className="text-[10px] text-muted">{plan.period}</span>}
                </div>
                <div className="space-y-0.5 text-left">
                  {plan.features.slice(2).map(f => (
                    <div key={f} className="flex items-center gap-1">
                      <Check size={8} className="text-emerald-400 flex-shrink-0" />
                      <span className="text-[9px] text-muted">{f}</span>
                    </div>
                  ))}
                </div>
                <a href="https://hermes-agent.io/pricing"
                   className={`mt-3 block w-full py-1.5 rounded-md text-[10px] font-semibold text-center transition-all ${
                     plan.highlight
                       ? 'bg-brand text-black hover:brightness-110'
                       : 'border border-border text-muted hover:text-text hover:border-border/80'
                   }`}>
                  {plan.cta}
                </a>
              </div>
            ))}
          </div>
        </div>

        {/* Footer tagline */}
        <div className="mt-auto pt-8">
          <p className="text-xs text-muted/60">
            Built with care by Hold 1 — Jonas & Rawan · Copenhagen, Denmark
          </p>
        </div>
      </div>

      {/* ─── Right: Login Form ─────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-sm">

          {/* Mobile logo */}
          <div className="lg:hidden mb-8 flex flex-col items-center text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-border"
                 style={{ background: 'linear-gradient(135deg, #1a1510 0%, #2a2015 100%)' }}>
              <Shield size={24} className="text-brand" />
            </div>
            <h1 className="text-lg font-bold text-text">Hermes Agent Platform</h1>
            <p className="text-xs text-muted mt-1">Din AI-arbejdsstyrke, visuelt styret</p>
          </div>

          <div className="mb-8">
            <h2 className="text-xl font-bold text-text">Log ind</h2>
            <p className="text-sm text-muted mt-1">Indtast din adgangstoken for at fortsætte</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <input
                type="password"
                value={token}
                onChange={(e) => { setToken(e.target.value); setError('') }}
                placeholder="Adgangstoken"
                autoFocus
                disabled={loading}
                className="w-full rounded-lg border border-border bg-surface px-4 py-3 text-text text-sm
                           placeholder-muted transition-colors
                           focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/30
                           disabled:opacity-50"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-lg border border-red-900/40 bg-red-950/30
                             px-3 py-2 text-sm text-red-400">
                <AlertCircle size={14} />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !token.trim()}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 py-3
                         font-semibold text-black text-sm transition-all hover:brightness-110
                         disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-brand/10"
            >
              {loading ? (
                <><Loader size={15} className="animate-spin" /> Verificerer...</>
              ) : (
                <>Log ind <ArrowRight size={15} /></>
              )}
            </button>
          </form>

          <div className="mt-6 space-y-2 text-center">
            <p className="text-xs text-muted">
              Token er sat i <code className="rounded bg-surface px-1.5 py-0.5 font-mono text-[10px]">~/.hermes/.env</code>
            </p>
            <a href="https://hermes-agent.io/docs" className="block text-xs text-brand/70 hover:text-brand transition-colors">
              Har du ikke en token? Læs dokumentationen →
            </a>
          </div>

          {/* Mini pricing on mobile */}
          <div className="lg:hidden mt-8 pt-6 border-t border-border/40">
            <p className="text-[9px] uppercase tracking-widest font-bold text-muted mb-3 text-center">Prisside</p>
            <div className="grid grid-cols-3 gap-2">
              {PLANS.map(plan => (
                <div key={plan.name}
                     className={`p-2.5 rounded-lg border text-center ${plan.highlight
                       ? 'border-brand/40 bg-brand/5'
                       : 'border-border/40 bg-surface/30'
                     }`}>
                  <div className="text-[10px] font-bold text-text">{plan.name}</div>
                  <div className="flex items-baseline justify-center gap-0.5 mt-0.5">
                    <span className="text-sm font-bold text-text">€{plan.price}</span>
                    {plan.period && <span className="text-[8px] text-muted">{plan.period}</span>}
                  </div>
                  {plan.highlight && (
                    <div className="mt-1">
                      <span className="text-[7px] font-bold text-brand uppercase tracking-wider">Populær</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
