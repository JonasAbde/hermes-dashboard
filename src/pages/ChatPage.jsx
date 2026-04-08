import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import {
  Send,
  Bot,
  User,
  AlertCircle,
  Trash2,
  MessageSquare,
  Sparkles,
  TerminalSquare,
  Radio,
  Copy,
  Check,
  RotateCcw,
  PencilLine,
} from 'lucide-react'
import { usePoll } from '../hooks/useApi'

const colors = {
  bg: '#060608',
  surface: '#0d0f17',
  surface2: '#0f1019',
  border: '#111318',
  border2: '#1a1c26',
  text: '#d8d8e0',
  textSecondary: '#6b6b80',
  textMuted: '#2a2b38',
  green: '#00b478',
  greenDim: 'rgba(0,180,120,0.12)',
  greenGlow: 'rgba(0,180,120,0.25)',
  rust: '#e05f40',
  rustDim: 'rgba(224,95,64,0.12)',
  rustGlow: 'rgba(224,95,64,0.25)',
  amber: '#e09040',
  amberDim: 'rgba(224,144,64,0.12)',
  amberGlow: 'rgba(224,144,64,0.25)',
  blue: '#4a80c8',
  blueDim: 'rgba(74,128,200,0.12)',
  blueGlow: 'rgba(74,128,200,0.25)',
}

const SUGGESTED_PROMPTS = [
  {
    id: 'health',
    label: 'Runtime health check',
    prompt: 'Give me a short operator health check for this Hermes runtime and the first thing I should inspect next.',
  },
  {
    id: 'gateway',
    label: 'Gateway recovery',
    prompt: 'The dashboard gateway may be unhealthy. Give me a safe step-by-step recovery checklist before I restart anything.',
  },
  {
    id: 'models',
    label: 'Model tradeoffs',
    prompt: 'Explain the likely model/runtime tradeoffs of this Hermes setup in operator terms: stability, speed, and cost.',
  },
  {
    id: 'commands',
    label: 'CLI inspection plan',
    prompt: 'Give me a concise Hermes CLI inspection plan to debug the current runtime without making risky changes.',
  },
]

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1.5 py-1">
      <div
        className="w-1.5 h-1.5 rounded-full"
        style={{ background: colors.green, animation: 'hermes-bounce 1.4s infinite ease-in-out both' }}
      />
      <div
        className="w-1.5 h-1.5 rounded-full"
        style={{ background: colors.green, animation: 'hermes-bounce 1.4s infinite ease-in-out 0.16s both' }}
      />
      <div
        className="w-1.5 h-1.5 rounded-full"
        style={{ background: colors.green, animation: 'hermes-bounce 1.4s infinite ease-in-out 0.32s both' }}
      />
    </div>
  )
}

function formatTimestamp(date) {
  return new Intl.DateTimeFormat('da-DK', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date)
}

function createMessageId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function EmptyPromptCard({ item, onSelect }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(item.prompt)}
      className="text-left rounded-xl border px-3 py-3 transition-all duration-200 hover:-translate-y-0.5"
      style={{
        background: colors.surface,
        borderColor: colors.border2,
      }}
    >
      <div className="flex items-center gap-2 text-[11px] font-semibold" style={{ color: colors.text }}>
        <Sparkles size={12} style={{ color: colors.rust }} />
        {item.label}
      </div>
      <div className="mt-1.5 text-[11px] leading-relaxed" style={{ color: colors.textSecondary }}>
        {item.prompt}
      </div>
    </button>
  )
}

function StatusPill({ icon: Icon, label, tone = 'neutral' }) {
  const toneMap = {
    good: { bg: colors.greenDim, border: colors.greenGlow, text: colors.green },
    warn: { bg: colors.amberDim, border: colors.amberGlow, text: colors.amber },
    danger: { bg: colors.rustDim, border: colors.rustGlow, text: colors.rust },
    info: { bg: colors.blueDim, border: colors.blueGlow, text: colors.blue },
    neutral: { bg: colors.surface2, border: colors.border2, text: colors.textSecondary },
  }
  const current = toneMap[tone] || toneMap.neutral

  return (
    <div
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono"
      style={{
        background: current.bg,
        border: `1px solid ${current.border}`,
        color: current.text,
      }}
    >
      <Icon size={11} />
      {label}
    </div>
  )
}

function ActionButton({ onClick, title, children, tone = 'neutral' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-mono transition-all duration-150"
      style={{
        background: tone === 'danger' ? colors.rustDim : colors.surface2,
        color: tone === 'danger' ? colors.rust : colors.textSecondary,
        border: `1px solid ${tone === 'danger' ? colors.rustGlow : colors.border2}`,
      }}
    >
      {children}
    </button>
  )
}

function MessageBubble({ message, onCopy, onEdit, onRegenerate, canRegenerate, isCopied }) {
  const isUser = message.role === 'user'
  const isError = message.isError
  const speaker = isUser ? 'Operator' : 'Hermes'

  return (
    <div
      className="flex items-start gap-3"
      style={{
        flexDirection: isUser ? 'row-reverse' : 'row',
      }}
    >
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{
          background: isUser ? colors.rustDim : colors.greenDim,
          border: `1px solid ${isUser ? colors.rustGlow : colors.greenGlow}`,
        }}
      >
        {isUser
          ? <User size={16} style={{ color: colors.rust }} />
          : <Bot size={16} style={{ color: colors.green }} />
        }
      </div>

      <div
        className="px-4 py-3 rounded-2xl max-w-[80%]"
        style={{
          background: isError
            ? colors.rustDim
            : isUser
              ? colors.rustDim
              : colors.surface,
          border: `1px solid ${isError ? colors.rustGlow : isUser ? colors.rustGlow : colors.border}`,
          borderTopRightRadius: isUser ? '4px' : undefined,
          borderTopLeftRadius: isUser ? undefined : '4px',
        }}
      >
        <div className="flex items-center justify-between gap-3 mb-1.5">
          <div className="text-[10px] uppercase tracking-[0.18em] font-mono" style={{ color: colors.textMuted }}>
            {speaker}
          </div>
          <div className="text-[10px] font-mono" style={{ color: colors.textMuted }}>
            {formatTimestamp(message.timestamp)}
          </div>
        </div>
        <div
          className="text-sm whitespace-pre-wrap break-words leading-relaxed"
          style={{
            color: isError ? colors.rust : colors.text,
            fontFamily: "'Inter', sans-serif",
          }}
        >
          {message.content || (message.isLoading ? '' : '')}
        </div>

        {!message.isLoading && message.content && (
          <div className="mt-2.5 flex items-center gap-1.5">
            <ActionButton onClick={() => onCopy(message.id, message.content)} title="Copy message">
              {isCopied ? <Check size={11} /> : <Copy size={11} />}
              <span>{isCopied ? 'Copied' : 'Copy'}</span>
            </ActionButton>

            {isUser && (
              <ActionButton onClick={() => onEdit(message.id)} title="Edit this prompt and continue from here">
                <PencilLine size={11} />
                <span>Edit</span>
              </ActionButton>
            )}

            {!isUser && canRegenerate && (
              <ActionButton onClick={() => onRegenerate(message.id)} title="Regenerate this answer">
                <RotateCcw size={11} />
                <span>Regenerate</span>
              </ActionButton>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export function ChatPage() {
  const location = useLocation()
  const { data: gatewayData } = usePoll('/gateway', 8000)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [copiedMessageId, setCopiedMessageId] = useState(null)
  const [retryPrompt, setRetryPrompt] = useState(null)
  const messagesEndRef = useRef(null)
  const textareaRef = useRef(null)

  const gatewayStatus = gatewayData
    ? (gatewayData.gateway_online ? 'online' : 'offline')
    : 'checking'
  const isGatewayOffline = gatewayStatus === 'offline'

  const modelLabel = gatewayData?.model_label || 'model unknown'
  const platformCount = Array.isArray(gatewayData?.platforms) ? gatewayData.platforms.length : 0
  const sessionModeLabel = 'ephemeral operator chat'

  const placeholder = useMemo(() => {
    if (isGatewayOffline) return 'Gateway offline. Start or recover the gateway before sending prompts.'
    if (!messages.length) return 'Ask Hermes to inspect runtime health, explain tradeoffs, or draft a safe debug plan...'
    return 'Ask a follow-up, request a command plan, or tighten the answer...'
  }, [isGatewayOffline, messages.length])

  const lastAssistantMessageId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const current = messages[i]
      if (current.role === 'assistant' && !current.isLoading) {
        return current.id
      }
    }
    return null
  }, [messages])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView?.({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`
    }
  }, [input])

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const quickPrompt = params.get('msg')
    if (quickPrompt) {
      setInput(quickPrompt)
      requestAnimationFrame(() => textareaRef.current?.focus())
    }
  }, [location.search])

  useEffect(() => {
    const clear = () => {
      setMessages([])
      setError(null)
    }
    window.addEventListener('hermes:clear-chat', clear)
    return () => window.removeEventListener('hermes:clear-chat', clear)
  }, [])

  const sendMessage = useCallback(async (overridePrompt = null) => {
    const sourcePrompt = typeof overridePrompt === 'string' ? overridePrompt : input
    const trimmed = sourcePrompt.trim()
    if (!trimmed || isLoading || isGatewayOffline) return

    const userMessage = {
      id: createMessageId(),
      role: 'user',
      content: trimmed,
      timestamp: new Date(),
    }

    const assistantId = createMessageId()
    const assistantPlaceholder = {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isLoading: true,
    }

    setMessages((prev) => [...prev, userMessage, assistantPlaceholder])
    if (typeof overridePrompt !== 'string') {
      setInput('')
    }
    setIsLoading(true)
    setError(null)
    setRetryPrompt(null)

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || `HTTP ${response.status}`)
      }

      const data = await response.json()

      setMessages((prev) => prev.map((msg) =>
        msg.id === assistantId
          ? { ...msg, content: data.response || data.message || 'No response received.', isLoading: false }
          : msg
      ))
      setRetryPrompt(null)
    } catch (err) {
      const nextError = err.message || 'Failed to send message'
      setError(nextError)
      setRetryPrompt(trimmed)
      setMessages((prev) => prev.map((msg) =>
        msg.id === assistantId
          ? { ...msg, content: `Error: ${nextError}`, isLoading: false, isError: true }
          : msg
      ))
    } finally {
      setIsLoading(false)
    }
  }, [input, isLoading, isGatewayOffline])

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }, [sendMessage])

  const clearChat = useCallback(() => {
    setMessages([])
    setError(null)
    setRetryPrompt(null)
  }, [])

  const applyPrompt = useCallback((prompt) => {
    setInput(prompt)
    requestAnimationFrame(() => textareaRef.current?.focus())
  }, [])

  const copyMessage = useCallback(async (messageId, content) => {
    try {
      await navigator.clipboard.writeText(content)
      setCopiedMessageId(messageId)
      window.setTimeout(() => setCopiedMessageId(null), 1200)
    } catch {
      setError('Failed to copy message to clipboard')
    }
  }, [])

  const editFromMessage = useCallback((messageId) => {
    const idx = messages.findIndex((msg) => msg.id === messageId)
    if (idx < 0) return
    const target = messages[idx]
    if (target.role !== 'user') return

    setInput(target.content)
    setMessages((prev) => prev.slice(0, idx))
    setError(null)
    setRetryPrompt(null)
    requestAnimationFrame(() => textareaRef.current?.focus())
  }, [messages])

  const regenerateResponse = useCallback(async (assistantMessageId) => {
    if (isLoading || isGatewayOffline) return

    const assistantIndex = messages.findIndex((msg) => msg.id === assistantMessageId)
    if (assistantIndex < 0) return

    let sourcePrompt = null
    for (let i = assistantIndex - 1; i >= 0; i -= 1) {
      if (messages[i].role === 'user') {
        sourcePrompt = messages[i].content
        break
      }
    }

    if (!sourcePrompt) return

    await sendMessage(sourcePrompt)
  }, [isGatewayOffline, isLoading, messages, sendMessage])

  const retryLastPrompt = useCallback(() => {
    if (!retryPrompt || isLoading || isGatewayOffline) return
    sendMessage(retryPrompt)
  }, [isGatewayOffline, isLoading, retryPrompt, sendMessage])

  return (
    <div className="flex flex-col h-full" style={{ background: colors.bg }}>
      <div
        className="flex items-center justify-between px-4 py-3 border-b"
        style={{ borderColor: colors.border, background: colors.surface }}
      >
        <div className="flex items-center gap-2">
          <MessageSquare size={15} style={{ color: colors.rust }} />
          <span className="text-sm font-semibold" style={{ color: colors.text }}>Chat</span>
          <span
            className="px-2 py-0.5 text-[10px] font-mono rounded-full"
            style={{
              background: isGatewayOffline ? colors.rustDim : colors.greenDim,
              color: isGatewayOffline ? colors.rust : colors.green,
              border: `1px solid ${isGatewayOffline ? colors.rustGlow : colors.greenGlow}`,
            }}
          >
            {gatewayStatus === 'checking' ? (
              <span className="flex items-center gap-1">
                <svg className="animate-spin" width="8" height="8" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                checking
              </span>
            ) : isGatewayOffline ? 'offline' : 'live'}
          </span>
        </div>
        <button
          onClick={clearChat}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs transition-all duration-150"
          style={{
            color: colors.textSecondary,
            background: 'transparent',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = colors.rustDim
            e.currentTarget.style.color = colors.rust
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent'
            e.currentTarget.style.color = colors.textSecondary
          }}
        >
          <Trash2 size={12} />
          <span>Clear</span>
        </button>
      </div>

      <div
        className="px-4 py-3 border-b"
        style={{ borderColor: colors.border, background: colors.surface2 }}
      >
        <div className="flex flex-wrap gap-2">
          <StatusPill
            icon={Radio}
            tone={isGatewayOffline ? 'danger' : gatewayStatus === 'checking' ? 'warn' : 'good'}
            label={isGatewayOffline ? 'gateway offline' : gatewayStatus === 'checking' ? 'gateway checking' : 'gateway live'}
          />
          <StatusPill icon={Sparkles} tone="info" label={modelLabel} />
          <StatusPill icon={TerminalSquare} tone="neutral" label={`${platformCount} platform${platformCount === 1 ? '' : 's'}`} />
          <StatusPill icon={MessageSquare} tone="neutral" label={sessionModeLabel} />
        </div>
        <div className="mt-2 text-[11px] leading-relaxed" style={{ color: colors.textSecondary }}>
          This panel sends one-off operator prompts through <span style={{ color: colors.text }}>Hermes CLI tooling</span>.
          Memory and context files are skipped here, so use it for runtime guidance, debugging plans, and quick operator questions.
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4" style={{ scrollBehavior: 'smooth' }}>
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center min-h-full text-center py-8">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
              style={{ background: colors.greenDim, border: `1px solid ${colors.greenGlow}` }}
            >
              <Bot size={24} style={{ color: colors.green }} />
            </div>
            <h2 className="text-lg font-semibold mb-2" style={{ color: colors.text, fontFamily: "'Inter', sans-serif" }}>
              Operator Chat
            </h2>
            <p className="text-sm max-w-xl leading-relaxed" style={{ color: colors.textSecondary }}>
              Use this chat for quick runtime reasoning, safe recovery plans, CLI inspection help, and concise operator summaries.
              {isGatewayOffline && <span style={{ color: colors.rust }}> Gateway currently looks offline, so send is disabled until it recovers.</span>}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full max-w-4xl mt-6">
              {SUGGESTED_PROMPTS.map((item) => (
                <EmptyPromptCard key={item.id} item={item} onSelect={applyPrompt} />
              ))}
            </div>

            <div
              className="mt-6 max-w-2xl rounded-xl border px-4 py-3 text-left"
              style={{ background: colors.surface, borderColor: colors.border2 }}
            >
              <div className="text-[11px] font-semibold mb-1.5" style={{ color: colors.text }}>
                What works well here
              </div>
              <div className="text-[11px] leading-relaxed" style={{ color: colors.textSecondary }}>
                Ask for operator checklists, risk-aware next steps, and concise command plans. Quick Ask from the command palette also lands here and pre-fills the message box.
              </div>
            </div>
          </div>
        )}

        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            onCopy={copyMessage}
            onEdit={editFromMessage}
            onRegenerate={regenerateResponse}
            canRegenerate={message.id === lastAssistantMessageId}
            isCopied={copiedMessageId === message.id}
          />
        ))}

        {isLoading && messages.length > 0 && messages[messages.length - 1]?.role === 'user' && (
          <div className="flex items-start gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: colors.greenDim, border: `1px solid ${colors.greenGlow}` }}
            >
              <Bot size={16} style={{ color: colors.green }} />
            </div>
            <div
              className="px-4 py-3 rounded-2xl rounded-tl-md"
              style={{
                background: colors.surface,
                border: `1px solid ${colors.border}`,
                maxWidth: '80%',
              }}
            >
              <TypingIndicator />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {error && (
        <div
          className="mx-4 mb-2 px-3 py-2 rounded-lg flex items-center gap-2 text-sm"
          style={{
            background: colors.rustDim,
            border: `1px solid ${colors.rustGlow}`,
            color: colors.rust,
          }}
        >
          <AlertCircle size={14} />
          <span>{error}</span>
          {retryPrompt && !isLoading && !isGatewayOffline && (
            <button
              onClick={retryLastPrompt}
              className="ml-auto mr-2 text-xs opacity-80 hover:opacity-100"
              style={{ color: colors.text }}
            >
              Retry
            </button>
          )}
          <button onClick={() => setError(null)} className="ml-auto text-xs opacity-70 hover:opacity-100">
            Dismiss
          </button>
        </div>
      )}

      <div className="px-4 pb-4 pt-2" style={{ borderTop: `1px solid ${colors.border}` }}>
        <div className="mb-2 flex flex-wrap gap-1.5">
          {SUGGESTED_PROMPTS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => applyPrompt(item.prompt)}
              disabled={isLoading || isGatewayOffline}
              className="px-2.5 py-1 rounded-full text-[10px] font-mono transition-all duration-150"
              style={{
                background: colors.surface2,
                color: colors.textSecondary,
                border: `1px solid ${colors.border2}`,
                opacity: isLoading || isGatewayOffline ? 0.55 : 1,
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div
          className="flex items-end gap-3 rounded-xl px-4 py-3"
          style={{
            background: colors.surface,
            border: `1px solid ${isLoading ? colors.greenGlow : colors.border2}`,
            boxShadow: isLoading ? `0 0 0 1px ${colors.greenDim}` : 'none',
          }}
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={isLoading || isGatewayOffline}
            rows={1}
            className="flex-1 bg-transparent resize-none text-sm outline-none placeholder:text-sm"
            style={{
              color: colors.text,
              fontFamily: "'Inter', sans-serif",
              lineHeight: '1.5',
              maxHeight: '150px',
              overflowY: 'auto',
            }}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || isLoading || isGatewayOffline}
            className="flex items-center justify-center min-w-9 h-9 px-3 rounded-lg flex-shrink-0 transition-all duration-150"
            style={{
              background: input.trim() && !isLoading && !isGatewayOffline ? colors.green : colors.surface2,
              border: `1px solid ${input.trim() && !isLoading && !isGatewayOffline ? colors.green : colors.border}`,
              cursor: input.trim() && !isLoading && !isGatewayOffline ? 'pointer' : 'not-allowed',
              opacity: input.trim() && !isLoading && !isGatewayOffline ? 1 : 0.5,
            }}
            onMouseEnter={(e) => {
              if (input.trim() && !isLoading && !isGatewayOffline) {
                e.currentTarget.style.boxShadow = `0 0 12px ${colors.greenGlow}`
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = 'none'
            }}
          >
            {isLoading ? (
              <div className="w-4 h-4 rounded-full border-2 border-transparent" style={{ borderTopColor: colors.green, borderRightColor: colors.green, animation: 'hermes-spin 0.9s linear infinite' }} />
            ) : (
              <Send size={16} style={{ color: input.trim() && !isLoading && !isGatewayOffline ? colors.bg : colors.textSecondary }} />
            )}
          </button>
        </div>
        <div className="flex items-center justify-between mt-2 px-1 gap-4">
          <span className="text-[10px] font-mono" style={{ color: colors.textMuted }}>
            {isGatewayOffline ? 'Gateway offline · chat send is disabled' : 'Enter to send · Shift+Enter for newline'}
          </span>
          <span className="text-[10px] font-mono text-right" style={{ color: colors.textMuted }}>
            {messages.length > 0 ? `${messages.length} message${messages.length !== 1 ? 's' : ''}` : 'Quick Ask prefill supported'}
          </span>
        </div>
      </div>

      <style>{`
        @keyframes hermes-bounce {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
          40% { transform: scale(1); opacity: 1; }
        }
        @keyframes hermes-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
