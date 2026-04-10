// Auto-generated from assets/vectors/hermes-sigil-warning.svg
// Do not edit by hand — edit the source SVG and re-run: python3 generate.py
const SVG_WARNING = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="Hermes — warning">
  <title>Hermes — Warning</title>
  <desc>Hermes AI agent sigil in attention needed state</desc>
  <defs>
    <filter id="glow-warning" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="4" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
        <linearGradient id="sigil-grad-sg-e09040" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#e09040"/>
      <stop offset="100%" stop-color="#e05f40"/>
    </linearGradient>
  </defs>
    <g opacity="0.65" filter="url(#glow-warning)">
    <ellipse cx="32" cy="32" rx="19" ry="19" fill="none" stroke="#e09040" stroke-width="1.5" opacity="0.5"/>
  </g>
  <!-- Diamond frame outer -->
  <path d="M32 10 L50 32 L32 54 L14 32 Z"
        fill="none" stroke="url(#sigil-grad-sg-e09040)" stroke-width="2.5" stroke-linejoin="round"/>
  <!-- Diamond inner detail -->
  <path d="M32 16 L44 32 L32 48 L20 32 Z"
        fill="none" stroke="url(#sigil-grad-sg-e09040)" stroke-width="1" stroke-linejoin="round" opacity="0.35"/>
  <!-- Horizontal crossbar -->
  <line x1="17" y1="32" x2="47" y2="32" stroke="url(#sigil-grad-sg-e09040)" stroke-width="2" stroke-linecap="round"/>
  <!-- Vertical line (upper) -->
  <line x1="32" y1="10" x2="32" y2="32" stroke="url(#sigil-grad-sg-e09040)" stroke-width="2" stroke-linecap="round" opacity="0.7"/>
  <!-- Vertical line (lower) -->
  <line x1="32" y1="32" x2="32" y2="54" stroke="url(#sigil-grad-sg-e09040)" stroke-width="2" stroke-linecap="round" opacity="0.7"/>
  <!-- Central dot — the mind -->
  <circle cx="32" cy="32" r="4.5" fill="url(#sigil-grad-sg-e09040)"/>
  <!-- Corner terminals -->
  <circle cx="32" cy="10" r="2.5" fill="#e09040"/>
  <circle cx="50" cy="32" r="2.5" fill="#e05f40"/>
  <circle cx="32" cy="54" r="2.5" fill="#e05f40"/>
  <circle cx="14" cy="32" r="2.5" fill="#e09040"/>
    <!-- Warning triangle badge -->
  <circle cx="52" cy="12" r="8" fill="#0d0f17" stroke="#e09040" stroke-width="1.5"/>
  <polygon points="52,6 56,16 48,16" fill="none" stroke="#e09040" stroke-width="1.5" stroke-linejoin="round"/>
  <line x1="52" y1="9" x2="52" y2="12" stroke="#e09040" stroke-width="1.5" stroke-linecap="round"/>
  <circle cx="52" cy="14" r="1" fill="#e09040"/>
</svg>`;
export { SVG_WARNING as sigilWarning };
