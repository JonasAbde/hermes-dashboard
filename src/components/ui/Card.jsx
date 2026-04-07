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

export function MetricCard({ label, value, sub, accent, valueColor }) {
  return (
    <Card accent={accent}>
      <div className="p-4">
        <div className="text-[9px] font-bold uppercase tracking-widest text-t3 mb-1.5">{label}</div>
        <div className={clsx('text-2xl font-extrabold tracking-tight mb-1', valueColor)}>{value}</div>
        {sub && <div className="text-[11px] text-t3">{sub}</div>}
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
