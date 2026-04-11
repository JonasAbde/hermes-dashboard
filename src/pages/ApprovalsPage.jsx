import { useState, useEffect, useRef } from 'react'
import { usePoll } from '../hooks/useApi'
import { useLoadingTimeout } from '../hooks/useLoadingTimeout'
import { Chip } from '../components/ui/Chip'
import { CheckSquare, Check, X, AlertTriangle, RefreshCw, Loader } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { da } from 'date-fns/locale'
import { clsx } from 'clsx'
import { apiFetch } from '../utils/auth'

// ─── Toast notification ────────────────────────────────────────────────────────

function Toast({ toasts }) {
  if (!toasts.length) return null
  return (
    <div className="fixed bottom-5 right-5 z-50 space-y-2">
      {toasts.map(t => (
        <div
          key={t.id}
          className={clsx(
            'flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-sm font-semibold border animate-[slideUp_0.2s_ease-out]',
            t.ok
              ? 'bg-green/15 border-green/30 text-green'
              : 'bg-red/15 border-red/30 text-red'
          )}
          style={{ animation: 'slideUp 0.2s ease-out' }}
        >
          {t.ok
            ? <Check size={14} className="flex-shrink-0" />
            : <X size={14} className="flex-shrink-0" />
          }
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Approval Card ─────────────────────────────────────────────────────────────

function ApprovalCard({ item, onAction }) {
  const [leaving, setLeaving] = useState(false)

  const handle = async (action) => {
    setLeaving(true)
    try {
      const res = await apiFetch(`/api/approvals/${item.id}/${action}`, { method: 'POST' })
      const body = await res.json().catch(() => ({}))
      onAction({
        ok: res.ok,
        message: body.message ?? (res.ok
          ? `${action === 'approve' ? 'Approved' : 'Denied'} "${item.command?.slice(0, 40)}…"`
          : `Fejl: HTTP ${res.status}`
        ),
      })
    } catch (e) {
      onAction({ ok: false, message: e.message })
    }
    // Deferred null callback — leaving state already set above so rapid clicks are blocked
    setTimeout(() => onAction(null), 50)
  }

  return (
    <div
      className={clsx(
        'bg-surface border border-amber/20 rounded-lg overflow-hidden transition-all duration-300',
        leaving ? 'opacity-0 translate-x-4 scale-95' : 'opacity-100 translate-x-0 scale-100'
      )}
      style={{ transitionProperty: 'opacity, transform' }}
    >
      {/* Amber accent line */}
      <div style={{
        height: 1,
        background: 'linear-gradient(90deg, transparent, rgba(224,144,64,0.5), transparent)',
      }} />

      <div className="p-4">
        {/* Header row */}
        <div className="flex items-start gap-2 mb-3">
          <AlertTriangle size={13} className="text-amber flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-t1 truncate">
              {item.title ?? 'Afventer Approval'}
            </div>
            <div className="font-mono text-[10px] text-t3 mt-0.5">
              {formatDistanceToNow(new Date(item.created_at * 1000), { locale: da, addSuffix: true })}
            </div>
          </div>
          <Chip variant="pending" pulse>Afventer</Chip>
        </div>

        {/* Command block */}
        <div className="bg-surface2 border border-border rounded-md px-3 py-2.5 mb-3">
          <div className="text-[9px] font-bold uppercase tracking-widest text-t3 mb-1.5">Kommando</div>
          <pre className="font-mono text-[11px] text-t1 whitespace-pre-wrap break-all leading-relaxed">
            {item.command}
          </pre>
        </div>

        {/* Reason / context */}
        {item.reason && (
          <div className="mb-3 text-[11px] text-t3 leading-relaxed">
            <span className="font-semibold text-t2">Begrundelse: </span>
            {item.reason}
          </div>
        )}

        {/* Metadata row */}
        <div className="flex items-center gap-3 text-[10px] font-mono text-t3 mb-3">
          {item.source && <span>source: {item.source}</span>}
          {item.model && <span>model: {item.model}</span>}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => handle('approve')}
            disabled={leaving}
            className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-green/10 border border-green/25 text-green text-xs font-semibold hover:bg-green/20 transition-colors active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Check size={13} />
            Approve
          </button>
          <button
            onClick={() => handle('deny')}
            disabled={leaving}
            className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-red/10 border border-red/20 text-red text-xs font-semibold hover:bg-red/20 transition-colors active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <X size={13} />
            Deny
          </button>
        </div>
      </div>
    </div>
  )
}

function SkeletonCard() {
  return (
    <div className="bg-surface border border-border rounded-lg overflow-hidden p-4">
      <div className="flex items-start gap-2 mb-3">
        <div className="skeleton w-3.5 h-3.5 rounded" />
        <div className="flex-1">
          <div className="skeleton h-3 w-1/2 mb-2" />
          <div className="skeleton h-2 w-1/4" />
        </div>
        <div className="skeleton w-16 h-4 rounded-full" />
      </div>
      <div className="skeleton h-16 w-full mb-3 rounded-md" />
      <div className="flex gap-2">
        <div className="skeleton h-7 w-20 rounded-md" />
        <div className="skeleton h-7 w-16 rounded-md" />
      </div>
    </div>
  )
}

function ErrorState({ message, onRetry }) {
  return (
    <div className="bg-surface border border-border rounded-lg p-8 text-center">
      <AlertTriangle size={18} className="text-rust mx-auto mb-2" />
      <div className="text-sm font-semibold text-rust">Fejl ved indlæsning</div>
      <div className="text-[11px] text-t3 mt-1 mb-4">{message}</div>
      <button
        onClick={onRetry}
        className="px-3 py-1.5 rounded-md bg-surface2 border border-border text-xs text-t2 hover:text-t1 transition-colors"
      >
        Prøv igen
      </button>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="bg-surface border border-border rounded-lg py-16 text-center">
      <div className="w-12 h-12 rounded-full bg-green/10 border border-green/20 flex items-center justify-center mx-auto mb-3">
        <CheckSquare size={20} className="text-green" />
      </div>
      <div className="text-sm font-bold text-t2">Ingen afventende approvals</div>
      <div className="text-[11px] text-t3 mt-1.5 max-w-xs mx-auto leading-relaxed">
        Alle kommandoer er godkendt — Hermes kører i normal tilstand
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

let toastId = 0
const toastTimerRefs = []

export function ApprovalsPage() {
  const toastTimers = useRef([])

  const { data, loading, error, refetch } = usePoll('/approvals', 4000)
  const pending = data?.pending ?? []
  const { loadingTimedOut, resetTimeout } = useLoadingTimeout(loading, 8000)

  const [toasts, setToasts] = useState([])

  // Cleanup all toast timers on unmount
  useEffect(() => {
    return () => {
      toastTimerRefs.forEach(clearTimeout)
      toastTimerRefs.length = 0
    }
  }, [])

  // Loading timeout handled by useLoadingTimeout hook

  const showToast = (toast) => {
    if (!toast) return
    const id = ++toastId
    setToasts(t => [...t, { ...toast, id }])
    const timerId = setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500)
    toastTimerRefs.push(timerId)
  }

  // Remove item from list when it's been actioned
  const handleAction = (item, toast) => {
    if (toast) showToast(toast)
    refetch()
  }

  return (
    <div className="max-w-2xl space-y-5">

      {/* Page Header */}
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-amber/10 border border-amber/20 flex items-center justify-center flex-shrink-0">
          <CheckSquare size={16} className="text-amber" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-bold text-t1">Tirith Approval Queue</div>
          <div className="text-[11px] text-t3 mt-0.5">
            Review and approve pending agent commands
          </div>
        </div>
        {pending.length > 0 && (
          <Chip variant="warn" pulse>{pending.length} afventer</Chip>
        )}
        <button
          onClick={refetch}
          className="w-7 h-7 rounded-md flex items-center justify-center text-t3 hover:text-t2 hover:bg-surface2 transition-colors flex-shrink-0"
          title="Refresh"
        >
          <RefreshCw size={13} />
        </button>
      </div>

      {/* Error state */}
      {error && (
        <ErrorState message={error} onRetry={refetch} />
      )}

      {/* Skeleton loading */}
      {loading && !loadingTimedOut && (
        <div className="space-y-3">
          {Array.from({ length: 2 }, (_, i) => <SkeletonCard key={i} />)}
        </div>
      )}

      {loading && loadingTimedOut && !error && (
        <ErrorState
          message="Data loader tager for lang tid. API er muligvis offline."
          onRetry={() => {
            resetTimeout()
            refetch()
          }}
        />
      )}

      {/* Empty state */}
      {!loading && !error && pending.length === 0 && (
        <EmptyState />
      )}

      {/* Approval cards with staggered animation */}
      {!loading && !error && pending.length > 0 && (
        <div className="space-y-3">
          {pending.map((item, i) => (
            <div
              key={item.id}
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <ApprovalCard
                item={item}
                onAction={(toast) => handleAction(item, toast)}
              />
            </div>
          ))}
        </div>
      )}

      <Toast toasts={toasts} />
    </div>
  )
}
