import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { usePoll } from '../../hooks/useApi'
import { Toast } from '../ui/Toast'
import { ActionGuardDialog } from '../ui/ActionGuardDialog'
import { getActionGuardrail } from '../../utils/actionGuardrails'
import { apiFetch } from '../../utils/auth'
import { navItems, settingsItem, brandIcon as BrandIcon } from './sidebarData'
import { SidebarRail } from './SidebarRail'
import { SidebarDrawer } from './SidebarDrawer'

export function Sidebar({ mobileOpen = false, onMobileClose, onSearchOpen }) {
  const location = useLocation()
  const { data: agent, refetch: refetchAgent } = usePoll('/agent/status', 5000)
  const isStopped = agent?.stopped === true
  const [pending, setPending] = useState(false)
  const [toast, setToast] = useState(null)
  const [guard, setGuard] = useState(null)

  const clearToast = () => setToast(null)

  /* Close mobile drawer on route change */
  const pathnameRef = useRef(location.pathname)
  useEffect(() => {
    if (pathnameRef.current !== location.pathname) {
      pathnameRef.current = location.pathname
      if (mobileOpen && onMobileClose) onMobileClose()
    }
  }, [location.pathname])

  const performToggleStop = async (nextStopped) => {
    setPending(true)
    try {
      const res = await apiFetch('/api/agent/status', {
        method: 'POST',
        body: JSON.stringify({ stopped: nextStopped })
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setToast({ type: 'error', message: body.error || `HTTP ${res.status}` })
        return
      }
      setToast({
        type: 'success',
        message: nextStopped
          ? 'Agent stopped. New Hermes automation is now paused.'
          : 'Agent resumed. Hermes can accept new work again.',
      })
      refetchAgent()
    } catch (e) {
      setToast({ type: 'error', message: e.message || 'Failed to update agent state' })
    } finally {
      setPending(false)
    }
  }

  const toggleStop = async () => {
    if (pending) return
    const nextStopped = !isStopped
    const nextGuard = getActionGuardrail({ type: 'agent-status', nextStopped })
    if (nextGuard) {
      setGuard({ ...nextGuard, action: { type: 'agent-status', nextStopped } })
      return
    }
    await performToggleStop(nextStopped)
  }

  const confirmGuard = async () => {
    const action = guard?.action
    if (!action) return
    setGuard(null)
    if (action.type === 'agent-status') {
      await performToggleStop(action.nextStopped)
    }
  }

  return (
    <>
      <SidebarRail
        brandIcon={BrandIcon}
        isStopped={isStopped}
        navItems={navItems}
        settingsItem={settingsItem}
        pending={pending}
        onToggleStop={toggleStop}
      />

      <SidebarDrawer
        open={mobileOpen}
        onClose={onMobileClose}
        isStopped={isStopped}
        pending={pending}
        navItems={navItems}
        settingsItem={settingsItem}
        onToggleStop={toggleStop}
        onSearchOpen={onSearchOpen}
      />

      <ActionGuardDialog
        guard={guard}
        pending={pending}
        onCancel={() => !pending && setGuard(null)}
        onConfirm={confirmGuard}
      />
      <Toast toast={toast} onDone={clearToast} />
    </>
  )
}
