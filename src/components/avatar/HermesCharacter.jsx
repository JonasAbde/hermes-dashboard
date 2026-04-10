/**
 * HermesCharacter — Living AI Avatar with CSS-driven SVG animations
 * 
 * A true character with eyes, expression, and state-based animations.
 * Replaces the geometric sigil with a personality-driven mascot.
 * 
 * States:
 *   - idle:     Calm breathing, occasional blink
 *   - thinking: Eyes look up, "thought bubbles", processing indicator  
 *   - active:   Energetic, focused, execution mode
 *   - success:  Celebratory pose, satisfied expression
 *   - warning:  Alert, cautious
 *   - error:    Distressed, error state
 *   - offline:  "Asleep", dimmed
 */

import React, { useEffect, useState } from 'react'
import { clsx } from 'clsx'

// ─── Constants ───────────────────────────────────────────────────────────────

const SIZE_MAP = {
  micro:  16,
  small:  32,
  medium: 64,
  large:  128,
  xl:     256,
}

const COLORS = {
  default:  { primary: '#00b478', secondary: '#00d490', glow: 'rgba(0, 180, 120, 0.4)' },
  thinking: { primary: '#4a80c8', secondary: '#6ba3e0', glow: 'rgba(74, 128, 200, 0.4)' },
  active:   { primary: '#00b478', secondary: '#00ff9d', glow: 'rgba(0, 255, 157, 0.5)' },
  idle:     { primary: '#3a5c50', secondary: '#4a7c60', glow: 'rgba(58, 92, 80, 0.3)' },
  success:  { primary: '#00b478', secondary: '#00ff9d', glow: 'rgba(0, 255, 157, 0.5)' },
  warning:  { primary: '#e09040', secondary: '#ffb060', glow: 'rgba(224, 144, 64, 0.4)' },
  error:    { primary: '#e05f40', secondary: '#ff8060', glow: 'rgba(224, 95, 64, 0.5)' },
  offline:  { primary: '#2a2b38', secondary: '#3a3b48', glow: 'rgba(42, 43, 56, 0.2)' },
}

// ─── Character SVG Component ─────────────────────────────────────────────────

function CharacterFace({ variant, size, blink }) {
  const colors = COLORS[variant] ?? COLORS.default
  const isThinking = variant === 'thinking'
  const isActive = variant === 'active'
  const isError = variant === 'error'
  const isSuccess = variant === 'success'
  const isOffline = variant === 'offline'
  const isIdle = variant === 'idle'
  
  // Eye positions based on state
  const eyeY = isThinking ? 38 : 42  // Look up when thinking
  const eyeScale = isActive ? 1.1 : 1  // Wider eyes when active
  const eyeOpacity = blink ? 0.1 : 1
  
  // Mouth expression
  const mouthD = isError 
    ? 'M 35 58 Q 50 48 65 58'  // Frown
    : isSuccess 
    ? 'M 32 52 Q 50 68 68 52'  // Big smile
    : isThinking
    ? 'M 42 58 Q 50 62 58 58'  // Small o-shape
    : isActive
    ? 'M 35 55 Q 50 60 65 55'  // Focused line
    : 'M 38 58 Q 50 64 62 58'  // Neutral gentle smile

  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className="hermes-character-face"
      style={{ display: 'block' }}
    >
      <defs>
        {/* Face gradient */}
        <radialGradient id={`faceGrad-${variant}`} cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor={colors.secondary} stopOpacity="0.15" />
          <stop offset="50%" stopColor={colors.primary} stopOpacity="0.08" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
        
        {/* Glow filter */}
        <filter id={`glow-${variant}`}>
          <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
        
        {/* Eye gradient */}
        <radialGradient id={`eyeGrad-${variant}`} cx="50%" cy="30%" r="50%">
          <stop offset="0%" stopColor={colors.secondary} />
          <stop offset="100%" stopColor={colors.primary} />
        </radialGradient>
      </defs>
      
      {/* Background face circle */}
      <circle 
        cx="50" 
        cy="50" 
        r="45" 
        fill={`url(#faceGrad-${variant})`}
        stroke={colors.primary}
        strokeWidth="1.5"
        strokeOpacity="0.4"
        style={{
          filter: isActive || isThinking ? `url(#glow-${variant})` : 'none',
        }}
      />
      
      {/* Inner ring (tech aesthetic) */}
      <circle 
        cx="50" 
        cy="50" 
        r="38" 
        fill="none"
        stroke={colors.primary}
        strokeWidth="0.5"
        strokeOpacity="0.2"
        strokeDasharray="4 6"
        className={isActive ? 'hermes-character-spin' : ''}
      />
      
      {/* Eyes container */}
      <g 
        style={{
          transformOrigin: 'center',
          transform: `scale(${eyeScale})`,
          transition: 'transform 0.3s ease',
        }}
      >
        {/* Left eye */}
        <ellipse 
          cx="35" 
          cy={eyeY} 
          rx="5" 
          ry={blink ? 0.5 : 6}
          fill={`url(#eyeGrad-${variant})`}
          style={{
            opacity: eyeOpacity,
            transition: 'ry 0.15s ease, opacity 0.1s ease',
          }}
        />
        {/* Left eye highlight */}
        {!blink && (
          <circle cx="37" cy={eyeY - 2} r="1.5" fill="white" opacity="0.6" />
        )}
        
        {/* Right eye */}
        <ellipse 
          cx="65" 
          cy={eyeY} 
          rx="5" 
          ry={blink ? 0.5 : 6}
          fill={`url(#eyeGrad-${variant})`}
          style={{
            opacity: eyeOpacity,
            transition: 'ry 0.15s ease, opacity 0.1s ease',
          }}
        />
        {/* Right eye highlight */}
        {!blink && (
          <circle cx="67" cy={eyeY - 2} r="1.5" fill="white" opacity="0.6" />
        )}
      </g>
      
      {/* Mouth */}
      <path
        d={mouthD}
        fill="none"
        stroke={colors.primary}
        strokeWidth="2"
        strokeLinecap="round"
        style={{
          filter: isError || isSuccess ? `url(#glow-${variant})` : 'none',
          transition: 'd 0.3s ease',
        }}
      />
      
      {/* Thinking indicator dots */}
      {isThinking && (
        <g className="hermes-thinking-indicator">
          <circle cx="25" cy="25" r="2" fill={colors.secondary} opacity="0.6">
            <animate attributeName="opacity" values="0.3;1;0.3" dur="1.2s" repeatCount="indefinite" begin="0s" />
            <animate attributeName="cy" values="25;22;25" dur="1.2s" repeatCount="indefinite" begin="0s" />
          </circle>
          <circle cx="20" cy="20" r="1.5" fill={colors.secondary} opacity="0.4">
            <animate attributeName="opacity" values="0.3;1;0.3" dur="1.2s" repeatCount="indefinite" begin="0.4s" />
            <animate attributeName="cy" values="20;17;20" dur="1.2s" repeatCount="indefinite" begin="0.4s" />
          </circle>
          <circle cx="15" cy="15" r="1" fill={colors.secondary} opacity="0.3">
            <animate attributeName="opacity" values="0.3;1;0.3" dur="1.2s" repeatCount="indefinite" begin="0.8s" />
            <animate attributeName="cy" values="15;12;15" dur="1.2s" repeatCount="indefinite" begin="0.8s" />
          </circle>
        </g>
      )}
      
      {/* Active mode "data stream" lines */}
      {isActive && (
        <g className="hermes-active-streams" opacity="0.4">
          <line x1="50" y1="5" x2="50" y2="15" stroke={colors.secondary} strokeWidth="1">
            <animate attributeName="y1" values="5;-5" dur="0.8s" repeatCount="indefinite" />
            <animate attributeName="y2" values="15;5" dur="0.8s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0;1;0" dur="0.8s" repeatCount="indefinite" />
          </line>
          <line x1="30" y1="8" x2="30" y2="18" stroke={colors.secondary} strokeWidth="0.5">
            <animate attributeName="y1" values="8;-2" dur="0.6s" repeatCount="indefinite" begin="0.2s" />
            <animate attributeName="y2" values="18;8" dur="0.6s" repeatCount="indefinite" begin="0.2s" />
            <animate attributeName="opacity" values="0;1;0" dur="0.6s" repeatCount="indefinite" begin="0.2s" />
          </line>
          <line x1="70" y1="8" x2="70" y2="18" stroke={colors.secondary} strokeWidth="0.5">
            <animate attributeName="y1" values="8;-2" dur="0.7s" repeatCount="indefinite" begin="0.4s" />
            <animate attributeName="y2" values="18;8" dur="0.7s" repeatCount="indefinite" begin="0.4s" />
            <animate attributeName="opacity" values="0;1;0" dur="0.7s" repeatCount="indefinite" begin="0.4s" />
          </line>
        </g>
      )}
      
      {/* Offline "sleep" indicator */}
      {isOffline && (
        <g opacity="0.5">
          <text x="50" y="35" textAnchor="middle" fill={colors.secondary} fontSize="8" fontFamily="monospace">
            z
          </text>
          <text x="58" y="28" textAnchor="middle" fill={colors.secondary} fontSize="6" fontFamily="monospace">
            z
          </text>
        </g>
      )}
    </svg>
  )
}

// ─── Pulse Ring Component ────────────────────────────────────────────────────

function PulseRing({ variant, size }) {
  if (variant === 'idle' || variant === 'offline') return null
  
  const colors = COLORS[variant] ?? COLORS.default
  const ringSize = size * 1.4
  
  return (
    <div
      className="hermes-character-pulse-ring"
      style={{
        width: ringSize,
        height: ringSize,
        borderRadius: '50%',
        border: `2px solid ${colors.glow}`,
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        animation: `hermes-character-pulse-${variant} 2s ease-in-out infinite`,
        pointerEvents: 'none',
      }}
    />
  )
}

// ─── Status Dot Component ────────────────────────────────────────────────────

function StatusDot({ variant, size }) {
  const colors = COLORS[variant] ?? COLORS.default
  const dotSize = Math.max(6, size * 0.15)
  const label = {
    default: 'Online', thinking: 'Tænker', active: 'Aktiv',
    idle: 'Ledig', success: 'Succes', warning: 'Advarsel',
    offline: 'Offline', error: 'Fejl',
  }[variant] ?? variant

  return (
    <div
      className="hermes-character-status-dot"
      title={label}
      style={{
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: dotSize,
        height: dotSize,
        minWidth: 6,
        minHeight: 6,
        borderRadius: '50%',
        background: colors.primary,
        boxShadow: `0 0 8px ${colors.glow}`,
        border: `2px solid #0d0f17`,
        zIndex: 10,
      }}
    />
  )
}

// ─── Main HermesCharacter Component ──────────────────────────────────────────

/**
 * @param {object} props
 * @param {'default'|'thinking'|'active'|'idle'|'success'|'warning'|'offline'|'error'} [props.variant='default']
 * @param {'micro'|'small'|'medium'|'large'|'xl'|number} [props.size='medium']
 * @param {boolean} [props.pulse=false]     — show animated pulse ring
 * @param {boolean} [props.statusDot=false] — show colored status indicator dot
 * @param {boolean} [props.blink=true]      — enable blinking animation (idle only)
 * @param {string}  [props.className]
 */
export function HermesCharacter({
  variant = 'default',
  size = 'medium',
  pulse = false,
  statusDot = false,
  blink = true,
  className,
}) {
  const numericSize = typeof size === 'number' ? size : (SIZE_MAP[size] ?? 64)
  const containerSize = pulse ? numericSize * 1.5 : numericSize
  
  // Blink state management
  const [isBlinking, setIsBlinking] = useState(false)
  
  useEffect(() => {
    if (!blink || variant !== 'idle') {
      setIsBlinking(false)
      return
    }
    
    // Random blinking interval
    const scheduleBlink = () => {
      const delay = 2000 + Math.random() * 4000 // 2-6 seconds
      return setTimeout(() => {
        setIsBlinking(true)
        setTimeout(() => setIsBlinking(false), 150) // Blink duration
        scheduleBlink()
      }, delay)
    }
    
    const timer = scheduleBlink()
    return () => clearTimeout(timer)
  }, [blink, variant])

  return (
    <div
      className={clsx(
        'hermes-character relative inline-flex items-center justify-center',
        `hermes-character--${variant}`,
        className
      )}
      style={{ 
        width: containerSize, 
        height: containerSize,
        animation: variant === 'idle' ? 'hermes-character-breathe 4s ease-in-out infinite' : 'none',
      }}
    >
      {/* Pulse ring */}
      {pulse && <PulseRing variant={variant} size={numericSize} />}
      
      {/* Character face */}
      <div 
        className="hermes-character-face-wrapper relative z-10"
        style={{
          animation: variant === 'active' ? 'hermes-character-energize 0.5s ease-in-out infinite alternate' : 'none',
        }}
      >
        <CharacterFace 
          variant={variant} 
          size={numericSize} 
          blink={isBlinking}
        />
      </div>
      
      {/* Status dot */}
      {statusDot && <StatusDot variant={variant} size={numericSize} />}
    </div>
  )
}

// ─── Convenience Presets ─────────────────────────────────────────────────────

export function HermesCharacterCompact({ variant = 'default', className }) {
  return <HermesCharacter variant={variant} size="small" statusDot pulse={variant === 'active'} className={className} />
}

export function HermesCharacterMedium({ variant = 'default', className }) {
  return <HermesCharacter variant={variant} size="medium" statusDot className={className} />
}

export function HermesCharacterLarge({ variant = 'active', className }) {
  return <HermesCharacter variant={variant} size="large" pulse statusDot className={className} />
}

export function HermesMascot({ variant = 'default', className }) {
  return <HermesCharacter variant={variant} size="xl" pulse statusDot className={className} />
}

// ─── Avatar Stack (compatible with old API) ──────────────────────────────────

export function HermesCharacterStack({ avatars = [], max = 4, size = 24, className }) {
  const shown = avatars.slice(0, max)
  const extra = avatars.length - max

  return (
    <div className={clsx('flex items-center', className)}>
      {shown.map((a, i) => (
        <div
          key={i}
          className="relative ring-2 ring-[#0d0f17] rounded-full"
          style={{ marginLeft: i === 0 ? 0 : -(size * 0.35), zIndex: shown.length - i }}
        >
          <HermesCharacter variant={a.variant} size={size} />
        </div>
      ))}
      {extra > 0 && (
        <div
          className="relative ring-2 ring-[#0d0f17] rounded-full flex items-center justify-center text-[9px] font-bold text-t3 bg-surface border border-border"
          style={{ marginLeft: -(size * 0.35), width: size, height: size, zIndex: 0 }}
        >
          +{extra}
        </div>
      )}
    </div>
  )
}

// ─── Status Badge ────────────────────────────────────────────────────────────

export function HermesCharacterStatusBadge({ variant = 'default', label, className }) {
  const variantColors = {
    default:  'text-green bg-green/10 border-green/20',
    thinking: 'text-blue bg-blue/10 border-blue/20',
    active:   'text-green bg-green/10 border-green/20',
    idle:     'text-t3 bg-surface2 border-border',
    success:  'text-green bg-green/10 border-green/20',
    warning:  'text-amber bg-amber/10 border-amber/20',
    offline:  'text-t3 bg-surface2 border-border',
    error:    'text-rust bg-rust/10 border-rust/20',
  }
  const colorClass = variantColors[variant] ?? variantColors.default

  return (
    <div className={clsx(
      'inline-flex items-center gap-1.5 px-2 py-1 rounded-full border text-[10px] font-semibold uppercase tracking-wide',
      colorClass,
      className,
    )}>
      <HermesCharacter variant={variant} size={12} blink={false} />
      {label ?? variant}
    </div>
  )
}

// ─── Utility mappings (compatible with old API) ──────────────────────────────

export function rhythmToVariant(rhythm) {
  const map = {
    hibernation: 'idle',
    steady:      'default',
    deep_focus:  'thinking',
    high_burst:  'active',
  }
  return map[rhythm] ?? 'default'
}

export function platformStatusToVariant(status) {
  const map = {
    live_active:  'active',
    connected:     'default',
    running:       'active',
    stopped:       'idle',
    offline:       'offline',
    error:         'error',
    warning:       'warning',
    success:       'success',
  }
  return map[status] ?? 'default'
}

export default HermesCharacter
