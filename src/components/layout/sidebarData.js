import { LayoutDashboard, MessageSquare, Brain, Clock, Wrench, CheckSquare, Terminal, ScrollText, Server, MessageCircle, Settings, Zap } from 'lucide-react'

export const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Overview' },
  { to: '/chat', icon: MessageCircle, label: 'Chat' },
  { to: '/sessions', icon: MessageSquare, label: 'Sessions' },
  { to: '/memory', icon: Brain, label: 'Memory' },
  { to: '/cron', icon: Clock, label: 'Cron' },
  { to: '/skills', icon: Wrench, label: 'Skills' },
  { to: '/approvals', icon: CheckSquare, label: 'Approvals' },
  { to: '/logs', icon: ScrollText, label: 'Logs' },
  { to: '/operations', icon: Server, label: 'Operations' },
  { to: '/terminal', icon: Terminal, label: 'Terminal' },
]

export const settingsItem = { to: '/settings', icon: Settings, label: 'Settings' }
export const brandIcon = Zap
