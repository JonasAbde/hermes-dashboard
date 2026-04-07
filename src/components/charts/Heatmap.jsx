import React from 'react'

export function Heatmap({ data }) {
  if (!data) return <div className="h-20 skeleton rounded" />
  const days = ['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn']
  const peak = Math.max(
    1,
    ...(Array.isArray(data)
      ? data.flatMap((day) => (Array.isArray(day) ? day : []))
      : []),
  )

  return (
    <div className="space-y-2">
      <div className="safe-scroll-x">
        <div className="grid gap-0.5 min-w-[540px]" style={{ gridTemplateColumns: '28px repeat(24, 1fr)' }}>
          {days.map((d, di) => (
            <React.Fragment key={di}>
              <div className="text-[8px] text-t3 font-mono flex items-center justify-end pr-1.5">{d}</div>
              {Array.from({ length: 24 }, (_, h) => {
                const v = data?.[di]?.[h] ?? 0
                const intensity = Math.min(v / peak, 1)
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
      </div>
      <div className="flex flex-wrap items-center gap-2 font-mono text-[9px] text-t3">
        Aktivitet:
        <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: 'rgba(224,95,64,0.06)' }} /> lav
        <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: 'rgba(224,95,64,0.4)' }} /> middel
        <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: 'rgba(224,95,64,0.86)' }} /> høj
      </div>
    </div>
  )
}
