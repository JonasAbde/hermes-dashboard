import { LayoutDashboard, MessageSquare, Brain, Clock, Wrench, CheckSquare, Terminal, ScrollText, Server, MessageCircle, Settings, Zap, DollarSign } from 'lucide-react'

export const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Overview' },
  { to: '/chat', icon: MessageCircle, label: 'Chat' },
  { to: '/sessions', icon: MessageSquare, label: 'Sessions' },
  { to: '/memory', icon: Brain, label: 'Memory' },
  { to: '/scheduled', icon: Clock, label: 'Scheduled' },
  { to: '/skills', icon: Wrench, label: 'Skills' },
  { to: '/approvals', icon: CheckSquare, label: 'Approvals' },
  { to: '/logs', icon: ScrollText, label: 'Logs' },
  { to: '/operations', icon: Server, label: 'Operations' },
  { to: '/terminal', icon: Terminal, label: 'Terminal' },
  { to: '/cost', icon: DollarSign, label: 'Cost' },
]

export const settingsItem = { to: '/settings', icon: Settings, label: 'Settings' }
export const brandIcon = Zap

export const basicModeHiddenRoutes = [
  '/memory',
  '/skills',
  '/logs',
  '/operations',
  '/terminal',
  '/settings',
]

export function getVisibleNavItems(basicMode) {
  if (!basicMode) return navItems
  const hidden = new Set(basicModeHiddenRoutes)
  return navItems.filter((item) => !hidden.has(item.to))
}
