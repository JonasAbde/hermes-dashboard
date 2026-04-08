import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
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
  }
})
