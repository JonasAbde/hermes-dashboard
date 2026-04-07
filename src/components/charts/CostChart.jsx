import React from 'react'
import { BarChart, Bar, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

const axisTick = { fontSize: 8, fill: '#52556a' }
const tooltipStyle = {
  background: '#0d0f17',
  border: '1px solid #111318',
  borderRadius: 10,
  fontSize: 11,
  color: '#d8d8e0',
  boxShadow: '0 12px 40px rgba(0, 0, 0, 0.3)',
}

function formatUsd(value) {
  const numericValue = Number(value || 0)
  return `$${numericValue.toFixed(numericValue < 1 ? 4 : 2)}`
}

function CostTooltip({ active, label, payload }) {
  if (!active || !payload?.length) return null

  const value = Number(payload[0]?.value || 0)

  return (
    <div style={tooltipStyle}>
      <div className="text-[10px] uppercase tracking-[0.16em] text-t3">{label}</div>
      <div className="mt-1 font-mono text-sm font-bold text-blue">{formatUsd(value)}</div>
    </div>
  )
}

export function CostChart({ data }) {
  const series = Array.isArray(data)
    ? data.filter((entry) => entry && entry.day != null && Number.isFinite(Number(entry.cost))).map((entry) => ({
      day: entry.day,
      cost: Number(entry.cost),
    }))
    : []

  if (!series.length) return <div className="h-24 skeleton rounded-xl" />

  const latest = series[series.length - 1]
  const previous = series[series.length - 2]
  const average = series.reduce((sum, entry) => sum + entry.cost, 0) / series.length
  const peak = series.reduce((max, entry) => Math.max(max, entry.cost), 0)
  const delta = previous ? latest.cost - previous.cost : null
  const deltaLabel = delta == null
    ? 'Seneste datapunkt'
    : `${delta > 0 ? '+' : '−'}${formatUsd(Math.abs(delta)).slice(1)} fra i går`
  const trendLabel = delta == null
    ? 'Ingen trend endnu'
    : `${delta > 0 ? 'Over' : 'Under'} gårsdagens niveau`
  const gradientId = React.useId().replace(/:/g, '')
  const yDomainTop = Math.max(average, peak, 0.01) * 1.18

  return (
    <div className="p-4">
      <div className="mb-3 flex items-start gap-3">
        <div className="min-w-0">
          <div className="text-xs font-bold text-t2">Daglig omkostning</div>
          <div className="text-[11px] text-t3">Estimeret pr. dag · sidste {series.length} dage</div>
        </div>
        <div className="ml-auto text-right">
          <div className="font-mono text-sm font-bold text-blue">{formatUsd(latest.cost)}</div>
          <div className="text-[10px] text-t3">{deltaLabel}</div>
        </div>
      </div>

      <div className="rounded-xl border border-white/[0.04] bg-[#0d0f17]/70 px-2 py-2">
        <ResponsiveContainer width="100%" height={92}>
          <BarChart data={series} margin={{ top: 10, right: 0, bottom: 0, left: 0 }} barSize={12}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#74a6f5" stopOpacity={0.92} />
                <stop offset="100%" stopColor="#4a80c8" stopOpacity={0.45} />
              </linearGradient>
            </defs>
            <XAxis dataKey="day" tick={axisTick} axisLine={false} tickLine={false} />
            <YAxis hide domain={[0, yDomainTop]} />
            <ReferenceLine y={average} stroke="#74a6f5" strokeDasharray="3 3" strokeOpacity={0.32} />
            <Tooltip content={<CostTooltip />} cursor={{ fill: 'rgba(74, 128, 200, 0.08)' }} />
            <Bar dataKey="cost" radius={[6, 6, 3, 3]}>
              {series.map((entry, index) => (
                <Cell key={entry.day} fill={index === series.length - 1 ? '#74a6f5' : `url(#${gradientId})`} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-2 flex items-center justify-between gap-3 text-[10px] uppercase tracking-[0.14em] text-t3">
        <span>Snit {formatUsd(average)}</span>
        <span>{trendLabel}</span>
      </div>
    </div>
  )
}
