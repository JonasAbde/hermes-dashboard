import { useState, useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Menu, Search, RefreshCw, User, Settings, LogOut } from 'lucide-react'
import { Chip } from '../ui/Chip'
import { useApi, usePoll } from '../../hooks/useApi'
import { getBasicMode, setBasicMode } from '../../utils/preferences'

const pageTitles = {
  '/':          'Overview',
  '/sessions':  'Sessions',
  '/memory':    'Memory',
  '/cron':      'Scheduled Tasks',
  '/scheduled': 'Scheduled Tasks',
  '/skills':    'Skills',
  '/approvals': 'Approvals',
  '/terminal':  'Terminal',
  '/settings':  'Settings',
  '/chat':      'Chat',
  '/logs':      'Logs',
  '/operations':'Operations',
  '/onboarding':'Onboarding',
}

const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.userAgent)

export function Topbar({ onSearchOpen, onMenuOpen }) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { data: gw } = usePoll('/gateway', 8000)
  const { data: profile, refetch: refetchProfile } = useApi('/profile')
  const [profileOpen, setProfileOpen] = useState(false)
  const [basicMode, setBasicModeState] = useState(() => getBasicMode())
  const profileRef = useRef(null)

  useEffect(() => {
    const handleProfileUpdated = () => {
      refetchProfile({ background: true })
    }
    window.addEventListener('profile-updated', handleProfileUpdated)
    return () => window.removeEventListener('profile-updated', handleProfileUpdated)
  }, [refetchProfile])

  /* Close profile dropdown on outside click */
  useEffect(() => {
    function handleClick(e) {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setProfileOpen(false)
      }
    }
    if (profileOpen) {
      document.addEventListener('mousedown', handleClick)
      return () => document.removeEventListener('mousedown', handleClick)
    }
  }, [profileOpen])

  const isOnline = gw?.gateway_online === true
  const gatewayUnavailable = gw?.status === 'error'
  const gatewayStale = gw?.state_fresh === false
  const gatewayVariant = gatewayUnavailable ? 'warn' : isOnline ? 'online' : 'offline'
  const gatewayLabel = gatewayUnavailable ? 'Unknown' : isOnline ? (gatewayStale ? 'Online (stale)' : 'Online') : 'Offline'
  const modelLabel = typeof gw?.model === 'string'
    ? gw.model
    : gw?.model?.default ?? gw?.model?.provider ?? null
  const username = profile?.username || 'User'

  return (
    <header className="min-h-12 bg-[#050608] border-b border-border flex items-center px-2.5 sm:px-4 py-2 gap-1.5 sm:gap-3 flex-shrink-0">
      <button
        onClick={onMenuOpen}
        className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-surface2 text-t3 transition-colors hover:border-t3 hover:text-t1 md:hidden"
        aria-label="Open navigation"
      >
        <Menu size={14} />
      </button>

      <h1 className="text-sm font-bold text-t1 flex-1 min-w-0 truncate">{pageTitles[pathname] ?? 'Hermes'}</h1>

      <Chip variant={gatewayVariant} pulse={isOnline && !gatewayUnavailable}>
        {gatewayLabel}
      </Chip>

      {modelLabel && (
        <Chip variant="model" className="hidden md:inline-flex">{modelLabel}</Chip>
      )}

      <button
        onClick={onSearchOpen}
        className="w-8 h-8 sm:w-auto sm:h-auto flex items-center justify-center sm:justify-start gap-2 px-0 sm:px-3 py-0 sm:py-1.5 rounded-md bg-surface2 border border-border text-t3 text-[12px] hover:border-t3 transition-colors duration-150 ml-auto sm:ml-0"
      >
        <Search size={12} />
        <span className="hidden md:inline">Search…</span>
        <kbd className="hidden lg:inline font-mono text-[10px] bg-surface px-1 rounded border border-border">
          {isMac ? '⌘K' : 'Ctrl+K'}
        </kbd>
      </button>

      <button
        onClick={() => window.location.reload()}
        className="w-8 h-8 rounded-md flex items-center justify-center text-t3 hover:text-t2 hover:bg-surface2 transition-all"
        title="Refresh"
      >
        <RefreshCw size={13} />
      </button>

      {/* Profile button + dropdown */}
      <div className="relative" ref={profileRef}>
        <button
          type="button"
          className="flex items-center gap-2 pl-1.5 sm:pl-2 sm:border-l sm:border-border ml-0.5 sm:ml-1 h-8 pr-1 rounded-md text-t3 hover:text-t1 hover:bg-surface2 transition-colors min-w-0"
          title="Open profile settings"
          aria-label="Open profile settings"
          onClick={() => setProfileOpen(p => !p)}
        >
          <div className="h-6 w-6 rounded-full bg-surface2 flex items-center justify-center ring-1 ring-border">
            <User size={12} />
          </div>
          <span className="text-[12px] font-medium text-t2 hidden sm:inline">{username}</span>
        </button>

        {profileOpen && (
          <div className="absolute right-0 top-full mt-1 w-48 rounded-lg bg-surface border border-border shadow-lg shadow-black/40 z-50 py-1 animate-in fade-in">
            <div className="px-3 py-2 border-b border-border">
              <p className="text-xs font-semibold text-t1 truncate">{username}</p>
              <p className="text-[10px] text-t3 mt-0.5">Hermes Agent</p>
            </div>
            <button
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-t2 hover:text-t1 hover:bg-surface2 transition-colors"
              onClick={() => {
                const next = !basicMode
                setBasicMode(next)
                setBasicModeState(next)
              }}
            >
              <Settings size={12} />
              {basicMode ? 'Disable basic mode' : 'Enable basic mode'}
            </button>
            <button
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-t2 hover:text-t1 hover:bg-surface2 transition-colors"
              onClick={() => { setProfileOpen(false); navigate('/settings') }}
            >
              <Settings size={12} />
              Settings
            </button>
            <button
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-t2 hover:text-red hover:bg-red/5 transition-colors"
              onClick={() => { setProfileOpen(false); window.location.reload() }}
            >
              <LogOut size={12} />
              Reload dashboard UI
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
