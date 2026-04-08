import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

// Helper: wrap component in MemoryRouter
function renderWithRouter(ui, { route = '/' } = {}) {
  return render(<MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>)
}

// Mock API responses
const mockApiData = {
  '/api/stats': { sessions_today: 5, sessions_week: 30, tokens_today: 12000, cost_month: 4.23, budget: '25.00', daily_costs: [], recent_sessions: [] },
  '/api/mcp': { servers: [], running_count: 0, total: 0 },
  '/api/gateway': { status: 'running', username: 'tester', uptime_s: 3600 },
  '/api/ekg': { points: [], last_beat: Date.now(), avg_latency_ms: 120 },
  '/api/heatmap': { grid: [] },
  '/api/agent': { rhythm: 'balanced', stopped: false },
  '/api/platforms': { platforms: [] },
  '/api/recommendations': { items: [] },
  '/api/sessions': { sessions: [] },
  '/api/memory/stats': { memory_pct: 42, memory: { chars: 5000, lines: 120, entries: 15, size_kb: 5 }, max_chars: 250000 },
  '/api/cron': { jobs: [] },
  '/api/skills': { skills: [] },
  '/api/approvals': { pending: [] },
  '/api/models': { models: [], current: 'gpt-4o' },
  '/api/config': { personalities: ['default'], current_personality: 'default' },
  '/api/system/info': { hostname: 'test', platform: 'linux', arch: 'x64', cpu_count: 4, uptime_s: 86400, mem_pct: 55, used_mem_mb: 2048, free_mem_mb: 2048 },
  '/api/logs/files': { files: [] },
  '/api/auth/verify': { ok: true, hasToken: false },
}

beforeEach(() => {
  vi.restoreAllMocks()
  globalThis.fetch = vi.fn((url) => {
    const path = typeof url === 'string' ? url : url.toString()
    const data = Object.entries(mockApiData).find(([k]) => path.includes(k))?.[1] ?? {}
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve(data),
    })
  })
  localStorage.setItem('hermes_dashboard_token', 'test-token')
})

// --- Page smoke tests ---

describe('OverviewPage', () => {
  it('renders without crashing', async () => {
    const { OverviewPage } = await import('../pages/OverviewPage')
    renderWithRouter(<OverviewPage />)
    expect(screen.getByText(/Hermes overview/i)).toBeInTheDocument()
  })
})

describe('SettingsPage', () => {
  it('renders without crashing', async () => {
    const { SettingsPage } = await import('../pages/SettingsPage')
    renderWithRouter(<SettingsPage />)
    expect(screen.getByText(/Settings/i)).toBeInTheDocument()
  })
})

describe('ChatPage', () => {
  it('renders without crashing', async () => {
    const { ChatPage } = await import('../pages/ChatPage')
    renderWithRouter(<ChatPage />)
    expect(document.querySelector('[class*="flex"]')).toBeTruthy()
  })
})

describe('SessionsPage', () => {
  it('renders without crashing', async () => {
    const { SessionsPage } = await import('../pages/SessionsPage')
    renderWithRouter(<SessionsPage />)
    expect(document.querySelector('[class*="flex"]')).toBeTruthy()
  })
})

describe('MemoryPage', () => {
  it('renders without crashing', async () => {
    const { MemoryPage } = await import('../pages/MemoryPage')
    renderWithRouter(<MemoryPage />)
    expect(document.querySelector('[class*="flex"]')).toBeTruthy()
  })
})

describe('CronPage', () => {
  it('renders without crashing', async () => {
    const { CronPage } = await import('../pages/CronPage')
    renderWithRouter(<CronPage />)
    expect(document.querySelector('[class*="flex"]')).toBeTruthy()
  })
})

describe('SkillsPage', () => {
  it('renders without crashing', async () => {
    const { SkillsPage } = await import('../pages/SkillsPage')
    renderWithRouter(<SkillsPage />)
    expect(document.querySelector('[class*="flex"]')).toBeTruthy()
  })
})

describe('ApprovalsPage', () => {
  it('renders without crashing', async () => {
    const { ApprovalsPage } = await import('../pages/ApprovalsPage')
    renderWithRouter(<ApprovalsPage />)
    expect(document.querySelector('[class*="flex"]')).toBeTruthy()
  })
})

describe('LogsPage', () => {
  it('renders without crashing', async () => {
    const { LogsPage } = await import('../pages/LogsPage')
    renderWithRouter(<LogsPage />)
    expect(document.querySelector('[class*="flex"]')).toBeTruthy()
  })
})

describe('LoginPage', () => {
  it('renders without crashing', async () => {
    const { LoginPage } = await import('../pages/LoginPage')
    renderWithRouter(<LoginPage />)
    expect(document.querySelector('[class*="flex"]')).toBeTruthy()
  })
})

describe('TerminalPage', () => {
  it('renders without crashing', async () => {
    const { TerminalPage } = await import('../pages/TerminalPage')
    renderWithRouter(<TerminalPage />)
    expect(document.querySelector('[class*="flex"]')).toBeTruthy()
  })
})

describe('OperationsPage', () => {
  it('renders without crashing', async () => {
    const { OperationsPage } = await import('../pages/OperationsPage')
    renderWithRouter(<OperationsPage />)
    expect(document.querySelector('[class*="flex"]')).toBeTruthy()
  })
})

describe('CommandPalette', () => {
  it('renders when open', async () => {
    const { CommandPalette } = await import('../components/CommandPalette')
    renderWithRouter(<CommandPalette open={true} onClose={() => {}} />)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('does not render when closed', async () => {
    const { CommandPalette } = await import('../components/CommandPalette')
    const { container } = renderWithRouter(<CommandPalette open={false} onClose={() => {}} />)
    expect(container.innerHTML).toBe('')
  })
})
