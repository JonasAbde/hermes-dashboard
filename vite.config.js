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
    allowedHosts: ['.trycloudflare.com', '.lhr.life', '.serveo.net', 'localhost'],
    proxy: {
      '/api': {
        target: 'http://localhost:5174',
        changeOrigin: true,
        // Fail fast: return 503 instead of silent 500 when backend is down
        configure(proxy) {
          proxy.on('error', (err, req, res) => {
            console.error('[ViteProxy] /api error:', err.message)
            if (!res.headersSent) {
              res.writeHead(503, {
                'Content-Type': 'application/json',
                'X-Proxy-Error': 'backend-unavailable',
              })
              res.end(JSON.stringify({
                error: 'Backend unavailable',
                message: err.message,
                code: 'BACKEND_UNAVAILABLE',
              }))
            }
          })
        },
      },
      '/ws': {
        target: 'http://localhost:5174',
        ws: true,
        changeOrigin: true,
      },
    },
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
