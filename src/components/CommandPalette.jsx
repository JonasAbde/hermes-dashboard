import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { clsx } from 'clsx'
import {
  Search, Compass, Zap, MessageSquare,
  Settings, Terminal, Send, X, User,
  RefreshCw, Trash2, Sun, Moon,
  LayoutDashboard, Users, Brain, Calendar,
  CheckSquare, ChevronRight,
} from 'lucide-react'
import { Toast } from './ui/Toast'
import { LoadingSpinner } from './ui/Loaders'
import { ActionGuardDialog } from './ui/ActionGuardDialog'
import { getActionGuardrail } from '../utils/actionGuardrails'
import { apiFetch } from '../utils/auth'

// ── Command palette routes (not in basic-mode nav items) ────────────────────
const CMD_NAV_EXTRA = [
  { id: 'cmd-skills',      group: 'Navigation', icon: Brain,          label: 'Go to Skills',      to: '/skills' },
  { id: 'cmd-operations',  group: 'Navigation', icon: Compass,       label: 'Go to Operations',  to: '/operations' },
]

// ── Navigation items ───────────────────────────────────────────────────────
const NAV_ITEMS = [
  { id: 'nav-overview',   group: 'Navigation', icon: LayoutDashboard, label: 'Go to Overview',   to: '/' },
  { id: 'nav-sessions',   group: 'Navigation', icon: Users,           label: 'Go to Sessions',   to: '/sessions' },
  { id: 'nav-chat',       group: 'Navigation', icon: MessageSquare,   label: 'Go to Chat',       to: '/chat' },
  { id: 'nav-memory',     group: 'Navigation', icon: Brain,           label: 'Go to Memory',     to: '/memory' },
  { id: 'nav-cron',       group: 'Navigation', icon: Calendar,        label: 'Go to Cron',       to: '/cron' },
  { id: 'nav-approvals',  group: 'Navigation', icon: CheckSquare,     label: 'Go to Approvals',  to: '/approvals' },
  { id: 'nav-terminal',   group: 'Navigation', icon: Terminal,        label: 'Open Terminal',    to: '/terminal' },
  { id: 'nav-settings',   group: 'Navigation', icon: Settings,        label: 'Go to Settings',   to: '/settings' },
]

// ── Action items ───────────────────────────────────────────────────────────
const ACTION_ITEMS = [
  {
    id: 'action-restart',
    group: 'Actions',
    icon: RefreshCw,
    label: 'Restart Gateway',
    description: 'POST /api/control/gateway/restart',
    shortcut: null,
    action: 'restart-gateway',
  },
  {
    id: 'action-refresh',
    group: 'Actions',
    icon: RefreshCw,
    label: 'Refresh all data',
    description: 'Re-fetch data on current page',
    shortcut: null,
    action: 'refresh-data',
  },
  {
    id: 'action-clear-chat',
    group: 'Actions',
    icon: Trash2,
    label: 'Clear chat',
    description: 'Clear all messages on chat page',
    shortcut: null,
    action: 'clear-chat',
  },
  {
    id: 'action-theme',
    group: 'Actions',
    icon: Sun,
    label: 'Toggle dark / light mode',
    description: 'Switch between dark and light theme',
    shortcut: null,
    action: 'toggle-theme',
  },
  {
    id: 'action-terminal',
    group: 'Actions',
    icon: Terminal,
    label: 'Open terminal',
    description: 'Navigate to terminal page',
    shortcut: null,
    action: 'goto-terminal',
  },
]

// ── Quick Ask item (dynamic, only shown when query non-empty) ─────────────
const QUICK_ASK_BASE = {
  id: 'quick-ask',
  group: 'Quick Ask',
  icon: MessageSquare,
  label: 'Ask Hermes',
  shortcut: null,
  action: 'quick-ask',
}

// ── Recent storage key ─────────────────────────────────────────────────────
const RECENT_KEY = 'hermes_cmd_recent'
const MAX_RECENT = 5

function getRecent() {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]') } catch { return [] }
}
function pushRecent(to) {
  const prev = getRecent().filter(r => r !== to)
  const next = [to, ...prev].slice(0, MAX_RECENT)
  localStorage.setItem(RECENT_KEY, JSON.stringify(next))
}

// ── Fuzzy filter ───────────────────────────────────────────────────────────
function fuzzy(items, query) {
  if (!query) return items
  const q = query.toLowerCase()
  return items.filter(item =>
    item.label.toLowerCase().includes(q) ||
    (item.description || '').toLowerCase().includes(q)
  )
}

// ── Main component ─────────────────────────────────────────────────────────
export function CommandPalette({ open, onClose }) {
  const [query, setQuery]         = useState('')
  const [selected, setSelected]    = useState(0)
  const [recent, setRecent]        = useState(getRecent)
  const [toast, setToast]          = useState(null)
  const [loadingId, setLoadingId]  = useState(null)
  const [guard, setGuard]          = useState(null)
  const inputRef                   = useRef(null)
  const listRef                    = useRef(null)
  const navigate                  = useNavigate()

  // ── Focus & reset when opened ────────────────────────────────────────────
  useEffect(() => {
    if (open) {
      setQuery('')
      setSelected(0)
      setRecent(getRecent())
      setTimeout(() => inputRef.current?.focus(), 40)
    }
  }, [open])

  // ── Show toast helper ────────────────────────────────────────────────────
  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type })
  }, [])

  const clearToast = useCallback(() => setToast(null), [])

  const executeGatewayRestart = useCallback(async (item) => {
    setLoadingId(item.id)
    try {
      const res = await apiFetch('/api/control/gateway/restart', { method: 'POST' })
      const body = await res.json().catch(() => ({}))
      if (res.ok) {
        showToast(body.message || 'Gateway restart initiated', 'success')
      } else {
        showToast(body.error || `Server error ${res.status}`, 'error')
      }
    } catch {
      showToast('Failed to reach server', 'error')
    } finally {
      setLoadingId(null)
      onClose()
    }
  }, [onClose, showToast])

  // ── Action executors ─────────────────────────────────────────────────────
  const executeAction = useCallback(async (item) => {
    const action = item.action

    if (action === 'restart-gateway') {
      const nextGuard = getActionGuardrail({ type: 'api', target: '/api/control/gateway/restart' })
      if (nextGuard) {
        setGuard({ ...nextGuard, item })
        return
      }
      await executeGatewayRestart(item)
      return
    }

    if (action === 'refresh-data') {
      window.dispatchEvent(new CustomEvent('hermes:refresh'))
      showToast('Data refresh triggered', 'success')
      onClose()
      return
    }

    if (action === 'clear-chat') {
      window.dispatchEvent(new CustomEvent('hermes:clear-chat'))
      showToast('Chat cleared', 'success')
      onClose()
      return
    }

    if (action === 'toggle-theme') {
      const isDark = document.documentElement.classList.contains('dark')
      if (isDark) {
        document.documentElement.classList.remove('dark')
        document.documentElement.style.colorScheme = 'light'
        showToast('Switched to light mode', 'success')
      } else {
        document.documentElement.classList.add('dark')
        document.documentElement.style.colorScheme = 'dark'
        showToast('Switched to dark mode', 'success')
      }
      onClose()
      return
    }

    if (action === 'goto-terminal') {
      navigate('/terminal')
      onClose()
      return
    }

    if (action === 'quick-ask') {
      const msg = encodeURIComponent(query.trim())
      navigate(`/chat?msg=${msg}`)
      onClose()
      return
    }
  }, [query, navigate, onClose, showToast, executeGatewayRestart])

  // ── Navigation executor ──────────────────────────────────────────────────
  const executeNav = useCallback((item) => {
    navigate(item.to)
    pushRecent(item.to)
    setRecent(getRecent())
    onClose()
  }, [navigate, onClose])

  // ── Build flat list of visible items ─────────────────────────────────────
  const navFiltered    = fuzzy(NAV_ITEMS, query)
  const actFiltered    = fuzzy(ACTION_ITEMS, query)
  const recFiltered   = fuzzy(
    recent.map(to => ({ ...NAV_ITEMS.find(n => n.to === to), to })).filter(Boolean),
    query
  )

  const hasQuickAsk    = query.trim().length > 0

  const quickAskItem = hasQuickAsk
    ? [{ ...QUICK_ASK_BASE, label: `Ask Hermes: ${query.trim().slice(0, 48)}${query.trim().length > 48 ? '…' : ''}` }]
    : []

  const allItems = [...navFiltered, ...actFiltered, ...quickAskItem, ...recFiltered]

  // ── Keyboard handler ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return

    const handler = (e) => {
      if (e.key === 'Escape') { onClose(); return }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelected(s => Math.min(s + 1, allItems.length - 1))
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelected(s => Math.max(s - 1, 0))
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        const item = allItems[selected]
        if (!item) return
        if (item.group === 'Navigation' || item.group === 'Recent') executeNav(item)
        else if (item.group === 'Quick Ask') executeAction(item)
        else if (item.group === 'Actions') executeAction(item)
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, selected, allItems, executeNav, executeAction, onClose])

  // ── Scroll selected item into view ──────────────────────────────────────
  useEffect(() => {
    if (!listRef.current) return
    const btns = listRef.current.querySelectorAll('[data-cmd-item]')
    btns[selected]?.scrollIntoView?.({ block: 'nearest' })
  }, [selected])

  const handleItemClick = useCallback((item, flatIndex) => {
    setSelected(flatIndex)
    if (item.group === 'Navigation' || item.group === 'Recent') executeNav(item)
    else executeAction(item)
  }, [executeNav, executeAction])

  const GroupHeader = ({ label }) => (
    <div className="px-4 py-1.5 text-[10px] font-mono tracking-widest text-t2 uppercase">
      {label}
    </div>
  )

  const renderRow = (item, flatIndex) => {
    if (!item) return null
    const isSelected    = flatIndex === selected
    const isLoading     = loadingId === item.id
    const Icon          = item.icon || Compass

    return (
      <button
        key={item.id || item.to || flatIndex}
        data-cmd-item
        onClick={() => handleItemClick(item, flatIndex)}
        className={clsx(
          "w-full flex items-center gap-2.5 px-4 py-2 border-l-2 cursor-pointer text-left transition-colors duration-75",
          isSelected ? "bg-surface2 border-rust" : "bg-transparent border-transparent hover:bg-surface"
        )}
      >
        {/* Icon */}
        <div className={clsx(
          "w-7 h-7 rounded-md flex items-center justify-center shrink-0",
          isSelected ? "bg-rust/20 text-rust" : "bg-surface text-t2"
        )}>
          {isLoading ? <div className={isSelected ? "text-rust" : "text-t2"}><LoadingSpinner /></div> : <Icon size={13} />}
        </div>

        {/* Label + description */}
        <div className="flex-1 min-w-0">
          <div className={clsx(
            "text-[13px] whitespace-nowrap overflow-hidden text-ellipsis leading-snug",
            isSelected ? "text-t1 font-medium" : "text-t1 font-normal"
          )}>
            {item.label}
          </div>
          {item.description && (
            <div className="text-[11px] text-t2 whitespace-nowrap overflow-hidden text-ellipsis font-mono">
              {item.description}
            </div>
          )}
        </div>

        {/* Right hint */}
        {item.group === 'Quick Ask' && (
          <span className="text-[10px] font-mono text-green shrink-0">↵</span>
        )}
        {item.group === 'Recent' && (
          <ChevronRight size={12} className="text-t2 shrink-0" />
        )}
      </button>
    )
  }

  useEffect(() => { setSelected(0) }, [query])

  if (!open) return null

  const hasNav     = navFiltered.length > 0
  const hasAct     = actFiltered.length > 0
  const hasRec     = recFiltered.length > 0
  const hasAny     = hasNav || hasAct || hasQuickAsk || hasRec

  const navCount   = navFiltered.length
  const actCount   = actFiltered.length
  const qaCount    = quickAskItem.length

  return (
    <>
      <div
        onClick={onClose}
        className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm"
        aria-hidden="true"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="fixed top-[18vh] left-1/2 -translate-x-1/2 z-[101] w-full max-w-[560px] bg-surface border border-border2 rounded-2xl shadow-[0_24px_80px_rgba(0,0,0,0.7),0_0_0_1px_rgba(255,255,255,0.04)] overflow-hidden font-sans"
      >

        {/* Search input row */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Search size={15} className="text-rust shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => { setQuery(e.target.value); setSelected(0) }}
            placeholder="Search pages, actions, or ask Hermes…"
            className="flex-1 bg-transparent border-none outline-none text-t1 text-sm font-sans"
          />
          {query && (
            <button
              onClick={() => { setQuery(''); inputRef.current?.focus() }}
              className="bg-surface2 border border-border rounded-md px-2 py-0.5 text-[11px] text-t2 font-mono hover:text-t1 transition-colors"
            >
              clear
            </button>
          )}
          <kbd className="text-[10px] font-mono text-t2 bg-surface2 border border-border rounded-md px-2 py-0.5 shrink-0">
            ESC
          </kbd>
        </div>

        {/* Results list */}
        <div
          ref={listRef}
          className="max-h-[380px] overflow-y-auto py-1.5"
        >
          {!hasAny && (
            <div className="py-8 px-6 text-center text-[13px] text-t2">
              No results for "<strong className="text-t1">{query}</strong>"
            </div>
          )}

          {hasNav && (
            <>
              <GroupHeader label="Navigation" />
              {navFiltered.map((item, i) => renderRow(item, i))}
            </>
          )}

          {hasAct && (
            <>
              <GroupHeader label="Actions" />
              {actFiltered.map((item, i) => renderRow(item, navCount + i))}
            </>
          )}

          {hasQuickAsk && (
            <>
              <GroupHeader label="Quick Ask" />
              {quickAskItem.map((item, i) => renderRow(item, navCount + actCount + i))}
            </>
          )}

          {hasRec && (
            <>
              <GroupHeader label="Recent" />
              {recFiltered.map((item, i) => renderRow(item, navCount + actCount + qaCount + i))}
            </>
          )}
        </div>

        {/* Footer hints */}
        <div className="flex items-center gap-5 px-4 py-2.5 border-t border-border bg-bg">
          {[
            ['↑↓', 'Navigate'],
            ['↵', 'Select'],
            ['ESC', 'Close'],
          ].map(([key, label]) => (
            <span key={key} className="flex items-center gap-1.5 text-[11px] text-t2">
              <kbd className="font-mono text-[10px] bg-surface2 border border-border rounded px-1.5 py-0.5">
                {key}
              </kbd>
              {label}
            </span>
          ))}
          <span className="ml-auto text-[10px] text-t2 font-mono">
            {navigator.platform.includes('Mac') ? '⌘K' : 'Ctrl+K'}
          </span>
        </div>
      </div>

      <Toast toast={toast} onDone={clearToast} />
      <ActionGuardDialog
        guard={guard}
        pending={Boolean(guard && loadingId === guard.item?.id)}
        onCancel={() => !loadingId && setGuard(null)}
        onConfirm={async () => {
          const guardedItem = guard?.item
          setGuard(null)
          if (guardedItem) await executeGatewayRestart(guardedItem)
        }}
      />
    </>
  )
}
