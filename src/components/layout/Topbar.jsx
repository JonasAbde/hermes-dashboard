import { useLocation } from 'react-router-dom'
import { Search, RefreshCw } from 'lucide-react'
import { Chip } from '../ui/Chip'
import { usePoll } from '../../hooks/useApi'

const pageTitles = {
  '/':          'Overview',
  '/sessions':  'Sessions',
  '/memory':    'Memory',
  '/cron':      'Cron Jobs',
  '/skills':    'Skills',
  '/approvals': 'Approvals',
  '/terminal':  'Terminal',
  '/settings':  'Settings',
}

export function Topbar({ onSearchOpen }) {
  const { pathname } = useLocation()
  const { data: gw } = usePoll('/gateway', 8000)

  const isOnline = gw?.gateway_online === true
  const modelLabel = typeof gw?.model === 'string'
    ? gw.model
    : gw?.model?.default ?? gw?.model?.provider ?? null

  return (
    <header className="h-12 bg-[#050608] border-b border-border flex items-center px-4 gap-3 flex-shrink-0">
      <h1 className="text-sm font-bold text-t1 flex-1">{pageTitles[pathname] ?? 'Hermes'}</h1>

      {/* Gateway status */}
      <Chip variant={isOnline ? 'online' : 'offline'} pulse={isOnline}>
        {isOnline ? 'Online' : 'Offline'}
      </Chip>

      {/* Model chip */}
      {modelLabel && (
        <Chip variant="model" className="hidden sm:inline-flex">{modelLabel}</Chip>
      )}

      {/* Search trigger */}
      <button
        onClick={onSearchOpen}
        className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-surface2 border border-border text-t3 text-[12px] hover:border-t3 transition-colors duration-150"
      >
        <Search size={12} />
        <span className="hidden md:inline">Søg…</span>
        <kbd className="hidden md:inline font-mono text-[10px] bg-surface px-1 rounded border border-border">⌘K</kbd>
      </button>

      <button
        onClick={() => window.location.reload()}
        className="w-7 h-7 rounded-md flex items-center justify-center text-t3 hover:text-t2 hover:bg-surface2 transition-all"
        title="Refresh"
      >
        <RefreshCw size={13} />
      </button>
    </header>
  )
}
