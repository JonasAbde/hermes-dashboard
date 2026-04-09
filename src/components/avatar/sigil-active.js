// Auto-generated from assets/vectors/hermes-sigil-active.svg
// Do not edit by hand — edit the source SVG and re-run: python3 generate.py
const SVG_ACTIVE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="Hermes — active">
  <title>Hermes — Active</title>
  <desc>Hermes AI agent sigil in active / working state</desc>
  <defs>
    <filter id="glow-active" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="5" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
        <linearGradient id="sigil-grad-sg-00b478" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#00b478"/>
      <stop offset="100%" stop-color="#4a80c8"/>
    </linearGradient>
  </defs>
    <g opacity="0.85" filter="url(#glow-active)">
    <ellipse cx="32" cy="32" rx="22" ry="22" fill="none" stroke="#00b478" stroke-width="2" opacity="0.7"/>
    <ellipse cx="32" cy="32" rx="16" ry="16" fill="none" stroke="#00b478" stroke-width="1" opacity="0.4"/>
  </g>
  <!-- Diamond frame outer -->
  <path d="M32 10 L50 32 L32 54 L14 32 Z"
        fill="none" stroke="url(#sigil-grad-sg-00b478)" stroke-width="2.5" stroke-linejoin="round"/>
  <!-- Diamond inner detail -->
  <path d="M32 16 L44 32 L32 48 L20 32 Z"
        fill="none" stroke="url(#sigil-grad-sg-00b478)" stroke-width="1" stroke-linejoin="round" opacity="0.35"/>
  <!-- Horizontal crossbar -->
  <line x1="17" y1="32" x2="47" y2="32" stroke="url(#sigil-grad-sg-00b478)" stroke-width="2" stroke-linecap="round"/>
  <!-- Vertical line (upper) -->
  <line x1="32" y1="10" x2="32" y2="32" stroke="url(#sigil-grad-sg-00b478)" stroke-width="2" stroke-linecap="round" opacity="0.7"/>
  <!-- Vertical line (lower) -->
  <line x1="32" y1="32" x2="32" y2="54" stroke="url(#sigil-grad-sg-00b478)" stroke-width="2" stroke-linecap="round" opacity="0.7"/>
  <!-- Central dot — the mind -->
  <circle cx="32" cy="32" r="4.5" fill="url(#sigil-grad-sg-00b478)"/>
  <!-- Corner terminals -->
  <circle cx="32" cy="10" r="2.5" fill="#00b478"/>
  <circle cx="50" cy="32" r="2.5" fill="#4a80c8"/>
  <circle cx="32" cy="54" r="2.5" fill="#4a80c8"/>
  <circle cx="14" cy="32" r="2.5" fill="#00b478"/>
</svg>`;
export { SVG_ACTIVE as sigilActive };
