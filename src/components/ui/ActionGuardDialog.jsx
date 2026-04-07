import { AlertTriangle, ShieldAlert } from 'lucide-react'
import { clsx } from 'clsx'

const toneStyles = {
  danger: {
    icon: ShieldAlert,
    iconColor: 'text-rust',
    badge: 'bg-rust/10 border-rust/20 text-rust',
    confirm: 'bg-rust text-white hover:brightness-110',
  },
  warn: {
    icon: AlertTriangle,
    iconColor: 'text-amber',
    badge: 'bg-amber/10 border-amber/20 text-amber',
    confirm: 'bg-amber text-bg hover:brightness-110',
  },
}

export function ActionGuardDialog({ guard, pending = false, onConfirm, onCancel }) {
  if (!guard) return null

  const tone = toneStyles[guard.severity] || toneStyles.warn
  const Icon = tone.icon

  return (
    <>
      <div className="fixed inset-0 z-[120] bg-black/65 backdrop-blur-sm" onClick={pending ? undefined : onCancel} />
      <div className="fixed inset-x-4 top-1/2 z-[121] mx-auto w-auto max-w-md -translate-y-1/2 rounded-2xl border border-border bg-surface shadow-[0_24px_80px_rgba(0,0,0,0.7)]">
        <div className="border-b border-border px-5 py-4">
          <div className="flex items-start gap-3">
            <div className={clsx('mt-0.5 rounded-xl border p-2', tone.badge)}>
              <Icon size={15} className={tone.iconColor} />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold text-t1">{guard.title}</div>
              <div className={clsx('mt-1 inline-flex rounded-full border px-2 py-0.5 text-[9px] font-mono uppercase tracking-wider', tone.badge)}>
                {guard.severity === 'danger' ? 'High impact' : 'Operator check'}
              </div>
            </div>
          </div>
        </div>
        <div className="space-y-3 px-5 py-4">
          <p className="text-[12px] leading-relaxed text-t2">{guard.description}</p>
          {guard.consequence && (
            <div className="rounded-xl border border-border bg-surface2/60 px-3 py-2.5">
              <div className="text-[10px] font-bold uppercase tracking-widest text-t3">Consequence</div>
              <div className="mt-1 text-[11px] leading-relaxed text-t2">{guard.consequence}</div>
            </div>
          )}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-4">
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="rounded-lg border border-border px-3 py-2 text-[11px] font-semibold text-t2 hover:bg-surface2 hover:text-t1 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className={clsx('rounded-lg px-3 py-2 text-[11px] font-bold transition-colors disabled:opacity-60 disabled:cursor-wait', tone.confirm)}
          >
            {pending ? 'Working...' : guard.confirmLabel || 'Confirm'}
          </button>
        </div>
      </div>
    </>
  )
}
