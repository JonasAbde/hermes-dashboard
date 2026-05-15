/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        rust:    { DEFAULT: '#e05f40', dim: 'rgba(224,95,64,0.15)',  glow: 'rgba(224,95,64,0.3)' },
        green:   { DEFAULT: '#00b478', dim: 'rgba(0,180,120,0.12)' },
        amber:   { DEFAULT: '#e09040', dim: 'rgba(224,144,64,0.12)' },
        blue:    { DEFAULT: '#4a80c8', dim: 'rgba(74,128,200,0.12)' },
        red:     { DEFAULT: '#ef4444', dim: 'rgba(239,68,68,0.12)' },
        bg:      '#060608',
        surface: '#0a0b10',
        surface2:'#0d0f17',
        border:  '#111318',
        t1:      '#d8d8e0',
        t2:      '#6b6b80',
        t3:      '#2a2b38',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      borderRadius: {
        sm: '4px',
        md: '8px',
        lg: '12px',
        xl: '16px',
      },
      animation: {
        blink: 'blink 2s ease-in-out infinite',
        shimmer: 'shimmer 1.5s infinite',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4,0,0.6,1) infinite',
        /** Login / Forge marketing — keep motion subtle; pair with prefers-reduced-motion in JS */
        'forge-float': 'forgeFloat 5.5s ease-in-out infinite',
        'forge-dash': 'forgeDash 2.8s linear infinite',
        'forge-aurora': 'forgeAurora 18s ease-in-out infinite',
        'forge-scan': 'forgeScan 4.5s ease-in-out infinite',
      },
      keyframes: {
        blink: { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.35 } },
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition:  '200% 0' },
        },
        forgeFloat: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-7px)' },
        },
        forgeDash: {
          '0%': { strokeDashoffset: '0' },
          '100%': { strokeDashoffset: '-36' },
        },
        forgeAurora: {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 40%' },
        },
        forgeScan: {
          '0%, 100%': { transform: 'translateX(-30%)', opacity: '0.35' },
          '50%': { transform: 'translateX(30%)', opacity: '0.9' },
        },
      },
    },
  },
  plugins: [],
}
