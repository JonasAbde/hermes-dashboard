import React, { useState } from 'react'
import { clsx } from 'clsx'
import { ChevronDown, ChevronRight, Terminal, User, Bot, Code } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

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

export function ChatMessageBubble({ message }) {
  const { role, content, name, function_call, tool_calls } = message
  const [isExpanded, setIsExpanded] = useState(false)

  const isUser = role === 'user'
  const isAssistant = role === 'assistant'
  const isTool = role === 'tool' || role === 'function'

  // Determine label and icon
  let label = role
  let Icon = Bot
  let accentColor = T.green

  if (isUser) {
    label = 'User'
    Icon = User
    accentColor = T.rust
  } else if (isAssistant) {
    label = 'Assistant'
    Icon = Bot
    accentColor = T.green
  } else if (isTool) {
    label = name || 'Tool'
    Icon = Code
    accentColor = T.blue
  }

  return (
    <div className={clsx(
      'flex flex-col gap-1.5 mb-6 max-w-[90%]',
      isUser ? 'ml-auto items-end' : 'mr-auto items-start'
    )}>
      {/* Header */}
      <div className={clsx(
        'flex items-center gap-2 px-1',
        isUser ? 'flex-row-reverse' : 'flex-row'
      )}>
        <div 
          className="p-1.5 rounded-lg bg-surface2 border border-border"
          style={{ color: accentColor }}
        >
          <Icon size={14} />
        </div>
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted">
          {label}
        </span>
      </div>

      {/* Bubble */}
      <div className={clsx(
        'rounded-2xl px-4 py-3 border text-sm leading-relaxed shadow-sm',
        isUser 
          ? 'bg-surface2 border-border text-text rounded-tr-none' 
          : isTool
            ? 'bg-surface border-border/50 text-muted font-mono text-xs rounded-tl-none'
            : 'bg-surface border-border text-text rounded-tl-none'
      )}>
        {isTool ? (
          <div className="space-y-2">
            <button 
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex items-center gap-2 hover:text-text transition-colors group"
            >
              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              <span className="font-bold uppercase tracking-wider text-[9px]">Tool Output</span>
            </button>
            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <pre className="bg-black/40 p-3 rounded-md border border-white/5 overflow-x-auto text-[11px] text-blue-300">
                    {typeof content === 'string' ? content : JSON.stringify(content, null, 2)}
                  </pre>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ) : (
          <div className="whitespace-pre-wrap break-words">
            {content}
          </div>
        )}

        {/* Tool Calls if any */}
        {tool_calls && tool_calls.length > 0 && (
          <div className="mt-3 pt-3 border-t border-white/5 space-y-2">
            {tool_calls.map((tc, idx) => (
              <div key={idx} className="bg-black/20 p-2 rounded border border-white/5">
                <div className="flex items-center gap-2 text-[10px] font-bold text-blue font-mono mb-1">
                  <Terminal size={10} />
                  {tc.function?.name || 'tool_call'}
                </div>
                <pre className="text-[10px] text-muted overflow-x-auto">
                  {tc.function?.arguments}
                </pre>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
