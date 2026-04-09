import React, { useMemo } from 'react'
import { usePoll } from '../hooks/useApi'
import { clsx } from 'clsx'
import { AreaChart, Area, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Legend, BarChart, Bar } from 'recharts'
import { MetricCard, SkeletonCard } from '../components/ui/Card'
import { SectionCard } from '../components/ui/Section'
import { PagePrimer } from '../components/ui/PagePrimer'
import { Chip } from '../components/ui/Chip'
import { AlertTriangle, TrendingDown, TrendingUp, DollarSign, Coins, Zap, Layers } from 'lucide-react'

// ─── Formatters ───────────────────────────────────────────────────────────────

function formatCost(val) {
  if (val == null || val === 0) return '$0.00'
  if (val < 0.01) return `$${val.toFixed(4)}`
  return `$${val.toFixed(2)}`
}

function formatTokens(val) {
  if (val == null || val === 0) return '0'
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(2)}M`
  if (val >= 1_000) return `${(val / 1_000).toFixed(1)}k`
  return val.toString()
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  } catch {
    return dateStr
  }
}

// ─── Budget Alert Banner ──────────────────────────────────────────────────────

function BudgetAlert({ cost_month, budget }) {
  if (cost_month == null || budget == null || budget <= 0) return null

  const pct = (cost_month / budget) * 100
  const remaining = budget - cost_month

  if (pct >= 95) {
    return (
      <div className="flex items-center gap-3 px-4 py-3 rounded-2xl border border-red/30 bg-red/10 text-red shadow-[0_4px_24px_rgba(239,68,68,0.15)]">
        <span className="w-5 h-5 rounded-full bg-red/20 flex items-center justify-center flex-shrink-0">
          <AlertTriangle size={11} />
        </span>
        <div className="flex-1 min-w-0">
          <span className="text-[12px] font-bold uppercase tracking-wider">Critical budget alert</span>
          <span className="text-[11px] ml-2">You've used {pct.toFixed(1)}% of your monthly budget. Only {formatCost(remaining)} remaining.</span>
        </div>
        <Chip variant="rust" pulse>CRITICAL</Chip>
      </div>
    )
  }

  if (pct >= 80) {
    return (
      <div className="flex items-center gap-3 px-4 py-3 rounded-2xl border border-amber/30 bg-amber/10 text-amber shadow-[0_4px_24px_rgba(224,144,64,0.12)]">
        <span className="w-5 h-5 rounded-full bg-amber/20 flex items-center justify-center flex-shrink-0">
          <AlertTriangle size={11} />
        </span>
        <div className="flex-1 min-w-0">
          <span className="text-[12px] font-bold uppercase tracking-wider">Budget warning</span>
          <span className="text-[11px] ml-2">You've used {pct.toFixed(1)}% of your monthly budget. {formatCost(remaining)} remaining.</span>
        </div>
        <Chip variant="warn" pulse>WARNING</Chip>
      </div>
    )
  }

  return null
}

// ─── Budget Bar ────────────────────────────────────────────────────────────────

function BudgetBar({ cost_month, budget }) {
  if (cost_month == null || budget == null || budget <= 0) return null

  const pct = Math.min((cost_month / budget) * 100, 100)
  const isWarning = pct >= 80
  const isCritical = pct >= 95

  const barColor = isCritical ? '#ef4444' : isWarning ? '#e09040' : '#00b478'
  const glowColor = isCritical ? 'rgba(239,68,68,0.4)' : isWarning ? 'rgba(224,144,64,0.35)' : 'rgba(0,180,120,0.3)'

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-t3 uppercase tracking-widest">Monthly budget</span>
        <span className="font-mono font-bold" style={{ color: barColor }}>
          {formatCost(cost_month)} <span className="text-t3 font-normal">/ {formatCost(budget)}</span>
        </span>
      </div>
      <div className="relative h-2.5 rounded-full bg-surface2 overflow-hidden border border-white/[0.05]">
        <div
          className="absolute left-0 top-0 h-full rounded-full transition-all duration-700 ease-out"
          style={{
            width: `${pct}%`,
            background: `linear-gradient(90deg, ${barColor}cc, ${barColor})`,
            boxShadow: `0 0 12px ${glowColor}`,
          }}
        />
        {/* Threshold markers */}
        <div className="absolute left-[80%] top-0 bottom-0 w-px bg-white/20" title="80% warning" />
        <div className="absolute left-[95%] top-0 bottom-0 w-px bg-white/15" title="95% critical" />
      </div>
      <div className="flex justify-between text-[9px] text-t3 uppercase tracking-widest">
        <span>spent</span>
        <span>{pct.toFixed(1)}%</span>
        <span>remaining: {formatCost(Math.max(0, budget - cost_month))}</span>
      </div>
    </div>
  )
}

// ─── Daily Cost Area Chart ────────────────────────────────────────────────────

const axisTick = { fontSize: 9, fill: '#52556a' }
const chartTooltipStyle = {
  background: '#0d0f17',
  border: '1px solid #111318',
  borderRadius: 10,
  fontSize: 11,
  color: '#d8d8e0',
  boxShadow: '0 12px 40px rgba(0, 0, 0, 0.35)',
}

function ChartTooltip({ active, label, payload }) {
  if (!active || !payload?.length) return null
  return (
    <div style={chartTooltipStyle} className="px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-[0.16em] text-t3 mb-1">{label}</div>
      <div className="font-mono text-sm font-bold text-blue">{formatCost(payload[0]?.value ?? 0)}</div>
    </div>
  )
}

function DailyCostChart({ daily_costs, budget }) {
  const series = Array.isArray(daily_costs)
    ? daily_costs
        .filter((e) => e && Number.isFinite(Number(e.cost)))
        .map((e) => ({ date: formatDate(e.date ?? e.day), cost: Number(e.cost), tokens: Number(e.tokens ?? 0) }))
    : []

  if (!series.length) return <div className="h-48 skeleton rounded-xl" />

  const gradientId = React.useId().replace(/:/g, '')
  const avg = series.reduce((s, e) => s + e.cost, 0) / series.length
  const peak = Math.max(...series.map((e) => e.cost))
  const yMax = Math.max(avg * 1.5, peak * 1.1, 0.01)

  const budgetLine = budget != null && budget > 0 ? budget / 30 : null // daily budget equivalent

  return (
    <div className="rounded-xl border border-white/[0.04] bg-surface2/60 p-4">
      <div className="h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={series} margin={{ top: 8, right: 4, bottom: 0, left: -16 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#4a80c8" stopOpacity={0.35} />
                <stop offset="60%" stopColor="#4a80c8" stopOpacity={0.12} />
                <stop offset="100%" stopColor="#4a80c8" stopOpacity={0} />
              </linearGradient>
              <linearGradient id={`${gradientId}tokens`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#00b478" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#00b478" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
            <XAxis dataKey="date" tick={axisTick} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={40} />
            <YAxis tick={axisTick} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v.toFixed(2)}`} domain={[0, yMax]} />
            {budgetLine && (
              <ReferenceLine
                y={budgetLine}
                stroke="#e09040"
                strokeDasharray="5 4"
                strokeOpacity={0.6}
                label={{ value: 'avg budget/day', position: 'insideTopRight', fill: '#e09040', fontSize: 8 }}
              />
            )}
            <ReferenceLine y={avg} stroke="#4a80c8" strokeDasharray="3 3" strokeOpacity={0.3} />
            <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'rgba(74,128,200,0.3)', strokeWidth: 1, strokeDasharray: '3 3' }} />
            <Area type="monotone" dataKey="cost" stroke="#4a80c8" strokeWidth={2} fill={`url(#${gradientId})`} dot={false} activeDot={{ r: 4, fill: '#74a6f5', stroke: '#0d0f17', strokeWidth: 2 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3 flex items-center gap-4 text-[9px] uppercase tracking-widest text-t3">
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-px bg-blue inline-block" /> Cost per day
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-px bg-white/30 border-t border-dashed border-white/30 inline-block" /> Avg: {formatCost(avg)}
        </span>
        {budgetLine && (
          <span className="flex items-center gap-1.5">
            <span className="w-4 h-px bg-amber border-t border-dashed border-amber/60 inline-block" /> Budget/day: {formatCost(budgetLine)}
          </span>
        )}
      </div>
    </div>
  )
}

// ─── Model Breakdown Table ────────────────────────────────────────────────────

function ModelBreakdown({ models }) {
  if (!Array.isArray(models) || models.length === 0) {
    return (
      <div className="py-6 text-center text-[12px] text-t3">
        No model usage data available
      </div>
    )
  }

  return (
    <div className="overflow-x-auto -mx-5 px-5">
      <table className="w-full text-[11px]">
        <thead>
          <tr className="border-b border-white/[0.05]">
            <th className="text-left pb-2.5 text-[9px] uppercase tracking-widest text-t3 font-semibold">Model</th>
            <th className="text-right pb-2.5 text-[9px] uppercase tracking-widest text-t3 font-semibold">$/1M In</th>
            <th className="text-right pb-2.5 text-[9px] uppercase tracking-widest text-t3 font-semibold">$/1M Out</th>
            <th className="text-right pb-2.5 text-[9px] uppercase tracking-widest text-t3 font-semibold">Sessions</th>
            <th className="text-right pb-2.5 text-[9px] uppercase tracking-widest text-t3 font-semibold">Est. Cost</th>
          </tr>
        </thead>
        <tbody>
          {models.map((m, i) => {
            const inputCost = Number(m.cost_per_1k_input ?? 0) * (m.input_tokens ?? 0) / 1_000_000
            const outputCost = Number(m.cost_per_1k_output ?? 0) * (m.output_tokens ?? 0) / 1_000_000
            const totalCost = inputCost + outputCost
            return (
              <tr key={m.name ?? i} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] transition-colors">
                <td className="py-2.5 pr-3">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue flex-shrink-0" />
                    <span className="font-mono font-medium text-t1 truncate max-w-[140px] block">{m.name ?? 'Unknown'}</span>
                  </span>
                </td>
                <td className="py-2.5 text-right font-mono text-t2">${(Number(m.cost_per_1k_input ?? 0)).toFixed(2)}</td>
                <td className="py-2.5 text-right font-mono text-t2">${(Number(m.cost_per_1k_output ?? 0)).toFixed(2)}</td>
                <td className="py-2.5 text-right font-mono text-t2">{m.usage_count ?? 0}</td>
                <td className="py-2.5 text-right font-mono font-bold text-blue">{formatCost(totalCost)}</td>
              </tr>
            )
          })}
        </tbody>
        {models.length > 1 && (
          <tfoot>
            <tr className="border-t border-white/[0.06]">
              <td colSpan={4} className="pt-2.5 text-[9px] uppercase tracking-widest text-t3 text-right pr-3">Total estimated</td>
              <td className="pt-2.5 text-right font-mono font-bold text-rust">
                {formatCost(
                  models.reduce((sum, m) => {
                    const ic = Number(m.cost_per_1k_input ?? 0) * (m.input_tokens ?? 0) / 1_000_000
                    const oc = Number(m.cost_per_1k_output ?? 0) * (m.output_tokens ?? 0) / 1_000_000
                    return sum + ic + oc
                  }, 0)
                )}
              </td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  )
}

// ─── Token Split Bar ──────────────────────────────────────────────────────────

function TokenSplitBar({ input_tokens, output_tokens }) {
  const total = (input_tokens ?? 0) + (output_tokens ?? 0)
  const inputPct = total > 0 ? (input_tokens / total) * 100 : 50
  const outputPct = total > 0 ? (output_tokens / total) * 100 : 50

  if (total === 0) {
    return (
      <div className="py-4 text-center text-[12px] text-t3">No token data available</div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Visual bar */}
      <div className="relative h-6 rounded-lg overflow-hidden border border-white/[0.05] flex">
        <div
          className="flex items-center justify-center text-[9px] font-bold font-mono text-white/80 transition-all duration-700"
          style={{ width: `${inputPct}%`, background: 'linear-gradient(90deg, #4a80c8, #74a6f5)' }}
        >
          {inputPct > 12 ? `${inputPct.toFixed(1)}%` : ''}
        </div>
        <div
          className="flex items-center justify-center text-[9px] font-bold font-mono text-white/80 transition-all duration-700"
          style={{ width: `${outputPct}%`, background: 'linear-gradient(90deg, #00b478, #00d090)' }}
        >
          {outputPct > 12 ? `${outputPct.toFixed(1)}%` : ''}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-sm bg-blue" />
          <span className="text-[10px] text-t3">Input</span>
          <span className="font-mono text-[11px] font-bold text-t1">{formatTokens(input_tokens ?? 0)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-[11px] font-bold text-t1">{formatTokens(output_tokens ?? 0)}</span>
          <span className="text-[10px] text-t3">Output</span>
          <span className="w-2 h-2 rounded-sm bg-green" />
        </div>
      </div>

      <div className="text-center text-[10px] text-t3">
        Total: <span className="font-mono font-bold text-t2">{formatTokens(total)}</span> tokens
      </div>
    </div>
  )
}

// ─── Monthly Trend Stats ──────────────────────────────────────────────────────

function TrendStats({ daily_costs }) {
  const series = Array.isArray(daily_costs)
    ? daily_costs.filter((e) => e && Number.isFinite(Number(e.cost))).map((e) => Number(e.cost))
    : []

  if (series.length < 2) return null

  const total = series.reduce((a, b) => a + b, 0)
  const avg = total / series.length
  const peak = Math.max(...series)
  const trough = Math.min(...series)
  const last = series[series.length - 1]
  const first = series[0]
  const trend = first > 0 ? ((last - first) / first) * 100 : 0

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      {[
        { label: 'Daily avg', value: formatCost(avg), color: 'text-blue' },
        { label: 'Peak day', value: formatCost(peak), color: 'text-rust' },
        { label: 'Lowest day', value: formatCost(trough), color: 'text-green' },
        {
          label: 'Trend',
          value: `${trend >= 0 ? '+' : ''}${trend.toFixed(1)}%`,
          color: trend > 5 ? 'text-rust' : trend < -5 ? 'text-green' : 'text-t2',
          icon: trend >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />,
        },
      ].map(({ label, value, color, icon }) => (
        <div key={label} className="rounded-xl border border-white/[0.05] bg-surface2/40 p-2.5 text-center">
          <div className="text-[9px] uppercase tracking-widest text-t3 mb-1">{label}</div>
          <div className={clsx('font-mono text-[13px] font-bold flex items-center justify-center gap-1', color)}>
            {icon}
            {value}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── CostPage ─────────────────────────────────────────────────────────────────

export function CostPage() {
  const { data: stats, loading: statsLoading } = usePoll('/stats', 15000)
  const { data: modelsData, loading: modelsLoading } = usePoll('/models', 30000)

  const cost_month = stats?.cost_month
  const budget = stats?.budget != null ? Number(stats.budget) : null
  const daily_costs = stats?.daily_costs ?? []
  const sessions_today = stats?.sessions_today
  const tokens_today = stats?.tokens_today
  const models = modelsData?.models ?? []

  // Aggregate tokens from models
  const totalInputTokens = models.reduce((s, m) => s + (m.input_tokens ?? 0), 0)
  const totalOutputTokens = models.reduce((s, m) => s + (m.output_tokens ?? 0), 0)

  // Days remaining in month
  const now = new Date()
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const daysRemaining = daysInMonth - now.getDate()

  const budgetPct = budget != null && budget > 0 && cost_month != null ? (cost_month / budget) * 100 : null
  const dailyBurnRate = daysRemaining > 0 && cost_month != null ? cost_month / (daysInMonth - daysRemaining + 1) : null
  const projectedTotal = dailyBurnRate != null && daysRemaining > 0 ? dailyBurnRate * daysInMonth : null

  const alert = budgetPct != null && budget != null ? (
    <BudgetAlert cost_month={cost_month} budget={budget} />
  ) : null

  return (
    <div className="relative isolate max-w-6xl min-w-0 space-y-5 pb-8">
      {/* Ambient background glows */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-20 right-12 h-64 w-64 rounded-full bg-blue/8 blur-3xl" />
        <div className="absolute top-40 left-[-4rem] h-56 w-56 rounded-full bg-rust/8 blur-3xl" />
      </div>

      {/* Hero header */}
      <section className="relative overflow-hidden rounded-[28px] border border-white/[0.07] bg-[linear-gradient(180deg,rgba(10,11,16,0.96),rgba(10,11,16,0.88))] shadow-[0_30px_80px_rgba(0,0,0,0.45)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(74,128,200,0.18),transparent_38%),radial-gradient(circle_at_bottom_left,rgba(224,95,64,0.12),transparent_35%)]" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        <div className="relative z-10 p-5 sm:p-6 lg:p-7">
          <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-[0.28em] text-t3 mb-4">
            <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-t2">Cost &amp; Token Tracker</span>
            <span className="rounded-full border border-blue/20 bg-blue/10 px-2.5 py-1 text-blue flex items-center gap-1.5">
              <DollarSign size={9} />
              Budget monitoring
            </span>
          </div>

          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3 flex-1 min-w-0">
              <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-t1">
                Cost &amp; Tokens
              </h1>
              <p className="max-w-xl text-sm leading-7 text-t2">
                Real-time cost and token usage monitoring. Track your monthly spend against budget, analyze daily patterns, and understand per-model consumption.
              </p>
              {alert && <div className="mt-1">{alert}</div>}
            </div>

            {/* Quick stats badge */}
            <div className="flex flex-wrap gap-2 lg:flex-col lg:items-end lg:gap-2">
              {budgetPct != null && budget != null && (
                <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5">
                  <span className="text-[10px] uppercase tracking-widest text-t3">Used</span>
                  <span className={clsx(
                    'font-mono text-[13px] font-bold',
                    budgetPct >= 95 ? 'text-red' : budgetPct >= 80 ? 'text-amber' : 'text-green'
                  )}>
                    {budgetPct.toFixed(1)}%
                  </span>
                </div>
              )}
              {daysRemaining > 0 && (
                <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5">
                  <span className="text-[10px] uppercase tracking-widest text-t3">Days left</span>
                  <span className="font-mono text-[13px] font-bold text-t1">{daysRemaining}</span>
                </div>
              )}
              {projectedTotal != null && budget != null && (
                <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5">
                  <span className="text-[10px] uppercase tracking-widest text-t3">Projected</span>
                  <span className={clsx(
                    'font-mono text-[13px] font-bold',
                    projectedTotal > budget ? 'text-red' : 'text-green'
                  )}>
                    {formatCost(projectedTotal)}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Metric cards */}
      <div className="grid grid-cols-2 min-[560px]:grid-cols-4 gap-3">
        {statsLoading ? (
          Array.from({ length: 4 }, (_, i) => <SkeletonCard key={i} />)
        ) : (
          <>
            <MetricCard
              label="Monthly cost"
              value={cost_month != null ? formatCost(cost_month) : '—'}
              sub={budget != null ? `budget ${formatCost(budget)}` : 'No budget set'}
              accent="blue"
              valueColor="text-blue"
            />
            <MetricCard
              label="Sessions today"
              value={sessions_today ?? '—'}
              sub={`${stats?.sessions_week ?? '—'} this week`}
              accent="rust"
              valueColor="text-rust"
            />
            <MetricCard
              label="Tokens today (est.)"
              value={tokens_today != null ? formatTokens(tokens_today) : '—'}
              sub="estimated at ~4 chars/token"
              accent="rust"
              valueColor="text-rust"
            />
            <MetricCard
              label="Daily burn rate"
              value={dailyBurnRate != null ? formatCost(dailyBurnRate) : '—'}
              sub={daysRemaining > 0 ? `${daysRemaining} days remaining` : 'Month ending'}
              accent="amber"
              valueColor="text-amber"
            />
          </>
        )}
      </div>

      {/* Budget bar section */}
      {budget != null && (
        <SectionCard title="Budget Overview" icon={DollarSign} iconColor="text-blue" accent="#4a80c8">
          <BudgetBar cost_month={cost_month} budget={budget} />
        </SectionCard>
      )}

      {/* Daily cost chart */}
      <SectionCard title="Daily Cost — Last 30 Days" icon={Zap} iconColor="text-blue" accent="#4a80c8">
        <DailyCostChart daily_costs={daily_costs} budget={budget} />
        <div className="mt-4">
          <TrendStats daily_costs={daily_costs} />
        </div>
      </SectionCard>

      {/* Model breakdown + Token split — side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <SectionCard title="Model Breakdown" icon={Layers} iconColor="text-green" accent="#00b478">
          {modelsLoading ? (
            <div className="py-4 space-y-3">
              {Array.from({ length: 3 }, (_, i) => (
                <div key={i} className="flex justify-between items-center py-2">
                  <div className="skeleton h-3 w-24 rounded" />
                  <div className="skeleton h-3 w-16 rounded" />
                </div>
              ))}
            </div>
          ) : (
            <ModelBreakdown models={models} />
          )}
        </SectionCard>

        <SectionCard title="Token Split" icon={Coins} iconColor="text-amber" accent="#e09040">
          {modelsLoading ? (
            <div className="py-4">
              <div className="skeleton h-6 w-full rounded-lg mb-3" />
              <div className="skeleton h-3 w-1/2 rounded" />
            </div>
          ) : (
            <TokenSplitBar input_tokens={totalInputTokens} output_tokens={totalOutputTokens} />
          )}

          <div className="mt-4 pt-4 border-t border-white/[0.05]">
            <PagePrimer
              title="Token estimation"
              body="Token counts are estimated using ~4 characters per token. Actual provider counts may differ slightly."
            />
          </div>
        </SectionCard>
      </div>

      {/* Info footer */}
      <div className="text-center text-[10px] text-t3 uppercase tracking-widest">
        Costs are model-based estimates · Actual billing from your AI provider may vary
      </div>
    </div>
  )
}
