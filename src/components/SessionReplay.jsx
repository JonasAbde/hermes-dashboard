import { useState, useEffect, useRef } from 'react'
import { Play, Pause, RotateCcw, User, Cpu, PenTool, Hash, Info } from 'lucide-react'
import { clsx } from 'clsx'

const ROLE_ICONS = {
  user: User,
  assistant: Cpu,
  tool: PenTool,
  system: Hash,
  info: Info
}

const ROLE_COLORS = {
  user: 'text-rust',
  assistant: 'text-green',
  tool: 'text-blue',
  system: 'text-t3',
  info: 'text-amber'
}

export function SessionReplay({ messages, loading }) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [speed, setSpeed] = useState(1)
  const listRef = useRef(null)

  // Auto-scroll when new messages appear in replay
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [currentIndex])

  // Playback logic
  useEffect(() => {
    let timer;
    if (isPlaying && messages && currentIndex < messages.length - 1) {
      // Calculate delay based on next message timestamp (if any)
      const currentMsg = messages[currentIndex]
      const nextMsg = messages[currentIndex + 1]
      
      let delayMs = 1000 // default 1s
      if (currentMsg?.timestamp && nextMsg?.timestamp) {
        // Real delay, capped between 0.5s and 5s
        const rawDelay = (nextMsg.timestamp - currentMsg.timestamp) * 1000
        delayMs = Math.max(500, Math.min(rawDelay, 5000))
      }
      
      timer = setTimeout(() => {
        setCurrentIndex(prev => prev + 1)
      }, delayMs / speed)
    } else if (currentIndex >= (messages?.length ?? 0) - 1) {
      setIsPlaying(false)
    }
    
    return () => clearTimeout(timer)
  }, [isPlaying, currentIndex, messages, speed])

  const handlePlayPause = () => {
    if (currentIndex >= (messages?.length ?? 0) - 1) {
      setCurrentIndex(0)
    }
    setIsPlaying(!isPlaying)
  }

  const handleReset = () => {
    setIsPlaying(false)
    setCurrentIndex(0)
  }

  const handleScrub = (e) => {
    const val = parseInt(e.target.value, 10)
    setCurrentIndex(val)
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-8 gap-3">
        <div className="text-sm text-t3 animate-pulse">Indlæser transskript...</div>
      </div>
    )
  }

  if (!messages || messages.length === 0) {
    return (
      <div className="py-8 text-center bg-surface2/30 rounded-lg border border-border">
        <p className="text-sm text-t3">Ingen beskeder at vise for denne session.</p>
      </div>
    )
  }

  const displayedMessages = messages.slice(Math.max(0, currentIndex - 19), currentIndex + 1)
  const progressPct = ((currentIndex + 1) / messages.length) * 100

  return (
    <div className="flex flex-col bg-surface border border-border rounded-lg overflow-hidden h-full max-h-[600px]">
      
      {/* Transcript Window */}
      <div 
        ref={listRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth"
      >
        {displayedMessages.map((msg, i) => {
          const Icon = ROLE_ICONS[msg.role] || Info
          const colorClass = ROLE_COLORS[msg.role] || ROLE_COLORS.info
          
          return (
            <div 
              key={i} 
              className={clsx(
                "flex gap-3 text-sm animate-in fade-in slide-in-from-bottom-2 duration-300",
                msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'
              )}
            >
              <div className={clsx(
                "w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 bg-surface2 border border-border",
                colorClass
              )}>
                <Icon size={12} />
              </div>
              <div className={clsx(
                "px-4 py-2.5 rounded-lg max-w-[85%] whitespace-pre-wrap break-words text-[13px] leading-relaxed border",
                msg.role === 'user' 
                  ? 'bg-rust/5 border-rust/20 text-t1' 
                  : msg.role === 'assistant'
                    ? 'bg-green/5 border-green/20 text-t1'
                    : 'bg-surface2 border-border text-t2 font-mono text-[11px]'
              )}>
                {msg.tool_name && (
                  <div className="text-[10px] uppercase font-bold tracking-widest text-blue mb-1">
                    Tool: {msg.tool_name}
                  </div>
                )}
                {msg.content}
              </div>
            </div>
          )
        })}
      </div>

      {/* Control Bar */}
      <div className="bg-surface2/80 border-t border-border p-3 backdrop-blur-md">
        <div className="flex items-center gap-4 mb-2">
          {/* Controls */}
          <div className="flex items-center gap-1">
            <button 
              onClick={handlePlayPause}
              className="w-8 h-8 rounded-full bg-rust hover:bg-rust/80 text-white flex items-center justify-center transition-all shadow-[0_0_10px_rgba(224,95,64,0.3)]"
            >
              {isPlaying ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" className="ml-0.5" />}
            </button>
            <button 
              onClick={handleReset}
              className="w-8 h-8 rounded-full text-t3 hover:bg-surface hover:text-t2 flex items-center justify-center transition-colors"
              title="Reset replay"
            >
              <RotateCcw size={14} />
            </button>
          </div>

          {/* Scrubber */}
          <div className="flex-1 flex items-center gap-3">
            <span className="font-mono text-[10px] text-t3 w-10 text-right">
              {currentIndex + 1}
            </span>
            <div className="relative flex-1 group h-4 flex items-center">
              <div className="absolute inset-x-0 h-1 rounded-full bg-border" />
              <div 
                className="absolute left-0 h-1 rounded-full bg-rust/50 transition-all duration-200" 
                style={{ width: `${progressPct}%` }} 
              />
              <input
                type="range"
                min="0"
                max={messages.length - 1}
                value={currentIndex}
                onChange={handleScrub}
                className="absolute inset-0 w-full opacity-0 cursor-pointer"
              />
              <div 
                className="absolute h-3 w-3 rounded-full bg-rust shadow-[0_0_8px_rgba(224,95,64,0.8)] transition-all duration-100 pointer-events-none"
                style={{ left: `calc(${progressPct}% - 6px)` }}
              />
            </div>
            <span className="font-mono text-[10px] text-t3 w-10">
              {messages.length}
            </span>
          </div>

          {/* Speed settings */}
          <div className="flex items-center gap-1 bg-surface border border-border rounded flex-shrink-0">
            {[1, 2, 5].map(s => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                className={clsx(
                  "px-2 py-1 text-[10px] font-mono transition-colors rounded-sm",
                  speed === s ? "bg-blue/20 text-blue font-bold" : "text-t3 hover:text-t1 hover:bg-surface2"
                )}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
