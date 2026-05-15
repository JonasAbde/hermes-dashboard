import { useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import {
  Shield,
  AlertCircle,
  Loader2,
  Lock,
  ArrowRight,
  Eye,
  TrendingUp,
  BookOpen,
  Activity,
  Zap,
  ChevronRight,
} from 'lucide-react'
import { BRAND } from '../constants/brandColors.js'
import { setCsrfToken } from '../utils/auth.ts'

const A = {
  green: { stroke: BRAND.green, dim: 'rgba(0,180,120,0.18)', glow: BRAND.greenGlow },
  blue:  { stroke: BRAND.blue,  dim: 'rgba(74,128,200,0.18)', glow: BRAND.blueGlow },
  amber: { stroke: BRAND.amber, dim: 'rgba(224,144,64,0.18)', glow: BRAND.amberGlow },
  rust:  { stroke: BRAND.rust,  dim: 'rgba(224,95,64,0.18)',  glow: BRAND.rustGlow },
}

const AGENTS = [
  { icon: Eye,        name: 'Argus', role: 'Overvaagning & incident response', caps: ['Health', 'Logs', 'Anomalier'],   accent: 'green' },
  { icon: Lock,       name: 'Nyx',   role: 'Adgang, auth & guardrails',        caps: ['Tokens', 'Approvals', 'Policy'], accent: 'blue'  },
  { icon: TrendingUp, name: 'Dex',   role: 'Data, trends & omkostninger',      caps: ['Statistik', 'EKG', 'Cost'],      accent: 'amber' },
  { icon: BookOpen,   name: 'Echo',  role: 'Hukommelse, sessions & historik',  caps: ['Memory', 'Sessions', 'Traces'],  accent: 'rust'  },
]

const AFTER_LOGIN = [
  { icon: Activity, text: 'Live overblik: gateway, services og fleet' },
  { icon: Eye,      text: 'Agent-status, verify-historik og logs' },
  { icon: Zap,      text: 'Direkte kontrol: restart, deploy og approve' },
]

const HEX = '[clip-path:polygon(50%_0%,100%_25%,100%_75%,50%_100%,0%_75%,0%_25%)]'

const containerVariants = {
  hidden: { opacity: 0 },
  show:   { opacity: 1, transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
}
const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  show:   { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 340, damping: 26 } },
}

/** Registry hub + fire pack-satellitter — “univers” uden at love gamification */
function AgentCard({ agent, index, reduce }) {
  const a = A[agent.accent]
  return (
    <motion.div
      initial={reduce ? undefined : { opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.07, type: 'spring', stiffness: 240, damping: 22 }}
      whileHover={reduce ? {} : { y: -5, transition: { duration: 0.18 } }}
      className="group relative overflow-hidden rounded-[20px] border border-white/[0.08]"
      style={{
        background: 'linear-gradient(180deg, rgba(12,12,18,0.95) 0%, rgba(6,6,10,0.85) 100%)',
        boxShadow: '0 16px 48px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.06)',
      }}
    >
      <div
        className="absolute inset-x-0 top-0 h-[2px]"
        style={{ background: `linear-gradient(90deg, transparent, ${a.stroke}99, transparent)` }}
      />
      <div
        className="relative flex h-[120px] items-center justify-center overflow-hidden"
        style={{
          background: `radial-gradient(circle at 50% 15%, ${a.stroke}30, transparent 42%),
            radial-gradient(circle at 85% 80%, ${a.stroke}16, transparent 38%),
            linear-gradient(180deg, ${a.stroke}1c 0%, transparent 55%, rgba(0,0,0,0.55) 100%)`,
        }}
      >
        <div
          className="absolute inset-0 opacity-[0.22]"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.07) 1px, transparent 1px)',
            backgroundSize: '14px 14px',
          }}
        />
        <div
          className={`relative flex h-[62px] w-[62px] items-center justify-center bg-black/60 ${HEX}`}
          style={{ boxShadow: `0 0 30px ${a.dim}` }}
        >
          {!reduce && (
            <motion.div
              className={`absolute inset-[5px] ${HEX}`}
              animate={{ scale: [1, 1.1, 1], opacity: [0.28, 0.65, 0.28] }}
              transition={{ duration: 3.2 + index * 0.45, repeat: Infinity, ease: 'easeInOut' }}
              style={{ border: `1px solid ${a.stroke}70` }}
            />
          )}
          <agent.icon size={24} style={{ color: a.stroke }} />
        </div>
        <div
          className="absolute bottom-0 inset-x-0 px-3 pb-2 pt-8"
          style={{ background: 'linear-gradient(to top, rgba(6,6,10,0.92) 55%, transparent)' }}
        >
          <div className="text-[8px] font-mono uppercase tracking-[0.3em] mb-0.5" style={{ color: `${a.stroke}aa` }}>
            Agent
          </div>
          <div className="text-[17px] font-black uppercase tracking-wider text-t1 leading-none">
            {agent.name}
          </div>
        </div>
      </div>
      <div className="px-3 pb-3 pt-2.5">
        <p className="text-[11px] text-t2 leading-snug mb-2">{agent.role}</p>
        <div className="flex flex-wrap gap-1">
          {agent.caps.map(cap => (
            <span
              key={cap}
              className="rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em]"
              style={{ backgroundColor: `${a.stroke}1a`, color: a.stroke, border: `1px solid ${a.stroke}38` }}
            >
              {cap}
            </span>
          ))}
        </div>
      </div>
    </motion.div>
  )
}

function _OLD_REMOVED({ reduce }) {
  const cx = 200
  const cy = 150
  const nodes = [
    { x: 200, y: 26, label: 'Health', pack: PACKS[0] },
    { x: 368, y: 150, label: 'Config', pack: PACKS[1] },
    { x: 200, y: 274, label: 'Session', pack: PACKS[2] },
    { x: 32, y: 150, label: 'Verify', pack: PACKS[3] },
  ]
  const edges = nodes.map(n => ({
    d: `M ${cx} ${cy} L ${n.x} ${n.y}`,
    color: ACCENT[n.pack.accent].stroke,
  }))

  return (
    <div className="relative w-full overflow-hidden rounded-2xl border border-white/[0.07] bg-gradient-to-b from-black/40 via-[#0a0a12]/90 to-black/50 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Boxes size={14} className="text-rust" />
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-t2">Pack universe</span>
        </div>
        <span className="rounded-full border border-green/25 bg-green/5 px-2 py-0.5 text-[9px] font-mono text-green/90">
          registry:live
        </span>
      </div>
      <svg viewBox="0 0 400 300" className="mx-auto h-[200px] w-full max-w-md" aria-hidden>
        <defs>
          <filter id="forge-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1.2" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {edges.map((edge, i) => (
          <motion.path
            key={edge.d}
            d={edge.d}
            fill="none"
            stroke={edge.color}
            strokeWidth="1.25"
            strokeOpacity="0.45"
            strokeDasharray="6 6"
            filter="url(#forge-glow)"
            initial={reduce ? undefined : { pathLength: 0 }}
            animate={reduce ? {} : { pathLength: 1 }}
            transition={{ duration: 1.2, delay: 0.15 + i * 0.05, ease: easeOutCubic }}
          />
        ))}
        {!reduce &&
          edges.map(edge => (
            <path
              key={`dash-${edge.d}`}
              d={edge.d}
              fill="none"
              stroke={edge.color}
              strokeWidth="1.5"
              strokeOpacity="0.35"
              strokeDasharray="6 8"
              className="animate-forge-dash"
            />
          ))}
        <motion.circle
          cx={cx}
          cy={cy}
          r="22"
          fill="rgba(13,15,23,0.95)"
          stroke={BRAND.rust}
          strokeWidth="1.5"
          initial={reduce ? undefined : { scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5 }}
        />
        {reduce ? null : (
          <motion.circle
            cx={cx}
            cy={cy}
            r="22"
            fill="none"
            stroke={BRAND.rust}
            strokeWidth="1"
            strokeOpacity="0.45"
            initial={{ scale: 1 }}
            animate={{ scale: [1, 1.12, 1], opacity: [0.45, 0.15, 0.45] }}
            transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
          />
        )}
        <text x={cx} y={cy + 4} textAnchor="middle" className="fill-t1 text-[10px] font-bold" fontFamily="system-ui">
          FORGE
        </text>
        <text x={cx} y={cy + 16} textAnchor="middle" className="fill-t3 text-[7px]" fontFamily="ui-monospace, monospace">
          registry
        </text>
        {nodes.map((n, i) => {
          const a = ACCENT[n.pack.accent]
          return (
            <g key={n.label}>
              <motion.g
                style={{ transformOrigin: `${n.x}px ${n.y}px` }}
                initial={reduce ? undefined : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 + i * 0.08 }}
              >
                <motion.g
                  animate={reduce ? {} : { y: [0, -5, 0] }}
                  transition={{ duration: 4 + i * 0.3, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <circle
                    cx={n.x}
                    cy={n.y}
                    r="14"
                    fill={a.dim}
                    stroke={a.stroke}
                    strokeWidth="1.25"
                  />
                  <foreignObject x={n.x - 10} y={n.y - 10} width="20" height="20">
                    <div className="flex h-full w-full items-center justify-center text-t1">
                      <n.pack.icon size={12} style={{ color: a.stroke }} />
                    </div>
                  </foreignObject>
                </motion.g>
              </motion.g>
              <text
                x={n.x}
                y={n.y + 26}
                textAnchor="middle"
                className="fill-t2 text-[8px] font-bold uppercase tracking-[0.12em]"
              >
                {n.label}
              </text>
            </g>
          )
        })}
      </svg>
      <p className="text-center text-[10px] leading-relaxed text-t2/90">
        Fire agent packs koblet til ét registry — samme model som i CLI, bare med orbit og farvekode.
      </p>
    </div>
  )
}

/** Horisontal livscyklus med “scan” der viser flow (ikke en rigtig progress) */
function LifecycleRail({ reduce }) {
  return (
    <div className="relative">
      <div className="mb-3 flex items-center gap-2">
        <Cpu size={14} className="text-blue" />
        <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-t2">Livscyklus</span>
      </div>
      <div className="relative rounded-2xl border border-white/[0.06] bg-black/25 p-3">
        {!reduce && (
          <div
            className="pointer-events-none absolute inset-x-4 top-[42%] hidden h-0.5 overflow-hidden rounded-full bg-t3/40 lg:block"
            aria-hidden
          >
            <motion.div
              className="h-full w-1/3 rounded-full bg-gradient-to-r from-transparent via-rust/60 to-transparent"
              animate={{ x: ['-20%', '120%'] }}
              transition={{ duration: 5, repeat: Infinity, ease: 'linear' }}
            />
          </div>
        )}
        <div className="relative grid grid-cols-2 gap-2 sm:grid-cols-5 md:gap-0">
          {LIFE_STEPS.map((step, idx) => (
            <motion.div
              key={step.step}
              initial={reduce ? undefined : { opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.05 }}
              className="relative flex flex-col items-center gap-1.5 rounded-xl border border-white/[0.04] bg-surface/40 p-2 text-center md:border-0 md:bg-transparent"
            >
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-rust/25 bg-black/40">
                <step.icon size={15} className="text-rust" />
              </span>
              <p className="text-[11px] font-semibold text-t1">{step.step}</p>
              <p className="hidden text-[9px] text-t2 leading-snug sm:block sm:line-clamp-2">{step.description}</p>
              <span className="font-mono text-[10px] text-t3">{String(idx + 1).padStart(2, '0')}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  )
}

function PackCard({ pack, index, reduce }) {
  const a = ACCENT[pack.accent]
  return (
    <motion.div
      initial={reduce ? undefined : { opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.05, type: 'spring', stiffness: 260, damping: 22 }}
      whileHover={reduce ? {} : { y: -3, transition: { duration: 0.2 } }}
      className="group relative overflow-hidden rounded-2xl border border-white/[0.07] bg-gradient-to-b from-black/40 to-black/20 p-4 shadow-[0_20px_50px_rgba(0,0,0,0.45)]"
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[2px] opacity-90"
        style={{
          background: `linear-gradient(90deg, transparent, ${a.stroke}88, transparent)`,
        }}
      />
      <div
        className="absolute left-3 top-3 rounded-md border px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.18em]"
        style={{ borderColor: `${a.stroke}55`, color: a.stroke, backgroundColor: `${a.stroke}18` }}
      >
        {pack.tier}
      </div>

      <div className="mb-4 overflow-hidden rounded-[18px] border border-white/[0.06] bg-gradient-to-b from-black/20 via-black/10 to-transparent">
        <div
          className="relative flex h-36 items-center justify-center overflow-hidden"
          style={{
            background: `
              radial-gradient(circle at 50% 30%, ${a.stroke}26, transparent 36%),
              radial-gradient(circle at 20% 80%, ${a.stroke}18, transparent 35%),
              linear-gradient(180deg, ${a.stroke}18 0%, rgba(0,0,0,0.08) 45%, rgba(0,0,0,0.52) 100%)
            `,
          }}
        >
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
          <div
            className="absolute inset-0 opacity-30"
            style={{
              backgroundImage:
                'linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)',
              backgroundSize: '16px 16px',
            }}
          />
          <div
            className={`relative flex h-20 w-20 items-center justify-center bg-black/55 shadow-[0_0_40px_rgba(0,0,0,0.35)] ${HEX_CLIP}`}
            style={{ boxShadow: `0 0 28px ${a.dim}` }}
          >
            {!reduce && (
              <motion.div
                className={`absolute inset-2 ${HEX_CLIP}`}
                animate={{ scale: [1, 1.08, 1], opacity: [0.35, 0.8, 0.35] }}
                transition={{ duration: 3.2 + index * 0.35, repeat: Infinity, ease: 'easeInOut' }}
                style={{ border: `1px solid ${a.stroke}55` }}
              />
            )}
            <pack.icon size={30} style={{ color: a.stroke }} />
          </div>

          <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-3">
            <div>
              <div className="text-[9px] font-mono uppercase tracking-[0.2em] text-t3">Agent Pack</div>
              <div className="text-lg font-black uppercase tracking-wide text-t1">{pack.title}</div>
            </div>
            <div
              className="rounded-md border px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.18em]"
              style={{ borderColor: `${a.stroke}40`, color: a.stroke, backgroundColor: 'rgba(0,0,0,0.4)' }}
            >
              {pack.tag}
            </div>
          </div>
        </div>
      </div>

      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-t3">Operativ rolle</p>
        <span className="text-[9px] font-mono uppercase tracking-[0.16em]" style={{ color: a.stroke }}>
          {pack.tier}
        </span>
      </div>
      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-t1/90">{pack.role}</p>
      <p className="mt-2 text-[11px] text-t2 leading-relaxed">{pack.summary}</p>
      <div className="mt-3 flex items-start gap-1.5">
        <CheckCircle2 size={13} className="mt-0.5 flex-shrink-0 text-green" />
        <p className="text-[10px] text-green/90">{pack.metrics.join(' · ')}</p>
      </div>
      <div className="mt-3 flex items-center gap-2 text-[11px] text-t2">
        <ArrowDown size={13} className="opacity-70 group-hover:translate-y-0.5 transition-transform" />
        <span className="group-hover:text-t1 transition-colors">Klar til næste fase i pipeline</span>
      </div>
    </motion.div>
  )
}

export function LoginPage() {
  const TOKEN_KEY = 'hermes_dashboard_token'
  const [token, setToken] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const reduce = useReducedMotion()

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

      {/* VENSTRE: Agent-univers */}
      <motion.div
        initial={{ opacity: 0, x: -16 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="hidden lg:flex w-[54%] flex-col relative overflow-hidden border-r border-border/50 p-10 xl:p-12"
        style={{ background: 'linear-gradient(140deg, #0c0c12 0%, #101018 55%, #08080d 100%)' }}
      >
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: `radial-gradient(ellipse 65% 45% at 10% 0%, ${BRAND.rust}1a, transparent 50%),
              radial-gradient(ellipse 50% 38% at 95% 30%, ${BRAND.blue}12, transparent 48%),
              radial-gradient(ellipse 42% 32% at 40% 100%, ${BRAND.green}0b, transparent 45%)`,
          }}
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.25]"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
            maskImage: 'linear-gradient(180deg, black 45%, transparent 100%)',
          }}
        />

        <div className="relative z-10 flex flex-col h-full">
          <div className="flex items-center gap-3 mb-10">
            <div
              className="flex h-11 w-11 items-center justify-center rounded-2xl border"
              style={{
                borderColor: `${BRAND.rust}55`,
                backgroundColor: 'rgba(0,0,0,0.45)',
                boxShadow: `0 0 22px -4px ${BRAND.rust}40`,
              }}
            >
              <Shield size={22} style={{ color: BRAND.rust }} />
            </div>
            <div>
              <p className="text-[14px] font-black tracking-wider text-t1">Hermes</p>
              <p className="text-[11px] text-t2">Operationspanel · Fase 0</p>
            </div>
          </div>

          <div className="mb-8">
            <h1 className="text-[2.1rem] xl:text-[2.4rem] font-black text-t1 leading-[1.12] tracking-tight mb-4">
              Fire specialister.
              <br />
              <span style={{ color: BRAND.rust }}>Et samlet overblik.</span>
            </h1>
            <p className="text-[13px] text-t2 leading-relaxed max-w-[400px]">
              Hermes samler overvaagning, adgangskontrol, dataanalyse og hukommelse
              i eet operationspanel med samme sandhed i dashboard og CLI.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 flex-1">
            {AGENTS.map((agent, i) => (
              <AgentCard key={agent.name} agent={agent} index={i} reduce={reduce} />
            ))}
          </div>

          <div className="mt-6 pt-4 border-t border-white/[0.05]">
            <p className="text-[10px] text-t3/60">Hermes · Hold 1 Copenhagen</p>
          </div>
        </div>
      </motion.div>

      {/* ─── Højre: login + CLI ─── */}
      <div className="relative flex-1 flex min-h-screen flex-col items-center justify-center overflow-hidden p-6 sm:p-10">
        <AuroraBackdrop reduce={reduce} />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.4]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)`,
            backgroundSize: '24px 24px',
          }}
        />
        <div className="pointer-events-none absolute top-1/4 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-rust/10 blur-[100px]" />
        <div className="pointer-events-none absolute bottom-1/4 right-0 h-48 w-48 rounded-full bg-blue/10 blur-[80px]" />

        <motion.div
          variants={containerMotion}
          initial="hidden"
          animate="show"
          className="relative z-10 w-full max-w-md"
        >
          <div className="lg:hidden mb-8 text-center">
            <div className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl border border-rust/30 bg-black/40 shadow-[0_0_20px_-4px_rgba(224,95,64,0.4)]">
              <Shield size={24} className="text-rust" />
            </div>
            <p className="text-xs uppercase tracking-wider text-t3">Hermes Forge</p>
            <h1 className="text-xl mt-1 font-bold text-t1">Agent Pack opererer her</h1>
            <p className="text-sm text-t2 mt-1">Log ind og gå direkte til Fase 0 workflows.</p>
          </div>

          <motion.div variants={itemMotion} className="mb-5 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-rust/25 bg-rust/10 px-3 py-1 text-[11px] font-medium text-rust">
              <Sparkles size={12} />
              Fase 0 · intern pilot
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-t3/80 bg-surface/80 px-3 py-1 text-[11px] text-t2">
              <Lock size={11} />
              Kun token — ingen passwords her
            </span>
          </motion.div>

          <motion.p variants={itemMotion} className="mb-5 text-sm text-t2 leading-relaxed">
            Efter login får du fuldt overblik over packs, verify-runs og gateway-health — samme sandhed som CLI’en,
            bare med øjne og grafer.
          </motion.p>

          <motion.div
            variants={itemMotion}
            className="mb-5 overflow-hidden rounded-xl border border-white/[0.08] bg-[#050508] shadow-[0_24px_60px_rgba(0,0,0,0.65),inset_0_1px_0_rgba(255,255,255,0.05)]"
          >
            <div className="flex items-center gap-2 border-b border-white/[0.06] bg-surface2/80 px-3 py-2">
              <Terminal size={14} className="text-t2" />
              <span className="text-[11px] font-mono text-t2">hdb · forbundet til Forge</span>
              <span className="ml-auto flex gap-1.5">
                <span className="h-2 w-2 rounded-full bg-red/80" />
                <span className="h-2 w-2 rounded-full bg-amber/80" />
                <span className="h-2 w-2 rounded-full bg-green/90" />
              </span>
            </div>
            <div className="space-y-2 p-3 font-mono text-[11px] leading-relaxed">
              {CLI_PREVIEW.map((line, i) => (
                <div key={i}>
                  <p>
                    <span className="text-green">{line.prompt}</span>{' '}
                    <span className="text-t1">{line.cmd}</span>
                  </p>
                  <p className="text-t2/90 pl-4 border-l border-white/[0.06] ml-1">{line.out}</p>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div
            variants={itemMotion}
            className="mb-6 rounded-xl border border-white/[0.07] bg-gradient-to-b from-surface/90 to-black/40 p-4 shadow-inner"
          >
            <p className="text-[10px] uppercase tracking-[0.28em] text-t2 font-bold mb-3">Hurtigstart efter login</p>
            <ol className="space-y-2.5">
              {QUICK_PATH.map((item, idx) => (
                <li
                  key={item}
                  className="flex gap-3 rounded-lg border border-white/[0.05] bg-black/35 px-3 py-2.5 transition-colors hover:border-rust/15"
                >
                  <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg border border-rust/30 bg-rust/10 text-[11px] font-bold text-rust">
                    {idx + 1}
                  </span>
                  <div className="flex min-w-0 flex-1 items-start gap-2 pt-0.5">
                    <PlayCircle size={14} className="mt-0.5 text-rust/70 flex-shrink-0" />
                    <span className="text-[11px] text-t2 leading-snug">{item}</span>
                  </div>
                </li>
              ))}
            </ol>
          </motion.div>

          <motion.div variants={itemMotion} className="relative">
            <div
              className="absolute -inset-px rounded-2xl bg-gradient-to-br from-rust/40 via-transparent to-blue/25 opacity-80 blur-[1px]"
              aria-hidden
            />
            <div className="relative rounded-2xl border border-white/[0.1] bg-surface/95 p-6 shadow-[0_32px_80px_rgba(0,0,0,0.5)] backdrop-blur-md">
              <div className="mb-5">
                <h2 className="text-2xl font-bold text-t1 tracking-tight">Log ind</h2>
                <p className="text-sm text-t2 mt-1">
                  Indsæt adgangstoken fra{' '}
                  <code className="rounded bg-black/50 px-1.5 py-0.5 font-mono text-[11px] text-t1">~/.hermes/.env</code>
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="hermes-token" className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-t2">
                    Adgangstoken
                  </label>
                  <input
                    id="hermes-token"
                    type="password"
                    value={token}
                    onChange={(e) => {
                      setToken(e.target.value)
                      setError('')
                    }}
                    placeholder="Indsæt token her"
                    autoFocus
                    disabled={loading}
                    className="w-full rounded-xl border border-white/[0.08] bg-black/50 px-4 py-3.5 font-mono text-sm text-t1 placeholder:text-t3 transition-all focus:border-rust/60 focus:outline-none focus:ring-2 focus:ring-rust/20 disabled:opacity-50"
                  />
                </div>
                {error && (
                  <div className="flex items-center gap-2 rounded-lg border border-red-900/50 bg-red-950/40 px-3 py-2 text-sm text-red-400">
                    <AlertCircle size={14} />
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || !token.trim()}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-rust px-4 py-3.5 font-semibold text-black text-sm transition-all hover:brightness-110 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-rust/25"
                >
                  {loading ? (
                    <>
                      <Loader2 size={15} className="animate-spin" />
                      Verificerer...
                    </>
                  ) : (
                    <>
                      Log ind
                      <ArrowRight size={15} />
                    </>
                  )}
                </button>
              </form>

              <div className="mt-4 flex items-start gap-2 rounded-lg border border-white/[0.05] bg-black/30 px-3 py-2.5">
                <Lock size={14} className="text-t2 mt-0.5 flex-shrink-0" />
                <p className="text-[11px] text-t2 leading-relaxed">
                  Token sendes kun til <code className="font-mono text-t1/90">POST /api/auth/verify</code>. Vi gemmer det lokalt i
                  browseren efter godkendelse.
                </p>
              </div>

              <p className="mt-5 text-xs text-t2 text-center">
                Har du ikke token?{' '}
                <a
                  href="https://hermes-agent.io/docs"
                  className="text-rust/90 hover:text-rust underline-offset-2 hover:underline transition-colors"
                >
                  Læs dokumentationen →
                </a>
              </p>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </div>
  )
}
