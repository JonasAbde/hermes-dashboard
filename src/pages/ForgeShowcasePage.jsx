import { Link } from 'react-router-dom'
import { ArrowRight, Layers3, ShieldCheck, Sparkles, TerminalSquare } from 'lucide-react'
import { HermesCharacter, HermesMascot, HermesCharacterStatusBadge } from '../components/avatar/HermesCharacter'

const VARIANTS = [
  { key: 'default', label: 'Default', note: 'Ready state med rolig aura og stabil kerne.' },
  { key: 'thinking', label: 'Thinking', note: 'Fokus-tilstand med blå energi og signalprikker.' },
  { key: 'active', label: 'Active', note: 'Eksekvering med højere puls og stærkere signalflow.' },
  { key: 'success', label: 'Success', note: 'Verificeret udførsel med seal/checkmark-badge.' },
  { key: 'warning', label: 'Warning', note: 'Attention state med amber-badge og kontrolleret alarm.' },
  { key: 'error', label: 'Error', note: 'Fejltilstand med hårdere puls og tydelig X-markør.' },
  { key: 'idle', label: 'Idle', note: 'Dormant state til lav aktivitet og baggrundsnær presence.' },
  { key: 'offline', label: 'Offline', note: 'Frakoblet state med afbrudt slash og dæmpet liv.' },
]

const DIRECTIONS = [
  {
    title: 'The Living Sigil',
    eyebrow: 'Primary identity',
    text: 'Hermes som et levende tegn: stille intelligens, høj præcision og en silhuet der kan fungere som både mascot, product mark og system-presence.',
    icon: Sparkles,
  },
  {
    title: 'Forge Heart',
    eyebrow: 'Forge expression',
    text: 'Forge-afledningen af samme kerne: mere præget, mere verified, mere “minted capability” end pynt eller gamification.',
    icon: ShieldCheck,
  },
  {
    title: 'Relay Warden',
    eyebrow: 'CLI expression',
    text: 'Terminaludtrykket for Hermes-universet: kontrolrum, operator shell og signalbåret autoritet oven på det samme sigil-sprog.',
    icon: TerminalSquare,
  },
]

function VariantCard({ variant }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 shadow-[0_20px_50px_rgba(0,0,0,0.35)]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-t3">State</div>
          <h3 className="text-lg font-semibold text-t1">{variant.label}</h3>
        </div>
        <HermesCharacterStatusBadge variant={variant.key} />
      </div>
      <div className="mb-4 flex min-h-[180px] items-center justify-center rounded-2xl border border-white/8 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.07),transparent_40%),linear-gradient(180deg,rgba(11,13,18,0.95),rgba(7,8,11,0.98))]">
        <HermesCharacter variant={variant.key} size="large" pulse statusDot blink={false} />
      </div>
      <p className="text-sm leading-6 text-t2">{variant.note}</p>
    </div>
  )
}

export default function ForgeShowcasePage() {
  return (
    <div className="min-h-screen bg-[#07080c] text-white">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute left-1/2 top-24 h-[34rem] w-[34rem] -translate-x-1/2 rounded-full bg-green/10 blur-3xl" />
        <div className="absolute right-[10%] top-[28rem] h-[20rem] w-[20rem] rounded-full bg-blue/10 blur-3xl" />
        <div className="absolute left-[10%] top-[40rem] h-[18rem] w-[18rem] rounded-full bg-rust/10 blur-3xl" />
      </div>

      <main className="relative mx-auto flex w-full max-w-7xl flex-col gap-20 px-6 pb-20 pt-10 md:px-10">
        <header className="flex items-center justify-between gap-4 border-b border-white/10 pb-6">
          <div>
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-green/80">
              Hermes Forge Platform
            </div>
            <h1 className="text-2xl font-bold text-white md:text-3xl">Mascot Showcase Prototype</h1>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="rounded-xl border border-white/12 px-4 py-2 text-sm text-t2 transition hover:border-white/20 hover:bg-white/[0.04] hover:text-white"
            >
              Back
            </Link>
            <Link
              to="/overview"
              className="inline-flex items-center gap-2 rounded-xl bg-green px-4 py-2 text-sm font-semibold text-black transition hover:brightness-110"
            >
              Launch App
              <ArrowRight size={16} />
            </Link>
          </div>
        </header>

        <section className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-green/20 bg-green/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-green/90">
              <Layers3 size={14} />
              The Living Sigil
            </div>
            <h2 className="max-w-3xl text-4xl font-black tracking-tight text-white md:text-6xl">
              En showcase-side for den nye Hermes Forge Platform-identitet
            </h2>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-t2">
              Denne prototype samler de designretninger vi har lavet, og viser hvordan <span className="text-white font-semibold">The Living Sigil</span>
              {' '}kan fungere som primær mascot, Forge-udtryk og system-identitet i samme webapp.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <span className="rounded-full border border-green/20 bg-green/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-green/90">
                Living Sigil
              </span>
              <span className="rounded-full border border-blue/20 bg-blue/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-blue/90">
                Forge Heart
              </span>
              <span className="rounded-full border border-rust/20 bg-rust/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-rust/90">
                Relay Warden
              </span>
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(17,19,24,0.95),rgba(7,8,12,0.98))] p-8 shadow-[0_30px_80px_rgba(0,0,0,0.45)]">
            <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.24em] text-t3">Hero mascot</div>
            <div className="flex items-center justify-center rounded-[1.5rem] border border-white/8 bg-[radial-gradient(circle_at_center,rgba(0,212,144,0.18),transparent_42%),linear-gradient(180deg,rgba(10,11,16,0.95),rgba(5,6,9,1))] px-4 py-8">
              <HermesMascot variant="active" />
            </div>
            <p className="mt-5 text-sm leading-7 text-t2">
              Hero-versionen viser maskotten som platform-presence: levende, systems-aware og stadig teknisk nok til at kunne skaleres ned til UI-badges og CLI-branding.
            </p>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-3">
          {DIRECTIONS.map((direction) => (
            <div
              key={direction.title}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 shadow-[0_20px_50px_rgba(0,0,0,0.3)]"
            >
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-green">
                <direction.icon size={20} />
              </div>
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-t3">{direction.eyebrow}</div>
              <h3 className="text-xl font-semibold text-t1">{direction.title}</h3>
              <p className="mt-3 text-sm leading-7 text-t2">{direction.text}</p>
            </div>
          ))}
        </section>

        <section>
          <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-t3">State system</div>
              <h2 className="mt-2 text-3xl font-bold text-white">The Living Sigil i alle tilstande</h2>
            </div>
            <p className="max-w-2xl text-sm leading-7 text-t2">
              Her vises selve mascot-systemet som prototype: samme geometri, men forskellig energi, badge-logik og funktionel betydning afhængigt af state.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            {VARIANTS.map((variant) => (
              <VariantCard key={variant.key} variant={variant} />
            ))}
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 shadow-[0_20px_50px_rgba(0,0,0,0.3)]">
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-t3">Design notes</div>
            <h2 className="mt-2 text-2xl font-bold text-white">Hvad denne prototype skal bevise</h2>
            <ul className="mt-5 space-y-3 text-sm leading-7 text-t2">
              <li>Én maskot-identitet kan bære både platform, Forge og terminaloplevelse.</li>
              <li>Forge kan føles mere verified og premium uden at blive gamified.</li>
              <li>Silhuetten er stærk nok til både hero-visning og små statusmærker.</li>
              <li>Webappens retning kan flyttes visuelt uden at ombygge hele systemet først.</li>
            </ul>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(17,19,24,0.95),rgba(7,8,12,0.98))] p-6 shadow-[0_20px_50px_rgba(0,0,0,0.35)]">
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-t3">Brand surfaces</div>
            <h2 className="mt-2 text-2xl font-bold text-white">Første flader i det nye udtryk</h2>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-white/8 bg-black/30 p-5">
                <div className="mb-3 text-sm font-semibold text-t1">Favicon / small mark</div>
                <div className="flex min-h-[8rem] items-center justify-center rounded-xl border border-white/8 bg-[#0a0b10]">
                  <img src="/favicon.svg" alt="Hermes sigil favicon" className="h-24 w-24" />
                </div>
              </div>
              <div className="rounded-2xl border border-white/8 bg-black/30 p-5">
                <div className="mb-3 text-sm font-semibold text-t1">Social / hero preview</div>
                <div className="overflow-hidden rounded-xl border border-white/8 bg-[#0a0b10]">
                  <img src="/og-image.svg" alt="Hermes social preview" className="h-full w-full object-cover" />
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
