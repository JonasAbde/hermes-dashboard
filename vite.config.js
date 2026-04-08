import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.js',
  },
  define: {
    'import.meta.env.VITE_TOKEN_KEY': JSON.stringify(process.env.VITE_TOKEN_KEY || 'hermes_dashboard_token'),
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.API_URL || 'http://localhost:5174',
        changeOrigin: true,
      }
    }
  },
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/recharts')) return 'recharts'
          if (id.includes('node_modules/d3')) return 'd3'
          if (id.includes('node_modules/lucide-react')) return 'icons'
          if (id.includes('node_modules/date-fns')) return 'date-fns'
          if (id.includes('node_modules/scheduler')) return 'scheduler'
          if (id.includes('node_modules/react-dom')) return 'react-dom'
        }
      }
    }
  }
})
