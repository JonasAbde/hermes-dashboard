import { AlertTriangle } from 'lucide-react'

export function ErrorState({ message, onRetry }) {
  return (
    <div className="bg-surface/50 backdrop-blur-xl border border-rust/20 rounded-2xl p-8 text-center relative overflow-hidden">
      <div className="absolute inset-0 bg-rust/5 blur-xl pointer-events-none" />
      <AlertTriangle size={24} className="text-rust mx-auto mb-3" />
      <div className="text-sm font-bold text-rust">Neural Link Fail</div>
      <div className="text-xs text-t3 mt-1.5 mb-5 font-mono">{message}</div>
      {onRetry && (
        <button
        onClick={onRetry}
        className="px-4 py-2 rounded-lg bg-rust/10 border border-rust/30 text-xs font-semibold text-rust hover:bg-rust/20 hover:text-white transition-all shadow-[0_0_10px_rgba(224,95,64,0.1)]"
        >
          RE-INITIALIZE
        </button>
      )}
    </div>
  )
}

export function LoadingSpinner() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" className="animate-spin">
      <circle cx="6.5" cy="6.5" r="5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="20 8" />
    </svg>
  )
}
