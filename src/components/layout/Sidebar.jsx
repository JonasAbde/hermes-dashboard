import { NavLink } from 'react-router-dom'
import { clsx } from 'clsx'
import {
  LayoutDashboard, MessageSquare, Brain, Clock, Wrench,
  CheckSquare, Terminal, Settings, Zap, MessageCircle,
  ScrollText
} from 'lucide-react'

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
  return (
    <aside className="w-12 h-full bg-[#050608] border-r border-border flex flex-col items-center py-3 gap-1 flex-shrink-0">
      {/* Logo */}
      <div className="w-7 h-7 rounded-md bg-rust/20 border border-rust/30 flex items-center justify-center mb-3 flex-shrink-0">
        <Zap size={13} className="text-rust" />
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
