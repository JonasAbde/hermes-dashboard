// api/routes/_lib.js — shared dependencies barrel for all route modules
// This file re-exports from split modules for backward compatibility

// Re-export from split modules
export {
  AUTH_SECRET,
  AUTH_SKIP,
  SENSITIVE_KEYS,
  authMiddleware,
  generateCsrfToken,
  getCsrfToken,
  removeCsrfToken,
  rotateCsrfToken,
  csrfMiddleware,
} from './lib/auth.ts'

export {
  HERMES_DB,
  getSessions,
  pyQuery,
  QUERY_SCRIPT,
  execAsync,
  execSync,
} from './lib/database.ts'

export {
  setEnvVar,
  setYamlKey,
  DASHBOARD_STATE_DIR,
  DASHBOARD_PROFILE_PATH,
  DASHBOARD_RECOMMENDATION_STATE_PATH,
  DASHBOARD_AGENT_STATUS_PATH,
  DASHBOARD_WEBHOOK_CONFIG_PATH,
  readDashboardOwnedJson,
  writeDashboardOwnedJson,
  ensureDashboardStateDir,
  migrateLegacyDashboardState,
  readDashboardProfile,
  writeDashboardProfile,
  readRecommendationState,
  writeRecommendationState,
  defaultAgentStatus,
  readDashboardAgentStatus,
  writeDashboardAgentStatus,
  defaultWebhookConfig,
  readDashboardWebhookConfig,
  writeDashboardWebhookConfig,
  RHYTHM_CONFIGS,
} from './lib/config.ts'

export {
  HERMES,
  HERMES_ROOT,
  HERMES_BIN,
  HOME_DIR,
  hermesCmd,
  readPidFile,
  kill0,
  getProcessInfo,
  getServiceStatus,
  controlGatewayService,
  getMcpConfigEntries,
} from './lib/services.ts'

export {
  standardRateLimit,
  strictRateLimit,
  lenientRateLimit,
  authRateLimit,
  isTrustedIp,
} from './lib/rateLimit.ts'

// Re-export common Node.js modules and utilities for convenience
import express from 'express'
import Database from 'better-sqlite3'
import { readFileSync, readdirSync, statSync, existsSync, openSync, readSync, closeSync, watchFile, unwatchFile, writeFileSync, unlinkSync, mkdirSync } from 'fs'
import { join, resolve } from 'path'
import { parse as parseYaml, parseDocument } from 'yaml'
import cors from 'cors'
import { spawn } from 'child_process'
import { promisify } from 'util'
import { Readable } from 'stream'
import os from 'os'

// ── CORS config ────────────────────────────────────────────────────────────
const CORS_ORIGINS = (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:5175,http://127.0.0.1:5173').split(',').map(s => s.trim())
const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true)
    const TUNNEL_PATTERNS = [
      /\.trycloudflare\.com$/,
      /\.lhr\.life$/,
      /\.serveo\.net$/,
    ]
    if (TUNNEL_PATTERNS.some(p => p.test(origin))) {
      return callback(null, origin)
    }
    if (CORS_ORIGINS.includes(origin)) {
      callback(null, origin)
    } else {
      callback(new Error(`Origin ${origin} not allowed by CORS policy`))
    }
  },
  credentials: true,
}

const HOME_DIR_ = os.homedir()
const HERMES_ROOT_ = join(HOME_DIR_, '.hermes')
const DB_PATH = join(HERMES_ROOT_, 'state.db')
const PYTHON = '/usr/bin/python3'

export {
  express,
  Database,
  readFileSync,
  readdirSync,
  statSync,
  existsSync,
  openSync,
  readSync,
  closeSync,
  watchFile,
  unwatchFile,
  writeFileSync,
  unlinkSync,
  mkdirSync,
  join,
  resolve,
  parseYaml,
  parseDocument,
  os,
  promisify,
  cors,
  corsOptions,
  DB_PATH,
  PYTHON,
  spawn,
  Readable,
}
