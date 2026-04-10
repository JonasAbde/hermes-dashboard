// Hermes Avatar System — Living Mascot + Sigil Static Assets

// Living mascot — animated character with expressions
export { default as HermesCharacter } from './HermesCharacter'
export { HermesCharacterCompact, HermesCharacterMedium, HermesCharacterLarge, HermesMascot } from './HermesCharacter'
export { HermesCharacterStatusBadge, HermesCharacterStack } from './HermesCharacter'

// Status mapping utilities
export { rhythmToVariant, platformStatusToVariant } from './HermesCharacter'

// Static sigil assets — only for favicon, app icons, OG images
export { sigilDefault, sigilThinking, sigilActive, sigilIdle, sigilSuccess, sigilWarning, sigilOffline, sigilError } from './sigilAssets'