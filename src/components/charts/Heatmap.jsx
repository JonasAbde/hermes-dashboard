import React from 'react'

export function Heatmap({ data }) {
  if (!data) return <div className="h-20 skeleton rounded" />
  const days = ['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn']
  return (
    <div>
      <div className="grid gap-0.5" style={{ gridTemplateColumns: '28px repeat(24, 1fr)' }}>
        {days.map((d, di) => (
          <React.Fragment key={di}>
            <div className="text-[8px] text-t3 font-mono flex items-center justify-end pr-1.5">{d}</div>
            {Array.from({ length: 24 }, (_, h) => {
              const v = data?.[di]?.[h] ?? 0
              const max = 10
              const intensity = Math.min(v / max, 1)
              return (
                <div
                  key={`${di}-${h}`}
                  className="aspect-square rounded-[2px]"
                  style={{ background: `rgba(224,95,64,${0.06 + intensity * 0.8})` }}
                  title={`${d} ${h}:00 — ${v} sessions`}
                />
              )
            })}
          </React.Fragment>
        ))}
      </div>
      <div className="flex items-center gap-2 mt-2 font-mono text-[9px] text-t3">
        Aktivitet:
        <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: 'rgba(224,95,64,0.06)' }} /> lav
        <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: 'rgba(224,95,64,0.4)' }} /> middel
        <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: 'rgba(224,95,64,0.86)' }} /> høj
      </div>
    </div>
  )
}
