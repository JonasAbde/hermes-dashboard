import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { clsx } from 'clsx'
import {
  LayoutDashboard, MessageSquare, Brain, Clock, Wrench,
  CheckSquare, Terminal, Settings, Zap, MessageCircle,
  ScrollText, Power, Server
} from 'lucide-react'
import { usePoll } from '../../hooks/useApi'
import { Toast } from '../ui/Toast'
import { ActionGuardDialog } from '../ui/ActionGuardDialog'
import { getActionGuardrail } from '../../utils/actionGuardrails'


const navItems = [
  { to: '/',          icon: LayoutDashboard, label: 'Overview'   },
  { to: '/chat',      icon: MessageCircle,    label: 'Chat'        },
  { to: '/sessions',  icon: MessageSquare,   label: 'Sessions'   },
  { to: '/memory',    icon: Brain,           label: 'Memory'     },
  { to: '/cron',      icon: Clock,           label: 'Cron'       },
  { to: '/skills',    icon: Wrench,          label: 'Skills'     },
  { to: '/approvals', icon: CheckSquare,     label: 'Approvals'  },
  { to: '/logs',      icon: ScrollText,      label: 'Logs'       },
  { to: '/operations',icon: Server,          label: 'Operations' },
  { to: '/terminal',  icon: Terminal,        label: 'Terminal'   },
]

const mobilePrimaryRoutes = new Set(['/', '/chat', '/sessions', '/logs', '/settings'])
const mobileNavItems = navItems.filter((item) => mobilePrimaryRoutes.has(item.to))

export function Sidebar() {
  const { data: agent, refetch: refetchAgent } = usePoll('/agent/status', 5000)
  const isStopped = agent?.stopped === true
  const [pending, setPending] = useState(false)
  const [toast, setToast] = useState(null)
  const [guard, setGuard] = useState(null)

  const clearToast = () => setToast(null)

  const performToggleStop = async (nextStopped) => {
    setPending(true)
    try {
      const res = await fetch('/api/agent/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stopped: nextStopped })
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setToast({ type: 'error', message: body.error || `HTTP ${res.status}` })
        return
      }
      setToast({
        type: 'success',
        message: nextStopped
          ? 'Agent stopped. New Hermes automation is now paused.'
          : 'Agent resumed. Hermes can accept new work again.',
      })
      refetchAgent()
    } catch (e) {
      setToast({ type: 'error', message: e.message || 'Failed to update agent state' })
    } finally {
      setPending(false)
    }
  }

  const toggleStop = async () => {
    if (pending) return
    const nextStopped = !isStopped
    const nextGuard = getActionGuardrail({ type: 'agent-status', nextStopped })
    if (nextGuard) {
      setGuard({ ...nextGuard, action: { type: 'agent-status', nextStopped } })
      return
    }
    await performToggleStop(nextStopped)
  }

  const confirmGuard = async () => {
    const action = guard?.action
    if (!action) return
    setGuard(null)
    if (action.type === 'agent-status') {
      await performToggleStop(action.nextStopped)
    }
  }

  return (
    <>
      {/* Mobile bottom navigation */}
      <aside className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-[#050608]/95 px-1 pb-[max(6px,env(safe-area-inset-bottom))] pt-1 backdrop-blur md:hidden">
        <div className="grid grid-cols-6 items-center gap-0.5">
          {mobileNavItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={`mobile-${to}`}
              to={to}
              end={to === '/'}
              title={label}
              aria-label={label}
              className={({ isActive }) => clsx(
                'min-h-11 rounded-md px-1 py-1.5 flex flex-col items-center justify-center gap-1 transition-all duration-150',
                isActive
                  ? 'bg-rust/15 border border-rust/25 text-rust'
                  : 'text-t3 hover:text-t2 hover:bg-surface2'
              )}
            >
              <Icon size={15} />
              <span className="text-[9px] leading-none">{label}</span>
            </NavLink>
          ))}

          <button
            onClick={toggleStop}
            disabled={pending}
            title={isStopped ? 'Start Agent' : 'Stop Agent'}
            aria-label={isStopped ? 'Start Agent' : 'Stop Agent'}
            className={clsx(
              'min-h-11 rounded-md px-1 py-1.5 flex flex-col items-center justify-center gap-1 transition-all duration-300',
              isStopped
                ? 'bg-red/20 border border-red/40 text-red animate-pulse'
                : 'text-t3 hover:text-red hover:bg-red/10 border border-transparent',
              pending && 'opacity-60 cursor-wait'
            )}
          >
            <Power size={15} className={clsx(isStopped && 'drop-shadow-[0_0_5px_rgba(255,0,0,0.8)]')} />
            <span className="text-[9px] leading-none">{isStopped ? 'Start' : 'Stop'}</span>
          </button>
        </div>
      </aside>

      {/* Desktop rail navigation */}
      <aside className="hidden md:flex md:w-12 md:h-full md:border-r md:border-border md:flex-col md:items-center md:py-3 md:px-0 md:bg-[#050608]/95 md:backdrop-blur">
        <div className="w-7 h-7 rounded-md bg-rust/20 border border-rust/30 flex items-center justify-center mb-3 flex-shrink-0">
          <Zap size={13} className={clsx(isStopped ? 'text-t3' : 'text-rust')} />
        </div>

        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={`desktop-${to}`}
            to={to}
            end={to === '/'}
            title={label}
            aria-label={label}
            className={({ isActive }) => clsx(
              'w-8 h-8 rounded-md flex items-center justify-center transition-all duration-150 group relative flex-shrink-0',
              isActive
                ? 'bg-rust/15 border border-rust/25 text-rust'
                : 'text-t3 hover:text-t2 hover:bg-surface2'
            )}
          >
            <Icon size={15} />
          </NavLink>
        ))}

        <div className="flex-1" />

        <button
          onClick={toggleStop}
          disabled={pending}
          title={isStopped ? 'Start Agent' : 'STOP AGENT (Emergency)'}
          aria-label={isStopped ? 'Start Agent' : 'Stop Agent'}
          className={clsx(
            'w-8 h-8 rounded-md flex items-center justify-center transition-all duration-300 flex-shrink-0 mb-1',
            isStopped
              ? 'bg-red/20 border border-red/40 text-red animate-pulse'
              : 'text-t3 hover:text-red hover:bg-red/10 border border-transparent',
            pending && 'opacity-60 cursor-wait'
          )}
        >
          <Power size={15} className={clsx(isStopped && 'drop-shadow-[0_0_5px_rgba(255,0,0,0.8)]')} />
        </button>

        <NavLink
          to="/settings"
          title="Settings"
          aria-label="Settings"
          className={({ isActive }) => clsx(
            'w-8 h-8 rounded-md flex items-center justify-center transition-all duration-150 flex-shrink-0',
            isActive ? 'bg-rust/15 border border-rust/25 text-rust' : 'text-t3 hover:text-t2 hover:bg-surface2'
          )}
        >
          <Settings size={15} />
        </NavLink>
      </aside>

      <ActionGuardDialog
        guard={guard}
        pending={pending}
        onCancel={() => !pending && setGuard(null)}
        onConfirm={confirmGuard}
      />
      <Toast toast={toast} onDone={clearToast} />
    </>
  )
}
