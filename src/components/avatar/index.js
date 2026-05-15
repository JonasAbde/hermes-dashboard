// Hermes Avatar System — The Living Sigil

// Primary mascot exports
export { default as HermesCharacter } from './HermesCharacter'
export { HermesSigilMark, HermesCharacterCompact, HermesCharacterMedium, HermesCharacterLarge, HermesMascot } from './HermesCharacter'
export { HermesCharacterStatusBadge, HermesCharacterStack } from './HermesCharacter'

// Status mapping utilities
export { rhythmToVariant, platformStatusToVariant } from './HermesCharacter'

// Agent avatar wrapper (uses HermesCharacter as fallback)
export { default as AgentAvatar } from './AgentAvatar'
