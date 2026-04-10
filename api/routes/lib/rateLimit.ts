// api/routes/lib/rateLimit.ts — rate limiting middleware
import rateLimit from 'express-rate-limit'
import type { Request, Response } from 'express'

// Augment Express Request with rateLimit info from express-rate-limit
declare module 'express-serve-static-core' {
  interface Request {
    rateLimit?: {
      limit: number
      current: number
      remaining: number
      resetTime: Date | undefined
    }
  }
}

// Trusted IPs that bypass rate limiting (localhost, private networks)
const TRUSTED_IPS = new Set([
  '127.0.0.1',
  '::1',
  'localhost',
])

// Helper to check if IP is trusted
function isTrustedIp(ip: string | undefined): boolean {
  if (!ip) return false
  if (TRUSTED_IPS.has(ip)) return true
  // Check for private IP ranges
  if (ip.startsWith('10.') || ip.startsWith('192.168.') || /^172\.(1[6-9]|2\d|3[01])\./.test(ip)) {
    return true
  }
  return false
}

// Standard rate limiter for general API endpoints
export const standardRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: { error: 'Too many requests', code: 'rate_limit_exceeded' },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  skip: (req: Request) => {
    const ip = req.ip || req.socket.remoteAddress
    return isTrustedIp(ip)
  },
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      error: 'Too many requests',
      code: 'rate_limit_exceeded',
      retryAfter: Math.ceil(((req.rateLimit?.resetTime?.getTime() ?? Date.now() + 90000) - Date.now()) / 1000),
    })
  },
})

// Stricter rate limiter for state-changing operations (POST, PUT, PATCH, DELETE)
export const strictRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // Limit each IP to 30 state-changing requests per windowMs
  message: { error: 'Too many state-changing requests', code: 'rate_limit_exceeded' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req: Request) => {
    const ip = req.ip || req.socket.remoteAddress
    return isTrustedIp(ip)
  },
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      error: 'Too many state-changing requests',
      code: 'rate_limit_exceeded',
      retryAfter: Math.ceil(((req.rateLimit?.resetTime?.getTime() ?? Date.now() + 90000) - Date.now()) / 1000),
    })
  },
})

// Lenient rate limiter for read-only endpoints (GET)
export const lenientRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // Limit each IP to 300 read requests per windowMs
  message: { error: 'Too many read requests', code: 'rate_limit_exceeded' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req: Request) => {
    const ip = req.ip || req.socket.remoteAddress
    return isTrustedIp(ip)
  },
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      error: 'Too many read requests',
      code: 'rate_limit_exceeded',
      retryAfter: Math.ceil(((req.rateLimit?.resetTime?.getTime() ?? Date.now() + 90000) - Date.now()) / 1000),
    })
  },
})

// Very strict rate limiter for authentication endpoints
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 auth requests per windowMs
  message: { error: 'Too many authentication attempts', code: 'auth_rate_limit_exceeded' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req: Request) => {
    const ip = req.ip || req.socket.remoteAddress
    return isTrustedIp(ip)
  },
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      error: 'Too many authentication attempts',
      code: 'auth_rate_limit_exceeded',
      retryAfter: Math.ceil(((req.rateLimit?.resetTime?.getTime() ?? Date.now() + 90000) - Date.now()) / 1000),
    })
  },
})

export { isTrustedIp }
