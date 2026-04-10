import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import { join } from 'path'
import { existsSync, readFileSync } from 'fs'
import os from 'os'
import type { Request, Response, NextFunction } from 'express'
import routesModule from './routes/index.ts'
import { standardRateLimit } from './routes/_lib.js'

const app = express()
const PORT = 5174
const HOME_DIR = os.homedir()
const HERMES_ROOT = join(HOME_DIR, '.hermes')

// ── Build Path Setup ────────────────────────────────────────────────────────
const __dirname = new URL('.', import.meta.url).pathname;
const DIST_PATH = join(__dirname, '../dist');

// Middleware
app.use(cors())
app.use(express.json())
app.use(cookieParser())

// Rate limiting (applies to all API endpoints)
app.use('/api', standardRateLimit)

// Debug logging
app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// API Routes - under /api prefix
app.use('/api', routesModule)

// Static Frontend (Production Build)
if (existsSync(DIST_PATH)) {
  app.use(express.static(DIST_PATH));
  app.get('*', (req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(join(DIST_PATH, 'index.html'));
  });
}

app.listen(PORT, '0.0.0.0', () => {
  console.log('[API] Running on port ' + PORT);
});
