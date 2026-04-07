import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Send, Bot, User, AlertCircle, Trash2, MessageSquare } from 'lucide-react'

// Design tokens
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
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1.5 py-1">
      <div
        className="w-1.5 h-1.5 rounded-full"
        style={{ background: colors.green, animation: 'bounce 1.4s infinite ease-in-out both' }}
      />
      <div
        className="w-1.5 h-1.5 rounded-full"
        style={{ background: colors.green, animation: 'bounce 1.4s infinite ease-in-out 0.16s both' }}
      />
      <div
        className="w-1.5 h-1.5 rounded-full"
        style={{ background: colors.green, animation: 'bounce 1.4s infinite ease-in-out 0.32s both' }}
      />
      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
          40% { transform: scale(1); opacity: 1; }
        }
      `}</style>
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

export function ChatPage() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [gatewayStatus, setGatewayStatus] = useState(null)
  const messagesEndRef = useRef(null)
  const textareaRef = useRef(null)
  const chatContainerRef = useRef(null)

  // Fetch gateway status on mount
  useEffect(() => {
    fetch('/api/gateway')
      .then(res => res.ok ? res.json() : null)
      .then(data => setGatewayStatus(data?.gateway_online ? 'online' : 'offline'))
      .catch(() => setGatewayStatus('offline'))
  }, [])

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`
    }
  }, [input])

  const sendMessage = useCallback(async () => {
    const trimmed = input.trim()
    if (!trimmed || isLoading) return

    const userMessage = {
      id: Date.now(),
      role: 'user',
      content: trimmed,
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)
    setError(null)

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }

    // Add placeholder for assistant response
    const assistantId = Date.now() + 1
    setMessages(prev => [...prev, {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isLoading: true,
    }])

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

      setMessages(prev => prev.map(msg =>
        msg.id === assistantId
          ? { ...msg, content: data.response || data.message || 'No response received.', isLoading: false }
          : msg
      ))
    } catch (err) {
      setError(err.message || 'Failed to send message')
      setMessages(prev => prev.map(msg =>
        msg.id === assistantId
          ? { ...msg, content: `Error: ${err.message || 'Failed to get response'}`, isLoading: false, isError: true }
          : msg
      ))
    } finally {
      setIsLoading(false)
    }
  }, [input, isLoading])

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }, [sendMessage])

  const clearChat = useCallback(() => {
    setMessages([])
    setError(null)
  }, [])

  const isGatewayOffline = gatewayStatus === 'offline'

  return (
    <div
      className="flex flex-col h-full"
      style={{ background: colors.bg }}
    >
      {/* Header */}
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
            {isGatewayOffline ? 'offline' : 'live'}
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

      {/* Messages container */}
      <div
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
        style={{ scrollBehavior: 'smooth' }}
      >
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
              style={{ background: colors.greenDim, border: `1px solid ${colors.greenGlow}` }}
            >
              <Bot size={24} style={{ color: colors.green }} />
            </div>
            <h2
              className="text-lg font-semibold mb-2"
              style={{ color: colors.text, fontFamily: "'Inter', sans-serif" }}
            >
              Hermes Chat
            </h2>
            <p className="text-sm max-w-sm" style={{ color: colors.textSecondary }}>
              Send a message to start chatting with Hermes.
              {isGatewayOffline && (
                <span style={{ color: colors.rust }}> Gateway appears to be offline.</span>
              )}
            </p>
          </div>
        )}

        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
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

      {/* Error banner */}
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
          <button
            onClick={() => setError(null)}
            className="ml-auto text-xs opacity-70 hover:opacity-100"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Input area */}
      <div
        className="px-4 pb-4 pt-2"
        style={{ borderTop: `1px solid ${colors.border}` }}
      >
        <div
          className="flex items-end gap-3 rounded-xl px-4 py-3"
          style={{
            background: colors.surface,
            border: `1px solid ${colors.border2}`,
          }}
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isGatewayOffline ? 'Gateway offline...' : 'Type a message...'}
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
            className="flex items-center justify-center w-9 h-9 rounded-lg flex-shrink-0 transition-all duration-150"
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
            <Send size={16} style={{ color: input.trim() && !isLoading && !isGatewayOffline ? colors.bg : colors.textSecondary }} />
          </button>
        </div>
        <div className="flex items-center justify-between mt-2 px-1">
          <span className="text-[10px] font-mono" style={{ color: colors.textMuted }}>
            Enter to send · Shift+Enter for newline
          </span>
          {messages.length > 0 && (
            <span className="text-[10px] font-mono" style={{ color: colors.textMuted }}>
              {messages.length} message{messages.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

function MessageBubble({ message }) {
  const isUser = message.role === 'user'
  const isError = message.isError

  return (
    <div
      className="flex items-start gap-3"
      style={{
        flexDirection: isUser ? 'row-reverse' : 'row',
      }}
    >
      {/* Avatar */}
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

      {/* Bubble */}
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
        <div
          className="text-sm whitespace-pre-wrap break-words leading-relaxed"
          style={{
            color: isError ? colors.rust : colors.text,
            fontFamily: "'Inter', sans-serif",
          }}
        >
          {message.content || (message.isLoading ? '' : '')}
        </div>
        <div
          className="text-[10px] font-mono mt-1.5"
          style={{ color: colors.textMuted }}
        >
          {formatTimestamp(message.timestamp)}
        </div>
      </div>
    </div>
  )
}
