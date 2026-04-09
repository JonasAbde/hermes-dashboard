import { useState, useEffect, useRef, useCallback } from 'react'
import { Terminal, Trash2, Play, Loader2, ChevronRight, Copy } from 'lucide-react'
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

  const bottomRef  = useRef(null)
  const inputRef   = useRef(null)
  const [isLive, setIsLive] = useState(true)

  // Fetch live logs periodically
  useEffect(() => {
    if (!isLive) return
    let timeout
    const fetchLogs = async () => {
      try {
        const r = await apiFetch('/api/terminal/logs')
        const d = await r.json()
        if (d.logs && d.logs.length > 0) {
          const newLines = d.logs.map(l => ({
            type: 'agent',
            text: l.text,
            isLive: true
          }))
          // Vi bruger en simpel de-duplikering baseret på tekst (midlertidig løsning)
          setOutputLines(prev => {
            const existingTexts = new Set(prev.map(p => p.text))
            const uniqueNew = newLines.filter(n => !existingTexts.has(n.text))
            if (uniqueNew.length === 0) return prev
            const next = [...prev, ...uniqueNew]
            return next.length > MAX_LINES ? next.slice(next.length - MAX_LINES) : next
          })
        }
      } catch (e) {
        if (import.meta.env.DEV) console.error('[TerminalPage] logs fetch failed:', e)
      } finally {
        timeout = setTimeout(fetchLogs, 3000)
      }
    }
    fetchLogs()
    return () => clearTimeout(timeout)
  }, [isLive])

  // Fetch history and backend info on mount
  useEffect(() => {
    // Backend info
    apiFetch('/api/terminal')
      .then(r => r.json())
      .then(d => setBackends(d.backends ?? []))
      .catch(e => { if (import.meta.env.DEV) console.warn('[TerminalPage] backend fetch failed:', e); setBackends([]) })

    // Chat history
    apiFetch('/api/terminal/history')
      .then(r => r.json())
      .then(d => {
        if (d.messages && d.messages.length > 0) {
          const historyLines = d.messages.map(m => ({
            type: m.role === 'user' ? 'cmd' : m.role === 'assistant' ? 'out' : 'err',
            text: m.role === 'user' ? `$ ${m.content}` : m.content,
            isHistory: true
          }))
          setOutputLines(prev => [...historyLines, { type: 'system', text: '--- End of Session History ---', isHistory: true }, ...prev])
        }
      })
      .catch(e => { if (import.meta.env.DEV) console.warn('[TerminalPage] history fetch failed:', e) })
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

  const handleClear = () => {
    setOutputLines([])
    setHistoryIdx(-1)
  }

  return (
    <div className="flex flex-col h-full gap-3 min-h-0">

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
                     : line.type === 'system' ? '#6b6b80'
                     : line.type === 'agent' ? '#74b9ff'
                     : '#d8d8e0',
                opacity: line.isHistory ? 0.7 : 1,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                borderLeft: line.type === 'system' ? '2px solid #2a2b38' : 'none',
                paddingLeft: line.type === 'system' ? '8px' : '0',
                margin: line.type === 'system' ? '8px 0' : '0'
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
    </div>
  )
}
