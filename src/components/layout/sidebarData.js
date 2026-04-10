import { LayoutDashboard, MessageSquare, Brain, Clock, Wrench, CheckSquare, Terminal, ScrollText, Server, MessageCircle, Settings, Zap, DollarSign, Package, GitFork, User } from 'lucide-react'

export const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Overblik' },
  { to: '/chat', icon: MessageCircle, label: 'Chat' },
  { to: '/sessions', icon: MessageSquare, label: 'Sessioner' },
  { to: '/memory', icon: Brain, label: 'Hukommelse' },
  { to: '/scheduled', icon: Clock, label: 'Planlagt' },
  { to: '/skills', icon: Wrench, label: 'Skills' },
  { to: '/approvals', icon: CheckSquare, label: 'Godkendelser' },
  { to: '/logs', icon: ScrollText, label: 'Logs' },
  { to: '/operations?tab=services', icon: Server, label: 'Drift' },
  { to: '/terminal', icon: Terminal, label: 'Terminal' },
  { to: '/cost', icon: DollarSign, label: 'Omkostninger' },
  { to: '/mcp', icon: Package, label: 'MCP Tools' },
  { to: '/github', icon: GitFork, label: 'GitHub' },
  { to: '/profile', icon: User, label: 'Profil' },
]

export const settingsItem = { to: '/profile', icon: Settings, label: 'Profil' }
export const brandIcon = Zap

export const basicModeHiddenRoutes = [
  '/memory',
  '/skills',
  '/logs',
  '/operations',
  '/terminal',
  '/settings',
  '/mcp',
  '/github',
]

export function getVisibleNavItems(basicMode) {
  if (!basicMode) return navItems
  const hidden = new Set(basicModeHiddenRoutes)
  return navItems.filter((item) => !hidden.has(item.to))
}
