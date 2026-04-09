import { useState } from 'react'
import { clsx } from 'clsx'
import { ActionGuardDialog } from './ui/ActionGuardDialog'
import { getActionGuardrail } from '../utils/actionGuardrails'
import { apiFetch } from '../utils/auth'
import { HermesAvatar, rhythmToVariant } from './avatar/HermesAvatar'

const rhythms = [
  { id: 'hibernation', label: 'Hibernation', color: 'text-blue', bg: 'bg-blue/10', border: 'border-blue/20' },
  { id: 'steady',      label: 'Steady',      color: 'text-green', bg: 'bg-green/10', border: 'border-green/20' },
  { id: 'deep_focus',  label: 'Deep Focus',  color: 'text-amber', bg: 'bg-amber/10', border: 'border-amber/20' },
  { id: 'high_burst',  label: 'High Burst',  color: 'text-rust', bg: 'bg-rust/10', border: 'border-rust/20' },
]

export function NeuralShift({ current, onShift }) {
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [guard, setGuard] = useState(null)

  const currentVariant = current ? rhythmToVariant(current) : 'default'

  const handleShiftClick = (id) => {
    if (id === current) return
    const g = getActionGuardrail('AGENT_RHYTHM_SHIFT', { from: current, to: id })
    if (g) {
      setGuard({ id, ...g })
      return
    }
    performShift(id)
  }

  const performShift = async (id) => {
    setLoading(true)
    setFeedback(null)
    try {
      const res = await apiFetch('/api/agent/rhythm', {
        method: 'POST',
        body: JSON.stringify({ rhythm: id })
      })
      if (res.ok) {
        onShift(id)
        setFeedback({ ok: true, message: `Rhythm shifted to ${id}` })
      } else {
        const err = await res.json()
        setFeedback({ ok: false, message: err.error || 'Shift failed' })
      }
    } catch (e) {
      const msg = e.message || ''
      const neutral = /unavailable|network|fetch|failed/i.test(msg)
        ? 'Agent unavailable — will retry on next cycle'
        : 'Network error — please try again'
      setFeedback({ ok: false, message: neutral })
    } finally {
      setLoading(false)
      setTimeout(() => setFeedback(null), 3000)
    }
  }

  return (
    <>
      <div className="bg-surface border border-border rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HermesAvatar variant={currentVariant} size={20} statusDot />
            <span className="text-xs font-bold text-t2 uppercase tracking-wider">Neural Rhythm</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-rust animate-pulse shadow-[0_0_5px_#e63946]" />
            <span className="font-mono text-[9px] text-rust uppercase">Sync Active</span>
          </div>
        </div>

        <div className="p-3 grid grid-cols-1 min-[420px]:grid-cols-2 gap-2">
          {rhythms.map((r) => {
            const isActive = current === r.id
            const variant = rhythmToVariant(r.id)

            return (
              <button
                key={r.id}
                onClick={() => handleShiftClick(r.id)}
                disabled={loading}
                className={clsx(
                  'flex flex-col items-center justify-center p-3 rounded-lg border transition-all duration-200 group relative overflow-hidden',
                  isActive
                    ? `${r.bg} ${r.border} ${r.color} shadow-sm`
                    : 'bg-surface2 border-transparent text-t3 hover:text-t2 hover:border-border',
                  loading && !isActive && 'opacity-60 cursor-wait'
                )}
              >
                {isActive && (
                  <div className="absolute inset-0 opacity-10 bg-gradient-to-br from-current to-transparent" />
                )}
                <HermesAvatar
                  variant={variant}
                  size={28}
                  pulse={isActive}
                  className="mb-1.5"
                />
                <span className="text-[10px] font-bold uppercase tracking-tight">{r.label}</span>

                {isActive && (
                  <div className="absolute top-1 right-1">
                    <div className={clsx('w-1 h-1 rounded-full', r.id === 'high_burst' ? 'bg-rust' : 'bg-current')} />
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {feedback && (
        <div className={clsx(
          'mt-2 px-3 py-2 rounded text-[10px] font-medium animate-in fade-in slide-in-from-top-1',
          feedback.ok ? 'bg-green/10 text-green border border-green/20' : 'bg-rust/10 text-rust border border-rust/20'
        )}>
          {feedback.message}
        </div>
      )}

      {guard && (
        <ActionGuardDialog
          open={!!guard}
          title={guard.title}
          message={guard.message}
          onConfirm={() => {
            performShift(guard.id)
            setGuard(null)
          }}
          onCancel={() => setGuard(null)}
        />
      )}
    </>
  )
}
