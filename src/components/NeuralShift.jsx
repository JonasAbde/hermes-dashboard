import { useState } from 'react'
import { clsx } from 'clsx'
import { Zap, Moon, Target, Activity } from 'lucide-react'
import { ActionGuardDialog } from './ui/ActionGuardDialog'
import { getActionGuardrail } from '../utils/actionGuardrails'
import { apiFetch } from '../utils/auth'

const rhythms = [
  { id: 'hibernation', label: 'Hibernation', icon: Moon, color: 'text-blue', bg: 'bg-blue/10', border: 'border-blue/20' },
  { id: 'steady',      label: 'Steady',      icon: Activity, color: 'text-green', bg: 'bg-green/10', border: 'border-green/20' },
  { id: 'deep_focus',  label: 'Deep Focus',  icon: Target, color: 'text-amber', bg: 'bg-amber/10', border: 'border-amber/20' },
  { id: 'high_burst',  label: 'High Burst',  icon: Zap, color: 'text-rust', bg: 'bg-rust/10', border: 'border-rust/20' },
]

export function NeuralShift({ current, onShift }) {
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [guard, setGuard] = useState(null)

  const performShift = async (id) => {
    setLoading(true)
    setFeedback(null)
    try {
      const res = await apiFetch('/api/control/neural-shift', {
        method: 'POST',
        body: JSON.stringify({ rhythm: id })
      })
      if (res.ok) {
        const rhythm = rhythms.find((item) => item.id === id)
        setFeedback({ ok: true, message: `Rhythm shifted to ${rhythm?.label || id}.` })
        onShift?.()
      } else {
        const err = await res.json().catch(() => ({}))
        setFeedback({ ok: false, message: err.error || 'Shift failed' })
      }
    } catch (e) {
      // Normalize "Backend unavailable" / network errors to a neutral message
      const msg = e.message || ''
      const neutral = /unavailable|network|fetch|failed/i.test(msg)
        ? 'Agent unavailable — will retry on next cycle'
        : msg || 'Shift failed'
      setFeedback({ ok: false, message: neutral })
    } finally {
      setLoading(false)
    }
  }

  const handleShift = async (id) => {
    if (id === current || loading) return
    const nextGuard = getActionGuardrail({ type: 'neural-shift', rhythm: id })
    if (nextGuard) {
      setGuard({ ...nextGuard, action: { type: 'neural-shift', rhythm: id } })
      return
    }
    await performShift(id)
  }

  return (
    <>
      <div className="bg-surface border border-border rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <span className="text-xs font-bold text-t2 uppercase tracking-wider">Neural Rhythm</span>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-rust animate-pulse shadow-[0_0_5px_#e63946]" />
            <span className="font-mono text-[9px] text-rust uppercase">Sync Active</span>
          </div>
        </div>
        <div className="p-3 grid grid-cols-1 min-[420px]:grid-cols-2 gap-2">
          {rhythms.map((r) => {
            const isActive = current === r.id
            const Icon = r.icon
            
            return (
              <button
                key={r.id}
                onClick={() => handleShift(r.id)}
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
                <Icon size={18} className={clsx('mb-1.5 transition-transform duration-300', isActive && 'scale-110')} />
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
        {feedback && (
          <div className={clsx(
            'mx-3 mb-3 rounded-md border px-3 py-2 text-[10px] font-mono',
            feedback.ok
              ? 'border-green/20 bg-green/10 text-green'
              : 'border-amber/20 bg-amber/10 text-amber'
          )}>
            {feedback.message}
          </div>
        )}
      </div>
      <ActionGuardDialog
        guard={guard}
        pending={loading}
        onCancel={() => !loading && setGuard(null)}
        onConfirm={async () => {
          const rhythm = guard?.action?.rhythm
          setGuard(null)
          if (rhythm) await performShift(rhythm)
        }}
      />
    </>
  )
}
