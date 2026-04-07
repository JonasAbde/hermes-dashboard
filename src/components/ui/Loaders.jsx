import { AlertTriangle, RotateCw } from 'lucide-react'

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

export function LoadingSpinner({ size = 13 }) {
  return (
    <RotateCw size={size} className="animate-spin text-t3" />
  )
}

// Generic skeleton rows for list/table content
export function SkeletonRows({ count = 5, height = 'h-8', className = '' }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {[...Array(count)].map((_, i) => (
        <div key={i} className={`skeleton ${height} rounded-lg`} style={{ animationDelay: `${i * 80}ms` }} />
      ))}
    </div>
  )
}

// Card skeleton for metric/card content
export function SkeletonBlock({ lines = 3, height = 'h-3' }) {
  return (
    <div className="space-y-2">
      {[...Array(lines)].map((_, i) => (
        <div key={i} className={`skeleton ${height} rounded`} style={{ width: `${60 + Math.random() * 30}%`, animationDelay: `${i * 60}ms` }} />
      ))}
    </div>
  )
}
