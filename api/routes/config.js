// api/routes/config.js — config, env, settings, personality
import { Router } from 'express'
import {
  execSync,
  existsSync,
  readFileSync,
  writeFileSync,
  unlinkSync,
  join,
  parseYaml,
  parseDocument,
  SENSITIVE_KEYS,
  setEnvVar,
  setYamlKey,
  HERMES,
  DB_PATH,
  PYTHON,
} from './_lib.js'

const router = Router()

// GET /api/config
router.get('/config', (req, res) => {
  try {
    const raw = readFileSync(join(HERMES, 'config.yaml'), 'utf8')
    const cfg = parseYaml(raw)
    res.json({
      config: {
        model:       cfg.model ?? cfg.models?.default,
        provider:    cfg.provider,
        max_tokens:  cfg.max_tokens,
        temperature: cfg.temperature,
        yolo:        cfg.yolo ?? false,
      },
      full_config: cfg,
      personalities: Object.keys(cfg.agent?.personalities || {}),
      current_personality: cfg.display?.personality || null,
      raw_config:  raw,
      config_path: join(HERMES, 'config.yaml'),
      db_path:     DB_PATH,
      version:     '1.x',
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── Config key whitelist ─────────────────────────────────────────────────────────
// Only these top-level keys (and their dot-notation children) may be written.
// This prevents arbitrary YAML injection / Python object injection (RCE risk).
const ALLOWED_CONFIG_KEYS = new Set([
  'model', 'provider', 'max_tokens', 'temperature', 'yolo',
  'display', 'platforms', 'tools', 'skills',
])

function isAllowedKey(key) {
  // Top-level key must be in the whitelist
  const top = key.split('.')[0]
  return ALLOWED_CONFIG_KEYS.has(top)
}

function filterConfigToWhitelist(cfg) {
  const filtered = {}
  const invalid = []
  for (const key of Object.keys(cfg)) {
    if (isAllowedKey(key)) {
      filtered[key] = cfg[key]
    } else {
      invalid.push(key)
    }
  }
  return { filtered, invalid }
}

// PUT /api/config — write arbitrary YAML (validated against whitelist)
router.put('/config', (req, res) => {
  try {
    const { raw_config } = req.body
    if (!raw_config) return res.status(400).json({ error: 'raw_config required' })

    const configPath = join(HERMES, 'config.yaml')
    const backupPath = configPath + '.bak'
    try { writeFileSync(backupPath, readFileSync(configPath, 'utf8'), 'utf8') } catch {}

    // 1. Parse the incoming YAML safely
    let parsed
    try {
      parsed = parseYaml(raw_config)
      if (typeof parsed !== 'object' || parsed === null) {
        return res.status(400).json({ error: 'raw_config must be a YAML object' })
      }
    } catch(e) {
      return res.status(400).json({ error: `Invalid YAML: ${e.message}` })
    }

    // 2. Whitelist-filter: reject keys not in ALLOWED_CONFIG_KEYS
    const { filtered, invalid } = filterConfigToWhitelist(parsed)
    if (invalid.length > 0) {
      return res.status(400).json({
        error: 'Invalid config keys',
        message: `The following keys are not permitted: ${invalid.join(', ')}`,
        invalid_keys: invalid,
      })
    }

    // 3. Serialize the filtered object back to YAML and write directly
    //    No execSync needed — pure Node.js YAML round-trip.
    const safeYaml = parseDocument(filtered).toString()
    writeFileSync(configPath, safeYaml, 'utf8')

    res.json({
      ok: true,
      deprecated: true,
      message: "PUT /api/config is deprecated. Use PATCH /api/config with {updates: {...}} instead."
    })
  } catch(e) {
    res.status(500).json({ error: e.message })
  }
})

// PATCH /api/config
router.patch('/config', (req, res) => {
  try {
    const { updates } = req.body
    if (!updates) return res.status(400).json({ error: 'updates required' })

    const configPath = join(HERMES, 'config.yaml')
    const backupPath = configPath + '.bak'
    try { writeFileSync(backupPath, readFileSync(configPath, 'utf8'), 'utf8') } catch {}

    const patched = []
    const yamlUpdates = { ...updates }

    if (updates.apiKey && updates.provider) {
      const envKey = `${updates.provider.toUpperCase()}_API_KEY`
      setEnvVar(envKey, updates.apiKey)
      patched.push('apiKey')
    }
    if (updates.telegramToken) {
      setEnvVar('TELEGRAM_BOT_TOKEN', updates.telegramToken)
      patched.push('telegramToken')
    }

    if (updates.provider !== undefined) {
      setYamlKey('provider', updates.provider)
      patched.push('provider')
    }
    if (updates.model !== undefined) {
      setYamlKey('model', updates.model)
      patched.push('model')
    }

    delete yamlUpdates.provider
    delete yamlUpdates.model
    delete yamlUpdates.apiKey
    delete yamlUpdates.telegramToken

    const remainingKeys = Object.keys(yamlUpdates)
    if (remainingKeys.length > 0) {
      // Pass updates via env var to avoid shell injection
      const safeUpdates = JSON.stringify(yamlUpdates)
      const tmpScript = join(HERMES, '.tmp_config_patch.py')
      const script = `import yaml, json, os, sys
cfg = yaml.safe_load(open('${configPath}'))
cfg.update(json.loads(os.environ['CONFIG_UPDATES_JSON']))
yaml.dump(cfg, open('${configPath}', 'w'), default_flow_style=False, allow_unicode=True, sort_keys=False)
print('OK')
`
      try {
        writeFileSync(tmpScript, script)
        execSync(
          `${PYTHON} "${tmpScript}"`,
          { cwd: HERMES, timeout: 8000, env: { ...process.env, CONFIG_UPDATES_JSON: safeUpdates } }
        )
        try { unlinkSync(tmpScript) } catch {}
        patched.push(...remainingKeys)
      } catch(e) {
        try { unlinkSync(tmpScript) } catch {}
        if (existsSync(backupPath)) {
          writeFileSync(configPath, readFileSync(backupPath, 'utf8'), 'utf8')
        }
        return res.status(500).json({ ok: false, error: `patch failed: ${e.message}` })
      }
    }

    res.json({ ok: true, patched })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// GET /api/env
router.get('/env', (req, res) => {
  try {
    const envPath = join(HERMES, '.env')
    if (!existsSync(envPath)) return res.json({ env: '' })
    const raw = readFileSync(envPath, 'utf8')
    const redacted = raw.split('\n').map(line => {
      const [key, ...rest] = line.split('=')
      if (!key) return line
      if (SENSITIVE_KEYS.test(key.trim())) {
        return `${key}=[REDACTED]`
      }
      return line
    }).join('\n')
    res.json({ env: redacted })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// PUT /api/env
router.put('/env', (req, res) => {
  try {
    const { env } = req.body
    if (typeof env !== 'string') return res.status(400).json({ error: 'env must be a string' })
    const envPath = join(HERMES, '.env')
    const existing = {}
    if (existsSync(envPath)) {
      readFileSync(envPath, 'utf8').split('\n').forEach(line => {
        const eq = line.indexOf('=')
        if (eq > 0) existing[line.slice(0, eq)] = line
      })
    }
    env.split('\n').forEach(line => {
      const eq = line.indexOf('=')
      if (eq > 0) existing[line.slice(0, eq)] = line.trim()
    })
    writeFileSync(envPath, Object.values(existing).join('\n') + '\n', 'utf8')
    res.json({ ok: true, count: Object.keys(existing).length })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// GET /api/settings alias
router.get('/settings', (req, res) => res.redirect('/config'))

// PUT /api/control/personality
router.put('/control/personality', (req, res) => {
  if (!req.body.personality) return res.status(400).json({ ok: false, error: 'personality required' })
  const { personality } = req.body

  try {
    const configPath = join(HERMES, 'config.yaml')
    const scriptPath = join(HERMES, '.tmp_personality.py')
    // Pass personality via JSON env var to avoid shell injection
    const safePersonality = JSON.stringify(personality)
    const script = `import yaml, sys, os, json
cfg = yaml.safe_load(open('${configPath}'))
if 'display' not in cfg or not isinstance(cfg.get('display'), dict):
    cfg['display'] = {}
cfg['display']['personality'] = json.loads(os.environ['PERSONALITY_JSON'])
yaml.dump(cfg, open('${configPath}', 'w'), default_flow_style=False, allow_unicode=True, sort_keys=False)
print('OK')
`
    writeFileSync(scriptPath, script)
    const out = execSync(`${PYTHON} "${scriptPath}"`, {
      cwd: HERMES, timeout: 8000,
      env: { ...process.env, PERSONALITY_JSON: safePersonality }
    }).toString().trim()
    try { unlinkSync(scriptPath) } catch {}

    res.json({ ok: out === 'OK', message: `Personality set to: ${personality}`, current: personality })
  } catch(e) {
    res.status(500).json({ ok: false, error: e.message })
  }
})

export default router
