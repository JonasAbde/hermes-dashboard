import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useLocation, useNavigate } from 'react-router-dom'
import { Menu, Search, RefreshCw, User, Settings, LogOut } from 'lucide-react'
import { Chip } from '../ui/Chip'
import { useApi, usePoll } from '../../hooks/useApi.ts'
import { getBasicMode, setBasicMode } from '../../utils/preferences'

const pageTitles = {
  '/':          'Overblik',
  '/sessions':  'Sessioner',
  '/memory':    'Hukommelse',
  '/cron':      'Planlagte opgaver',
  '/scheduled': 'Planlagte opgaver',
  '/skills':    'Færdigheder',
  '/approvals': 'Godkendelser',
  '/terminal':  'Terminal',
  '/settings':  'Indstillinger',
  '/chat':      'Chat',
  '/logs':      'Logfiler',
  '/operations':'Drift',
  '/onboarding':'Opsætning',
  '/profile':   'Profil',
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
  const gatewayVariant = gatewayUnavailable ? 'warn' : isOnline ? (gatewayStale ? 'warn' : 'online') : 'offline'
  const gatewayLabel = gatewayUnavailable ? 'Ukendt' : isOnline ? (gatewayStale ? 'Online (synkroniserer...)' : 'Online') : 'Offline'
  const modelLabel = typeof gw?.model === 'string'
    ? gw.model
    : gw?.model?.default ?? gw?.model?.provider ?? null
  const username = profile?.username || 'Bruger'

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
        <span className="hidden md:inline">Søg…</span>
        <kbd className="hidden lg:inline font-mono text-[10px] bg-surface px-1 rounded border border-border">
          {isMac ? '⌘K' : 'Ctrl+K'}
        </kbd>
      </button>

      <button
        onClick={() => window.location.reload()}
        className="w-8 h-8 rounded-md flex items-center justify-center text-t3 hover:text-t2 hover:bg-surface2 transition-all"
        title="Opdater"
      >
        <RefreshCw size={13} />
      </button>

      {/* Profile button + dropdown */}
      <div className="relative" ref={profileRef}>
        <button
          type="button"
          className="group flex items-center gap-2 pl-1.5 sm:pl-2 sm:border-l sm:border-border ml-0.5 sm:ml-1 h-8 pr-1 rounded-md text-t3 hover:text-t1 hover:bg-surface2 transition-all min-w-0"
          title="Åbn profilindstillinger"
          aria-label="Åbn profilindstillinger"
          onClick={() => setProfileOpen(p => !p)}
        >
          <div className="relative h-6 w-6 rounded-full bg-surface2 flex items-center justify-center ring-1 ring-border glow-ring">
            <User size={14} className="transition-transform group-hover:scale-110 group-active:scale-95 duration-200" />
            <div className="profile-active-dot" />
          </div>
          <motion.span 
            className="text-[12px] font-medium text-t2 hidden sm:inline text-glitch"
            animate={profileOpen ? { color: 'var(--t1)' } : {}}
          >
            {username}
          </motion.span>
        </button>

        <AnimatePresence>
          {profileOpen && (
            <motion.div 
              initial={{ opacity: 0, y: 8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 4, scale: 0.98 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className="absolute right-0 top-full mt-1.5 w-52 rounded-lg bg-[#0a0b10] border border-border shadow-2xl shadow-black/60 z-50 py-1.5 overflow-hidden backdrop-blur-md"
            >
              <div className="px-3 py-2.5 border-b border-border bg-surface2/30">
                <p className="text-xs font-bold text-t1 truncate flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-green shadow-[0_0_4px_var(--green)]" />
                  {username}
                </p>
                <p className="text-[10px] text-t3 mt-1 uppercase tracking-wider font-semibold">Hermes Agent System</p>
              </div>
              
              <div className="p-1">
                <button
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-t2 hover:text-t1 hover:bg-white/5 rounded-md transition-all group/item"
                  onClick={() => {
                    const next = !basicMode
                    setBasicMode(next)
                    setBasicModeState(next)
                  }}
                >
                  <Settings size={13} className="group-hover/item:rotate-90 transition-transform duration-300" />
                  <span className="flex-1 text-left">{basicMode ? 'Deaktiver basis-tilstand' : 'Aktiver basis-tilstand'}</span>
                  <div className={`w-1.5 h-1.5 rounded-full ${basicMode ? 'bg-amber' : 'bg-t3'}`} />
                </button>
                
                <button
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-t2 hover:text-t1 hover:bg-white/5 rounded-md transition-all"
                  onClick={() => { setProfileOpen(false); navigate('/profile') }}
                >
                  <User size={13} />
                  Indstillinger
                </button>
                
                <div className="h-px bg-border my-1 mx-1" />
                
                <button
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-red/80 hover:text-red hover:bg-red/5 rounded-md transition-all"
                  onClick={() => { setProfileOpen(false); window.location.reload() }}
                >
                  <LogOut size={13} />
                  Genstart Interface
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </header>
  )
}
