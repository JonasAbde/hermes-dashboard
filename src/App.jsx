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
import { AlertTriangle, RefreshCw } from 'lucide-react'

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
      <button
        onClick={() => setApiStatus('checking')}
        className="flex items-center gap-1 hover:opacity-80"
      >
        <RefreshCw size={11} />
        <span>Retry</span>
      </button>
    </div>
  )
}

export default function App() {
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
    <div className="flex h-screen overflow-hidden bg-bg">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <ApiStatusBanner />
        <Topbar onSearchOpen={() => setCmdOpen(true)} />
        <main className="flex-1 overflow-y-auto p-3 sm:p-5">
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
          </Routes>
        </main>
      </div>
      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} />
    </div>
  )
}
