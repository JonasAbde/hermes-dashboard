// Hermes Avatar System — Living Mascot + Sigil Static Assets

// Living mascot — animated character with expressions
export { default as HermesCharacter } from './HermesCharacter'
export { HermesCharacterCompact, HermesCharacterMedium, HermesCharacterLarge, HermesMascot } from './HermesCharacter'
export { HermesCharacterStatusBadge, HermesCharacterStack } from './HermesCharacter'

// Status mapping utilities
export { rhythmToVariant, platformStatusToVariant } from './HermesCharacter'

// Static sigil assets — only for favicon, app icons, OG images
export { sigilDefault } from './sigilAssets-default.js'
export { sigilThinking } from './sigilAssets-thinking.js'
export { sigilActive } from './sigilAssets-active.js'
export { sigilIdle } from './sigilAssets-idle.js'
export { sigilSuccess } from './sigilAssets-success.js'
export { sigilWarning } from './sigilAssets-warning.js'
export { sigilOffline } from './sigilAssets-offline.js'
export { sigilError } from './sigilAssets-error.js'