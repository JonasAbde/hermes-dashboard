import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  Send, Bot, User, AlertCircle, Trash2, MessageSquare, Sparkles,
  Square, Copy, Check, RotateCcw, PencilLine, Plus, X, Zap,
  Terminal, Cpu, ThumbsUp, ThumbsDown, PanelLeftClose, PanelLeft,
} from 'lucide-react'
import { usePoll } from '../hooks/useApi'
import { apiFetch } from '../utils/auth'

// ─── Theme ───────────────────────────────────────────────────────────────────
const C = {
  bg:            '#0a0a0f',
  surface:       '#111118',
  surface2:      '#18181f',
  surface3:      '#1f1f28',
  border:        '#222230',
  border2:       '#2a2a3a',
  text:          '#e4e4ed',
  textSecondary: '#7878a0',
  textMuted:     '#3a3a50',
  green:         '#22c55e',
  greenDim:      'rgba(34,197,94,0.10)',
  greenGlow:     'rgba(34,197,94,0.22)',
  rust:          '#ef4444',
  rustDim:       'rgba(239,68,68,0.10)',
  rustGlow:      'rgba(239,68,68,0.22)',
  amber:         '#f59e0b',
  amberDim:      'rgba(245,158,11,0.10)',
  blue:          '#3b82f6',
  blueDim:       'rgba(59,130,246,0.10)',
  purple:        '#a855f7',
}

// ─── Utils ───────────────────────────────────────────────────────────────────
function uid() {
  return (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function ts(date) {
  return new Intl.DateTimeFormat('da-DK', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).format(date instanceof Date ? date : new Date(date))
}

function dayLabel(date) {
  const d = date instanceof Date ? date : new Date(date)
  const now = new Date()
  const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1)
  if (d.toDateString() === now.toDateString()) return 'Today'
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return new Intl.DateTimeFormat('da-DK', { weekday: 'short', month: 'short', day: 'numeric' }).format(d)
}

function firstLine(text) {
  if (!text) return 'New chat'
  return text.slice(0, 60).replace(/\n/g, ' ').trim() + (text.length > 60 ? '…' : '')
}

function groupByDay(threads) {
  const groups = {}
  for (const t of threads) {
    const day = dayLabel(t.updatedAt)
    if (!groups[day]) groups[day] = []
    groups[day].push(t)
  }
  return groups
}

// ─── Code block with copy ─────────────────────────────────────────────────────
function CodeBlock({ children, className, node, ...props }) {
  const [copied, setCopied] = useState(false)
  const lang = (className || '').replace('language-', '')
  const code = String(children).replace(/\n$/, '')

  const copy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="relative rounded-lg overflow-hidden my-2" style={{ background: '#0d0d12', border: `1px solid ${C.border}` }}>
      <div className="flex items-center justify-between px-3 py-1.5" style={{ borderBottom: `1px solid ${C.border}` }}>
        <span className="text-[10px] font-mono" style={{ color: C.textMuted }}>{lang || 'code'}</span>
        <button onClick={copy} className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded transition-colors"
          style={{ color: copied ? C.green : C.textSecondary, background: copied ? C.greenDim : 'transparent' }}>
          {copied ? <Check size={10} /> : <Copy size={10} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="p-3 overflow-x-auto" style={{ margin: 0 }}>
        <code className={`text-[13px] font-mono ${className || ''}`} style={{ color: '#e2e8f0' }} {...props}>{children}</code>
      </pre>
    </div>
  )
}

// ─── Markdown renderer ────────────────────────────────────────────────────────
function renderMarkdown(text) {
  if (!text) return null
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        code({ node, inline, className, children, ...props }) {
          if (inline) {
            return <code className="px-1.5 py-0.5 rounded text-[12px] font-mono" style={{ background: C.surface3, color: C.amber }}>{children}</code>
          }
          return <CodeBlock className={className}>{children}</CodeBlock>
        },
        pre({ children }) { return <>{children}</> },
        a({ href, children }) {
          return <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: C.blue, textDecoration: 'underline' }}>{children}</a>
        },
        table({ children }) {
          return (
            <div className="overflow-x-auto my-2">
              <table className="w-full text-[13px]" style={{ borderCollapse: 'collapse', border: `1px solid ${C.border}` }}>{children}</table>
            </div>
          )
        },
        th({ children }) {
          return <th className="px-3 py-1.5 text-left text-[11px] font-semibold" style={{ background: C.surface2, border: `1px solid ${C.border}` }}>{children}</th>
        },
        td({ children }) {
          return <td className="px-3 py-1.5" style={{ border: `1px solid ${C.border}` }}>{children}</td>
        },
        h1({ children }) { return <h1 className="text-xl font-bold mt-4 mb-2" style={{ color: C.text }}>{children}</h1> },
        h2({ children }) { return <h2 className="text-lg font-bold mt-3 mb-2" style={{ color: C.text }}>{children}</h2> },
        h3({ children }) { return <h3 className="text-base font-semibold mt-2 mb-1" style={{ color: C.text }}>{children}</h3> },
        ul({ children }) { return <ul className="list-disc list-inside my-1 space-y-0.5" style={{ color: C.text }}>{children}</ul> },
        ol({ children }) { return <ol className="list-decimal list-inside my-1 space-y-0.5" style={{ color: C.text }}>{children}</ol> },
        li({ children }) { return <li className="text-sm leading-relaxed" style={{ color: C.text }}>{children}</li> },
        p({ children }) { return <p className="text-sm leading-relaxed mb-2" style={{ color: C.text }}>{children}</p> },
        blockquote({ children }) {
          return <blockquote className="border-l-2 px-3 py-1 my-2 rounded-r" style={{ borderColor: C.border2, background: C.surface2, color: C.textSecondary }}>{children}</blockquote>
        },
        hr() { return <hr className="my-3" style={{ borderColor: C.border }} /> },
        strong({ children }) { return <strong style={{ color: C.text, fontWeight: 600 }}>{children}</strong> },
      }}
    >
      {text}
    </ReactMarkdown>
  )
}

// ─── Typing dots ─────────────────────────────────────────────────────────────
function TypingDots() {
  return (
    <div className="flex items-center gap-1 py-1">
      {[0, 1, 2].map(i => (
        <div key={i} className="w-1.5 h-1.5 rounded-full"
          style={{ background: C.green, animation: `hermes-bounce 1.4s infinite ease-in-out both`, animationDelay: `${i * 0.16}s` }} />
      ))}
    </div>
  )
}

// ─── Feedback bar ─────────────────────────────────────────────────────────────
function FeedbackBar({ onRegenerate, onEdit }) {
  return (
    <div className="flex items-center gap-1 mt-2 pt-2" style={{ borderTop: `1px solid ${C.border}` }}>
      {[
        { icon: ThumbsUp, tip: 'Good', key: 'up', color: C.green, dim: C.greenDim },
        { icon: ThumbsDown, tip: 'Bad', key: 'down', color: C.rust, dim: C.rustDim },
        { icon: RotateCcw, tip: 'Regenerate', key: 'regen', color: C.blue, dim: C.blueDim },
        { icon: PencilLine, tip: 'Edit', key: 'edit', color: C.amber, dim: C.amberDim },
      ].map(({ icon: Icon, tip, key, color, dim }) => (
        <button key={key} title={tip} onClick={() => key === 'regen' ? onRegenerate() : key === 'edit' ? onEdit() : null}
          className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono transition-all hover:opacity-100"
          style={{ background: 'transparent', color: C.textSecondary, border: '1px solid transparent' }}
          onMouseEnter={e => { e.currentTarget.style.background = dim; e.currentTarget.style.color = color }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = C.textSecondary }}
        >
          <Icon size={11} />
        </button>
      ))}
    </div>
  )
}

// ─── Message bubble ──────────────────────────────────────────────────────────
function MessageBubble({ message, isStreaming, streamingText, onRegenerate, onEdit, onStop, onCopy, copiedId }) {
  const isUser = message.role === 'user'
  const isError = message.isError
  const isLoading = message.isLoading
  const displayText = isStreaming ? streamingText : message.content

  return (
    <div className="flex items-start gap-3 group" style={{ flexDirection: isUser ? 'row-reverse' : 'row' }}>
      {/* Avatar */}
      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
        style={{ background: isUser ? C.rustDim : C.greenDim, border: `1px solid ${isUser ? C.rustGlow : C.greenGlow}` }}>
        {isUser ? <User size={15} style={{ color: C.rust }} /> : <Bot size={15} style={{ color: C.green }} />}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 max-w-[85%]">
        {/* Speaker row */}
        <div className="flex items-center gap-2 mb-1 px-1">
          <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: isUser ? C.rust : C.green }}>
            {isUser ? 'You' : 'Hermes'}
          </span>
          {isLoading && !displayText && (
            <span className="text-[10px] px-1.5 py-0.5 rounded font-mono" style={{ background: C.greenDim, color: C.green }}>Generating…</span>
          )}
          {isError && (
            <span className="text-[10px] px-1.5 py-0.5 rounded font-mono" style={{ background: C.rustDim, color: C.rust }}>Error</span>
          )}
          <span className="text-[10px] ml-auto font-mono opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: C.textMuted }}>
            {ts(message.timestamp)}
          </span>
        </div>

        {/* Bubble */}
        <div className="rounded-2xl px-4 py-3"
          style={{
            background: isError ? C.rustDim : C.surface,
            border: `1px solid ${isError ? C.rustGlow : C.border}`,
            borderTopRightRadius: isUser ? '4px' : undefined,
            borderTopLeftRadius: isUser ? undefined : '4px',
          }}>
          {isLoading && !displayText
            ? <TypingDots />
            : renderMarkdown(displayText)
          }

          {/* Bottom bar */}
          {!isLoading && message.content && !isUser && (
            <FeedbackBar onRegenerate={onRegenerate} onEdit={onEdit} />
          )}

          {/* Streaming controls */}
          {isStreaming && (
            <div className="flex items-center gap-2 mt-2 pt-2" style={{ borderTop: `1px solid ${C.border}` }}>
              <button onClick={onStop}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-mono transition-all"
                style={{ background: C.rustDim, color: C.rust, border: `1px solid ${C.rustGlow}` }}>
                <Square size={11} /> Stop
              </button>
              <span className="text-[10px] font-mono" style={{ color: C.textMuted }}>Streaming…</span>
            </div>
          )}

          {/* Copy button for user messages */}
          {isUser && (
            <div className="flex items-center mt-1 pt-1" style={{ borderTop: `1px solid ${C.border}` }}>
              <button onClick={() => onCopy(message.id, message.content)}
                className="flex items-center gap-1 text-[10px] font-mono px-2 py-1 rounded transition-colors"
                style={{ color: copiedId === message.id ? C.green : C.textSecondary, background: copiedId === message.id ? C.greenDim : 'transparent' }}>
                {copiedId === message.id ? <Check size={10} /> : <Copy size={10} />}
                {copiedId === message.id ? 'Copied' : 'Copy'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Thread item ──────────────────────────────────────────────────────────────
function ThreadItem({ thread, isActive, onClick, onDelete }) {
  return (
    <button onClick={onClick}
      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors group relative"
      style={{ background: isActive ? C.surface3 : 'transparent', border: `1px solid ${isActive ? C.border2 : 'transparent'}` }}
      onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = C.surface2 }}
      onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}>
      <MessageSquare size={13} style={{ color: isActive ? C.green : C.textMuted, flexShrink: 0 }} />
      <span className="flex-1 text-[12px] truncate" style={{ color: isActive ? C.text : C.textSecondary }}>
        {thread.title || 'New chat'}
      </span>
      <span className="text-[10px] font-mono flex-shrink-0" style={{ color: C.textMuted }}>{thread.messages.length}</span>
      <button onClick={e => { e.stopPropagation(); onDelete(thread.id) }}
        className="opacity-0 group-hover:opacity-100 flex-shrink-0 p-1 rounded transition-all"
        style={{ color: C.textMuted }}
        onMouseEnter={e => { e.currentTarget.style.color = C.rust; e.currentTarget.style.background = C.rustDim }}
        onMouseLeave={e => { e.currentTarget.style.color = C.textMuted; e.currentTarget.style.background = 'transparent' }}>
        <X size={11} />
      </button>
    </button>
  )
}

// ─── SUGGESTED PROMPTS ───────────────────────────────────────────────────────
const SUGGESTIONS = [
  { label: 'Runtime health', prompt: 'Give me a short operator health check for this Hermes runtime and the first thing I should inspect next.' },
  { label: 'Gateway recovery', prompt: 'The dashboard gateway may be unhealthy. Give me a safe step-by-step recovery checklist before I restart anything.' },
  { label: 'Model tradeoffs', prompt: 'Explain the likely model/runtime tradeoffs of this Hermes setup in operator terms: stability, speed, and cost.' },
  { label: 'CLI inspection', prompt: 'Give me a concise Hermes CLI inspection plan to debug the current runtime without making risky changes.' },
]

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export function ChatPage() {
  const location = useLocation()
  const { data: gatewayData } = usePoll('/gateway', 8000)
  const messagesEndRef = useRef(null)
  const textareaRef = useRef(null)
  const abortRef = useRef(null)
  const scrollRef = useRef(null)

  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [threads, setThreads] = useState(() => {
    try { return JSON.parse(localStorage.getItem('hermes-chat-threads-v2') || '[]') } catch { return [] }
  })
  const [activeThreadId, setActiveThreadId] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [streamingText, setStreamingText] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState(null)
  const [copiedId, setCopiedId] = useState(null)
  const [showScrollBtn, setShowScrollBtn] = useState(false)

  const gatewayOnline = gatewayData?.gateway_online !== false
  const modelLabel = gatewayData?.model_label || 'kilo-auto/balanced'
  const platformCount = Array.isArray(gatewayData?.platforms) ? gatewayData.platforms.length : 0
  const groupedThreads = useMemo(() => groupByDay(threads), [threads])

  useEffect(() => { localStorage.setItem('hermes-chat-threads-v2', JSON.stringify(threads)) }, [threads])
  useEffect(() => { if (activeThread) setMessages(activeThread.messages) }, [activeThreadId]) // eslint-disable-line
  useEffect(() => { if (textareaRef.current) { textareaRef.current.style.height = 'auto'; textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px' } }, [input])

  const activeThread = useMemo(() => threads.find(t => t.id === activeThreadId) || null, [threads, activeThreadId])

  const scrollToBottom = useCallback(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }) }, [])

  useEffect(() => { if (!isStreaming) scrollToBottom() }, [messages, streamingText])

  const handleScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setShowScrollBtn(el.scrollHeight - el.scrollTop - el.clientHeight > 300)
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const q = params.get('msg')
    if (q) { setInput(q); requestAnimationFrame(() => textareaRef.current?.focus()) }
  }, [location.search])

  const createThread = useCallback(() => {
    const thread = { id: uid(), title: 'New chat', messages: [], createdAt: Date.now(), updatedAt: Date.now() }
    setThreads(prev => [thread, ...prev])
    setActiveThreadId(thread.id)
    setMessages([])
    setError(null)
    return thread.id
  }, [])

  const saveThread = useCallback((threadId, newMessages) => {
    setThreads(prev => prev.map(t => {
      if (t.id !== threadId) return t
      const title = t.title === 'New chat' && newMessages.length > 0 ? firstLine(newMessages[0]?.content) : t.title
      return { ...t, title, messages: newMessages, updatedAt: Date.now() }
    }))
  }, [])

  const deleteThread = useCallback((id) => {
    setThreads(prev => {
      const remaining = prev.filter(t => t.id !== id)
      if (activeThreadId === id) {
        setActiveThreadId(remaining[0]?.id || null)
        setMessages(remaining[0]?.messages || [])
      }
      return remaining
    })
  }, [activeThreadId])

  const switchThread = useCallback((id) => {
    if (id === activeThreadId) return
    setActiveThreadId(id)
    setError(null)
  }, [activeThreadId])

  const clearChat = useCallback(() => {
    setMessages([])
    setError(null)
    setInput('')
    if (activeThreadId) saveThread(activeThreadId, [])
  }, [activeThreadId, saveThread])

  const stopGeneration = useCallback(() => {
    if (abortRef.current) { abortRef.current.abort(); abortRef.current = null }
    setIsStreaming(false)
    setIsLoading(false)
  }, [])

  const sendMessage = useCallback(async (overridePrompt = null) => {
    const prompt = typeof overridePrompt === 'string' ? overridePrompt : input.trim()
    if (!prompt || isLoading || !gatewayOnline) return

    let threadId = activeThreadId
    if (!threadId) threadId = createThread()

    const userMsg = { id: uid(), role: 'user', content: prompt, timestamp: new Date() }
    const assistantId = uid()
    const assistantMsg = { id: assistantId, role: 'assistant', content: '', isLoading: true, timestamp: new Date() }

    setMessages(prev => {
      const next = [...prev, userMsg, assistantMsg]
      saveThread(threadId, next)
      return next
    })
    if (typeof overridePrompt !== 'string') setInput('')
    setError(null)
    setIsLoading(true)
    setStreamingText('')
    setIsStreaming(true)
    if (textareaRef.current) textareaRef.current.style.height = 'auto'

    try {
      const controller = new AbortController()
      abortRef.current = controller

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: prompt }),
        signal: controller.signal,
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || `HTTP ${response.status}`)
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let fullText = ''
      let hasChunks = false

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          hasChunks = true
          const chunk = decoder.decode(value, { stream: true })
          fullText += chunk
          setStreamingText(fullText)
          scrollToBottom()
        }
      } catch (e) {
        if (e.name === 'AbortError') {
          setMessages(prev => {
            const next = prev.map(m => m.id === assistantId ? { ...m, isLoading: false } : m)
            saveThread(threadId, next)
            return next
          })
          return
        }
      }

      if (!hasChunks) {
        const data = await response.json()
        fullText = data.response || data.message || 'No response.'
      }

      setMessages(prev => {
        const next = prev.map(m => m.id === assistantId ? { ...m, content: fullText, isLoading: false } : m)
        saveThread(threadId, next)
        return next
      })
      setStreamingText('')
      setIsStreaming(false)

    } catch (err) {
      if (err.name === 'AbortError') { setIsStreaming(false); setIsLoading(false); return }
      const errMsg = err.message || 'Failed'
      setError(errMsg)
      setIsStreaming(false)
      setMessages(prev => {
        const next = prev.map(m => m.id === assistantId ? { ...m, content: `Error: ${errMsg}`, isLoading: false, isError: true } : m)
        saveThread(threadId, next)
        return next
      })
    } finally {
      setIsLoading(false)
      abortRef.current = null
    }
  }, [input, isLoading, gatewayOnline, activeThreadId, createThread, saveThread, scrollToBottom])

  const regenerate = useCallback(async (assistantId) => {
    const idx = messages.findIndex(m => m.id === assistantId)
    if (idx < 0) return
    let prompt = null
    for (let i = idx - 1; i >= 0; i--) { if (messages[i].role === 'user') { prompt = messages[i].content; break } }
    if (!prompt) return
    setMessages(prev => { const next = prev.slice(0, idx); saveThread(activeThreadId, next); return next })
    await sendMessage(prompt)
  }, [messages, activeThreadId, sendMessage, saveThread])

  const editMessage = useCallback((assistantId) => {
    const idx = messages.findIndex(m => m.id === assistantId)
    if (idx < 0) return
    let userMsg = null
    for (let i = idx - 1; i >= 0; i--) { if (messages[i].role === 'user') { userMsg = messages[i]; break } }
    if (!userMsg) return
    setMessages(prev => { const next = prev.slice(0, idx); saveThread(activeThreadId, next); return next })
    setInput(userMsg.content)
    requestAnimationFrame(() => textareaRef.current?.focus())
  }, [messages, activeThreadId, saveThread])

  const copyMessage = useCallback(async (id, content) => {
    try { await navigator.clipboard.writeText(content); setCopiedId(id); setTimeout(() => setCopiedId(null), 1500) } catch { /* */ }
  }, [])

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (!isLoading && !isStreaming) sendMessage() }
    if (e.key === 'Escape' && isStreaming) stopGeneration()
    if ((e.ctrlKey || e.metaKey) && e.key === 'l') { e.preventDefault(); clearChat() }
  }, [sendMessage, isLoading, isStreaming, stopGeneration, clearChat])

  const applySuggestion = (prompt) => {
    if (!activeThreadId) createThread()
    setInput(prompt)
    requestAnimationFrame(() => textareaRef.current?.focus())
  }

  // ─── RENDER ────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-full" style={{ background: C.bg }}>
      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col border-r flex-shrink-0 transition-all duration-200"
        style={{ width: sidebarOpen ? '260px' : '0', overflow: 'hidden', borderColor: C.border, background: C.surface }}>
        {sidebarOpen && (
          <>
            <div className="flex items-center gap-2 px-3 py-3" style={{ borderBottom: `1px solid ${C.border}` }}>
              <Bot size={16} style={{ color: C.green }} />
              <span className="text-sm font-semibold" style={{ color: C.text }}>Chats</span>
              <button onClick={createThread}
                className="ml-auto flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-mono transition-colors"
                style={{ background: C.greenDim, color: C.green, border: `1px solid ${C.greenGlow}` }}>
                <Plus size={12} /> New
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-2 px-2">
              {threads.length === 0 && (
                <div className="text-center py-8 px-4">
                  <MessageSquare size={24} style={{ color: C.textMuted, margin: '0 auto 8px', display: 'block' }} />
                  <p className="text-[11px]" style={{ color: C.textMuted }}>No conversations yet</p>
                  <button onClick={createThread} className="mt-2 text-[11px] font-mono px-3 py-1.5 rounded-lg"
                    style={{ background: C.greenDim, color: C.green, border: `1px solid ${C.greenGlow}` }}>
                    Start a chat
                  </button>
                </div>
              )}
              {Object.entries(groupedThreads).map(([day, dayThreads]) => (
                <div key={day} className="mb-3">
                  <div className="text-[10px] font-semibold uppercase tracking-widest px-2 py-1" style={{ color: C.textMuted }}>{day}</div>
                  {dayThreads.map(thread => (
                    <ThreadItem key={thread.id} thread={thread} isActive={thread.id === activeThreadId}
                      onClick={() => switchThread(thread.id)} onDelete={deleteThread} />
                  ))}
                </div>
              ))}
            </div>

            <div className="p-3" style={{ borderTop: `1px solid ${C.border}` }}>
              <div className="flex items-center gap-2 text-[10px] font-mono" style={{ color: C.textMuted }}>
                <Cpu size={11} />
                <span className="flex-1 truncate">{modelLabel}</span>
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: gatewayOnline ? C.green : C.rust }} />
                  {gatewayOnline ? 'online' : 'offline'}
                </span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Main area ───────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-2.5 border-b flex-shrink-0" style={{ borderColor: C.border, background: C.surface }}>
          <button onClick={() => setSidebarOpen(v => !v)}
            className="flex items-center justify-center w-8 h-8 rounded-lg transition-colors"
            style={{ color: C.textSecondary }}
            onMouseEnter={e => { e.currentTarget.style.background = C.surface3 }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
            {sidebarOpen ? <PanelLeftClose size={16} /> : <PanelLeft size={16} />}
          </button>

          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono"
            style={{ background: C.greenDim, color: C.green, border: `1px solid ${C.greenGlow}` }}>
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: C.green }} />
            {gatewayOnline ? 'Live' : 'Offline'}
          </span>
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono"
            style={{ background: C.surface3, color: C.textSecondary, border: `1px solid ${C.border2}` }}>
            <Zap size={10} /> {modelLabel}
          </span>
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono"
            style={{ background: C.surface3, color: C.textSecondary, border: `1px solid ${C.border2}` }}>
            <Terminal size={10} /> {platformCount} platform{platformCount !== 1 ? 's' : ''}
          </span>

          <div className="ml-auto">
            <button onClick={clearChat} disabled={messages.length === 0}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-mono transition-colors disabled:opacity-30"
              style={{ color: C.textSecondary }}
              onMouseEnter={e => { e.currentTarget.style.background = C.rustDim; e.currentTarget.style.color = C.rust }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = C.textSecondary }}>
              <Trash2 size={13} /> Clear
            </button>
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto" style={{ scrollBehavior: 'smooth' }}>
          <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">

            {/* Empty state */}
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center text-center py-16">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5"
                  style={{ background: C.greenDim, border: `1px solid ${C.greenGlow}`, boxShadow: `0 0 30px ${C.greenDim}` }}>
                  <Bot size={28} style={{ color: C.green }} />
                </div>
                <h1 className="text-2xl font-semibold mb-2" style={{ color: C.text }}>Hey Jonas</h1>
                <p className="text-sm max-w-md leading-relaxed mb-8" style={{ color: C.textSecondary }}>
                  Operator chat for runtime inspection, debugging, and recovery plans.
                  {!gatewayOnline && <span style={{ color: C.rust }}> Gateway is offline.</span>}
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-2xl mb-8">
                  {SUGGESTIONS.map(s => (
                    <button key={s.label} onClick={() => applySuggestion(s.prompt)} disabled={!gatewayOnline}
                      className="text-left rounded-xl border px-4 py-3 transition-all hover:-translate-y-0.5 disabled:opacity-40 disabled:cursor-not-allowed"
                      style={{ background: C.surface, borderColor: C.border2 }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = C.greenGlow; e.currentTarget.style.background = C.surface2 }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = C.border2; e.currentTarget.style.background = C.surface }}>
                      <div className="flex items-center gap-2 mb-1.5">
                        <Sparkles size={12} style={{ color: C.amber }} />
                        <span className="text-[11px] font-semibold" style={{ color: C.text }}>{s.label}</span>
                      </div>
                      <div className="text-[11px] leading-relaxed" style={{ color: C.textSecondary }}>{s.prompt}</div>
                    </button>
                  ))}
                </div>

                <div className="flex flex-wrap justify-center gap-2 max-w-xl">
                  {['Memory inspection', 'CLI debugging', 'MCP tools', 'System recovery', 'Log analysis'].map(tag => (
                    <span key={tag} className="px-2.5 py-1 rounded-full text-[10px] font-mono"
                      style={{ background: C.surface3, color: C.textSecondary, border: `1px solid ${C.border2}` }}>
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Messages */}
            {messages.map(msg => (
              <MessageBubble key={msg.id} message={msg}
                isStreaming={isStreaming && msg.id === messages[messages.length - 1]?.id && msg.role === 'assistant'}
                streamingText={streamingText}
                onRegenerate={() => regenerate(msg.id)}
                onEdit={() => editMessage(msg.id)}
                onStop={stopGeneration}
                onCopy={copyMessage}
                copiedId={copiedId} />
            ))}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-4 mb-2 px-3 py-2 rounded-lg flex items-center gap-2 text-sm"
            style={{ background: C.rustDim, border: `1px solid ${C.rustGlow}`, color: C.rust }}>
            <AlertCircle size={14} />
            <span className="flex-1">{error}</span>
            <button onClick={() => setError(null)} className="opacity-70 hover:opacity-100"><X size={13} /></button>
          </div>
        )}

        {/* Input */}
        <div className="px-4 pb-4 pt-2 flex-shrink-0" style={{ borderTop: `1px solid ${C.border}` }}>
          {/* Quick suggestions when chatting */}
          {input.length === 0 && messages.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {SUGGESTIONS.slice(0, 3).map(s => (
                <button key={s.label} onClick={() => applySuggestion(s.prompt)}
                  className="px-2.5 py-1 rounded-full text-[10px] font-mono transition-colors"
                  style={{ background: C.surface2, color: C.textSecondary, border: `1px solid ${C.border2}` }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = C.greenGlow; e.currentTarget.style.color = C.green }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = C.border2; e.currentTarget.style.color = C.textSecondary }}>
                  {s.label}
                </button>
              ))}
            </div>
          )}

          {/* Input box */}
          <div className="flex items-end gap-3 rounded-2xl px-4 py-3 transition-all"
            style={{
              background: C.surface,
              border: `1px solid ${isLoading || isStreaming ? C.greenGlow : C.border2}`,
              boxShadow: isLoading || isStreaming ? `0 0 0 1px ${C.greenDim}` : 'none',
            }}>
            <textarea ref={textareaRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown}
              placeholder={!gatewayOnline ? 'Gateway offline' : messages.length === 0 ? 'Ask about runtime health, debugging, or recovery plans…' : 'Continue the conversation…'}
              disabled={isLoading && !isStreaming || !gatewayOnline}
              rows={1}
              className="flex-1 bg-transparent resize-none text-sm outline-none placeholder:text-sm disabled:opacity-50"
              style={{ color: C.text, fontFamily: "'Inter', sans-serif", lineHeight: '1.6', maxHeight: '200px', overflowY: 'auto' }} />

            {(isLoading || isStreaming) ? (
              <button onClick={stopGeneration}
                className="flex items-center justify-center w-9 h-9 rounded-lg transition-all flex-shrink-0"
                style={{ background: C.rustDim, border: `1px solid ${C.rustGlow}`, color: C.rust }} title="Stop (Esc)">
                <Square size={15} />
              </button>
            ) : (
              <button onClick={() => sendMessage()} disabled={!input.trim() || !gatewayOnline}
                className="flex items-center justify-center w-9 h-9 rounded-lg transition-all flex-shrink-0"
                style={{
                  background: input.trim() && gatewayOnline ? C.green : C.surface3,
                  border: `1px solid ${input.trim() && gatewayOnline ? C.green : C.border}`,
                  cursor: input.trim() && gatewayOnline ? 'pointer' : 'not-allowed',
                  opacity: input.trim() && gatewayOnline ? 1 : 0.4,
                }}
                title="Send (Enter)"
                onMouseEnter={e => { if (input.trim() && gatewayOnline) e.currentTarget.style.boxShadow = `0 0 12px ${C.greenGlow}` }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none' }}>
                <Send size={15} style={{ color: input.trim() && gatewayOnline ? C.bg : C.textSecondary }} />
              </button>
            )}
          </div>

          {/* Hints */}
          <div className="flex items-center justify-between mt-2 px-1 gap-4">
            <span className="text-[10px] font-mono" style={{ color: C.textMuted }}>
              {!gatewayOnline ? 'Gateway offline' : isLoading || isStreaming ? 'Generating — Esc to stop' : 'Enter send · Shift+Enter newline · Esc stop · Ctrl+L clear'}
            </span>
            <span className="text-[10px] font-mono" style={{ color: C.textMuted }}>
              {messages.length > 0 ? `${messages.length} message${messages.length !== 1 ? 's' : ''}` : 'No MCP tools in operator chat'}
            </span>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes hermes-bounce {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
          40% { transform: scale(1); opacity: 1; }
        }
        @keyframes hermes-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        .animate-pulse { animation: hermes-pulse 2s infinite; }
      `}</style>
    </div>
  )
}
