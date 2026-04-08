import React from 'react'
import { Info } from 'lucide-react'

export function PagePrimer({ title, body, tip }) {
  return (
    <div className="rounded-lg border border-blue/25 bg-blue/10 px-3 py-2.5">
      <div className="flex items-start gap-2">
        <Info size={14} className="mt-0.5 text-blue" />
        <div className="min-w-0">
          <div className="text-[11px] font-bold uppercase tracking-wide text-blue">{title}</div>
          <p className="mt-0.5 text-[12px] text-t2">{body}</p>
          {tip ? <p className="mt-1 text-[11px] text-t3">{tip}</p> : null}
        </div>
      </div>
    </div>
  )
}

