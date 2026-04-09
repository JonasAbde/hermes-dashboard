import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/*.png'],
      manifest: {
        name: 'Hermes Dashboard',
        short_name: 'Hermes',
        description: 'Web-based control panel for Hermes Agent',
        theme_color: '#0a0b10',
        background_color: '#060608',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        id: '/',
        categories: ['developer', 'productivity', 'utilities'],
        icons: [
          { src: '/icons/icon-72x72.png', sizes: '72x72', type: 'image/png' },
          { src: '/icons/icon-96x96.png', sizes: '96x96', type: 'image/png' },
          { src: '/icons/icon-128x128.png', sizes: '128x128', type: 'image/png' },
          { src: '/icons/icon-144x144.png', sizes: '144x144', type: 'image/png' },
          { src: '/icons/icon-152x152.png', sizes: '152x152', type: 'image/png' },
          { src: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-384x384.png', sizes: '384x384', type: 'image/png' },
          { src: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512x512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        screenshots: [],
        shortcuts: [
          {
            name: 'New Chat',
            short_name: 'Chat',
            description: 'Start a new chat session',
            url: '/chat',
            icons: [{ src: '/icons/icon-96x96.png', sizes: '96x96' }],
          },
          {
            name: 'Sessions',
            short_name: 'Sessions',
            description: 'View active sessions',
            url: '/sessions',
            icons: [{ src: '/icons/icon-96x96.png', sizes: '96x96' }],
          },
        ],
        related_applications: [],
        prefer_related_applications: false,
      },
      workbox: {
        // Global Workbox config
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          // Google Fonts — cache first with network fallback
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // External images
          {
            urlPattern: /^https:\/\/.*\.(png|jpg|jpeg|gif|webp|svg|ico)/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'external-images-cache',
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 7 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // API calls — network first, fall back to cache
          {
            urlPattern: /\/api\//i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 5 },
              cacheableResponse: { statuses: [0, 200] },
              networkTimeoutSeconds: 5,
            },
          },
        ],
      },
      devOptions: {
        enabled: false, // SW kun i production build
      },
    }),
  ],
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
    host: '0.0.0.0',
    allowedHosts: ['.trycloudflare.com', '.lhr.life', '.serveo.net', 'localhost'],
    proxy: {
      '/api': {
        target: 'http://localhost:5174',
        changeOrigin: true,
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
