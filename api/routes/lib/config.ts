// api/routes/lib/config.ts — configuration and dashboard state utilities
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { execSync } from 'child_process'
import os from 'os'

const HOME_DIR = os.homedir()
const HERMES = join(HOME_DIR, '.hermes')
const PYTHON = '/usr/bin/python3'

interface AgentStatus {
  status: string
  rhythm: string
  stopped: boolean
}

interface WebhookConfig {
  url: string
  secret: string
  enabled: boolean
}

interface RecommendationState {
  items: Record<string, unknown>
  history: unknown[]
}

interface RhythmAgentConfig {
  reasoning_effort: 'low' | 'medium' | 'high'
  max_turns: number
}

interface RhythmTerminalConfig {
  timeout: number
}

interface RhythmCodeExecutionConfig {
  max_tool_calls: number
  timeout: number
}

interface RhythmConfig {
  agent: RhythmAgentConfig
  terminal: RhythmTerminalConfig
  code_execution: RhythmCodeExecutionConfig
}

// ── Config writer helpers ───────────────────────────────────────────────────────
function setEnvVar(key: string, value: string): void {
  const envPath = join(HERMES, '.env')
  let content = ''
  try { content = readFileSync(envPath, 'utf8') } catch {}
  const lines = content.split('\n').filter(l => !l.startsWith(key + '='))
  lines.push(`${key}=${value}`)
  writeFileSync(envPath, lines.join('\n') + '\n')
}

// Whitelist of allowed YAML keys for security
const ALLOWED_YAML_KEYS = [
  'agent.model',
  'agent.reasoning_effort',
  'agent.max_turns',
  'terminal.timeout',
  'code_execution.max_tool_calls',
  'code_execution.timeout',
]

function isValidYamlKey(key: string): boolean {
  return ALLOWED_YAML_KEYS.some(allowed => key === allowed || key.startsWith(allowed + '.'))
}

function sanitizeYamlKey(key: string): string {
  // Only allow alphanumeric, dots, underscores, and hyphens
  if (!/^[a-zA-Z0-9._-]+$/.test(key)) {
    throw new Error('Invalid YAML key format')
  }
  return key
}

function sanitizeYamlValue(value: unknown): unknown {
  // Ensure value is JSON-serializable and doesn't contain dangerous patterns
  const str = JSON.stringify(value)
  // Reject values that might contain command injection patterns
  if (/[;&|`$()]/.test(str)) {
    throw new Error('Invalid YAML value format')
  }
  return value
}

function setYamlKey(key: string, value: unknown): void {
  // Validate and sanitize inputs
  if (!isValidYamlKey(key)) {
    throw new Error(`YAML key not allowed: ${key}`)
  }
  const sanitizedKey = sanitizeYamlKey(key)
  const sanitizedValue = sanitizeYamlValue(value)

  const configPath = join(HERMES, 'config.yaml')
  const raw = readFileSync(configPath, 'utf8')
  const escapedKey = sanitizedKey.replace(/'/g, "'\"'\"'")
  const escapedVal = JSON.stringify(sanitizedValue)
  try {
    execSync(
      `${PYTHON} -c "import yaml,json,sys; cfg=yaml.safe_load(open('${configPath}')); cfg['${escapedKey}']=json.loads('${escapedVal}'); yaml.dump(cfg,open('${configPath}','w'),default_flow_style=False,allow_unicode=True,sort_keys=False)"`,
      { cwd: HERMES, timeout: 5000, env: { ...process.env, PATH: '/usr/bin:/bin' } }
    )
    console.log(`[setYamlKey] Updated key: ${sanitizedKey}`)
  } catch(e) {
    const lines = raw.split('\n')
    const regex = new RegExp(`^(${sanitizedKey.replace(/\./g, '\\\\.')}\\s*:\\s*)(.*)$`)
    const idx = lines.findIndex(l => regex.test(l))
    if (idx >= 0) {
      lines[idx] = lines[idx].replace(regex, `$1${JSON.stringify(sanitizedValue)}`)
    } else {
      lines.push(`${sanitizedKey}: ${JSON.stringify(sanitizedValue)}`)
    }
    writeFileSync(configPath, lines.join('\n'))
    console.log(`[setYamlKey] Fallback update for key: ${sanitizedKey}`)
  }
}

// ── Dashboard state helpers ─────────────────────────────────────────────────────
const DASHBOARD_STATE_DIR = join(HERMES, 'dashboard_state')
const DASHBOARD_RECOMMENDATION_STATE_PATH = join(DASHBOARD_STATE_DIR, 'recommendations.json')
const DASHBOARD_PROFILE_PATH = join(DASHBOARD_STATE_DIR, 'profile.json')
const DASHBOARD_AGENT_STATUS_PATH = join(DASHBOARD_STATE_DIR, 'agent-status.json')
const DASHBOARD_WEBHOOK_CONFIG_PATH = join(DASHBOARD_STATE_DIR, 'webhook-config.json')
const LEGACY_RECOMMENDATION_STATE_PATH = join(HERMES, 'recommendation_state.json')
const LEGACY_PROFILE_PATH = join(HERMES, 'user_profile.json')
const LEGACY_AGENT_STATUS_PATH = join(HERMES, 'agent_status.json')
const LEGACY_WEBHOOK_CONFIG_PATH = join(HERMES, 'webhook_config.json')

function ensureDashboardStateDir(): void {
  try { mkdirSync(DASHBOARD_STATE_DIR, { recursive: true }) } catch {}
}

function migrateLegacyDashboardState(primaryPath: string, legacyPath: string, value: unknown): unknown {
  if (primaryPath === legacyPath) return value
  try {
    if (!existsSync(primaryPath) && existsSync(legacyPath) && value && typeof value === 'object') {
      ensureDashboardStateDir()
      writeFileSync(primaryPath, JSON.stringify(value, null, 2), 'utf8')
    }
  } catch {}
  return value
}

function readDashboardOwnedJson<T>(primaryPath: string, legacyPath: string, fallback: T | (() => T)): T {
  const tryPaths = [primaryPath, legacyPath]
  for (const path of tryPaths) {
    try {
      if (!existsSync(path)) continue
      const raw = JSON.parse(readFileSync(path, 'utf8'))
      if (raw && typeof raw === 'object') {
        return migrateLegacyDashboardState(primaryPath, legacyPath, raw) as T
      }
    } catch {}
  }
  return typeof fallback === 'function' ? (fallback as () => T)() : fallback
}

function writeDashboardOwnedJson(path: string, data: unknown): void {
  ensureDashboardStateDir()
  writeFileSync(path, JSON.stringify(data, null, 2), 'utf8')
}

function readDashboardProfile(): Record<string, unknown> {
  return readDashboardOwnedJson(DASHBOARD_PROFILE_PATH, LEGACY_PROFILE_PATH, {})
}

function writeDashboardProfile(profileData: Record<string, unknown>): void {
  writeDashboardOwnedJson(DASHBOARD_PROFILE_PATH, profileData)
}

function readRecommendationState(): RecommendationState {
  const raw = readDashboardOwnedJson<Partial<RecommendationState>>(DASHBOARD_RECOMMENDATION_STATE_PATH, LEGACY_RECOMMENDATION_STATE_PATH, {})
  return {
    items: raw?.items && typeof raw.items === 'object' ? raw.items : {},
    history: Array.isArray(raw?.history) ? raw.history : [],
  }
}

function writeRecommendationState(state: RecommendationState): void {
  const next = {
    items: state?.items && typeof state.items === 'object' ? state.items : {},
    history: Array.isArray(state?.history) ? state.history.slice(-500) : [],
    updated_at: new Date().toISOString(),
  }
  writeDashboardOwnedJson(DASHBOARD_RECOMMENDATION_STATE_PATH, next)
}

function defaultAgentStatus(): AgentStatus {
  return { status: 'online', rhythm: 'steady', stopped: false }
}

function readDashboardAgentStatus(): AgentStatus {
  return readDashboardOwnedJson(DASHBOARD_AGENT_STATUS_PATH, LEGACY_AGENT_STATUS_PATH, defaultAgentStatus)
}

function writeDashboardAgentStatus(statusData: AgentStatus): void {
  writeDashboardOwnedJson(DASHBOARD_AGENT_STATUS_PATH, statusData)
}

function defaultWebhookConfig(): WebhookConfig {
  return { url: '', secret: '', enabled: false }
}

function readDashboardWebhookConfig(): WebhookConfig {
  return readDashboardOwnedJson(DASHBOARD_WEBHOOK_CONFIG_PATH, LEGACY_WEBHOOK_CONFIG_PATH, defaultWebhookConfig)
}

function writeDashboardWebhookConfig(configData: WebhookConfig): void {
  writeDashboardOwnedJson(DASHBOARD_WEBHOOK_CONFIG_PATH, configData)
}

// ── Neural rhythm configs ──────────────────────────────────────────────────────
const RHYTHM_CONFIGS: Record<string, RhythmConfig> = {
  hibernation: {
    agent: { reasoning_effort: 'low', max_turns: 10 },
    terminal: { timeout: 60 },
    code_execution: { max_tool_calls: 20, timeout: 120 },
  },
  steady: {
    agent: { reasoning_effort: 'medium', max_turns: 40 },
    terminal: { timeout: 300 },
    code_execution: { max_tool_calls: 50, timeout: 600 },
  },
  deep_focus: {
    agent: { reasoning_effort: 'high', max_turns: 80 },
    terminal: { timeout: 600 },
    code_execution: { max_tool_calls: 100, timeout: 900 },
  },
  high_burst: {
    agent: { reasoning_effort: 'medium', max_turns: 120 },
    terminal: { timeout: 60 },
    code_execution: { max_tool_calls: 200, timeout: 300 },
  },
}

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
}
