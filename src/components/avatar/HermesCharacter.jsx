/**
 * HermesCharacter — The Living Sigil
 *
 * A stateful, sigil-based mascot that keeps the existing Hermes avatar API
 * while aligning the UI with the platform's core identity.
 */

import React, { useEffect, useId, useState } from 'react'
import { clsx } from 'clsx'
import { BRAND, STATE_COLORS } from '../../constants/brandColors'

// ─── Constants ───────────────────────────────────────────────────────────────

const SIZE_MAP = {
  micro:  16,
  small:  32,
  medium: 64,
  large:  128,
  xl:     256,
}

const COLORS = STATE_COLORS
const VARIANT_LABELS = {
  default: 'Online',
  thinking: 'Tænker',
  active: 'Aktiv',
  idle: 'Ledig',
  success: 'Succes',
  warning: 'Advarsel',
  offline: 'Offline',
  error: 'Fejl',
}

function sanitizeId(value) {
  return String(value).replace(/[^a-zA-Z0-9_-]/g, '')
}

function SignalBadge({ variant, colors }) {
  if (variant === 'success') {
    return (
      <g transform="translate(72 18)">
        <circle r="9" fill={BRAND.dark} stroke={colors.secondary} strokeWidth="1.5" />
        <path d="M-4 0.5 L-1 3.5 L4 -3" fill="none" stroke={colors.secondary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    )
  }

  if (variant === 'warning') {
    return (
      <g transform="translate(72 18)">
        <circle r="9" fill={BRAND.dark} stroke={colors.secondary} strokeWidth="1.5" />
        <path d="M0 -4 L4 3 H-4 Z" fill={colors.secondary} opacity="0.95" />
      </g>
    )
  }

  if (variant === 'error') {
    return (
      <g transform="translate(72 18)">
        <circle r="9" fill={BRAND.dark} stroke={colors.secondary} strokeWidth="1.5" />
        <path d="M-3.5 -3.5 L3.5 3.5 M3.5 -3.5 L-3.5 3.5" fill="none" stroke={colors.secondary} strokeWidth="2" strokeLinecap="round" />
      </g>
    )
  }

  return null
}

function LivingSigil({ variant, size, blink, pulse, uid }) {
  const colors = COLORS[variant] ?? COLORS.default
  const gradientId = `${uid}-frame-gradient`
  const coreId = `${uid}-core-gradient`
  const auraId = `${uid}-aura-gradient`
  const glowId = `${uid}-glow`

  const isThinking = variant === 'thinking'
  const isActive = variant === 'active'
  const isSuccess = variant === 'success'
  const isWarning = variant === 'warning'
  const isError = variant === 'error'
  const isOffline = variant === 'offline'
  const wantsPulse = pulse || isThinking || isActive || isSuccess || isWarning || isError
  const haloStroke = isOffline ? colors.primary : colors.secondary
  const coreOpacity = blink && (variant === 'idle' || variant === 'default') ? 0.35 : 1
  const streamColor = isOffline ? colors.primary : colors.secondary

  return (
    <svg viewBox="0 0 100 100" width={size} height={size} style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <linearGradient id={gradientId} x1="18%" y1="16%" x2="82%" y2="84%">
          <stop offset="0%" stopColor={isOffline ? colors.primary : BRAND.rust} />
          <stop offset="50%" stopColor={colors.secondary} />
          <stop offset="100%" stopColor={colors.primary} />
        </linearGradient>
        <radialGradient id={coreId} cx="50%" cy="50%" r="55%">
          <stop offset="0%" stopColor={colors.secondary} stopOpacity="1" />
          <stop offset="60%" stopColor={colors.primary} stopOpacity="0.95" />
          <stop offset="100%" stopColor={colors.primary} stopOpacity="0.15" />
        </radialGradient>
        <radialGradient id={auraId} cx="50%" cy="50%" r="65%">
          <stop offset="0%" stopColor={colors.secondary} stopOpacity={isOffline ? '0.08' : '0.28'} />
          <stop offset="70%" stopColor={colors.primary} stopOpacity={isOffline ? '0.03' : '0.12'} />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
        <filter id={glowId} x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation={isActive ? '3.5' : isThinking ? '3' : '2.2'} result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {wantsPulse && (
        <g opacity={isError ? 0.8 : 0.65} filter={`url(#${glowId})`}>
          <circle cx="50" cy="50" r="27" fill="none" stroke={haloStroke} strokeWidth="1.4" opacity="0.45">
            <animate attributeName="r" values="24;31;24" dur={isActive ? '1.3s' : isError ? '1.1s' : '1.9s'} repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.12;0.45;0.12" dur={isActive ? '1.3s' : isError ? '1.1s' : '1.9s'} repeatCount="indefinite" />
          </circle>
          <circle cx="50" cy="50" r="35" fill="none" stroke={colors.primary} strokeWidth="1" opacity="0.22">
            <animate attributeName="r" values="31;40;31" dur={isActive ? '1.8s' : '2.4s'} repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.05;0.22;0.05" dur={isActive ? '1.8s' : '2.4s'} repeatCount="indefinite" />
          </circle>
        </g>
      )}

      <circle cx="50" cy="50" r="30" fill={`url(#${auraId})`} opacity={isOffline ? 0.6 : 1} />
      <path
        d="M50 10 L82 50 L50 90 L18 50 Z"
        fill={BRAND.darkDeep}
        fillOpacity="0.88"
        stroke={colors.primary}
        strokeOpacity="0.18"
        strokeWidth="1.2"
      />

      <g filter={`url(#${glowId})`} opacity={isOffline ? 0.65 : 1}>
        <path
          d="M50 10 L82 50 L50 90 L18 50 Z"
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth="2.8"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <path
          d="M50 22 L70 50 L50 78 L30 50 Z"
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth="1.2"
          strokeLinejoin="round"
          strokeLinecap="round"
          opacity="0.5"
        />
        <path
          d="M50 14 L50 86 M24 50 H76"
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth="2.2"
          strokeLinecap="round"
          opacity={isOffline ? 0.5 : 0.9}
        />
        <path
          d="M36 24 L50 24 L64 24 M36 76 L50 76 L64 76"
          fill="none"
          stroke={colors.primary}
          strokeWidth="1"
          strokeLinecap="round"
          opacity="0.22"
        />
        <circle cx="50" cy="50" r="7.5" fill={`url(#${coreId})`} opacity={coreOpacity}>
          <animate attributeName="r" values={isActive ? '7;8.3;7' : isThinking ? '7.2;7.8;7.2' : isError ? '7.4;6.6;7.4' : '7;7.4;7'} dur={isActive ? '1s' : isThinking ? '1.4s' : isError ? '0.9s' : '2.8s'} repeatCount="indefinite" />
          <animate attributeName="opacity" values={isOffline ? '0.18;0.24;0.18' : '0.85;1;0.85'} dur={isActive ? '1s' : isThinking ? '1.4s' : isError ? '0.9s' : '2.8s'} repeatCount="indefinite" />
        </circle>
        <circle cx="50" cy="50" r="2.3" fill={BRAND.darkDeep} opacity={isOffline ? 0.65 : 0.85} />

        {[
          ['50', '10'],
          ['82', '50'],
          ['50', '90'],
          ['18', '50'],
        ].map(([cx, cy]) => (
          <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="3.2" fill={colors.primary} opacity={isOffline ? 0.75 : 1} />
        ))}
      </g>

      {(isThinking || isActive) && (
        <g opacity="0.9">
          <line x1="50" y1="4" x2="50" y2="14" stroke={streamColor} strokeWidth="1.1" strokeLinecap="round">
            <animate attributeName="y1" values="4;-2;4" dur="0.9s" repeatCount="indefinite" />
            <animate attributeName="y2" values="14;8;14" dur="0.9s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0;0.9;0" dur="0.9s" repeatCount="indefinite" />
          </line>
          <line x1="50" y1="96" x2="50" y2="86" stroke={streamColor} strokeWidth="1.1" strokeLinecap="round">
            <animate attributeName="y1" values="96;102;96" dur="1.05s" repeatCount="indefinite" />
            <animate attributeName="y2" values="86;92;86" dur="1.05s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0;0.8;0" dur="1.05s" repeatCount="indefinite" />
          </line>
        </g>
      )}

      {isThinking && (
        <g opacity="0.88">
          {[0, 1, 2].map((index) => (
            <circle key={index} cx={66 + index * 6} cy={24 - index * 5} r={2.4 - index * 0.4} fill={colors.secondary}>
              <animate attributeName="opacity" values="0.25;1;0.25" dur="1.4s" repeatCount="indefinite" begin={`${index * 0.22}s`} />
              <animate attributeName="cy" values={`${24 - index * 5};${20 - index * 5};${24 - index * 5}`} dur="1.4s" repeatCount="indefinite" begin={`${index * 0.22}s`} />
            </circle>
          ))}
        </g>
      )}

      {isOffline && (
        <g opacity="0.7">
          <line x1="28" y1="72" x2="72" y2="28" stroke={colors.secondary} strokeWidth="3" strokeLinecap="round" />
        </g>
      )}

      <SignalBadge variant={variant} colors={colors} />
    </svg>
  )
}

// ─── Status Dot Component ────────────────────────────────────────────────────

function StatusDot({ variant, size }) {
  const colors = COLORS[variant] ?? COLORS.default
  const dotSize = Math.max(6, size * 0.15)
  const label = VARIANT_LABELS[variant] ?? variant

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
  const rawId = useId()
  const uid = sanitizeId(rawId)

  const [isBlinking, setIsBlinking] = useState(false)

  useEffect(() => {
    if (!blink || (variant !== 'idle' && variant !== 'default')) {
      setIsBlinking(false)
      return
    }

    const scheduleBlink = () => {
      const delay = 2000 + Math.random() * 4000 // 2-6 seconds
      return setTimeout(() => {
        setIsBlinking(true)
        setTimeout(() => setIsBlinking(false), 140)
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
      }}
    >
      <div className="relative z-10">
        <LivingSigil
          variant={variant}
          size={numericSize}
          blink={isBlinking}
          pulse={pulse}
          uid={uid}
        />
      </div>

      {(variant === 'idle' || variant === 'default') && (
        <div
          className="pointer-events-none absolute inset-0 rounded-full"
          style={{
            background: `radial-gradient(circle, ${COLORS[variant]?.glow || BRAND.greenGlow} 0%, transparent 68%)`,
            opacity: isBlinking ? 0.14 : 0.28,
            filter: 'blur(8px)',
            transform: 'scale(0.88)',
            transition: 'opacity 140ms ease',
          }}
        />
      )}

      {statusDot && <StatusDot variant={variant} size={numericSize} />}
    </div>
  )
}

export function HermesSigilMark({
  variant = 'default',
  size = 'medium',
  pulse = false,
  blink = true,
  className,
}) {
  return (
    <HermesCharacter
      variant={variant}
      size={size}
      pulse={pulse}
      blink={blink}
      className={className}
    />
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
      <HermesSigilMark variant={variant} size={12} blink={false} />
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
