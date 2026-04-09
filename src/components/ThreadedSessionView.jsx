import React, { useState, useEffect, useRef } from 'react'
import { useApi } from '../hooks/useApi'
import { ChatMessageBubble } from './ChatMessageBubble'
import { Loader2, AlertCircle, Terminal, RefreshCw, ChevronLeft } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { clsx } from 'clsx'

const T = {
  bg:      '#060608',
  surface: '#0d0f17',
  surface2:'#0f1119',
  border:  '#111318',
  text:    '#d8d8e0',
  muted:   '#6b6b80',
  green:   '#00b478',
  rust:    '#e05f40',
  blue:    '#4a80c8',
  amber:   '#e09040',
}

export function ThreadedSessionView({ sessionId, onBack }) {
  const { data, loading, error, refresh } = useApi(
    sessionId ? `/sessions/${sessionId}/messages` : null,
    [sessionId]
  )
  
  const scrollRef = useRef(null)

  // Auto-scroll to bottom when messages update
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [data?.messages, loading])

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-surface/50 border border-border rounded-xl">
        <Loader2 size={32} className="text-rust animate-spin mb-4" />
        <span className="text-sm font-medium text-t2">Fetching thread history…</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8 bg-surface/50 border border-rust/20 rounded-xl flex flex-col items-center text-center">
        <AlertCircle size={32} className="text-rust mb-3" />
        <p className="text-sm text-rust font-bold mb-1">Could not load session</p>
        <p className="text-[11px] text-muted mb-4 max-w-xs">{error}</p>
        <button 
          onClick={refresh}
          className="px-4 py-2 bg-rust/10 border border-rust/30 text-rust rounded-lg text-xs font-bold hover:bg-rust/20 transition-all flex items-center gap-2"
        >
          <RefreshCw size={14} /> Retry
        </button>
      </div>
    )
  }

  const messages = data?.messages || []

  return (
    <div className="flex flex-col h-full bg-surface/30 backdrop-blur-sm rounded-xl border border-border overflow-hidden">
      {/* Thread Header */}
      <div className="px-5 py-4 border-b border-border bg-surface2/60 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <button 
            onClick={onBack}
            className="p-1.5 rounded hover:bg-white/5 text-muted hover:text-text transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
          <div>
            <h3 className="text-sm font-bold text-text flex items-center gap-2">
              <Terminal size={14} className="text-rust" />
              Threaded View
            </h3>
            <p className="text-[10px] text-muted font-mono tracking-tighter">
              SID: {sessionId}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
           <button 
             onClick={refresh}
             className={clsx(
               "p-2 rounded hover:bg-white/5 transition-colors",
               loading && "animate-spin text-rust"
             )}
           >
             <RefreshCw size={14} />
           </button>
        </div>
      </div>

      {/* Message List */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 scroll-smooth"
      >
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted py-12">
            <Terminal size={48} className="text-border mb-4" />
            <p className="text-sm font-medium">No messages found in this session</p>
            <p className="text-[11px]">The agent might have initialized but not processed any messages yet.</p>
          </div>
        ) : (
          <AnimatePresence>
            {messages.map((m, idx) => (
              <motion.div
                key={m.id || idx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: idx * 0.05 }}
              >
                <ChatMessageBubble message={m} />
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* Subtle Footer info */}
      <div className="px-5 py-2 border-t border-border bg-surface2/30">
        <div className="flex items-center justify-between text-[10px] font-mono text-muted">
          <span>{messages.length} messages</span>
          <span>Last sync: {new Date().toLocaleTimeString()}</span>
        </div>
      </div>
    </div>
  )
}
