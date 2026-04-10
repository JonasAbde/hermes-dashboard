import React from 'react'
import { clsx } from 'clsx'
import { Power } from 'lucide-react'
import { SidebarNavItem } from './SidebarNavItem'
import { HermesCharacterCompact, rhythmToVariant } from '../avatar/HermesCharacter'

export function SidebarRail({ brandIcon: _BrandIcon, isStopped, navItems, settingsItem, pending, onToggleStop, rhythm }) {
  const avatarVariant = isStopped ? 'offline' : (rhythm ? rhythmToVariant(rhythm) : 'default')

  return (
    <aside className="hidden md:flex md:w-12 md:h-full md:flex-col md:items-center md:border-r md:border-border md:bg-[#050608]/95 md:py-3 md:px-0 md:backdrop-blur">
      <div className="mb-3 flex-shrink-0">
        <HermesCharacterCompact
          variant={avatarVariant}
          pulse={!isStopped}
        />
      </div>

      <div className="flex flex-col items-center gap-1.5">
        {navItems.map((group, gi) => (
          <React.Fragment key={gi}>
            {gi > 0 && (
              <div className="my-1 w-5 h-px bg-white/[0.06]" />
            )}
            {group.items.map(({ to, icon, label }) => (
              <SidebarNavItem key={to} to={to} icon={icon} label={label} end={to === '/'} />
            ))}
          </React.Fragment>
        ))}
      </div>

      <div className="mt-auto flex flex-col items-center gap-1.5 pb-1">
        <button
          onClick={onToggleStop}
          disabled={pending}
          title={isStopped ? 'Start Agent' : 'STOP AGENT (Emergency)'}
          aria-label={isStopped ? 'Start Agent' : 'Stop Agent'}
          className={clsx(
            'w-8 h-8 rounded-md flex items-center justify-center transition-all duration-300 flex-shrink-0',
            isStopped
              ? 'bg-red/20 border border-red/40 text-red animate-pulse'
              : 'text-t3 hover:text-red hover:bg-red/10 border border-transparent',
            pending && 'opacity-60 cursor-wait'
          )}
        >
          <Power size={15} className={clsx(isStopped && 'drop-shadow-[0_0_5px_rgba(255,0,0,0.8)]')} />
        </button>

        {settingsItem ? (
          <SidebarNavItem to={settingsItem.to} icon={settingsItem.icon} label={settingsItem.label} />
        ) : null}
      </div>
    </aside>
  )
}
