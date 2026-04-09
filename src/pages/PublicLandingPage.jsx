import { Shield, Zap, Brain, Clock, Users, Check, ArrowRight, Star, Play, Globe, Lock } from 'lucide-react'
import { Link } from 'react-router-dom'

const FEATURES = [
  { icon: Globe,    title: 'Global Workforce',   desc: 'Dine agenter arbejder på tværs af platforme (Gmail, Sheets, Slack).' },
  { icon: Lock,     title: 'Bank-Grade Security', desc: 'Dine data og din hukommelse forlader aldrig din kontrol.' },
  { icon: Brain,    title: 'Neural Context',     desc: 'Agenter der lærer din stil og husker dine præferencer.' },
  { icon: Zap,      title: 'Real-time Ops',      desc: 'Overvåg hver tanke og handling i realtid fra dit dashboard.' },
]

export function PublicLandingPage() {
  return (
    <div className="min-h-screen bg-bg text-text selection:bg-brand/30">
      {/* ─── Navigation ────────────────────────────────────────────────── */}
      <nav className="border-b border-border/40 bg-bg/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl border border-brand/20 bg-brand/5 flex items-center justify-center">
              <Shield size={18} className="text-brand" />
            </div>
            <span className="font-bold tracking-tight text-lg">Hermes<span className="text-brand">.io</span></span>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/login" className="text-sm font-medium text-t3 hover:text-text transition-colors">Log ind</Link>
            <Link to="/login" className="px-4 py-2 rounded-lg bg-brand text-black text-sm font-bold hover:brightness-110 transition-all shadow-lg shadow-brand/10">
              Start gratis
            </Link>
          </div>
        </div>
      </nav>

      {/* ─── Hero Section ─────────────────────────────────────────────── */}
      <section className="relative pt-20 pb-24 px-6 overflow-hidden">
        {/* Glow background */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-brand/5 blur-[120px] -z-10 rounded-full" />
        
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-brand/20 bg-brand/5 text-[10px] font-bold text-brand uppercase tracking-widest mb-6 animate-in fade-in slide-in-from-bottom-2">
            <Star size={10} /> Nu i Open Beta for Hold 1
          </div>
          <h1 className="text-4xl md:text-6xl font-black tracking-tight leading-[1.1] mb-6">
            Ansæt din første <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand to-amber-500">Autonome Medarbejder.</span>
          </h1>
          <p className="text-lg text-muted max-w-2xl mx-auto mb-10 leading-relaxed">
            Hermes er ikke bare en chatbot. Det er en autonom agent-platform, der udfører komplekse opgaver, 
            husker dine præferencer og driver din forretning mens du sover.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/login" className="w-full sm:w-auto px-8 py-4 rounded-xl bg-brand text-black font-black text-lg hover:scale-105 transition-all shadow-xl shadow-brand/20 flex items-center justify-center gap-2">
              Start din AI-flåde <ArrowRight size={20} />
            </Link>
            <button className="w-full sm:w-auto px-8 py-4 rounded-xl border border-border bg-surface/50 text-t2 font-bold hover:bg-surface transition-all flex items-center justify-center gap-2">
              <Play size={18} fill="currentColor" /> Se hvordan det virker
            </button>
          </div>
        </div>
      </section>

      {/* ─── Features Grid ────────────────────────────────────────────── */}
      <section className="py-20 px-6 border-t border-border/30 bg-surface/20">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-2xl font-bold mb-3">Bygget til fremtidens forretning.</h2>
            <p className="text-muted text-sm max-w-md mx-auto">Glem prompts — deleger hele workflows til agenter der forstår din kontekst.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {FEATURES.map(f => (
              <div key={f.title} className="p-6 rounded-2xl border border-border/50 bg-bg/50 hover:border-brand/40 transition-colors group">
                <div className="w-12 h-12 rounded-xl bg-brand/10 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                  <f.icon size={24} className="text-brand" />
                </div>
                <h3 className="font-bold text-lg mb-2">{f.title}</h3>
                <p className="text-sm text-muted leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Trust / Stats ────────────────────────────────────────────── */}
      <section className="py-20 border-t border-border/30">
        <div className="max-w-3xl mx-auto text-center px-6">
          <div className="grid grid-cols-3 gap-8 mb-12">
            <div>
              <div className="text-3xl font-black text-brand mb-1">140+</div>
              <div className="text-[10px] uppercase tracking-widest font-bold text-muted">Aktive Brugere</div>
            </div>
            <div>
              <div className="text-3xl font-black text-brand mb-1">1.2M</div>
              <div className="text-[10px] uppercase tracking-widest font-bold text-muted">Tasks Udført</div>
            </div>
            <div>
              <div className="text-3xl font-black text-brand mb-1">99.9%</div>
              <div className="text-[10px] uppercase tracking-widest font-bold text-muted">Uptime</div>
            </div>
          </div>
          <blockquote className="text-xl font-medium italic text-t2 leading-relaxed">
            "Hermes har transformeret hvordan vi håndterer leads i Rendetalje. Det er som at have en ansat, der aldrig sover og altid husker alt."
          </blockquote>
          <div className="mt-6 flex items-center justify-center gap-3">
             <div className="w-10 h-10 rounded-full bg-brand/20 flex items-center justify-center font-bold text-brand">JA</div>
             <div className="text-left">
               <div className="text-sm font-bold">Jonas Abde</div>
               <div className="text-[10px] text-muted uppercase tracking-widest">Founder, Rendetalje ApS</div>
             </div>
          </div>
        </div>
      </section>

      {/* ─── CTA Footer ───────────────────────────────────────────────── */}
      <section className="py-24 px-6 bg-brand text-black text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl md:text-5xl font-black mb-6 leading-tight">Klar til at skalere din tid?</h2>
          <p className="text-lg font-medium mb-10 opacity-80">
            Join de 140+ founders der allerede har automatiseret deres hverdag med Hermes.
          </p>
          <Link to="/login" className="inline-flex items-center gap-2 px-10 py-5 rounded-2xl bg-black text-brand font-black text-xl hover:scale-105 transition-all shadow-2xl">
            Opret din gratis konto <ArrowRight size={22} />
          </Link>
        </div>
      </section>
    </div>
  )
}
