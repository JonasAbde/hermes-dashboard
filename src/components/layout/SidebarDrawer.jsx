import { useEffect } from 'react'
import { X, Sparkles, Square, Play, Search } from 'lucide-react'
import { clsx } from 'clsx'
import { SidebarNavItem } from './SidebarNavItem'
import { HermesAvatar, rhythmToVariant } from '../avatar/HermesAvatar'

export function SidebarDrawer({
  open,
  onClose,
  isStopped,
  pending,
  navItems,
  settingsItem,
  onToggleStop,
  onSearchOpen,
  rhythm,
}) {
  useEffect(() => {
    if (!open) return undefined
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/65 backdrop-blur-sm md:hidden" onClick={onClose} />
      <aside className="fixed inset-y-0 left-0 z-50 w-[min(86vw,340px)] border-r border-border bg-[#050608]/97 backdrop-blur-xl md:hidden">
        <div className="flex items-center justify-between border-b border-border px-4 py-4">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-t3">Navigation</div>
            <div className="mt-1 text-sm font-semibold text-t1">Hermes dashboard</div>
          </div>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-border text-t2 transition-colors hover:bg-surface2 hover:text-t1"
            aria-label="Luk navigation"
          >
            <X size={16} />
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto px-4 py-4">
          <div className="rounded-2xl border border-white/6 bg-white/[0.03] p-3">
            <div className="flex items-start gap-3">
              <div className={clsx('flex h-10 w-10 items-center justify-center rounded-2xl border', isStopped ? 'border-red/20 bg-red/10 text-red' : 'border-rust/20 bg-rust/10 text-rust')}>
                <HermesAvatar variant={isStopped ? 'offline' : (rhythm ? rhythmToVariant(rhythm) : 'default')} size={24} pulse={!isStopped} statusDot />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-t1">Agentstatus</div>
                <div className="mt-1 text-[12px] leading-relaxed text-t2">
                  {isStopped
                    ? 'Hermes er pauseret. Genoptag her, når du er klar.'
                    : 'Hermes er aktiv. Pausér herfra før du laver ændringer.'}
                </div>
              </div>
            </div>

            <button
              onClick={onToggleStop}
              disabled={pending}
              className={clsx(
                'mt-3 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-all',
                isStopped
                  ? 'border border-green/20 bg-green/10 text-green hover:bg-green/15'
                  : 'border border-red/20 bg-red/10 text-red hover:bg-red/15',
                pending && 'opacity-60 cursor-wait'
              )}
            >
              {isStopped ? <Play size={15} /> : <Square size={15} />}
              {pending ? 'Arbejder...' : isStopped ? 'Genoptag agent' : 'Pausér agent'}
            </button>
          </div>

          <div>
            <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.28em] text-t3">Hurtige handlinger</div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => { onClose(); onSearchOpen?.() }}
                className="flex items-center gap-2 rounded-xl border border-white/6 bg-white/[0.03] px-3 py-2.5 text-left text-sm font-medium text-t1 transition-colors hover:bg-white/[0.06]"
              >
                <Search size={15} className="text-t2" />
                Søg
              </button>
              <button
                onClick={onClose}
                className="flex items-center gap-2 rounded-xl border border-white/6 bg-white/[0.03] px-3 py-2.5 text-left text-sm font-medium text-t1 transition-colors hover:bg-white/[0.06]"
              >
                <X size={15} className="text-t2" />
                Luk
              </button>
            </div>
          </div>

          <div>
            <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.28em] text-t3">Navigér</div>
            <div className="grid grid-cols-1 gap-2">
              {navItems.map(({ to, icon, label }) => (
                <SidebarNavItem key={to} to={to} icon={icon} label={label} variant="drawer" onNavigate={onClose} end={to === '/'} />
              ))}
              {settingsItem ? (
                <SidebarNavItem to={settingsItem.to} icon={settingsItem.icon} label={settingsItem.label} variant="drawer" onNavigate={onClose} />
              ) : null}
            </div>
          </div>

          <div className="rounded-2xl border border-white/6 bg-white/[0.03] p-3 text-[12px] leading-relaxed text-t2">
            Brug menuen til hurtigere navigation på mobil. Sidebjælken er synlig på desktop, men drawer giver større trykfelter på små skærme.
          </div>
        </div>
      </aside>
    </>
  )
}
