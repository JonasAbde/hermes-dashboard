import { clsx } from 'clsx'

export function Card({ accent, className, children }) {
  return (
    <div className={clsx(
      'bg-surface border border-border rounded-lg overflow-hidden relative',
      accent && `card-${accent}`,
      className
    )}>
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
        'transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_40px_rgba(0,0,0,0.28)]',
        className,
      )}
    >
      <div className="relative p-4">
        <div className="absolute inset-x-4 top-0 h-px bg-white/[0.04]" />
        <div className="flex items-start justify-between gap-3 mb-1.5">
          <div className="text-[9px] font-bold uppercase tracking-[0.24em] text-t3">{label}</div>
          <span className={clsx('mt-0.5 h-2 w-2 rounded-full shadow-[0_0_12px_currentColor]', accentDot)} />
        </div>
        <div className={clsx('text-2xl font-extrabold tracking-tight mb-1', valueColor)}>{value}</div>
        {sub && <div className="text-[11px] text-t3 leading-relaxed">{sub}</div>}
      </div>
    </Card>
  )
}

export function SkeletonCard() {
  return (
    <div className="bg-surface border border-border rounded-lg p-4">
      <div className="skeleton h-2 w-1/2 mb-3" />
      <div className="skeleton h-6 w-2/3 mb-2" />
      <div className="skeleton h-2 w-1/3" />
    </div>
  )
}
