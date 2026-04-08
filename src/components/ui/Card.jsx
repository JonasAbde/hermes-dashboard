import React from 'react'
import { clsx } from 'clsx'

export function Card({ accent, className, children }) {
  return (
    <div className={clsx(
      'relative overflow-hidden rounded-[22px] border border-white/[0.07] bg-[linear-gradient(180deg,rgba(13,15,23,0.96),rgba(10,11,16,0.92))] shadow-[0_20px_50px_rgba(0,0,0,0.22)]',
      accent && `card-${accent}`,
      className
    )}>
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),transparent_24%)]" />
      {children}
    </div>
  )
}

export function MetricCard({ label, value, sub, accent, valueColor, className }) {
  const accentDot = accent === 'rust'
    ? 'bg-rust'
    : accent === 'green'
      ? 'bg-green'
      : accent === 'amber'
        ? 'bg-amber'
        : accent === 'blue'
          ? 'bg-blue'
          : 'bg-t3'

  return (
    <Card
      accent={accent}
      className={clsx(
        'transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-[0_22px_46px_rgba(0,0,0,0.28)]',
        className,
      )}
    >
      <div className="relative p-4">
        <div className="absolute inset-x-4 top-0 h-px bg-white/[0.06]" />
        <div className="flex items-start justify-between gap-3 mb-1.5">
          <div className="text-[9px] font-bold uppercase tracking-[0.24em] text-t3">{label}</div>
          <span className={clsx('mt-0.5 h-2 w-2 rounded-full shadow-[0_0_12px_currentColor]', accentDot)} />
        </div>
        <div className="absolute left-0 top-4 h-[calc(100%-2rem)] w-0.5 rounded-full bg-white/8" />
        <div className={clsx('text-2xl font-extrabold tracking-tight mb-1', valueColor)}>{value}</div>
        {sub && <div className="text-[11px] text-t3 leading-relaxed">{sub}</div>}
      </div>
    </Card>
  )
}

export function SkeletonCard() {
  return (
    <Card className="p-4">
      <div className="skeleton h-2 w-1/2 mb-3" />
      <div className="skeleton h-6 w-2/3 mb-2" />
      <div className="skeleton h-2 w-1/3" />
    </Card>
  )
}
