import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Search, RefreshCw, User } from 'lucide-react'
import { Chip } from '../ui/Chip'
import { useApi, usePoll } from '../../hooks/useApi'

const pageTitles = {
  '/':          'Overview',
  '/sessions':  'Sessions',
  '/memory':    'Memory',
  '/cron':      'Cron Jobs',
  '/skills':    'Skills',
  '/approvals': 'Approvals',
  '/terminal':  'Terminal',
  '/settings':  'Settings',
  '/chat':      'Chat',
  '/logs':      'Logs',
  '/operations':'Operations',
}

export function Topbar({ onSearchOpen }) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { data: gw } = usePoll('/gateway', 8000)
  const { data: profile, refetch: refetchProfile } = useApi('/profile')

  useEffect(() => {
    const handleProfileUpdated = () => {
      refetchProfile({ background: true })
    }
    window.addEventListener('profile-updated', handleProfileUpdated)
    return () => window.removeEventListener('profile-updated', handleProfileUpdated)
  }, [refetchProfile])

  const isOnline = gw?.gateway_online === true
  const modelLabel = typeof gw?.model === 'string'
    ? gw.model
    : gw?.model?.default ?? gw?.model?.provider ?? null

  return (
    <header className="min-h-12 bg-[#050608] border-b border-border flex items-center flex-wrap px-2.5 sm:px-4 py-2 gap-1.5 sm:gap-3 flex-shrink-0">
      <h1 className="text-sm font-bold text-t1 basis-full sm:basis-auto sm:flex-1 min-w-0 truncate">{pageTitles[pathname] ?? 'Hermes'}</h1>

      {/* Gateway status */}
      <Chip variant={isOnline ? 'online' : 'offline'} pulse={isOnline}>
        {isOnline ? 'Online' : 'Offline'}
      </Chip>

      {/* Model chip */}
      {modelLabel && (
        <Chip variant="model" className="hidden md:inline-flex">{modelLabel}</Chip>
      )}

      {/* Search trigger */}
      <button
        onClick={onSearchOpen}
        className="w-8 h-8 sm:w-auto sm:h-auto flex items-center justify-center sm:justify-start gap-2 px-0 sm:px-3 py-0 sm:py-1.5 rounded-md bg-surface2 border border-border text-t3 text-[12px] hover:border-t3 transition-colors duration-150 ml-auto sm:ml-0"
      >
        <Search size={12} />
        <span className="hidden md:inline">Search…</span>
        <kbd className="hidden lg:inline font-mono text-[10px] bg-surface px-1 rounded border border-border">⌘K</kbd>
      </button>

      <button
        onClick={() => window.location.reload()}
        className="w-8 h-8 rounded-md flex items-center justify-center text-t3 hover:text-t2 hover:bg-surface2 transition-all"
        title="Refresh"
      >
        <RefreshCw size={13} />
      </button>

      {/* User profile section */}
      <button
        type="button"
        onClick={() => navigate('/settings')}
        className="flex items-center gap-2 pl-1.5 sm:pl-2 sm:border-l sm:border-border ml-0.5 sm:ml-1 h-8 pr-1 rounded-md text-t3 hover:text-t1 hover:bg-surface2 transition-colors min-w-0"
        title="Open profile settings"
        aria-label="Open profile settings"
      >
        <div className="h-6 w-6 rounded-full bg-surface2 flex items-center justify-center ring-1 ring-border">
          <User size={12} />
        </div>
        <span className="text-[12px] font-medium text-t2 hidden sm:inline">
          {profile?.username || 'User'}
        </span>
      </button>
    </header>
  )
}
