import { useEffect } from 'react'
import { clsx } from 'clsx'

export function Toast({ toast, onDone }) {
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(onDone, 3200)
    return () => clearTimeout(t)
  }, [toast, onDone])

  if (!toast) return null

  const isError = toast.type === 'error'

  return (
    <div
      className={clsx(
        "fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999]",
        "flex items-center gap-2.5 px-4 py-2.5 rounded-xl min-w-[240px]",
        "border shadow-2xl animate-in slide-in-from-bottom-4 fade-in duration-200",
        isError 
          ? "bg-rust/10 border-rust/30 text-rust shadow-[0_4px_24px_rgba(224,95,64,0.15)]"
          : "bg-green/10 border-green/30 text-green shadow-[0_4px_24px_rgba(34,197,94,0.15)]"
      )}
    >
      <div className={clsx("w-1.5 h-1.5 rounded-full shrink-0", isError ? "bg-rust" : "bg-green")} />
      <span className="text-[13px] font-medium">{toast.message}</span>
    </div>
  )
}
