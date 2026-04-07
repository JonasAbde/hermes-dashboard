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
      },
      keyframes: {
        blink: { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.35 } },
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition:  '200% 0' },
        },
      },
    },
  },
  plugins: [],
}
