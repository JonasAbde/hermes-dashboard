import { useState, useEffect, useRef, useCallback } from 'react'
import { Terminal, Trash2, Play, Loader2, ChevronRight, Copy, History, Search, X } from 'lucide-react'
import { apiFetch } from '../utils/auth'

const MAX_LINES = 500

const QUICK_CMDS = [
  'hermes status',
  'hermes model',
  'hermes gateway status',
  'hermes cron list',
  'hermes skills list',
]

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

export function TerminalPage() {
  const [outputLines, setOutputLines]   = useState([])
  const [inputValue, setInputValue]      = useState('')
  const [isExecuting, setIsExecuting]   = useState(false)
  const [cmdHistory, setCmdHistory]     = useState([])
  const [historyIdx, setHistoryIdx]     = useState(-1)
  const [backends, setBackends]         = useState([])
  const [copied, setCopied]             = useState(false)
  const [showHistory, setShowHistory]   = useState(false)
  const [historyItems, setHistoryItems] = useState([])
  const [historySearch, setHistorySearch] = useState('')
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)

  const bottomRef  = useRef(null)
  const inputRef   = useRef(null)

  // Fetch backend info on mount
  useEffect(() => {
    apiFetch('/api/terminal')
      .then(r => r.json())
      .then(d => setBackends(d.backends ?? []))
      .catch(e => { if (import.meta.env.DEV) console.warn('[TerminalPage] backend fetch failed:', e); setBackends([]) })
  }, [])

  // Auto-scroll to bottom whenever outputLines change
  useEffect(() => {
    bottomRef.current?.scrollIntoView?.({ behavior: 'smooth' })
  }, [outputLines])

  const pushLines = useCallback((lines) => {
    setOutputLines(prev => {
      const next = [...prev, ...lines]
      return next.length > MAX_LINES ? next.slice(next.length - MAX_LINES) : next
    })
  }, [])

  const executeCommand = useCallback(async (raw) => {
    const command = raw.trim()
    if (!command) return

    setIsExecuting(true)
    setHistoryIdx(-1)

    // Record command in history
    setCmdHistory(prev => {
      const filtered = prev.filter(c => c !== command)
      return [...filtered, command]
    })

    // Push command echo line
    pushLines([{ type: 'cmd', text: `$ ${command}` }])

    try {
      const res = await apiFetch('/api/terminal', {
        method: 'POST',
        body: JSON.stringify({ command }),
      })
      const data = await res.json()

      if (!res.ok || !data.ok) {
        const err = data.stderr || data.error || 'Unknown error'
        pushLines([{ type: 'err', text: err }])
      } else if (data.stdout) {
        pushLines([{ type: 'out', text: data.stdout }])
      }
    } catch (e) {
      pushLines([{ type: 'err', text: `Network error: ${e.message}` }])
    } finally {
      setIsExecuting(false)
      setInputValue('')
      inputRef.current?.focus()
    }
  }, [pushLines])

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !isExecuting) {
      e.preventDefault()
      executeCommand(inputValue)
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHistoryIdx(idx => {
        const next = idx < cmdHistory.length - 1 ? idx + 1 : idx
        if (cmdHistory.length > 0) setInputValue(cmdHistory[cmdHistory.length - 1 - next] ?? '')
        return next
      })
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHistoryIdx(idx => {
        const next = idx > 0 ? idx - 1 : -1
        setInputValue(next === -1 ? '' : cmdHistory[cmdHistory.length - 1 - next] ?? '')
        return next
      })
      return
    }
  }, [inputValue, isExecuting, cmdHistory, executeCommand])

  const handleCopy = () => {
    const text = outputLines
      .map(l => l.type === 'cmd' ? l.text : l.text)
      .join('\n')
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  const fetchHistory = useCallback(async (query = '') => {
    setIsLoadingHistory(true)
    try {
      const res = await apiFetch(`/api/sessions/search?filter=terminal&q=${encodeURIComponent(query)}`)
      const data = await res.json()
      setHistoryItems(data.sessions || [])
    } catch (e) {
      if (import.meta.env.DEV) console.warn('[TerminalPage] history fetch failed:', e)
    } finally {
      setIsLoadingHistory(false)
    }
  }, [])

  useEffect(() => {
    if (showHistory) {
      fetchHistory(historySearch)
    }
  }, [showHistory, historySearch, fetchHistory])

  const handleClear = () => {
    setOutputLines([])
    setHistoryIdx(-1)
  }

  return (
    <div className="flex h-full gap-3 min-h-0 overflow-hidden relative">
      <div className="flex-1 flex flex-col min-w-0 gap-3">

        {/* ── Header ── */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <Terminal size={15} className="text-green" />
          <span className="text-sm font-bold text-t1 font-mono">Terminal</span>
          <div className="flex items-center gap-1.5 ml-2">
            {backends.map(b => (
              <span
                key={b}
                className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-border bg-surface2 text-t2"
              >
                {b}
              </span>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded border transition-all ${
              showHistory 
                ? 'bg-green/10 border-green/40 text-green' 
                : 'text-t2 border-border hover:text-t1 hover:border-green/40 hover:bg-green/5'
            }`}
            title="Command history"
          >
            <History size={12} />
            <span>History</span>
          </button>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 text-xs text-t2 hover:text-t1 px-2 py-1 rounded border border-border hover:border-green/40 hover:bg-green/5 transition-all"
            title="Copy output"
          >
            <Copy size={12} />
            <span>{copied ? 'Copied!' : 'Copy'}</span>
          </button>
          <button
            onClick={handleClear}
            className="flex items-center gap-1.5 text-xs text-t2 hover:text-t1 px-2 py-1 rounded border border-border hover:border-rust/40 hover:bg-rust/5 transition-all"
            title="Clear terminal"
          >
            <Trash2 size={12} />
            <span>Clear</span>
          </button>
        </div>
      </div>

      {/* ── Quick command chips ── */}
      <div className="flex flex-wrap gap-2 flex-shrink-0">
        {QUICK_CMDS.map(cmd => (
          <button
            key={cmd}
            onClick={() => executeCommand(cmd)}
            disabled={isExecuting}
            className="flex items-center gap-1.5 text-xs font-mono px-2.5 py-1 rounded border border-border bg-surface2 text-t2 hover:text-green hover:border-green/40 hover:bg-green/5 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronRight size={10} className="text-green/60" />
            {cmd}
          </button>
        ))}
      </div>

      {/* ── Terminal output area ── */}
      <div className="flex-1 min-h-0 rounded-lg overflow-hidden border border-border bg-[#06060a] flex flex-col">
        <div className="flex-1 min-h-0 overflow-y-auto p-4 font-mono text-[13px] leading-relaxed">

          {outputLines.length === 0 && !isExecuting && (
            <div className="text-t3 italic select-none">
              Ready — type a command or use a quick command above.
            </div>
          )}

          {outputLines.map((line, i) => (
            <div
              key={i}
              style={{
                color: line.type === 'cmd' ? '#00b478'
                     : line.type === 'err' ? '#e05f40'
                     : '#d8d8e0',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {line.text}
            </div>
          ))}

          {isExecuting && (
            <div className="flex items-center gap-2 text-green">
              <Loader2 size={13} className="animate-spin" />
              <span className="text-[13px]">executing…</span>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* ── Input bar ── */}
        <div className="flex-shrink-0 flex items-center gap-2 px-4 py-3 border-t border-border bg-[#050508]">
          <span className="font-mono text-[13px] text-green select-none flex-shrink-0">$ </span>
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={e => { setInputValue(e.target.value); setHistoryIdx(-1) }}
            onKeyDown={handleKeyDown}
            disabled={isExecuting}
            autoFocus
            spellCheck={false}
            autoComplete="off"
            autoCorrect="off"
            className="flex-1 bg-transparent font-mono text-[13px] text-t1 placeholder:text-t3 outline-none disabled:opacity-50"
            placeholder="hermes status"
          />
          <button
            onClick={() => executeCommand(inputValue)}
            disabled={isExecuting || !inputValue.trim()}
            className="flex items-center gap-1.5 text-xs font-mono px-3 py-1.5 rounded bg-green/15 border border-green/40 text-green hover:bg-green/25 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
          >
            {isExecuting ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
            <span>Run</span>
          </button>
        </div>
      </div>
{/* ── Close Inner Container ── */}
      </div>

      {/* ── History Sidebar ── */}
      {showHistory && (
        <div className="w-80 flex-shrink-0 flex flex-col gap-3 h-full border-l border-border bg-surface1 p-4 animate-in slide-in-from-right-4 duration-200">
          <div className="flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2 text-t1 font-bold text-sm">
              <History size={14} className="text-green" />
              <span>History</span>
            </div>
            <button 
              onClick={() => setShowHistory(false)}
              className="p-1 hover:bg-surface2 rounded text-t3 hover:text-t1"
            >
              <X size={14} />
            </button>
          </div>

          <div className="relative flex-shrink-0">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-t3" size={14} />
            <input 
              type="text"
              placeholder="Search command..."
              value={historySearch}
              onChange={(e) => setHistorySearch(e.target.value)}
              className="w-full bg-surface2 border border-border rounded-md pl-9 pr-3 py-1.5 text-xs text-t1 placeholder:text-t3 outline-none focus:border-green/50"
            />
          </div>

          <div className="flex-1 overflow-y-auto min-h-0 custom-scrollbar">
            {isLoadingHistory ? (
              <div className="flex items-center justify-center py-10 text-t3">
                <Loader2 size={16} className="animate-spin mr-2" />
                <span className="text-xs">Loading history...</span>
              </div>
            ) : historyItems.length === 0 ? (
              <div className="text-center py-10 text-t3 text-xs italic">
                No history found
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                {historyItems.map((item) => (
                  <button
                    key={item.sessionId}
                    onClick={() => {
                      // Extract command from session metadata or name
                      // Based on /api/sessions/search, terminal sessions usually have the command as title or name
                      setInputValue(item.name || '')
                      inputRef.current?.focus()
                    }}
                    className="flex flex-col p-2.5 rounded-lg border border-transparent hover:border-border hover:bg-surface2 text-left group transition-all"
                  >
                    <div className="text-xs font-mono text-t1 line-clamp-2 break-all group-hover:text-green">
                      {item.name}
                    </div>
                    <div className="text-[10px] text-t3 mt-1 flex justify-between">
                      <span>{new Date(item.startTime).toLocaleDateString()}</span>
                      <span className="opacity-0 group-hover:opacity-100 text-green">Use »</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
