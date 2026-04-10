import { LayoutDashboard, MessageSquare, Brain, Clock, Wrench, CheckSquare, Terminal, ScrollText, Server, MessageCircle, Zap, DollarSign, Package, GitFork, User } from 'lucide-react'

export const navGroups = [
  {
    label: null, // top group — no label
    items: [
      { to: '/', icon: LayoutDashboard, label: 'Overblik' },
      { to: '/chat', icon: MessageCircle, label: 'Chat' },
      { to: '/sessions', icon: MessageSquare, label: 'Sessioner' },
    ],
  },
  {
    label: 'Ugentligt',
    items: [
      { to: '/memory', icon: Brain, label: 'Hukommelse' },
      { to: '/scheduled', icon: Clock, label: 'Planlagt' },
      { to: '/skills', icon: Wrench, label: 'Skills' },
      { to: '/approvals', icon: CheckSquare, label: 'Godkendelser' },
      { to: '/cost', icon: DollarSign, label: 'Omkostninger' },
    ],
  },
  {
    label: 'Avanceret',
    items: [
      { to: '/logs', icon: ScrollText, label: 'Logs' },
      { to: '/operations?tab=services', icon: Server, label: 'Drift' },
      { to: '/terminal', icon: Terminal, label: 'Terminal' },
      { to: '/mcp', icon: Package, label: 'MCP Tools' },
      { to: '/github', icon: GitFork, label: 'GitHub' },
    ],
  },
]

// Flattened list for backwards compat
export const navItems = navGroups.flatMap(g => g.items)

export const settingsItem = { to: '/profile', icon: User, label: 'Profil' }
export const brandIcon = Zap

const basicModeHiddenRoutes = new Set([
  '/memory', '/skills', '/logs', '/operations',
  '/terminal', '/mcp', '/github',
])

export function getVisibleNavItems(basicMode) {
  if (!basicMode) return navGroups
  return navGroups.map(g => ({
    ...g,
    items: g.items.filter(item => !basicModeHiddenRoutes.has(item.to)),
  })).filter(g => g.items.length > 0)
}
