import React from 'react'
import { AreaChart, Area, ReferenceLine, ResponsiveContainer, Tooltip, YAxis } from 'recharts'

const tooltipStyle = {
  background: '#0d0f17',
  border: '1px solid #111318',
  borderRadius: 10,
  fontSize: 11,
  color: '#d8d8e0',
  boxShadow: '0 12px 40px rgba(0, 0, 0, 0.3)',
}

function EkgTooltip({ active, payload }) {
  if (!active || !payload?.length) return null

  const value = Number(payload[0]?.value || 0)

  return (
    <div style={tooltipStyle}>
      <div className="text-[10px] uppercase tracking-[0.16em] text-t3">live sample</div>
      <div className="mt-1 font-mono text-sm font-bold text-green">{value.toLocaleString()} tok</div>
    </div>
  )
}

export function EkgChart({ data }) {
  const series = Array.isArray(data)
    ? data.filter((entry) => entry && Number.isFinite(Number(entry.tokens))).map((entry) => ({
      ...entry,
      tokens: Number(entry.tokens),
    }))
    : []

  if (!series.length) return <div className="h-20 skeleton rounded-xl" />

  const latest = series[series.length - 1]
  const average = series.reduce((sum, entry) => sum + entry.tokens, 0) / series.length
  const peak = series.reduce((max, entry) => Math.max(max, entry.tokens), 0)
  const gradientId = React.useId().replace(/:/g, '')
  const yDomainTop = Math.max(average, peak, 1) * 1.18

  return (
    <div className="p-3 sm:p-4">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        <div className="min-w-0">
          <div className="text-xs font-bold text-t2 sm:text-[11px]">Live Heartbeat EKG</div>
          <div className="flex items-center gap-2 text-[10px] text-t3 sm:text-[11px]">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green shadow-[0_0_5px_#00b478] pulse inline-block" />
              live
            </span>
            <span className="hidden sm:inline">·</span>
            <span>estimeret rytme</span>
          </div>
        </div>
        <div className="flex items-baseline justify-between gap-2 sm:ml-auto sm:flex-col sm:items-end sm:justify-start sm:gap-0.5">
          <div className="font-mono text-[11px] font-bold text-t2 sm:text-sm">{latest.tokens.toLocaleString()} tok</div>
          <div className="text-[10px] text-t3 sm:text-right">snit {Math.round(average).toLocaleString()} tok</div>
        </div>
      </div>

      <div className="rounded-xl border border-white/[0.04] bg-[#0d0f17]/70 px-2 py-2 sm:px-3">
        <div className="h-[72px] sm:h-[88px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series} margin={{ top: 6, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00b478" stopOpacity={0.28} />
                  <stop offset="100%" stopColor="#00b478" stopOpacity={0} />
                </linearGradient>
              </defs>
              <YAxis hide domain={[0, yDomainTop]} />
              <ReferenceLine y={average} stroke="#00b478" strokeDasharray="3 3" strokeOpacity={0.25} />
              <Area type="monotone" dataKey="tokens" stroke="#00b478" strokeWidth={1.5} fill={`url(#${gradientId})`} dot={false} />
              <Tooltip content={<EkgTooltip />} cursor={{ fill: 'rgba(0, 180, 120, 0.08)' }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="mt-2 flex flex-col gap-1 text-[10px] uppercase tracking-[0.14em] text-t3 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <span>Snit {Math.round(average).toLocaleString()} tok</span>
        <span className="sm:text-right">Live feed · sidste {series.length} samples</span>
      </div>
    </div>
  )
}
