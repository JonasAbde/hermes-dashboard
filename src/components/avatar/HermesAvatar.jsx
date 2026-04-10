import React from 'react'
import HermesCharacter, { rhythmToVariant, platformStatusToVariant } from './HermesCharacter'

function legacyStatusToVariant(status) {
  const map = {
    Ledig: 'idle',
    Tænker: 'thinking',
    Aktiv: 'active',
    Offline: 'offline',
    Fejl: 'error',
    'Online (forældet)': 'default',
  }
  return map[status] ?? null
}

export function HermesAvatar({ user, status, variant, size = 48, pulse = true, statusDot = true, ...props }) {
  const resolvedVariant =
    variant ??
    legacyStatusToVariant(status) ??
    (typeof status === 'string' ? platformStatusToVariant(status) : 'default')

  const ariaLabel = user?.name ? `Avatar for ${user.name}` : 'Hermes avatar'

  return (
    <HermesCharacter
      variant={resolvedVariant}
      size={size}
      pulse={pulse}
      statusDot={statusDot}
      aria-label={ariaLabel}
      {...props}
    />
  )
}

export { rhythmToVariant, platformStatusToVariant }

export default HermesAvatar
