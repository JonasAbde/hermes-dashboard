// Auto-generated from assets/vectors/hermes-sigil-idle.svg
// Do not edit by hand — edit the source SVG and re-run: python3 generate.py
const SVG_IDLE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="Hermes — idle">
  <title>Hermes — Idle</title>
  <desc>Hermes AI agent sigil in idle / dormant state</desc>
  <defs>
    <filter id="glow-idle" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="2" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
    <g opacity="0.25" filter="url(#glow-idle)">
    <ellipse cx="32" cy="32" rx="16" ry="16" fill="none" stroke="#3a5c50" stroke-width="0.5" opacity="0.3"/>
  </g>
  <!-- Diamond frame outer -->
  <path d="M32 10 L50 32 L32 54 L14 32 Z"
        fill="none" stroke="#3a5c50" stroke-width="2.5" stroke-linejoin="round"/>
  <!-- Diamond inner detail -->
  <path d="M32 16 L44 32 L32 48 L20 32 Z"
        fill="none" stroke="#3a5c50" stroke-width="1" stroke-linejoin="round" opacity="0.35"/>
  <!-- Horizontal crossbar -->
  <line x1="17" y1="32" x2="47" y2="32" stroke="#3a5c50" stroke-width="2" stroke-linecap="round"/>
  <!-- Vertical line (upper) -->
  <line x1="32" y1="10" x2="32" y2="32" stroke="#3a5c50" stroke-width="2" stroke-linecap="round" opacity="0.7"/>
  <!-- Vertical line (lower) -->
  <line x1="32" y1="32" x2="32" y2="54" stroke="#3a5c50" stroke-width="2" stroke-linecap="round" opacity="0.7"/>
  <!-- Central dot — the mind -->
  <circle cx="32" cy="32" r="4.5" fill="#3a5c50"/>
  <!-- Corner terminals -->
  <circle cx="32" cy="10" r="2.5" fill="#2a4a40"/>
  <circle cx="50" cy="32" r="2.5" fill="#3a5c50"/>
  <circle cx="32" cy="54" r="2.5" fill="#3a5c50"/>
  <circle cx="14" cy="32" r="2.5" fill="#2a4a40"/>
</svg>`;
export { SVG_IDLE as sigilIdle };
