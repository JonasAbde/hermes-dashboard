import React from 'react'
import { AreaChart, Area, ResponsiveContainer, Tooltip } from 'recharts'

export function EkgChart({ data }) {
  if (!data?.length) return <div className="h-14 skeleton rounded" />
  return (
    <ResponsiveContainer width="100%" height={56}>
      <AreaChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="ekgGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#00b478" stopOpacity={0.25} />
            <stop offset="100%" stopColor="#00b478" stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="tokens" stroke="#00b478" strokeWidth={1.5} fill="url(#ekgGrad)" dot={false} />
        <Tooltip
          contentStyle={{ background: '#0d0f17', border: '1px solid #111318', borderRadius: 6, fontSize: 11, color: '#d8d8e0' }}
          labelFormatter={() => ''}
          formatter={(v) => [`${v.toLocaleString()} tok`, '']}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
