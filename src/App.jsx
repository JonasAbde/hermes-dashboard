import { useState, useEffect } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import { Sidebar } from './components/layout/Sidebar'
import { Topbar } from './components/layout/Topbar'
import { CommandPalette } from './components/CommandPalette'
import { OverviewPage }  from './pages/OverviewPage'
import { SessionsPage }  from './pages/SessionsPage'
import { MemoryPage }    from './pages/MemoryPage'
import { CronPage }      from './pages/CronPage'
import { SkillsPage }    from './pages/SkillsPage'
import { ApprovalsPage } from './pages/ApprovalsPage'
import { TerminalPage }  from './pages/TerminalPage'
import { SettingsPage }  from './pages/SettingsPage'
import { ChatPage }       from './pages/ChatPage'
import { LogsPage }       from './pages/LogsPage'
import { OperationsPage } from './pages/OperationsPage'
import { LoginPage }      from './pages/LoginPage'
import { OnboardingPage } from './pages/OnboardingPage'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { getToken, clearToken, setToken } from './utils/auth'
import { ToastProvider, useToast } from './hooks/useToast'
import { Toast } from './components/ui/Toast'
import { ErrorBoundary } from './components/ui/ErrorBoundary'

function ToastWithContext() {
  const { toast, dismissToast } = useToast()
  return <Toast toast={toast} onDone={dismissToast} />
}

function ApiStatusBanner() {
  const [apiStatus, setApiStatus] = useState('checking')

  useEffect(() => {
    let mounted = true
    const check = async () => {
      try {
        const res = await fetch('/api/stats')
        if (mounted) setApiStatus(res.ok ? 'ok' : 'error')
      } catch {
        if (mounted) setApiStatus('error')
      }
    }
    check()
    const interval = setInterval(check, 30000)
    return () => { mounted = false; clearInterval(interval) }
  }, [])

  if (apiStatus === 'ok') return null

  return (
    <div className="flex items-center justify-between px-3 py-1.5 text-xs"
      style={{ background: '#2a150a', borderBottom: '1px solid #4a2010', color: '#e05f40' }}>
      <div className="flex items-center gap-1.5">
        <AlertTriangle size={12} />
        <span>API unreachable — some data may be stale</span>
      </div>
      <button onClick={() => setApiStatus('checking')} className="flex items-center gap-1 hover:opacity-80">
        <RefreshCw size={11} />
        <span>Retry</span>
      </button>
    </div>
  )
}

function DashboardShell() {
  const [cmdOpen, setCmdOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()

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
            <Routes>
              <Route path="/"          element={<ErrorBoundary><OverviewPage /></ErrorBoundary>} />
              <Route path="/sessions"  element={<ErrorBoundary><SessionsPage /></ErrorBoundary>} />
              <Route path="/memory"    element={<ErrorBoundary><MemoryPage /></ErrorBoundary>} />
              <Route path="/cron"      element={<ErrorBoundary><CronPage /></ErrorBoundary>} />
              <Route path="/skills"    element={<ErrorBoundary><SkillsPage /></ErrorBoundary>} />
              <Route path="/approvals" element={<ErrorBoundary><ApprovalsPage /></ErrorBoundary>} />
              <Route path="/terminal"  element={<ErrorBoundary><TerminalPage /></ErrorBoundary>} />
              <Route path="/settings"  element={<ErrorBoundary><SettingsPage /></ErrorBoundary>} />
              <Route path="/chat"      element={<ErrorBoundary><ChatPage /></ErrorBoundary>} />
              <Route path="/logs"      element={<ErrorBoundary><LogsPage /></ErrorBoundary>} />
              <Route path="/operations" element={<ErrorBoundary><OperationsPage /></ErrorBoundary>} />
            </Routes>
          </main>
        </div>
        <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} />
        <ToastWithContext />
      </div>
    </ToastProvider>
  )
}

// Auto-login: if backend has no AUTH_SECRET set (local-only install),
// populate a dummy token so the dashboard shell renders immediately.
// The backend skips auth when DASHBOARD_TOKEN is absent in .env.
const DEMO_TOKEN = '__local_only__'
if (!getToken()) {
  setToken(DEMO_TOKEN)
}

export default function App() {
  const token = getToken()
  const isAuthenticated = Boolean(token)

  return isAuthenticated ? <DashboardShell /> : <LoginPage />
}
