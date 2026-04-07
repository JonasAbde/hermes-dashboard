import { NavLink } from 'react-router-dom'
import { clsx } from 'clsx'
import {
  LayoutDashboard, MessageSquare, Brain, Clock, Wrench,
  CheckSquare, Terminal, Settings, Zap, MessageCircle,
  ScrollText, Power
} from 'lucide-react'
import { usePoll } from '../../hooks/useApi'


const navItems = [
  { to: '/',          icon: LayoutDashboard, label: 'Overview'   },
  { to: '/chat',      icon: MessageCircle,    label: 'Chat'        },
  { to: '/sessions',  icon: MessageSquare,   label: 'Sessions'   },
  { to: '/memory',    icon: Brain,           label: 'Memory'     },
  { to: '/cron',      icon: Clock,           label: 'Cron'       },
  { to: '/skills',    icon: Wrench,          label: 'Skills'     },
  { to: '/approvals', icon: CheckSquare,     label: 'Approvals'  },
  { to: '/logs',      icon: ScrollText,      label: 'Logs'       },
  { to: '/terminal',  icon: Terminal,        label: 'Terminal'   },
]

export function Sidebar() {
  const { data: agent, refetch: refetchAgent } = usePoll('/agent/status', 5000)
  const isStopped = agent?.stopped === true

  const toggleStop = async () => {
    try {
      await fetch('/api/agent/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stopped: !isStopped })
      })
      refetchAgent()
    } catch {}
  }

  return (
    <aside className="w-12 h-full bg-[#050608] border-r border-border flex flex-col items-center py-3 gap-1 flex-shrink-0">
      {/* Logo */}
      <div className="w-7 h-7 rounded-md bg-rust/20 border border-rust/30 flex items-center justify-center mb-3 flex-shrink-0">
        <Zap size={13} className={clsx(isStopped ? "text-t3" : "text-rust")} />
      </div>

      {navItems.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          title={label}
          className={({ isActive }) => clsx(
            'w-8 h-8 rounded-md flex items-center justify-center transition-all duration-150 group relative',
            isActive
              ? 'bg-rust/15 border border-rust/25 text-rust'
              : 'text-t3 hover:text-t2 hover:bg-surface2'
          )}
        >
          <Icon size={15} />
        </NavLink>
      ))}

      <div className="flex-1" />

      {/* Agent Stop Toggle */}
      <button
        onClick={toggleStop}
        title={isStopped ? "Start Agent" : "STOP AGENT (Emergency)"}
        className={clsx(
          'w-8 h-8 rounded-md flex items-center justify-center transition-all duration-300 mb-1',
          isStopped 
            ? 'bg-red/20 border border-red/40 text-red animate-pulse' 
            : 'text-t3 hover:text-red hover:bg-red/10 border border-transparent'
        )}
      >
        <Power size={15} className={clsx(isStopped && "drop-shadow-[0_0_5px_rgba(255,0,0,0.8)]")} />
      </button>

      <NavLink
        to="/settings"
        title="Settings"
        className={({ isActive }) => clsx(
          'w-8 h-8 rounded-md flex items-center justify-center transition-all duration-150',
          isActive ? 'bg-rust/15 border border-rust/25 text-rust' : 'text-t3 hover:text-t2 hover:bg-surface2'
        )}
      >
        <Settings size={15} />
      </NavLink>
    </aside>
  )
}

