// Auto-generated from assets/vectors/hermes-sigil-default.svg
// Do not edit by hand — edit the source SVG and re-run: python3 generate.py
const SVG_DEFAULT = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="Hermes — default">
  <title>Hermes — Default</title>
  <desc>Hermes AI agent sigil in default idle state</desc>
  <defs>
    <filter id="glow-default" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="3" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
        <linearGradient id="sigil-grad-sg-e05f40" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#e05f40"/>
      <stop offset="100%" stop-color="#4a80c8"/>
    </linearGradient>
  </defs>
    <g opacity="0.5" filter="url(#glow-default)">
    <ellipse cx="32" cy="32" rx="18" ry="18" fill="none" stroke="#00b478" stroke-width="1" opacity="0.4"/>
  </g>
  <!-- Diamond frame outer -->
  <path d="M32 10 L50 32 L32 54 L14 32 Z"
        fill="none" stroke="url(#sigil-grad-sg-e05f40)" stroke-width="2.5" stroke-linejoin="round"/>
  <!-- Diamond inner detail -->
  <path d="M32 16 L44 32 L32 48 L20 32 Z"
        fill="none" stroke="url(#sigil-grad-sg-e05f40)" stroke-width="1" stroke-linejoin="round" opacity="0.35"/>
  <!-- Horizontal crossbar -->
  <line x1="17" y1="32" x2="47" y2="32" stroke="url(#sigil-grad-sg-e05f40)" stroke-width="2" stroke-linecap="round"/>
  <!-- Vertical line (upper) -->
  <line x1="32" y1="10" x2="32" y2="32" stroke="url(#sigil-grad-sg-e05f40)" stroke-width="2" stroke-linecap="round" opacity="0.7"/>
  <!-- Vertical line (lower) -->
  <line x1="32" y1="32" x2="32" y2="54" stroke="url(#sigil-grad-sg-e05f40)" stroke-width="2" stroke-linecap="round" opacity="0.7"/>
  <!-- Central dot — the mind -->
  <circle cx="32" cy="32" r="4.5" fill="url(#sigil-grad-sg-e05f40)"/>
  <!-- Corner terminals -->
  <circle cx="32" cy="10" r="2.5" fill="#e05f40"/>
  <circle cx="50" cy="32" r="2.5" fill="#4a80c8"/>
  <circle cx="32" cy="54" r="2.5" fill="#4a80c8"/>
  <circle cx="14" cy="32" r="2.5" fill="#e05f40"/>
</svg>`;
export { SVG_DEFAULT as sigilDefault };
