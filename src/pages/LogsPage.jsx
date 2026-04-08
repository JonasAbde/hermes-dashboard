import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { apiFetch, getToken } from '../utils/auth'
import { PagePrimer } from '../components/ui/PagePrimer'
import {
  Pause, Play, Trash2, Copy, Scroll, ChevronDown,
  Terminal, Search, FileText, Check, Download, Regex,
  Wifi, WifiOff, Server, Bot, User, Zap
} from 'lucide-react'

const MAX_LINES = 2000
const LOGS_UI_STATE_KEY = 'hermes_dashboard_logs_ui_v1'

function normalizeLogFile(value) {
  if (!value) return null
  return String(value).replace(/\.log$/, '').trim() || null
}

function readPersistedLogsUiState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(LOGS_UI_STATE_KEY) || '{}')
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

const LEVEL_COLORS = {
  info:  '#6b6b80',
  warn:  '#e09040',
  error: '#e05f40',
  debug: '#4a80c8',
}

const LEVEL_LABELS = {
  info:  'INFO',
  warn:  'WARN',
  error: 'ERROR',
  debug: 'DEBUG',
}

const PLATFORM_COLORS = {
  telegram: '#4a80c8',
  discord:  '#5865f2',
  slack:    '#4a154b',
  cli:      '#00b478',
  cron:     '#e09040',
  api:      '#e05f40',
  webhook:  '#9b59b6',
}

// ─── Parse helpers ─────────────────────────────────────────────────────────────

function parseTimestamp(line) {
  const m = line.match(/^(\[)?(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:[.,]\d{3})?(?:Z|[+-]\d{2}:?\d{2})?)(\]?)/)
  if (m) return m[2]
  return null
}

function parseLevel(line) {
  const m = line.match(/,\d{3}\s+(ERROR|WARN|WARNING|DEBUG|INFO)\s+/)
  if (m) {
    const l = m[1].toLowerCase()
    return l === 'warning' ? 'warn' : l
  }
  if (line.includes('ERROR')) return 'error'
  if (line.includes('WARN')) return 'warn'
  if (line.includes('DEBUG')) return 'debug'
  return 'info'
}

// ─── LogLine component ─────────────────────────────────────────────────────────

function LogLine({ entry, searchQuery, isRegex, onSessionClick }) {
  const ts = useMemo(() => parseTimestamp(entry.msg), [entry.msg])
  const level = entry.level || parseLevel(entry.msg)

  const highlight = useCallback((text, query) => {
    if (!query) return <span>{text}</span>
    try {
      const parts = isRegex
        ? text.split(new RegExp(`(${query})`, 'gi'))
        : text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'))
      return (
        <>
          {parts.map((part, i) =>
            part.toLowerCase() === query.toLowerCase()
              ? <mark key={i} className="bg-yellow-500/30 text-yellow-200 rounded px-0.5">{part}</mark>
              : <span key={i}>{part}</span>
          )}
        </>
      )
    } catch {
      // Invalid regex — fall back to plain text
      return <span>{text}</span>
    }
  }, [isRegex])

  // Extract session IDs for clickable links
  const sessionIdInMsg = useMemo(() => {
    const m = entry.msg.match(/(?:session[=_]|sid=)([\w:.-]{8,})/)
    return m ? m[1] : null
  }, [entry.msg])

  // Build display text without the timestamp (since we show it separately)
  const displayText = useMemo(() => {
    const ts2 = parseTimestamp(entry.msg)
    return ts2 ? entry.msg.slice(entry.msg.indexOf(ts2) + ts2.length).trim() : entry.msg
  }, [entry.msg])

  const levelColor = LEVEL_COLORS[level] ?? LEVEL_COLORS.info

  return (
    <div className="group flex gap-2 py-px leading-5 hover:bg-white/[0.02] transition-colors" style={{ fontFamily: "'JetBrains Mono','Fira Code',monospace", fontSize: '11px' }}>
      {/* Timestamp */}
      {ts && (
        <span className="text-t3 flex-shrink-0 opacity-50 tabular-nums">{ts.slice(11, 19)}</span>
      )}

      {/* Level badge */}
      <span
        className="flex-shrink-0 uppercase tracking-wider font-bold tabular-nums"
        style={{ color: levelColor, minWidth: '3.2em' }}
      >
        {LEVEL_LABELS[level] ?? level?.toUpperCase() ?? 'LOG'}
      </span>

      {/* Platform badge */}
      {entry.platform && (
        <span
          className="flex-shrink-0 px-1 py-0 rounded text-[9px] font-bold uppercase"
          style={{
            background: `${PLATFORM_COLORS[entry.platform] ?? '#6b6b80'}22`,
            color: PLATFORM_COLORS[entry.platform] ?? '#6b6b80',
            border: `1px solid ${PLATFORM_COLORS[entry.platform] ?? '#6b6b80'}44`,
          }}
          title={`Platform: ${entry.platform}`}
        >
          {entry.platform}
        </span>
      )}

      {/* User badge */}
      {entry.user && (
        <span className="flex-shrink-0 text-t3 text-[10px] flex items-center gap-0.5">
          <User size={9} />
          {entry.user}
        </span>
      )}

      {/* Message content */}
      <span className="flex-1 break-all text-[#d8d8e0]">
        {sessionIdInMsg ? (
          <>
            {highlight(displayText.slice(0, displayText.indexOf(sessionIdInMsg)), searchQuery)}
            <button
              onClick={() => onSessionClick(sessionIdInMsg)}
              className="text-blue-400 hover:text-blue-300 underline underline-offset-2 cursor-pointer font-medium"
              title={`Go to session ${sessionIdInMsg}`}
            >
              {sessionIdInMsg}
            </button>
            {highlight(displayText.slice(displayText.indexOf(sessionIdInMsg) + sessionIdInMsg.length), searchQuery)}
          </>
        ) : (
          highlight(displayText, searchQuery)
        )}
      </span>
    </div>
  )
}

// ─── File selector with discovery ─────────────────────────────────────────────

function FileSelector({ files, activeFile, onChange }) {
  const [open, setOpen] = useState(false)

  const active = files.find(f => f.name === `${activeFile}.log`)

  return (
    <div className="relative" style={{ overflow: 'visible' }}>
      <button
        onClick={() => setOpen(o => !o)}
        aria-label="Vælg logfil"
        aria-expanded={open}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-mono transition-all"
        style={{ background: '#0d0f17', color: '#d8d8e0', border: '1px solid #1a1b24' }}
      >
        <FileText size={11} className="text-t3" />
        <span className="hidden sm:inline">{active?.name ?? `${activeFile}.log`}</span>
        <span className="sm:hidden">logs</span>
        <ChevronDown size={10} className="text-t3 ml-0.5" />
      </button>
      {open && (
        <div
          className="absolute top-full left-0 mt-1 z-50 rounded-lg overflow-hidden shadow-xl"
          style={{ background: '#0d0f17', border: '1px solid #1a1b24', minWidth: '200px' }}
        >
          {/* Built-in logs */}
          {files.filter(f => f.is_builtin).map(f => (
            <button
              key={f.name}
              onClick={() => { onChange(f.name.replace('.log', '')); setOpen(false) }}
              className="flex items-center gap-2 w-full px-3 py-2 text-[11px] font-mono transition-colors"
              style={{
                background: activeFile === f.name.replace('.log', '') ? '#1a1b24' : 'transparent',
                color: activeFile === f.name.replace('.log', '') ? '#d8d8e0' : '#6b6b80',
              }}
            >
              <Server size={10} className={f.name === 'gateway.log' ? 'text-green' : f.name === 'agent.log' ? 'text-blue' : 'text-rust'} />
              <span className="flex-1 text-left truncate">{f.label}</span>
              <span className="text-[9px] text-t3">{f.size_kb}KB</span>
              {activeFile === f.name.replace('.log', '') && <Check size={9} className="text-green" />}
            </button>
          ))}

          {/* MCP logs */}
          {files.filter(f => f.is_mcp).length > 0 && (
            <>
              <div className="px-3 py-1 text-[9px] font-bold uppercase tracking-widest text-t3 border-t border-border mt-1">
                MCP Servers
              </div>
              {files.filter(f => f.is_mcp).map(f => (
                <button
                  key={f.name}
                  onClick={() => { onChange(f.name.replace('.log', '')); setOpen(false) }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-[11px] font-mono transition-colors"
                  style={{
                    background: activeFile === f.name.replace('.log', '') ? '#1a1b24' : 'transparent',
                    color: activeFile === f.name.replace('.log', '') ? '#d8d8e0' : '#6b6b80',
                  }}
                >
                  <Bot size={10} className="text-purple-400" />
                  <span className="flex-1 text-left truncate">{f.name}</span>
                  <span className="text-[9px] text-t3">{f.size_kb}KB</span>
                  {activeFile === f.name.replace('.log', '') && <Check size={9} className="text-green" />}
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main LogsPage ────────────────────────────────────────────────────────────

export function LogsPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const persistedUi = useMemo(() => readPersistedLogsUiState(), [])
  const queryFile = normalizeLogFile(new URLSearchParams(location.search).get('file'))

  const [lines, setLines]           = useState([])
  const [isPaused, setIsPaused]    = useState(Boolean(persistedUi.isPaused))
  const [autoScroll, setAutoScroll] = useState(persistedUi.autoScroll ?? true)
  const [filterLevel, setFilterLevel] = useState(persistedUi.filterLevel || 'all')
  const [search, setSearch]         = useState(persistedUi.search || '')
  const [isRegex, setIsRegex]       = useState(Boolean(persistedUi.isRegex))
  const [copied, setCopied]         = useState(false)
  const [activeFile, setActiveFile] = useState(queryFile || normalizeLogFile(persistedUi.activeFile) || 'gateway')
  const [logFiles, setLogFiles]     = useState([])
  const [filesLoading, setFilesLoading] = useState(true)
  const [connError, setConnError]       = useState(null)

  const logContainerRef  = useRef(null)
  const pendingLinesRef   = useRef([])
  const esRef            = useRef(null)
  const isPausedRef      = useRef(false)
  const searchRef        = useRef('')
  const activeFileRef    = useRef('gateway')

  // Keep refs in sync
  useEffect(() => { isPausedRef.current = isPaused }, [isPaused])
  useEffect(() => { searchRef.current = search }, [search])
  useEffect(() => { activeFileRef.current = activeFile }, [activeFile])

  useEffect(() => {
    const persistedFile = normalizeLogFile(new URLSearchParams(location.search).get('file'))
    if (persistedFile && persistedFile !== activeFileRef.current) {
      setActiveFile(persistedFile)
    }
  }, [location.search])

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    if (params.get('file') !== activeFile) {
      params.set('file', activeFile)
      navigate(`${location.pathname}?${params.toString()}`, { replace: true })
    }
  }, [activeFile, location.pathname, location.search, navigate])

  useEffect(() => {
    try {
      localStorage.setItem(LOGS_UI_STATE_KEY, JSON.stringify({
        activeFile,
        filterLevel,
        search,
        isRegex,
        autoScroll,
        isPaused,
      }))
    } catch {}
  }, [activeFile, filterLevel, search, isRegex, autoScroll, isPaused])

  // Discover available log files
  useEffect(() => {
    apiFetch('/api/logs/files')
      .then(r => r.json())
      .then(d => { setLogFiles(d.files || []); setFilesLoading(false) })
      .catch(() => setFilesLoading(false))
  }, [])

  // Auto-scroll
  useEffect(() => {
    if (!autoScroll || isPaused) return
    const el = logContainerRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [lines, autoScroll, isPaused])

  // Session link handler
  const handleSessionClick = useCallback((sessionId) => {
    navigate(`/sessions?q=${encodeURIComponent(sessionId)}`)
  }, [navigate])

  // EventSource — reconnects on file change
  useEffect(() => {
    setLines([])
    pendingLinesRef.current = []

    const file = activeFileRef.current
    const levels = filterLevel === 'all' ? '' : `&levels=${filterLevel}`
    const token = getToken()
    const tokenParam = token ? `&token=${encodeURIComponent(token)}` : ''
    const url = `/api/logs?file=${file}${levels}${tokenParam}`

    let es = null
    try {
      es = new EventSource(url)
      esRef.current = es

      es.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data)
          if (data.type === 'log' || data.type === 'info') {
            if (isPausedRef.current) {
              pendingLinesRef.current.push(data)
            } else {
              setLines(prev => {
                const next = [...prev, data]
                return next.length > MAX_LINES ? next.slice(next.length - MAX_LINES) : next
              })
            }
          }
        } catch (e) { if (import.meta.env.DEV) console.error('[LogsPage] SSE message parse error:', e) }
      }

      es.onerror = () => {
        // Show reconnecting status — user can see something is wrong
        setConnError('Forbindelse tabt. Forsøger at genoprette...')
      }
      es.onopen = () => {
        setConnError(null)
      }
    } catch (e) { if (import.meta.env.DEV) console.error('[LogsPage] EventSource creation error:', e); setConnError('Kunne ikke oprette forbindelse til logstream') }

    return () => {
      if (es) es.close()
      esRef.current = null
    }
  }, [activeFile, filterLevel])

  // Flush pending when resumed
  useEffect(() => {
    if (!isPaused && pendingLinesRef.current.length > 0) {
      setLines(prev => {
        const batch = pendingLinesRef.current
        pendingLinesRef.current = []
        const next = [...prev, ...batch]
        return next.length > MAX_LINES ? next.slice(next.length - MAX_LINES) : next
      })
    }
  }, [isPaused])

  // Filtered lines
  const filteredLines = useMemo(() => {
    let result = lines
    const q = searchRef.current
    if (q) {
      try {
        if (isRegex) {
          const re = new RegExp(q, 'i')
          result = result.filter(l => re.test(l.msg || ''))
        } else {
          const ql = q.toLowerCase()
          result = result.filter(l => (l.msg || '').toLowerCase().includes(ql))
        }
      } catch {
        // Invalid regex — skip filter
      }
    }
    if (filterLevel !== 'all') {
      result = result.filter(l => l.level === filterLevel)
    }
    return result
  }, [lines, filterLevel])

  const handleClear = () => {
    setLines([])
    pendingLinesRef.current = []
  }

  const handleCopy = async () => {
    const text = filteredLines.map(l => `[${l.level?.toUpperCase()}] ${l.msg}`).join('\n')
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {} // acceptable: clipboard permission denied — best-effort only
  }

  const handleDownload = () => {
    const text = filteredLines.map(l => `[${l.level?.toUpperCase()}] ${l.msg}`).join('\n')
    const blob = new Blob([text], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${activeFile}_${new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-')}.log`
    a.click()
    URL.revokeObjectURL(url)
  }

  const levelCounts = useMemo(() => {
    const counts = { all: lines.length, info: 0, warn: 0, error: 0, debug: 0 }
    lines.forEach(l => { if (counts[l.level] !== undefined) counts[l.level]++ })
    return counts
  }, [lines])

  const filterButtons = [
    { key: 'all',   label: 'All',   color: '#d8d8e0' },
    { key: 'info',  label: 'INFO',  color: LEVEL_COLORS.info },
    { key: 'warn',  label: 'WARN',  color: LEVEL_COLORS.warn },
    { key: 'error', label: 'ERROR', color: LEVEL_COLORS.error },
    { key: 'debug', label: 'DEBUG', color: LEVEL_COLORS.debug },
  ]

  const isConnected = typeof EventSource !== 'undefined' && esRef.current?.readyState === EventSource.OPEN

  return (
    <div className="flex flex-col h-full gap-3 min-h-0">
      <PagePrimer
        title="Live logs"
        body="Use logs when something is broken or unclear. They are technical and update continuously."
        tip="Start with ERROR/WARN filters before reading all lines."
      />

      {/* Header row */}
      <div className="flex flex-wrap items-center gap-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Terminal size={14} className="text-t3" />
          <span className="text-sm font-semibold text-t1">Live Logs</span>
          <span className="font-mono text-[10px] text-t3 tabular-nums">
            {lines.length}/{MAX_LINES}
          </span>
          {connError && (
            <span className="text-[10px] text-amber-400 font-medium animate-pulse">
              ● Forbindelse tabt
            </span>
          )}
        </div>

        {/* File selector */}
        <FileSelector
          files={logFiles}
          activeFile={activeFile}
          onChange={setActiveFile}
        />

        <div className="hidden sm:block flex-1" />

        {/* Level filters */}
        <div className="flex items-center gap-1 flex-wrap">
          {filterButtons.map(({ key, label, color }) => (
            <button
              key={key}
              onClick={() => setFilterLevel(key)}
              className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-mono font-bold transition-all"
              style={{
                background: filterLevel === key ? `${color}22` : 'transparent',
                color: filterLevel === key ? color : '#6b6b80',
                border: `1px solid ${filterLevel === key ? color + '55' : '#1a1b24'}`,
              }}
            >
              {label}
              {key !== 'all' && levelCounts[key] > 0 && (
                <span className="ml-0.5 opacity-70">({levelCounts[key]})</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Search + Controls row */}
      <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
        <div className="relative flex-1 min-w-[180px] w-full sm:w-auto sm:max-w-xs">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-t3" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={isRegex ? 'Regex pattern…' : 'Filter logs…'}
            className="w-full pl-7 pr-14 py-1.5 bg-[#0d0f17] border border-[#1a1b24] rounded text-[11px] font-mono text-t1 placeholder-t3 focus:outline-none focus:border-[#4a80c8]/40 transition-colors"
          />
          {/* Regex toggle */}
          <button
            onClick={() => setIsRegex(r => !r)}
            className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold transition-all"
            style={{
              background: isRegex ? '#4a80c822' : 'transparent',
              color: isRegex ? '#4a80c8' : '#3a3a4a',
              border: `1px solid ${isRegex ? '#4a80c844' : 'transparent'}`,
            }}
            title={isRegex ? 'Regex mode ON' : 'Regex mode OFF'}
          >
            .*
          </button>
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-8 top-1/2 -translate-y-1/2 text-t3 hover:text-t2"
            >
              <span className="text-[10px]">×</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-1 flex-wrap sm:ml-auto">
          {/* Auto-scroll */}
          <button
            onClick={() => setAutoScroll(a => !a)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-[11px] font-medium transition-all"
            style={{
              background: autoScroll ? 'rgba(0,180,120,0.12)' : 'transparent',
              color: autoScroll ? '#00b478' : '#6b6b80',
              border: `1px solid ${autoScroll ? '#00b47844' : '#1a1b24'}`,
            }}
            title={autoScroll ? 'Auto-scroll ON' : 'Auto-scroll OFF'}
          >
            <Scroll size={11} />
            <span className="hidden sm:inline">Scroll</span>
          </button>

          {/* Pause / Resume */}
          <button
            onClick={() => setIsPaused(p => !p)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-[11px] font-medium transition-all"
            style={{
              background: isPaused ? 'rgba(224,144,64,0.12)' : 'transparent',
              color: isPaused ? '#e09040' : '#6b6b80',
              border: `1px solid ${isPaused ? '#e0904066' : '#1a1b24'}`,
            }}
            title={isPaused ? 'Resume' : 'Pause'}
          >
            {isPaused ? <Play size={11} /> : <Pause size={11} />}
            <span className="hidden sm:inline">{isPaused ? 'Resume' : 'Pause'}</span>
          </button>

          {/* Pending */}
          {isPaused && pendingLinesRef.current.length > 0 && (
            <span className="font-mono text-[10px] text-amber px-1.5 py-1 rounded" style={{ background: 'rgba(224,144,64,0.12)', border: '1px solid #e0904033' }}>
              +{pendingLinesRef.current.length} pending
            </span>
          )}

          {/* Download */}
          <button
            onClick={handleDownload}
            disabled={filteredLines.length === 0}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-[11px] font-medium text-t3 hover:text-t2 border border-[#1a1b24] hover:border-[#2a2b38] transition-all disabled:opacity-30"
            title="Download filtered logs"
          >
            <Download size={11} />
            <span className="hidden sm:inline">Download</span>
          </button>

          {/* Copy */}
          <button
            onClick={handleCopy}
            disabled={filteredLines.length === 0}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-[11px] font-medium text-t3 hover:text-t2 border border-[#1a1b24] hover:border-[#2a2b38] transition-all disabled:opacity-30"
            title="Copy visible logs"
          >
            {copied ? <Check size={11} className="text-green" /> : <Copy size={11} />}
            <span className="hidden sm:inline">{copied ? 'Copied!' : 'Copy'}</span>
          </button>

          {/* Clear */}
          <button
            onClick={handleClear}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-[11px] font-medium text-t3 hover:text-rust border border-[#1a1b24] hover:border-rust/30 transition-all"
            title="Clear all logs"
          >
            <Trash2 size={11} />
            <span className="hidden sm:inline">Clear</span>
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex flex-wrap items-center gap-3 flex-shrink-0">
        <span className="font-mono text-[10px] text-t3 tabular-nums">
          {filteredLines.length} of {lines.length} lines
          {search && ` matching "${search}"`}
          {filterLevel !== 'all' && ` [${filterLevel.toUpperCase()}]`}
        </span>
        {lines.length >= MAX_LINES && (
          <span className="font-mono text-[10px] text-amber/70">
            Ring buffer full — oldest lines dropped
          </span>
        )}
        <div className="sm:ml-auto flex flex-wrap items-center gap-3 font-mono text-[10px] text-t3 tabular-nums">
          {[
            { key: 'error', color: LEVEL_COLORS.error, count: levelCounts.error },
            { key: 'warn',  color: LEVEL_COLORS.warn,  count: levelCounts.warn },
            { key: 'info',  color: LEVEL_COLORS.info,  count: levelCounts.info },
            { key: 'debug', color: LEVEL_COLORS.debug, count: levelCounts.debug },
          ].map(({ key, color, count }) => (
            <span key={key} style={{ color }}>
              {key.toUpperCase()}: {count}
            </span>
          ))}
        </div>
      </div>

      {/* Log area */}
      <div
        ref={logContainerRef}
        className="flex-1 overflow-y-auto rounded-lg border"
        style={{ background: '#060608', borderColor: '#111318', minHeight: 0 }}
      >
        {filteredLines.length === 0 ? (
          <div className="flex items-center justify-center h-full text-t3 text-sm font-mono">
            {lines.length === 0 ? 'Waiting for logs…' : 'No matching logs'}
          </div>
        ) : (
          <div className="p-3 space-y-px">
            {filteredLines.map((entry, i) => (
              <LogLine
                key={i}
                entry={entry}
                searchQuery={search}
                isRegex={isRegex}
                onSessionClick={handleSessionClick}
              />
            ))}
          </div>
        )}
      </div>

      {/* Status bar */}
      <div className="flex flex-wrap items-center gap-3 flex-shrink-0 font-mono text-[10px] text-t3 tabular-nums">
        <span className="flex items-center gap-1.5">
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{
              background: isConnected ? '#00b478' : '#e09040',
              boxShadow: isConnected ? '0 0 5px #00b478' : '0 0 5px #e09040',
            }}
          />
          {isConnected ? 'Connected' : 'Reconnecting…'}
        </span>
        <span className="hidden sm:inline">
          file: <span className="text-t2">{activeFile}.log</span>
        </span>
        <span className="sm:ml-auto">
          SSE · 200ms · max {MAX_LINES} lines
        </span>
      </div>
    </div>
  )
}
