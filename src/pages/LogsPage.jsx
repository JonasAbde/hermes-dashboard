import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import { getToken } from '../utils/auth'
import {
  Pause, Play, Trash2, Copy, Scroll, ChevronDown,
  Terminal, Search, FileText, Check
} from 'lucide-react'

const MAX_LINES = 2000

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

function parseLine(msg) {
  // Try to extract timestamp prefix like [2026-04-07 19:54:00]
  const m = msg.match(/^\[?(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)\]?/)
  if (m) {
    return { ts: m[1], rest: msg.slice(m[0].length).trim() }
  }
  return { ts: null, rest: msg }
}

function LogLine({ entry, searchQuery }) {
  const { ts, rest } = useMemo(() => parseLine(entry.msg), [entry.msg])

  const highlight = useCallback((text, query) => {
    if (!query) return <span>{text}</span>
    const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'))
    return (
      <>
        {parts.map((part, i) =>
          part.toLowerCase() === query.toLowerCase()
            ? <mark key={i} className="bg-yellow-500/30 text-yellow-200 rounded px-0.5">{part}</mark>
            : <span key={i}>{part}</span>
        )}
      </>
    )
  }, [])

  return (
    <div className="flex gap-2 py-px leading-5" style={{ fontFamily: "'JetBrains Mono', 'Fira Code', monospace", fontSize: '11px' }}>
      {ts && (
        <span className="text-t3 flex-shrink-0 opacity-60">{ts}</span>
      )}
      <span
        className="flex-shrink-0 uppercase tracking-wider font-bold"
        style={{ color: LEVEL_COLORS[entry.level] ?? LEVEL_COLORS.info, minWidth: '3.5em' }}
      >
        {LEVEL_LABELS[entry.level] ?? entry.level?.toUpperCase() ?? 'LOG'}
      </span>
      <span className="flex-1 break-all" style={{ color: '#d8d8e0' }}>
        {highlight(rest || entry.msg, searchQuery)}
      </span>
    </div>
  )
}

export function LogsPage() {
  const { search: urlSearch } = useLocation()
  const initialFile = useMemo(() => {
    const f = new URLSearchParams(urlSearch).get('file')
    return ['gateway', 'agent', 'errors'].includes(f) ? f : 'gateway'
  }, [urlSearch])

  const [lines, setLines]           = useState([])
  const [isPaused, setIsPaused]      = useState(false)
  const [autoScroll, setAutoScroll]  = useState(true)
  const [filterLevel, setFilterLevel] = useState('all')
  const [search, setSearch]          = useState('')
  const [copied, setCopied]          = useState(false)
  const [activeFile, setActiveFile]  = useState(initialFile)
  const [showFileMenu, setShowFileMenu] = useState(false)

  const logContainerRef = useRef(null)
  const pendingLinesRef  = useRef([])
  const esRef            = useRef(null)
  const isPausedRef      = useRef(false)
  const searchRef        = useRef('')
  const activeFileRef    = useRef('gateway')

  // Keep refs in sync
  useEffect(() => { isPausedRef.current = isPaused }, [isPaused])
  useEffect(() => { searchRef.current = search }, [search])
  useEffect(() => { activeFileRef.current = activeFile }, [activeFile])
  useEffect(() => {
    setActiveFile(initialFile)
  }, [initialFile])

  // Auto-scroll effect
  useEffect(() => {
    if (!autoScroll || isPaused) return
    const el = logContainerRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [lines, autoScroll, isPaused])

  // EventSource connection — reconnects on file change
  useEffect(() => {
    // Reset lines when switching files
    setLines([])
    pendingLinesRef.current = []

    const file = activeFileRef.current
    const token = encodeURIComponent(getToken() || '')
    const url = `/api/logs?file=${file}&token=${token}`
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
        } catch {}
      }

      es.onerror = () => {
        // Reconnect automatically
      }
    } catch {}

    return () => {
      if (es) es.close()
      esRef.current = null
    }
  }, [activeFile])

  // Flush pending lines when resumed
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

  const filteredLines = useMemo(() => {
    let result = lines
    const q = searchRef.current.toLowerCase()
    if (q) {
      result = result.filter(l => (l.msg || '').toLowerCase().includes(q))
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
    const text = filteredLines
      .map(l => `[${l.level?.toUpperCase()}] ${l.msg}`)
      .join('\n')
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }

  const levelCounts = useMemo(() => {
    const counts = { all: lines.length, info: 0, warn: 0, error: 0, debug: 0 }
    lines.forEach(l => {
      if (counts[l.level] !== undefined) counts[l.level]++
    })
    return counts
  }, [lines])

  const filterButtons = [
    { key: 'all',   label: 'All',   color: '#d8d8e0' },
    { key: 'info',  label: 'INFO',  color: LEVEL_COLORS.info },
    { key: 'warn',  label: 'WARN',  color: LEVEL_COLORS.warn },
    { key: 'error', label: 'ERROR', color: LEVEL_COLORS.error },
    { key: 'debug', label: 'DEBUG', color: LEVEL_COLORS.debug },
  ]

  return (
    <div className="flex flex-col h-full gap-3 min-h-0">

      {/* Header row */}
      <div className="flex flex-wrap items-center gap-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Terminal size={14} className="text-t3" />
          <span className="text-sm font-semibold text-t1">Live Logs</span>
          <span className="font-mono text-[10px] text-t3">
            {lines.length}/{MAX_LINES} lines
          </span>
        </div>

        {/* File selector */}
        <div className="relative">
          <button
            onClick={() => setShowFileMenu(m => !m)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-mono transition-all"
            style={{
              background: '#0d0f17',
              color: '#d8d8e0',
              border: '1px solid #1a1b24',
            }}
          >
            <FileText size={11} className="text-t3" />
            {activeFile}.log
            <ChevronDown size={10} className="text-t3 ml-0.5" />
          </button>
          {showFileMenu && (
            <div
              className="absolute top-full left-0 mt-1 z-50 rounded-lg overflow-hidden shadow-xl"
              style={{ background: '#0d0f17', border: '1px solid #1a1b24', minWidth: '120px' }}
            >
              {[
                { key: 'gateway', label: 'gateway.log' },
                { key: 'agent',   label: 'agent.log' },
                { key: 'errors',  label: 'errors.log' },
              ].map(f => (
                <button
                  key={f.key}
                  onClick={() => { setActiveFile(f.key); setShowFileMenu(false) }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-[11px] font-mono text-t2 hover:text-t1 transition-colors"
                  style={{
                    background: activeFile === f.key ? '#1a1b24' : 'transparent',
                    color: activeFile === f.key ? '#d8d8e0' : '#6b6b80',
                  }}
                >
                  <FileText size={10} />
                  {f.label}
                  {activeFile === f.key && <Check size={9} className="ml-auto text-green" />}
                </button>
              ))}
            </div>
          )}
        </div>

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
              title={`Filter ${label}`}
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
            placeholder="Filter logs…"
            className="w-full pl-7 pr-3 py-1.5 bg-[#0d0f17] border border-[#1a1b24] rounded text-[11px] font-mono text-t1 placeholder-t3 focus:outline-none focus:border-[#4a80c8]/40 transition-colors"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-t3 hover:text-t2"
            >
              <span className="text-[10px]">×</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-1 flex-wrap sm:ml-auto">
          {/* Auto-scroll toggle */}
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

          {/* Pending indicator */}
          {isPaused && pendingLinesRef.current.length > 0 && (
            <span className="font-mono text-[10px] text-amber px-1.5">
              +{pendingLinesRef.current.length} pending
            </span>
          )}

          {/* Copy */}
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-[11px] font-medium text-t3 hover:text-t2 border border-[#1a1b24] hover:border-[#2a2b38] transition-all"
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

      {/* Line count bar */}
      <div className="flex flex-wrap items-center gap-3 flex-shrink-0">
        <span className="font-mono text-[10px] text-t3">
          {filteredLines.length} of {lines.length} lines
          {search && ` matching "${search}"`}
          {filterLevel !== 'all' && ` [${filterLevel.toUpperCase()}]`}
        </span>
        {lines.length >= MAX_LINES && (
          <span className="font-mono text-[10px] text-amber/70">
            Ring buffer full — oldest lines dropped
          </span>
        )}
        <div className="sm:ml-auto flex flex-wrap items-center gap-3 font-mono text-[10px] text-t3">
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
        style={{
          background: '#060608',
          borderColor: '#111318',
          minHeight: 0,
        }}
      >
        {filteredLines.length === 0 ? (
          <div className="flex items-center justify-center h-full text-t3 text-sm font-mono">
            {lines.length === 0 ? 'Waiting for logs…' : 'No matching logs'}
          </div>
        ) : (
          <div className="p-3 space-y-px">
            {filteredLines.map((entry, i) => (
              <LogLine key={i} entry={entry} searchQuery={search} />
            ))}
          </div>
        )}
      </div>

      {/* Status bar */}
      <div className="flex flex-wrap items-center gap-3 flex-shrink-0 font-mono text-[10px] text-t3">
        <span className="flex items-center gap-1.5">
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{
              background: esRef.current?.readyState === EventSource.OPEN ? '#00b478' : '#e09040',
              boxShadow: esRef.current?.readyState === EventSource.OPEN
                ? '0 0 5px #00b478'
                : '0 0 5px #e09040',
            }}
          />
          {esRef.current?.readyState === EventSource.OPEN ? 'Connected' : 'Reconnecting…'}
        </span>
        <span>
          file: <span className="text-t2">{activeFile}.log</span>
        </span>
        <span className="sm:ml-auto">
          SSE · 1s interval · max {MAX_LINES} lines
        </span>
      </div>
    </div>
  )
}
