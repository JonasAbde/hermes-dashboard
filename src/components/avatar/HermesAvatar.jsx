/**
 * HermesAvatar — Geometric sigil avatar for the Hermes AI Agent
 *
 * Usage:
 *   <HermesAvatar variant="default" size={64} />
 *   <HermesAvatar variant="active" size={32} pulse />
 *
 * Variants: default | thinking | active | idle | success | warning | offline | error
 * Sizes:    micro(16) | small(32) | medium(64) | large(128) | xl(256)
 */

import React from 'react'
import { clsx } from 'clsx'
import {
  sigilDefault,
  sigilThinking,
  sigilActive,
  sigilIdle,
  sigilSuccess,
  sigilWarning,
  sigilOffline,
  sigilError,
} from './svgAssets'

// ─── Constants ───────────────────────────────────────────────────────────────

const VARIANT_SVG = {
  default: sigilDefault,
  thinking: sigilThinking,
  active:   sigilActive,
  idle:     sigilIdle,
  success:  sigilSuccess,
  warning:  sigilWarning,
  offline:  sigilOffline,
  error:    sigilError,
}

const SIZE_MAP = {
  micro:  16,
  small:  32,
  medium: 64,
  large:  128,
  xl:     256,
}

// ─── SVG Sprite Component ─────────────────────────────────────────────────────

function Sigil({ variant, size, className }) {
  const svg = VARIANT_SVG[variant] ?? VARIANT_SVG.default
  return (
    <div
      className={clsx('hermes-sigil flex-shrink-0 inline-block', className)}
      style={{ width: size, height: size }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}

// ─── Animated Pulse Wrapper ───────────────────────────────────────────────────

function PulseRing({ variant, size }) {
  if (variant === 'idle' || variant === 'offline') return null

  const ringColor = {
    default:  'rgba(0, 180, 120, 0.35)',
    thinking: 'rgba(74, 128, 200, 0.35)',
    active:   'rgba(0, 180, 120, 0.5)',
    success:  'rgba(0, 180, 120, 0.5)',
    warning:  'rgba(224, 144, 64, 0.4)',
    error:    'rgba(224, 95, 64, 0.45)',
  }[variant] ?? 'rgba(0, 180, 120, 0.3)'

  const ringSize = size * 1.45

  return (
    <div
      className="hermes-pulse-ring"
      style={{
        width: ringSize,
        height: ringSize,
        borderRadius: '50%',
        border: `1.5px solid ${ringColor}`,
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        animation: `hermes-pulse-${variant} 2s ease-in-out infinite`,
        pointerEvents: 'none',
      }}
    />
  )
}

// ─── Status Badge Dot ─────────────────────────────────────────────────────────

function StatusDot({ variant }) {
  const colors = {
    default:  '#00b478',
    thinking: '#4a80c8',
    active:   '#00b478',
    idle:     '#3a5c50',
    success:  '#00b478',
    warning:  '#e09040',
    offline:  '#2a2b38',
    error:    '#e05f40',
  }
  const color = colors[variant] ?? '#00b478'
  const label = {
    default: 'Online', thinking: 'Tænker', active: 'Aktiv',
    idle: 'Ledig', success: 'Succes', warning: 'Advarsel',
    offline: 'Offline', error: 'Fejl',
  }[variant] ?? variant

  return (
    <div
      className="hermes-status-dot"
      title={label}
      style={{
        position: 'absolute',
        bottom: 1,
        right: 1,
        width: Math.max(5, (SIZE_MAP[variant] ?? 32) * 0.12),
        height: Math.max(5, (SIZE_MAP[variant] ?? 32) * 0.12),
        minWidth: 5,
        minHeight: 5,
        borderRadius: '50%',
        background: color,
        boxShadow: `0 0 6px ${color}`,
        border: '1.5px solid #0d0f17',
      }}
    />
  )
}

// ─── Main HermesAvatar Component ───────────────────────────────────────────────

/**
 * @param {object} props
 * @param {'default'|'thinking'|'active'|'idle'|'success'|'warning'|'offline'|'error'} [props.variant='default']
 * @param {'micro'|'small'|'medium'|'large'|'xl'|number} [props.size='medium']
 * @param {boolean} [props.pulse=false]     — show animated pulse ring
 * @param {boolean} [props.statusDot=false] — show colored status indicator dot
 * @param {string}  [props.className]
 */
export function HermesAvatar({
  variant = 'default',
  size = 'medium',
  pulse = false,
  statusDot = false,
  className,
}) {
  const numericSize = typeof size === 'number' ? size : (SIZE_MAP[size] ?? 64)
  const containerSize = pulse ? numericSize * 1.6 : numericSize

  return (
    <div
      className={clsx('hermes-avatar relative inline-flex items-center justify-center', className)}
      style={{ width: containerSize, height: containerSize }}
    >
      {/* Animated pulse ring */}
      {pulse && <PulseRing variant={variant} size={numericSize} />}

      {/* The sigil */}
      <Sigil
        variant={variant}
        size={numericSize}
        className="relative z-10"
      />

      {/* Status indicator dot */}
      {statusDot && <StatusDot variant={variant} />}
    </div>
  )
}

// ─── Convenience presets ──────────────────────────────────────────────────────

/** Compact avatar with status dot — for sidebar, nav, chips */
export function HermesAvatarCompact({ variant = 'default', className }) {
  return <HermesAvatar variant={variant} size="small" statusDot pulse={variant === 'active'} className={className} />
}

/** Medium avatar — for profile, chat header, cards */
export function HermesAvatarMedium({ variant = 'default', className }) {
  return <HermesAvatar variant={variant} size="medium" statusDot className={className} />
}

/** Large avatar — for onboarding hero, welcome screen */
export function HermesAvatarLarge({ variant = 'active', className }) {
  return <HermesAvatar variant={variant} size="large" pulse statusDot className={className} />
}

/** Full mascot display — for brand pages, about screen */
export function HermesMascot({ variant = 'default', className }) {
  return <HermesAvatar variant={variant} size="xl" pulse statusDot className={className} />
}

// ─── Avatar Stack (multiple avatars with overlap) ─────────────────────────────

/**
 * Renders a row/column of HermesAvatars with overlap for team/group display.
 * @param {object[]} props.avatars  — array of { variant, label? }
 */
export function HermesAvatarStack({ avatars = [], max = 4, size = 24, className }) {
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
          <HermesAvatar variant={a.variant} size={size} />
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

// ─── Animated Status Badge ───────────────────────────────────────────────────

export function HermesStatusBadge({ variant = 'default', label, className }) {
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
      <HermesAvatar variant={variant} size={12} />
      {label ?? variant}
    </div>
  )
}

// ─── Variant-to-status mapping helpers ──────────────────────────────────────

/** Map agent rhythm (from NeuralShift) to avatar variant */
export function rhythmToVariant(rhythm) {
  const map = {
    hibernation: 'idle',
    steady:      'default',
    deep_focus:  'thinking',
    high_burst:  'active',
  }
  return map[rhythm] ?? 'default'
}

/** Map platform/MCP status to avatar variant */
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

export default HermesAvatar
