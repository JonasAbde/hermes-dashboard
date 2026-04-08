import React from 'react'
import { clsx } from "clsx"

export function SettingRow({ label, value, mono, highlight, badge }) {
  let displayValue = value
  if (value !== null && value !== undefined && typeof value === 'object') {
    displayValue = JSON.stringify(value)
  } else if (value !== null && value !== undefined) {
    displayValue = String(value)
  }

  return (
    <div className={clsx(
      'flex items-center justify-between gap-4 py-3.5 border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] -mx-5 px-5 transition-colors',
      highlight && 'bg-rust/5'
    )}>
      <div className="text-[12px] font-medium text-t2 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
        <span>{label}</span>
        {badge && <span className="px-1.5 py-0.5 rounded-[4px] bg-red/10 text-red text-[9px] font-bold uppercase tracking-widest">{badge}</span>}
      </div>
      <div className={clsx(
        mono ? 'font-mono text-[11px] sm:text-[12px] text-t1 tracking-tight bg-white/[0.03] px-2 py-1 rounded' : 'text-xs sm:text-sm font-semibold text-t1',
        highlight && 'text-rust'
      )}>
        {displayValue ?? <span className="text-t3 italic">—</span>}
      </div>
    </div>
  )
}

export function ToggleSetting({ label, description, checked, onChange, disabled }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3.5 border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] -mx-5 px-5 transition-colors">
      <div className="flex flex-col gap-0.5 max-w-[70%]">
        <span className="text-[13px] font-medium text-t1">{label}</span>
        {description && <span className="text-[11px] text-t3 leading-snug">{description}</span>}
      </div>
      <button
        onClick={() => onChange(!checked)}
        disabled={disabled}
        className={clsx(
          "relative w-10 h-5 rounded-full transition-colors flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-rust/30",
          checked ? "bg-green/30" : "bg-white/[0.1]",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        <div className={clsx(
          "absolute top-0.5 inset-y-0 w-4 h-4 rounded-full transition-all shadow-md",
          checked ? "left-[22px] bg-green shadow-[0_0_8px_rgba(34,197,94,0.6)]" : "left-0.5 bg-t3"
        )} />
      </button>
    </div>
  )
}

export function SelectSetting({ label, description, value, options, onChange, disabled }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3.5 border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] -mx-5 px-5 transition-colors">
      <div className="flex flex-col gap-0.5 max-w-[60%]">
        <span className="text-[13px] font-medium text-t1">{label}</span>
        {description && <span className="text-[11px] text-t3 leading-snug">{description}</span>}
      </div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="bg-surface/80 border border-white/10 text-t2 text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-rust/50 focus:border-rust/30 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  )
}
