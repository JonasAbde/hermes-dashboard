// api/cors-proxy.js — HTTP reverse proxy + CORS preflight handler
// Problem: Cloudflare Tunnel and localhost.run strip Access-Control-Allow-Origin
// from 204 No Content responses (OPTIONS preflight).
// Solution: Handle OPTIONS directly in this proxy with correct CORS headers.
// Non-OPTIONS requests are proxied to the backend as normal.

import http from 'http'
import https from 'https'
import { createServer as createHttpsServer } from 'https'
import { Readable } from 'stream'
import { readFileSync, existsSync, statSync, createReadStream } from 'fs'

// ── Config ────────────────────────────────────────────────────────────────────────
const LISTEN_PORT  = process.env.PROXY_PORT  || 5176
const BACKEND_HOST = process.env.API_HOST    || '127.0.0.1'
const BACKEND_PORT = process.env.API_PORT    || 5174
const DIST_DIR     = '/home/empir/.hermes/dashboard/dist'

const TUNNEL_PATTERNS = [
  /\.trycloudflare\.com$/,
  /\.lhr\.life$/,
  /\.serveo\.net$/,
]

function isTunnelOrigin(origin) {
  return origin && TUNNEL_PATTERNS.some(p => p.test(origin))
}

function getCorsHeaders(origin, extraMethods = null) {
  const isTunnel = isTunnelOrigin(origin)
  const allowOrigin = isTunnel ? origin : '*'
  const headers = {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': extraMethods || 'GET,HEAD,PUT,PATCH,POST,DELETE',
    'Access-Control-Allow-Headers': 'content-type,authorization,X-CSRF-Token',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  }
  // credentials can only be 'true' when we have a specific origin
  if (isTunnel) {
    headers['Access-Control-Allow-Credentials'] = 'true'
  }
  return headers
}

// ── MIME types for static files ─────────────────────────────────────────────
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript',
  '.mjs':  'application/javascript',
  '.css':  'text/css',
  '.json': 'application/json',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.woff2':'font/woff2',
  '.woff': 'font/woff',
  '.ttf':  'font/ttf',
  '.otf':  'font/otf',
  '.txt':  'text/plain',
  '.wasm': 'application/wasm',
  '.gz':   'application/gzip',
}

// ── Static file server ───────────────────────────────────────────────────────
function serveStatic(req, res) {
  let url = req.url.split('?')[0]
  const [path] = url.split('#')
  url = path

  if (url === '/' || !existsSync(DIST_DIR + url)) {
    url = '/index.html'
  }
  const filePath = DIST_DIR + url

  if (!existsSync(filePath)) {
    res.writeHead(404, { 'Content-Type': 'text/plain' })
    res.end('Not found')
    return
  }

  const stat = statSync(filePath)
  const ext  = '.' + filePath.split('.').pop()
  const mimeType = MIME_TYPES[ext] || 'application/octet-stream'

  res.writeHead(200, {
    'Content-Type': mimeType,
    'Content-Length': stat.size,
    'Cache-Control': 'public, max-age=31536000, immutable',
  })
  createReadStream(filePath).pipe(res)
}

// ── OPTIONS preflight handler — constructs full response directly ─────────────
// This is the KEY fix: we never let Express handle OPTIONS, so no Cloudflare strip
function handlePreflight(req, res) {
  const origin = req.headers.origin || ''
  const accessControlRequestMethod = req.headers['access-control-request-method'] || 'GET'
  const accessControlRequestHeaders = req.headers['access-control-request-headers'] || ''

  const headers = {
    ...getCorsHeaders(origin),
    'Access-Control-Allow-Methods': accessControlRequestMethod + ',HEAD,PUT,PATCH,POST,DELETE',
    'Access-Control-Allow-Headers': accessControlRequestHeaders || 'content-type,authorization,X-CSRF-Token',
    'Content-Length': '0',
  }

  res.writeHead(204, headers)
  res.end()
}

// ── Proxy request to backend ────────────────────────────────────────────────
function proxyRequest(req, res) {
  const origin = req.headers.origin || ''

  const options = {
    hostname: BACKEND_HOST,
    port: BACKEND_PORT,
    path: req.url,
    method: req.method,
    headers: {
      ...req.headers,
      // Forward original origin so backend CORS callback can evaluate it
      'X-Forwarded-Origin': origin,
    },
  }

  const proxyReq = (BACKEND_PORT === 443 ? https : http).request(options, (proxyRes) => {
    // ── For 204 responses from backend (OPTIONS that Express DID handle),
    // ensure CORS headers exist before the response goes to Cloudflare ──
    if (proxyRes.statusCode === 204) {
      if (!proxyRes.headers['access-control-allow-origin']) {
        proxyRes.headers['access-control-allow-origin'] = isTunnelOrigin(origin) ? origin : '*'
        proxyRes.headers['access-control-allow-credentials'] = 'true'
        proxyRes.headers['vary'] = (proxyRes.headers['vary'] || '') + ', Origin'
      }
      // Remove content-length: 0 from 204 so Cloudflare doesn't strip headers
      delete proxyRes.headers['content-length']
    }

    res.writeHead(proxyRes.statusCode, proxyRes.headers)
    proxyRes.pipe(res)
  })

  proxyReq.on('error', (err) => {
    console.error('[CORS-Proxy] Backend error:', err.message)
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Backend unavailable', code: 'BACKEND_UNAVAILABLE' }))
    }
  })

  req.on('data', (chunk) => proxyReq.write(chunk))
  req.on('end', () => proxyReq.end())
}

// ── Dashboard status endpoint — serves tunnel URL and health info ─────────────
// GET /api/dashboard/status → { tunnelUrl, services: { api, proxy, vite } }
function handleDashboardStatus(req, res) {
  const TUNNEL_URL_FILE = '/home/empir/.hermes/dashboard/scripts/.pids/tunnel.url'
  const API_PID_FILE    = '/home/empir/.hermes/dashboard/scripts/.pids/api.pid'
  let tunnelUrl = ''
  try { tunnelUrl = readFileSync(TUNNEL_URL_FILE, 'utf8').trim() } catch {}

  // Check if process is alive using kill -0
  const isProcessAlive = (pidFile) => {
    try {
      const pid = parseInt(readFileSync(pidFile, 'utf8').trim())
      process.kill(pid, 0)
      return true
    } catch { return false }
  }

  res.writeHead(200, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache',
  })
  res.end(JSON.stringify({
    tunnelUrl,
    services: {
      api:   isProcessAlive(API_PID_FILE) ? 'up' : 'down',
      proxy: 'up',
      vite:  'deprecated',
    },
    updatedAt: new Date().toISOString(),
  }))
}

// ── Main router ─────────────────────────────────────────────────────────────
const server = http.createServer((req, res) => {
  const origin = req.headers.origin || ''
  const url = new URL(req.url, `http://${req.headers.host}`)

  // OPTIONS requests: handle directly (bypass backend + Cloudflare strip issue)
  if (req.method === 'OPTIONS') {
    return handlePreflight(req, res)
  }

  // Dashboard status endpoint (served by proxy, no backend needed)
  if (req.method === 'GET' && url.pathname === '/api/dashboard/status') {
    return handleDashboardStatus(req, res)
  }

  // API routes: proxy to backend
  if (req.url.startsWith('/api/')) {
    return proxyRequest(req, res)
  }

  // Static files (including SPA index.html)
  return serveStatic(req, res)
})

server.listen(LISTEN_PORT, '0.0.0.0', () => {
  console.log(`[CORS-Proxy] Listening on http://0.0.0.0:${LISTEN_PORT}`)
  console.log(`[CORS-Proxy]   /api/*  → backend http://${BACKEND_HOST}:${BACKEND_PORT}`)
  console.log(`[CORS-Proxy]   /*      → static files from ${DIST_DIR}`)
  console.log(`[CORS-Proxy]   OPTIONS preflight handled directly (no Cloudflare strip)`)
})
