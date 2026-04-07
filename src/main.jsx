import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'
import { getToken, clearToken } from './utils/auth'

// Global fetch override for /api/ routes to ensure auth token is always sent
const ogFetch = window.fetch
window.fetch = async (url, opts = {}) => {
  if (typeof url === 'string' && url.startsWith('/api') && url !== '/api/auth/verify') {
    const token = getToken()
    if (token) {
      opts.headers = {
        ...opts.headers,
        'Authorization': `Bearer ${token}`
      }
    }
    try {
      const res = await ogFetch(url, opts)
      if (res.status === 401) {
        clearToken()
        window.location.href = '/'
      }
      return res
    } catch(e) {
      throw e
    }
  }
  return ogFetch(url, opts)
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <App />
    </BrowserRouter>
  </React.StrictMode>
)
