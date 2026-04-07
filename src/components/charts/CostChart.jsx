import React from 'react'
import { BarChart, Bar, ResponsiveContainer, Tooltip, XAxis } from 'recharts'

export function CostChart({ data }) {
  if (!data?.length) return <div className="h-16 skeleton rounded" />
  return (
    <ResponsiveContainer width="100%" height={64}>
      <BarChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }} barSize={6}>
        <XAxis dataKey="day" tick={{ fontSize: 8, fill: '#2a2b38' }} axisLine={false} tickLine={false} />
        <Bar dataKey="cost" fill="#4a80c8" radius={[2, 2, 0, 0]} />
        <Tooltip
          contentStyle={{ background: '#0d0f17', border: '1px solid #111318', borderRadius: 6, fontSize: 11, color: '#d8d8e0' }}
          formatter={(v) => [`$${v.toFixed(4)}`, '']}
        />
      </BarChart>
    </ResponsiveContainer>
  )
}
