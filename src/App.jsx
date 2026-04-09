import { useState, useEffect, useCallback, Suspense, lazy } from 'react'
import { Routes, Route, useLocation, Navigate, useNavigate } from 'react-router-dom'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Sidebar } from './components/layout/Sidebar'
import { Topbar } from './components/layout/Topbar'
import { CommandPalette } from './components/CommandPalette'
import { LoginPage } from './pages/LoginPage'
import { getToken, setToken, setCsrfToken } from './utils/auth'
import { getBasicMode, BASIC_MODE_EVENT } from './utils/preferences'
import { ToastProvider, useToast } from './hooks/useToast'
import { Toast } from './components/ui/Toast'
import { ErrorBoundary } from './components/ui/ErrorBoundary'

const OverviewPage  = lazy(() => import('./pages/OverviewPage').then(m => ({ default: m.OverviewPage })))
const SessionsPage  = lazy(() => import('./pages/SessionsPage').then(m => ({ default: m.SessionsPage })))
const MemoryPage    = lazy(() => import('./pages/MemoryPage').then(m => ({ default: m.MemoryPage })))
const CronPage      = lazy(() => import('./pages/CronPage').then(m => ({ default: m.CronPage })))
const SkillsPage    = lazy(() => import('./pages/SkillsPage').then(m => ({ default: m.SkillsPage })))
const ApprovalsPage = lazy(() => import('./pages/ApprovalsPage').then(m => ({ default: m.ApprovalsPage })))
const TerminalPage  = lazy(() => import('./pages/TerminalPage').then(m => ({ default: m.TerminalPage })))
const SettingsPage  = lazy(() => import('./pages/SettingsPage').then(m => ({ default: m.SettingsPage })))
const ChatPage      = lazy(() => import('./pages/ChatPage').then(m => ({ default: m.ChatPage })))
const LogsPage      = lazy(() => import('./pages/LogsPage').then(m => ({ default: m.LogsPage })))
const OperationsPage= lazy(() => import('./pages/OperationsPage').then(m => ({ default: m.OperationsPage })))
const OnboardingPage= lazy(() => import('./pages/OnboardingPage').then(m => ({ default: m.OnboardingPage })))
const CostPage      = lazy(() => import('./pages/CostPage').then(m => ({ default: m.CostPage })))
const McpPage       = lazy(() => import('./pages/McpPage').then(m => ({ default: m.McpPage })))
const BASIC_MODE_HIDDEN_ROUTES = new Set(['/memory', '/skills', '/logs', '/operations', '/terminal', '/settings', '/cost', '/mcp'])

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-32">
      <div className="w-5 h-5 border-2 border-rust/30 border-t-rust rounded-full animate-spin" />
    </div>
  )
}

function ToastWithContext() {
  const { toast, dismissToast } = useToast()
  return <Toast toast={toast} onDone={dismissToast} />
}

function ApiStatusBanner() {
  const [apiStatus, setApiStatus] = useState('checking')
  const [checkNonce, setCheckNonce] = useState(0)

  const check = useCallback(async () => {
    try {
      const res = await fetch('/api/stats')
      setApiStatus(res.ok ? 'ok' : 'error')
    } catch {
      setApiStatus('error')
    }
  }, [])

  useEffect(() => {
    check()
    const interval = setInterval(check, 30000)
    return () => clearInterval(interval)
  }, [check, checkNonce])

  if (apiStatus === 'ok') return null

  return (
    <div className="flex items-center justify-between px-3 py-1.5 text-xs"
      style={{ background: '#2a150a', borderBottom: '1px solid #4a2010', color: '#e05f40' }}>
      <div className="flex items-center gap-1.5">
        <AlertTriangle size={12} />
        <span>API unreachable — some data may be stale</span>
      </div>
      <button
        onClick={() => {
          setApiStatus('checking')
          setCheckNonce((value) => value + 1)
        }}
        className="flex items-center gap-1 hover:opacity-80"
      >
        <RefreshCw size={11} />
        <span>Retry</span>
      </button>
    </div>
  )
}

function DashboardShell() {
  const [cmdOpen, setCmdOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [basicMode, setBasicMode] = useState(() => getBasicMode())
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setCmdOpen(o => !o)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  useEffect(() => {
    setSidebarOpen(false)
  }, [location.pathname])

  useEffect(() => {
    const onModeChange = () => setBasicMode(getBasicMode())
    window.addEventListener('storage', onModeChange)
    window.addEventListener(BASIC_MODE_EVENT, onModeChange)
    return () => {
      window.removeEventListener('storage', onModeChange)
      window.removeEventListener(BASIC_MODE_EVENT, onModeChange)
    }
  }, [])

  useEffect(() => {
    if (basicMode && BASIC_MODE_HIDDEN_ROUTES.has(location.pathname)) {
      navigate('/', { replace: true })
    }
  }, [basicMode, location.pathname, navigate])

  return (
    <ToastProvider>
      <div className="flex h-[100dvh] overflow-hidden bg-bg">
        <Sidebar
          mobileOpen={sidebarOpen}
          onMobileClose={() => setSidebarOpen(false)}
          onSearchOpen={() => setCmdOpen(true)}
        />
        <div className="flex flex-col flex-1 overflow-hidden min-w-0">
          <ApiStatusBanner />
          <Topbar onSearchOpen={() => setCmdOpen(true)} onMenuOpen={() => setSidebarOpen(true)} />
          <main className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-3 pb-5 pt-3 sm:px-5 sm:pt-5">
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/"          element={<ErrorBoundary><OverviewPage /></ErrorBoundary>} />
                <Route path="/sessions"  element={<ErrorBoundary><SessionsPage /></ErrorBoundary>} />
                <Route path="/memory"    element={basicMode ? <Navigate to="/" replace /> : <ErrorBoundary><MemoryPage /></ErrorBoundary>} />
                <Route path="/cron"      element={<ErrorBoundary><CronPage /></ErrorBoundary>} />
                <Route path="/scheduled" element={<ErrorBoundary><CronPage /></ErrorBoundary>} />
                <Route path="/skills"    element={basicMode ? <Navigate to="/" replace /> : <ErrorBoundary><SkillsPage /></ErrorBoundary>} />
                <Route path="/approvals" element={<ErrorBoundary><ApprovalsPage /></ErrorBoundary>} />
                <Route path="/terminal"  element={basicMode ? <Navigate to="/" replace /> : <ErrorBoundary><TerminalPage /></ErrorBoundary>} />
                <Route path="/settings"  element={basicMode ? <Navigate to="/" replace /> : <ErrorBoundary><SettingsPage /></ErrorBoundary>} />
                <Route path="/chat"      element={<ErrorBoundary><ChatPage /></ErrorBoundary>} />
                <Route path="/logs"      element={basicMode ? <Navigate to="/" replace /> : <ErrorBoundary><LogsPage /></ErrorBoundary>} />
                <Route path="/operations" element={basicMode ? <Navigate to="/" replace /> : <ErrorBoundary><OperationsPage /></ErrorBoundary>} />
                <Route path="/onboarding" element={<ErrorBoundary><OnboardingPage /></ErrorBoundary>} />
                <Route path="/cost"      element={basicMode ? <Navigate to="/" replace /> : <ErrorBoundary><CostPage /></ErrorBoundary>} />
                <Route path="/mcp"        element={basicMode ? <Navigate to="/" replace /> : <ErrorBoundary><McpPage /></ErrorBoundary>} />
              </Routes>
            </Suspense>
          </main>
        </div>
        <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} />
        <ToastWithContext />
      </div>
    </ToastProvider>
  )
}

// Blockers 1+2 fix: replace unconditional DEMO_TOKEN injection with a proper
// auth-check against the backend. This prevents stale token collisions when
// a user later adds DASHBOARD_TOKEN to their .env.
const DEMO_TOKEN='***'
;(async () => {
  if (getToken()) return  // already have a token, skip
  try {
    const res = await fetch('/api/auth/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: DEMO_TOKEN }),
    })
    if (res.ok) {
      const data = await res.json()
      // Only auto-login if auth is disabled and verify endpoint accepted it
      if (data?.ok && !data?.hasToken) {
        if (data?.csrfToken) setCsrfToken(data.csrfToken)
        setToken(DEMO_TOKEN)
      }
    }
  } catch {
    // Network error — stay on login page, don't inject invalid token
  }
})()

export default function App() {
  const token = getToken()
  const isAuthenticated = Boolean(token)

  return isAuthenticated ? <DashboardShell /> : <LoginPage />
}
