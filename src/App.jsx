import { useState, useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
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
import { getToken, clearToken } from './utils/auth'
import { ToastProvider, useToast } from './hooks/useToast'
import { Toast } from './components/ui/Toast'


// ─── Toast wrapper that consumes context ────────────────────────────────────
function ToastWithContext() {
  const { toast, dismissToast } = useToast()
  return <Toast toast={toast} onDone={dismissToast} />
}

// ─── API status banner ───────────────────────────────────────────────────────
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

  return (
    <ToastProvider>
      <div className="flex h-[100dvh] overflow-hidden bg-bg">
        <Sidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <ApiStatusBanner />
          <Topbar onSearchOpen={() => setCmdOpen(true)} />
          <main className="flex-1 overflow-y-auto p-3 pb-20 sm:p-5 sm:pb-5">
            <Routes>
              <Route path="/"          element={<OverviewPage />} />
              <Route path="/sessions"  element={<SessionsPage />} />
              <Route path="/memory"    element={<MemoryPage />} />
              <Route path="/cron"      element={<CronPage />} />
              <Route path="/skills"    element={<SkillsPage />} />
              <Route path="/approvals" element={<ApprovalsPage />} />
              <Route path="/terminal"  element={<TerminalPage />} />
              <Route path="/settings"  element={<SettingsPage />} />
              <Route path="/chat"      element={<ChatPage />} />
              <Route path="/logs"      element={<LogsPage />} />
              <Route path="/operations" element={<OperationsPage />} />
            </Routes>
          </main>
        </div>
        <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} />
        <ToastWithContext />
      </div>
    </ToastProvider>
  )
}

export default function App() {
  // Auth is optional — if DASHBOARD_TOKEN is set in .env, require login.
  // Otherwise, show dashboard directly (single-user local setup).
  const [authState, setAuthState] = useState(null) // null=checking, false=no-auth, true=authed
  const [onboardingNeeded, setOnboardingNeeded] = useState(null) // null=checking

  useEffect(() => {
    // Check both auth and onboarding status in parallel
    Promise.all([
      fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: '' }),
      }).then(r => r.json()),
      fetch('/api/onboarding/status').then(r => r.json()).catch(() => ({ needsOnboarding: true })),
    ])
      .then(([authData, onboardingData]) => {
        // Auth: hasToken=false → no auth needed
        if (!authData.hasToken) {
          setAuthState(false)
        } else {
          const stored = getToken()
          if (stored) {
            fetch('/api/auth/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ token: stored }),
            })
              .then(r => r.json())
              .then(d => setAuthState(!d.ok)) // d.ok=false means invalid token → go to login
              .catch(() => setAuthState(true))
          } else {
            setAuthState(true)
          }
        }
        // Onboarding: based on actual config, not localStorage
        setOnboardingNeeded(onboardingData.needsOnboarding)
      })
      .catch(() => {
        setAuthState(false)
        setOnboardingNeeded(true)
      })
  }, [])

  if (authState === null || onboardingNeeded === null) {
    return (
      <div className="flex h-screen items-center justify-center bg-bg">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand/30 border-t-brand" />
          <span className="text-sm text-muted">Indlæser...</span>
        </div>
      </div>
    )
  }

  if (authState === true) return <LoginPage />

  // Auto-redirect to onboarding if no provider is configured yet
  if (onboardingNeeded === true) return <OnboardingPage />

  return <DashboardShell />
}
