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
        <Topbar onSearchOpen={() => setCmdOpen(true)} />
        <main className="flex-1 overflow-y-auto p-5">
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
