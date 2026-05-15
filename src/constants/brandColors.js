/**
 * Brand Colors — Single source of truth for Hermes brand identity.
 * 
 * Import these constants instead of hard-coding hex values.
 * CSS variables are also available: var(--hermes-green), etc.
 * 
 * Usage:
 *   import { BRAND } from '../constants/brandColors'
 *   <circle fill={BRAND.green} />
 */

export const BRAND = {
  green:       '#00b478',
  greenLight:  '#00d490',
  greenGlow:   'rgba(0, 180, 120, 0.4)',

  blue:        '#4a80c8',
  blueLight:   '#6ba3e0',
  blueGlow:    'rgba(74, 128, 200, 0.4)',

  amber:       '#e09040',
  amberLight:  '#ffb060',
  amberGlow:   'rgba(224, 144, 64, 0.4)',

  rust:        '#e05f40',
  rustLight:   '#ff8060',
  rustGlow:    'rgba(224, 95, 64, 0.5)',

  dark:        '#0d0f17',
  darkDeep:    '#0a0b10',
  surface:     '#1a1b26',
  surfaceAlt:  '#242636',
}

/**
 * State → color mapping for HermesCharacter and related components.
 * Mirrors the COLORS object previously defined inline in HermesCharacter.jsx.
 */
export const STATE_COLORS = {
  default:  { primary: BRAND.green,      secondary: BRAND.greenLight,  glow: BRAND.greenGlow },
  thinking: { primary: BRAND.blue,       secondary: BRAND.blueLight,   glow: BRAND.blueGlow },
  active:   { primary: BRAND.green,      secondary: '#00ff9d',         glow: 'rgba(0, 255, 157, 0.5)' },
  idle:     { primary: '#3a5c50',        secondary: '#4a7c60',         glow: 'rgba(58, 92, 80, 0.3)' },
  success:  { primary: BRAND.green,      secondary: '#00ff9d',         glow: 'rgba(0, 255, 157, 0.5)' },
  warning:  { primary: BRAND.amber,      secondary: BRAND.amberLight,  glow: BRAND.amberGlow },
  error:    { primary: BRAND.rust,       secondary: BRAND.rustLight,   glow: BRAND.rustGlow },
  offline:  { primary: '#2a2b38',        secondary: '#3a3b48',         glow: 'rgba(42, 43, 56, 0.2)' },
}

export default BRAND
