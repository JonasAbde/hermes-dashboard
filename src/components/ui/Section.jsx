import { clsx } from "clsx"

export function SectionCard({ title, icon: Icon, iconColor, accent, children, className, headerRight }) {
  return (
    <div className={clsx('relative bg-surface/50 backdrop-blur-xl border border-white/[0.05] rounded-2xl overflow-hidden shadow-xl', className)}>
      {accent && (
        <div className="absolute top-0 left-0 right-0 h-[2px]" style={{
          background: `linear-gradient(90deg, transparent, ${accent}, transparent)`,
        }} />
      )}
      
      {accent && (
        <div className="absolute top-0 left-1/4 w-1/2 h-24 rounded-full blur-[60px] opacity-10 pointer-events-none" style={{ background: accent }} />
      )}

      <div className="px-5 py-4 border-b border-white/[0.03] flex items-center justify-between gap-3 bg-white/[0.01]">
        <div className="flex items-center gap-2.5">
          {Icon && <Icon size={14} className={iconColor} />}
          <span className="text-[13px] font-bold text-t1 tracking-wide uppercase">{title}</span>
        </div>
        {headerRight && <div className="flex items-center">{headerRight}</div>}
      </div>
      <div className="relative z-10 px-5 py-5">{children}</div>
    </div>
  )
}

export function SkeletonSection() {
  return (
    <div className="bg-surface/50 backdrop-blur-xl border border-white/[0.05] rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-white/[0.03]">
        <div className="skeleton h-3 w-1/3 rounded" />
      </div>
      <div className="px-5 py-5 space-y-4">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="flex justify-between items-center py-2 border-b border-white/[0.05] last:border-0">
            <div className="skeleton h-3 w-24 rounded" />
            <div className="skeleton h-3 w-40 rounded" />
          </div>
        ))}
      </div>
    </div>
  )
}
