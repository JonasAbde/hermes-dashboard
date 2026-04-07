import { clsx } from 'clsx'

const variantStyles = {
  online:  { background: 'rgba(0,180,120,0.12)',  color: '#00b478', border: '1px solid rgba(0,180,120,0.25)',   dot: '#00b478', dotShadow: '0 0 4px #00b478', dotAnim: 'pulse' },
  offline: { background: 'rgba(239,68,68,0.10)',  color: '#ef4444', border: '1px solid rgba(239,68,68,0.20)',   dot: '#ef4444', dotShadow: 'none',              dotAnim: '' },
  pending: { background: 'rgba(224,144,64,0.12)', color: '#e09040', border: '1px solid rgba(224,144,64,0.25)',  dot: '#e09040', dotShadow: 'none',              dotAnim: 'pulse-fast' },
  model:   { background: 'var(--surface2)',        color: 'var(--t2)', border: '1px solid var(--border)',       dot: null },
  cost:    { background: 'rgba(74,128,200,0.12)',  color: '#4a80c8', border: '1px solid rgba(74,128,200,0.20)', dot: null },
  warn:    { background: 'rgba(224,144,64,0.12)', color: '#e09040', border: '1px solid rgba(224,144,64,0.25)',  dot: '#e09040', dotShadow: 'none',              dotAnim: 'pulse-fast' },
  rust:    { background: 'rgba(224,95,64,0.12)',  color: '#e05f40', border: '1px solid rgba(224,95,64,0.20)',   dot: '#e05f40', dotShadow: '0 0 4px #e05f40',  dotAnim: 'pulse' },
}

export function Chip({ variant = 'model', pulse, children, className }) {
  const s = variantStyles[variant] ?? variantStyles.model
  return (
    <span
      className={clsx('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full font-mono text-[11px] font-semibold max-w-full min-w-0 whitespace-nowrap', className)}
      style={{ background: s.background, color: s.color, border: s.border }}
    >
      {pulse && s.dot && (
        <span
          className={clsx('w-1.5 h-1.5 rounded-full flex-shrink-0', s.dotAnim)}
          style={{ background: s.dot, boxShadow: s.dotShadow }}
        />
      )}
      {children}
    </span>
  )
}
