// api/routes/lib/forge-db.js — sqlite persistence for Forge Agent Pack feature
import { Database, DB_PATH } from '../_lib.js'

const DB = new Database(DB_PATH)
const BASE_STATE_VERSION = '1.4'

const INITIAL_PACKS = [
  {
    pack_id: 'pack-health-hurtig-harald',
    slug: 'hurtig-harald',
    name: 'Health Pack',
    card_name: 'Hurtig Harald',
    card_title: 'Health Pack',
    card_theme: 'infrastruktur',
    card_rarity_seed: 'seed-hurtig-harald',
    card_snippet: 'Kører health checks på gateway og API',
    version: '0.1.0',
    status: 'publish',
    entrypoint: 'agents.health.check',
    requirements_json: ['stats', 'gateway_state'],
    capabilities_json: ['ping', 'check_api', 'check_gateway', 'health_report'],
    owner: 'phase0-seed',
    workspace_id: 'default',
    visibility: 'public',
    summary_md: 'Health Pack holder øje med gateway og API, så teams hurtigt kan se om infrastrukturen er stabil nok til deployment og drift.',
    docs_url: 'https://forge.hermes.local/docs/health-pack',
    attachments_json: [
      { label: 'Runbook', url: 'https://forge.hermes.local/docs/health-pack/runbook' },
    ],
    source_pack_id: null,
    source_workspace_id: null,
    install_count: 0,
    last_requested_at: null,
    clone_depth: 0,
    trust_score: 82,
    rarity_tier: 'trusted',
    verification_state: 'verified',
    rarity_label: 'trusted',
    created_at: new Date().toISOString(),
    published_at: new Date().toISOString(),
    deployed_at: null,
    last_error: null,
  },
  {
    pack_id: 'pack-config-sure-sam',
    slug: 'sure-sam',
    name: 'Config Pack',
    card_name: 'Sure Sam',
    card_title: 'Config Pack',
    card_theme: 'governance',
    card_rarity_seed: 'seed-sure-sam',
    card_snippet: 'Validerer og skriver config ændringer',
    version: '0.1.0',
    status: 'publish',
    entrypoint: 'agents.config.apply',
    requirements_json: ['config.yaml'],
    capabilities_json: ['read_config', 'validate_config', 'apply_delta', 'rollback'],
    owner: 'phase0-seed',
    workspace_id: 'default',
    visibility: 'public',
    summary_md: 'Config Pack beskytter ændringer mod fejl ved at validere, sammenligne og rulle tilbage når governance kræver det.',
    docs_url: 'https://forge.hermes.local/docs/config-pack',
    attachments_json: [
      { label: 'Spec', url: 'https://forge.hermes.local/docs/config-pack/spec' },
    ],
    source_pack_id: null,
    source_workspace_id: null,
    install_count: 0,
    last_requested_at: null,
    clone_depth: 0,
    trust_score: 64,
    rarity_tier: 'starter',
    verification_state: 'not_verified',
    rarity_label: 'starter',
    created_at: new Date().toISOString(),
    published_at: new Date().toISOString(),
    deployed_at: null,
    last_error: null,
  },
  {
    pack_id: 'pack-session-session-sven',
    slug: 'session-sven',
    name: 'Session Pack',
    card_name: 'Session Sven',
    card_title: 'Session Pack',
    card_theme: 'driftsforbedring',
    card_rarity_seed: 'seed-session-sven',
    card_snippet: 'Liste og vedligeholder sessionhistorik',
    version: '0.1.0',
    status: 'publish',
    entrypoint: 'agents.session.maintenance',
    requirements_json: ['state.db'],
    capabilities_json: ['list_sessions', 'close_old_sessions', 'session_summary'],
    owner: 'phase0-seed',
    workspace_id: 'default',
    visibility: 'public',
    summary_md: 'Session Pack giver driftsteams overblik over historik og oprydning, så sessioner ikke bare akkumulerer i baggrunden.',
    docs_url: 'https://forge.hermes.local/docs/session-pack',
    attachments_json: [
      { label: 'Ops guide', url: 'https://forge.hermes.local/docs/session-pack/ops' },
    ],
    source_pack_id: null,
    source_workspace_id: null,
    install_count: 0,
    last_requested_at: null,
    clone_depth: 0,
    trust_score: 31,
    rarity_tier: 'starter',
    verification_state: 'not_verified',
    rarity_label: 'starter',
    created_at: new Date().toISOString(),
    published_at: new Date().toISOString(),
    deployed_at: null,
    last_error: null,
  },
]

function nowIso() {
  return new Date().toISOString()
}

function packJson(value) {
  return JSON.stringify(Array.isArray(value) ? value : [])
}

function parsePackJson(value, fallback = []) {
  if (!value) return [...fallback]
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : fallback
  } catch {
    return [...fallback]
  }
}

function rowToPack(row) {
  if (!row) return null
  return {
    pack_id: String(row.pack_id),
    slug: String(row.slug),
    name: String(row.name),
    card_name: String(row.card_name),
    card_title: String(row.card_title || row.name || ''),
    card_theme: String(row.card_theme || 'utility'),
    card_rarity_seed: String(row.card_rarity_seed || ''),
    card_snippet: String(row.card_snippet || ''),
    version: String(row.version || '0.1.0'),
    status: String(row.status || 'draft'),
    entrypoint: String(row.entrypoint || 'agents/default'),
    requirements_json: parsePackJson(row.requirements_json, []),
    capabilities_json: parsePackJson(row.capabilities_json, []),
    attachments_json: parsePackJson(row.attachments_json, []),
    owner: String(row.owner || 'operator'),
    visibility: String(row.visibility || 'private'),
    summary_md: String(row.summary_md || ''),
    docs_url: row.docs_url || null,
    source_pack_id: row.source_pack_id || null,
    source_workspace_id: row.source_workspace_id || null,
    install_count: Number(row.install_count) || 0,
    last_requested_at: row.last_requested_at || null,
    clone_depth: Number(row.clone_depth) || 0,
    trust_score: Number(row.trust_score) || 0,
    rarity_tier: String(row.rarity_tier || 'starter'),
    verification_state: String(row.verification_state || 'not_verified'),
    rarity_label: String(row.rarity_label || 'starter'),
    created_at: row.created_at || nowIso(),
    updated_at: row.updated_at || nowIso(),
    published_at: row.published_at || null,
    deployed_at: row.deployed_at || null,
    last_error: row.last_error || null,
    workspace_id: String(row.workspace_id || 'default'),
  }
}

function rowToLifecycle(row) {
  return {
    pack_id: String(row.pack_id),
    from_state: String(row.from_state || ''),
    to_state: String(row.to_state || ''),
    actor: String(row.actor || 'operator'),
    at: row.at || nowIso(),
    notes: row.notes,
    verifier_id: row.verifier_id || null,
  }
}

function rowToDeployment(row) {
  return {
    pack_id: String(row.pack_id),
    env: String(row.env || 'default'),
    deployed_at: row.deployed_at || nowIso(),
    agent_id: String(row.agent_id || ''),
    status: String(row.status || 'running'),
    runtime_notes: String(row.runtime_notes || ''),
  }
}

function rowToMetric(row) {
  return {
    pack_id: row.pack_id,
    runs: Number(row.runs) || 0,
    failures: Number(row.failures) || 0,
    avg_latency_ms: Number(row.avg_latency_ms) || 0,
    trust_score: Number(row.trust_score) || 0,
    success_rate: Number(row.success_rate) || 0,
    last_verified_at: row.last_verified_at || null,
    last_run_duration_ms: Number(row.last_run_duration_ms) || 0,
    period: row.period || 'current',
  }
}

function rowToRequest(row) {
  return {
    id: Number(row.id) || 0,
    pack_id: String(row.pack_id),
    source_workspace_id: String(row.source_workspace_id || 'default'),
    target_workspace_id: String(row.target_workspace_id || 'default'),
    actor: String(row.actor || 'operator'),
    requested_at: row.requested_at || nowIso(),
    status: String(row.status || 'open'),
    notes: row.notes || null,
  }
}

function rowToInstall(row) {
  return {
    id: Number(row.id) || 0,
    source_pack_id: String(row.source_pack_id || ''),
    installed_pack_id: String(row.installed_pack_id || ''),
    source_workspace_id: String(row.source_workspace_id || 'default'),
    target_workspace_id: String(row.target_workspace_id || 'default'),
    actor: String(row.actor || 'operator'),
    installed_at: row.installed_at || nowIso(),
    mode: String(row.mode || 'install'),
    notes: row.notes || null,
  }
}

/** Existing DBs created before workspace_id — add column if missing. */
function migrateForgeWorkspaceColumn() {
  try {
    const cols = DB.prepare('PRAGMA table_info(forge_packs)').all()
    const names = new Set(cols.map((c) => c.name))
    if (!names.has('workspace_id')) {
      DB.exec("ALTER TABLE forge_packs ADD COLUMN workspace_id TEXT NOT NULL DEFAULT 'default'")
    }
  } catch (e) {
    console.error('[forge-db] migrate workspace_id failed', e.message)
  }
}

function migrateForgeProfileColumns() {
  try {
    const cols = DB.prepare('PRAGMA table_info(forge_packs)').all()
    const names = new Set(cols.map((c) => c.name))
    if (!names.has('visibility')) {
      DB.exec("ALTER TABLE forge_packs ADD COLUMN visibility TEXT NOT NULL DEFAULT 'private'")
    }
    if (!names.has('summary_md')) {
      DB.exec("ALTER TABLE forge_packs ADD COLUMN summary_md TEXT NOT NULL DEFAULT ''")
    }
    if (!names.has('docs_url')) {
      DB.exec('ALTER TABLE forge_packs ADD COLUMN docs_url TEXT')
    }
    if (!names.has('attachments_json')) {
      DB.exec("ALTER TABLE forge_packs ADD COLUMN attachments_json TEXT NOT NULL DEFAULT '[]'")
    }
  } catch (e) {
    console.error('[forge-db] migrate profile columns failed', e.message)
  }
}

function backfillForgePackProfiles() {
  try {
    const updates = [
      {
        pack_id: 'pack-health-hurtig-harald',
        visibility: 'public',
        summary_md: 'Et public health-kort, der gør det nemt at se om Hermes-miljøet er deploy-klar og stabilt nok til drift.',
        docs_url: 'https://forge.hermes.local/docs/health-pack',
        attachments_json: packJson([{ label: 'Runbook', url: 'https://forge.hermes.local/docs/health-pack/runbook' }]),
      },
      {
        pack_id: 'pack-config-sure-sam',
        visibility: 'workspace',
        summary_md: 'Et workspace-pack til governance og sikre config-ændringer, så teams kan deploye uden at miste rollback og validering.',
        docs_url: 'https://forge.hermes.local/docs/config-pack',
        attachments_json: packJson([{ label: 'Spec', url: 'https://forge.hermes.local/docs/config-pack/spec' }]),
      },
      {
        pack_id: 'pack-session-session-sven',
        visibility: 'private',
        summary_md: 'Et privat maintenance-pack, der holder sessioner ryddelige og giver bedre overblik over driftsaktivitet.',
        docs_url: 'https://forge.hermes.local/docs/session-pack',
        attachments_json: packJson([{ label: 'Ops guide', url: 'https://forge.hermes.local/docs/session-pack/ops' }]),
      },
    ]
    const stmt = DB.prepare(`
      UPDATE forge_packs
      SET
        visibility = CASE WHEN COALESCE(visibility, '') IN ('', 'private') THEN @visibility ELSE visibility END,
        summary_md = CASE WHEN COALESCE(summary_md, '') = '' THEN @summary_md ELSE summary_md END,
        docs_url = COALESCE(docs_url, @docs_url),
        attachments_json = CASE WHEN COALESCE(attachments_json, '') IN ('', '[]') THEN @attachments_json ELSE attachments_json END
      WHERE pack_id = @pack_id
    `)
    for (const item of updates) {
      stmt.run(item)
    }
  } catch (e) {
    console.error('[forge-db] backfill pack profiles failed', e.message)
  }
}

/** Demo-packs skal kunne listes i Hermes Forge katalog: public + publish (se isCatalogEligible i forge.js). */
function migrateForgeCatalogEligiblePacks() {
  try {
    const now = nowIso()
    DB.prepare(
      `
      UPDATE forge_packs
      SET
        visibility = 'public',
        status = 'publish',
        published_at = COALESCE(published_at, ?),
        updated_at = ?
      WHERE pack_id IN ('pack-config-sure-sam', 'pack-session-session-sven')
    `,
    ).run(now, now)
  } catch (e) {
    console.error('[forge-db] migrate catalog eligible packs failed', e.message)
  }
}

function migrateForgeInstallColumns() {
  try {
    const cols = DB.prepare('PRAGMA table_info(forge_packs)').all()
    const names = new Set(cols.map((c) => c.name))
    if (!names.has('source_pack_id')) {
      DB.exec('ALTER TABLE forge_packs ADD COLUMN source_pack_id TEXT')
    }
    if (!names.has('source_workspace_id')) {
      DB.exec('ALTER TABLE forge_packs ADD COLUMN source_workspace_id TEXT')
    }
    if (!names.has('install_count')) {
      DB.exec("ALTER TABLE forge_packs ADD COLUMN install_count INTEGER NOT NULL DEFAULT 0")
    }
    if (!names.has('last_requested_at')) {
      DB.exec('ALTER TABLE forge_packs ADD COLUMN last_requested_at TEXT')
    }
    if (!names.has('clone_depth')) {
      DB.exec("ALTER TABLE forge_packs ADD COLUMN clone_depth INTEGER NOT NULL DEFAULT 0")
    }
  } catch (e) {
    console.error('[forge-db] migrate install columns failed', e.message)
  }
}

function ensureSchema() {
  const schemaSQL = `
    CREATE TABLE IF NOT EXISTS forge_schema_version (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS forge_packs (
      pack_id TEXT PRIMARY KEY,
      slug TEXT NOT NULL,
      name TEXT NOT NULL,
      card_name TEXT NOT NULL,
      card_title TEXT NOT NULL,
      card_theme TEXT NOT NULL DEFAULT 'utility',
      card_rarity_seed TEXT NOT NULL DEFAULT '',
      card_snippet TEXT NOT NULL DEFAULT '',
      version TEXT NOT NULL DEFAULT '0.1.0',
      status TEXT NOT NULL DEFAULT 'draft',
      entrypoint TEXT NOT NULL DEFAULT 'agents/default',
      requirements_json TEXT NOT NULL DEFAULT '[]',
      capabilities_json TEXT NOT NULL DEFAULT '[]',
      attachments_json TEXT NOT NULL DEFAULT '[]',
      owner TEXT NOT NULL DEFAULT 'operator',
      workspace_id TEXT NOT NULL DEFAULT 'default',
      visibility TEXT NOT NULL DEFAULT 'private',
      summary_md TEXT NOT NULL DEFAULT '',
      docs_url TEXT,
      source_pack_id TEXT,
      source_workspace_id TEXT,
      install_count INTEGER NOT NULL DEFAULT 0,
      last_requested_at TEXT,
      clone_depth INTEGER NOT NULL DEFAULT 0,
      trust_score REAL NOT NULL DEFAULT 0,
      rarity_tier TEXT NOT NULL DEFAULT 'starter',
      verification_state TEXT NOT NULL DEFAULT 'not_verified',
      rarity_label TEXT NOT NULL DEFAULT 'starter',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      published_at TEXT,
      deployed_at TEXT,
      last_error TEXT
    );

    CREATE TABLE IF NOT EXISTS forge_pack_lifecycle (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pack_id TEXT NOT NULL,
      from_state TEXT NOT NULL,
      to_state TEXT NOT NULL,
      actor TEXT NOT NULL DEFAULT 'operator',
      at TEXT NOT NULL,
      notes TEXT,
      verifier_id TEXT,
      FOREIGN KEY(pack_id) REFERENCES forge_packs(pack_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS forge_pack_verification (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pack_id TEXT NOT NULL,
      verification_state TEXT NOT NULL,
      last_run_at TEXT NOT NULL,
      last_run_duration_ms INTEGER NOT NULL DEFAULT 0,
      success_rate REAL NOT NULL DEFAULT 0,
      last_error TEXT,
      actor TEXT NOT NULL DEFAULT 'operator',
      trust_score REAL NOT NULL DEFAULT 0,
      FOREIGN KEY(pack_id) REFERENCES forge_packs(pack_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS forge_pack_metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pack_id TEXT NOT NULL,
      period TEXT NOT NULL DEFAULT 'current',
      runs INTEGER NOT NULL DEFAULT 0,
      failures INTEGER NOT NULL DEFAULT 0,
      avg_latency_ms INTEGER NOT NULL DEFAULT 0,
      trust_score REAL NOT NULL DEFAULT 0,
      success_rate REAL NOT NULL DEFAULT 0,
      last_verified_at TEXT,
      last_run_duration_ms INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL,
      UNIQUE(pack_id, period),
      FOREIGN KEY(pack_id) REFERENCES forge_packs(pack_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS forge_pack_deployments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pack_id TEXT NOT NULL,
      env TEXT NOT NULL DEFAULT 'default',
      deployed_at TEXT NOT NULL,
      agent_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'running',
      runtime_notes TEXT,
      actor TEXT NOT NULL DEFAULT 'operator',
      FOREIGN KEY(pack_id) REFERENCES forge_packs(pack_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS forge_pack_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pack_id TEXT NOT NULL,
      source_workspace_id TEXT NOT NULL DEFAULT 'default',
      target_workspace_id TEXT NOT NULL DEFAULT 'default',
      actor TEXT NOT NULL DEFAULT 'operator',
      requested_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      notes TEXT,
      FOREIGN KEY(pack_id) REFERENCES forge_packs(pack_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS forge_pack_installs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_pack_id TEXT NOT NULL,
      installed_pack_id TEXT NOT NULL,
      source_workspace_id TEXT NOT NULL DEFAULT 'default',
      target_workspace_id TEXT NOT NULL DEFAULT 'default',
      actor TEXT NOT NULL DEFAULT 'operator',
      installed_at TEXT NOT NULL,
      mode TEXT NOT NULL DEFAULT 'install',
      notes TEXT,
      FOREIGN KEY(source_pack_id) REFERENCES forge_packs(pack_id) ON DELETE CASCADE,
      FOREIGN KEY(installed_pack_id) REFERENCES forge_packs(pack_id) ON DELETE CASCADE
    );
  `

  DB.exec(schemaSQL)
  migrateForgeWorkspaceColumn()
  migrateForgeProfileColumns()
  migrateForgeInstallColumns()
  backfillForgePackProfiles()
  migrateForgeCatalogEligiblePacks()
  const current = DB.prepare("SELECT value FROM forge_schema_version WHERE key = 'version'").get()
  if (!current) {
    DB.prepare('INSERT INTO forge_schema_version (key, value) VALUES (?, ?)')
      .run('version', BASE_STATE_VERSION)
  } else if (current.value !== BASE_STATE_VERSION) {
    DB.prepare('UPDATE forge_schema_version SET value = ? WHERE key = ?')
      .run(BASE_STATE_VERSION, 'version')
  }
}

function seedInitialPacksIfEmpty() {
  const count = DB.prepare('SELECT COUNT(*) as total FROM forge_packs').get()?.total || 0
  if (count > 0) return

  const insertPack = DB.prepare(`
    INSERT INTO forge_packs (
      pack_id, slug, name, card_name, card_title, card_theme, card_rarity_seed, card_snippet, version,
      status, entrypoint, requirements_json, capabilities_json, attachments_json, owner, workspace_id, visibility,
      summary_md, docs_url, source_pack_id, source_workspace_id, install_count, last_requested_at, clone_depth,
      trust_score, rarity_tier, verification_state, rarity_label, created_at, updated_at, published_at, deployed_at, last_error
    ) VALUES (
      @pack_id, @slug, @name, @card_name, @card_title, @card_theme, @card_rarity_seed, @card_snippet, @version,
      @status, @entrypoint, @requirements_json, @capabilities_json, @attachments_json, @owner, @workspace_id, @visibility,
      @summary_md, @docs_url, @source_pack_id, @source_workspace_id, @install_count, @last_requested_at, @clone_depth,
      @trust_score, @rarity_tier, @verification_state, @rarity_label, @created_at, @updated_at, @published_at, @deployed_at, @last_error
    )
  `)
  const insertLifecycle = DB.prepare(`
    INSERT INTO forge_pack_lifecycle (pack_id, from_state, to_state, actor, at, notes, verifier_id)
    VALUES (@pack_id, 'seed', @status, 'system', @at, 'seeded', NULL)
  `)
  const insertMetrics = DB.prepare(`
    INSERT INTO forge_pack_metrics (
      pack_id, period, runs, failures, avg_latency_ms, trust_score, success_rate,
      last_verified_at, last_run_duration_ms, updated_at
    )
    VALUES (@pack_id, 'current', 0, 0, 0, @trust_score, 0, NULL, 0, @at)
  `)

  for (const pack of INITIAL_PACKS) {
    const now = nowIso()
    insertPack.run({
      ...pack,
      workspace_id: pack.workspace_id || 'default',
      requirements_json: packJson(pack.requirements_json),
      capabilities_json: packJson(pack.capabilities_json),
      attachments_json: packJson(pack.attachments_json),
      visibility: pack.visibility || 'private',
      summary_md: pack.summary_md || '',
      docs_url: pack.docs_url || null,
      source_pack_id: pack.source_pack_id || null,
      source_workspace_id: pack.source_workspace_id || null,
      install_count: Number(pack.install_count) || 0,
      last_requested_at: pack.last_requested_at || null,
      clone_depth: Number(pack.clone_depth) || 0,
      updated_at: pack.updated_at || now,
      published_at: pack.published_at || null,
      deployed_at: pack.deployed_at || null,
      last_error: pack.last_error || null,
    })
    insertLifecycle.run({
      pack_id: pack.pack_id,
      status: pack.status,
      at: now,
    })
    insertMetrics.run({
      pack_id: pack.pack_id,
      trust_score: pack.trust_score || 0,
      at: now,
    })
  }
}

function loadMetricMap() {
  const rows = DB.prepare('SELECT * FROM forge_pack_metrics WHERE period = ?').all('current')
  const payload = {}
  for (const row of rows) {
    payload[row.pack_id] = rowToMetric(row)
  }
  return payload
}

function loadVerificationRuns() {
  return DB.prepare(`
    SELECT pack_id, verification_state as status, last_run_duration_ms as latency_ms, actor, last_run_at as at, trust_score
    FROM forge_pack_verification
    ORDER BY last_run_at DESC
    LIMIT 300
  `).all().map(row => ({
    pack_id: row.pack_id,
    status: row.status,
    latency_ms: row.latency_ms,
    actor: row.actor,
    at: row.at,
    trust_score: row.trust_score,
  }))
}

function loadRequests() {
  return DB.prepare(`
    SELECT *
    FROM forge_pack_requests
    ORDER BY requested_at DESC
    LIMIT 300
  `).all().map(rowToRequest)
}

function loadInstalls() {
  return DB.prepare(`
    SELECT *
    FROM forge_pack_installs
    ORDER BY installed_at DESC
    LIMIT 500
  `).all().map(rowToInstall)
}

export function loadForgeState() {
  ensureSchema()
  seedInitialPacksIfEmpty()

  const rawPacks = DB.prepare('SELECT * FROM forge_packs ORDER BY created_at ASC').all()
  const rawLifecycle = DB.prepare('SELECT * FROM forge_pack_lifecycle ORDER BY at DESC').all()
  const rawDeployments = DB.prepare('SELECT * FROM forge_pack_deployments ORDER BY deployed_at DESC').all()

  const packs = rawPacks.map(rowToPack)
  return {
    schema_version: BASE_STATE_VERSION,
    updated_at: nowIso(),
    packs,
    lifecycle: rawLifecycle.map(rowToLifecycle),
    deployments: rawDeployments.map(rowToDeployment),
    metrics: loadMetricMap(),
    verification_runs: loadVerificationRuns(),
    requests: loadRequests(),
    installs: loadInstalls(),
  }
}

export function saveForgeState(state) {
  if (!state || typeof state !== 'object') return
  ensureSchema()

  const tx = DB.transaction((payload) => {
    DB.prepare('DELETE FROM forge_pack_metrics').run()
    DB.prepare('DELETE FROM forge_pack_lifecycle').run()
    DB.prepare('DELETE FROM forge_pack_deployments').run()
    DB.prepare('DELETE FROM forge_pack_verification').run()
    DB.prepare('DELETE FROM forge_pack_requests').run()
    DB.prepare('DELETE FROM forge_pack_installs').run()
    DB.prepare('DELETE FROM forge_packs').run()

    const insertPack = DB.prepare(`
      INSERT INTO forge_packs (
        pack_id, slug, name, card_name, card_title, card_theme, card_rarity_seed, card_snippet, version,
        status, entrypoint, requirements_json, capabilities_json, attachments_json, owner, workspace_id, visibility,
        summary_md, docs_url, source_pack_id, source_workspace_id, install_count, last_requested_at, clone_depth,
        trust_score, rarity_tier, verification_state, rarity_label, created_at, updated_at, published_at, deployed_at, last_error
      ) VALUES (
        @pack_id, @slug, @name, @card_name, @card_title, @card_theme, @card_rarity_seed, @card_snippet, @version,
        @status, @entrypoint, @requirements_json, @capabilities_json, @attachments_json, @owner, @workspace_id, @visibility,
        @summary_md, @docs_url, @source_pack_id, @source_workspace_id, @install_count, @last_requested_at, @clone_depth,
        @trust_score, @rarity_tier, @verification_state, @rarity_label, @created_at, @updated_at, @published_at, @deployed_at, @last_error
      )
    `)
    const insertLifecycle = DB.prepare(`
      INSERT INTO forge_pack_lifecycle (pack_id, from_state, to_state, actor, at, notes, verifier_id)
      VALUES (@pack_id, @from_state, @to_state, @actor, @at, @notes, @verifier_id)
    `)
    const insertDeployment = DB.prepare(`
      INSERT INTO forge_pack_deployments (pack_id, env, deployed_at, agent_id, status, runtime_notes, actor)
      VALUES (@pack_id, @env, @deployed_at, @agent_id, @status, @runtime_notes, @actor)
    `)
    const insertMetric = DB.prepare(`
      INSERT INTO forge_pack_metrics (pack_id, period, runs, failures, avg_latency_ms, trust_score, success_rate, last_verified_at, last_run_duration_ms, updated_at)
      VALUES (@pack_id, @period, @runs, @failures, @avg_latency_ms, @trust_score, @success_rate, @last_verified_at, @last_run_duration_ms, @updated_at)
    `)
    const insertVerification = DB.prepare(`
      INSERT INTO forge_pack_verification (pack_id, verification_state, last_run_at, last_run_duration_ms, success_rate, last_error, actor, trust_score)
      VALUES (@pack_id, @verification_state, @last_run_at, @last_run_duration_ms, @success_rate, @last_error, @actor, @trust_score)
    `)
    const insertRequest = DB.prepare(`
      INSERT INTO forge_pack_requests (pack_id, source_workspace_id, target_workspace_id, actor, requested_at, status, notes)
      VALUES (@pack_id, @source_workspace_id, @target_workspace_id, @actor, @requested_at, @status, @notes)
    `)
    const insertInstall = DB.prepare(`
      INSERT INTO forge_pack_installs (source_pack_id, installed_pack_id, source_workspace_id, target_workspace_id, actor, installed_at, mode, notes)
      VALUES (@source_pack_id, @installed_pack_id, @source_workspace_id, @target_workspace_id, @actor, @installed_at, @mode, @notes)
    `)

    const packs = Array.isArray(payload.packs) ? payload.packs : []
    const metrics = payload.metrics || {}
    for (const pack of packs) {
      insertPack.run({
        ...pack,
        workspace_id: pack.workspace_id || 'default',
        requirements_json: packJson(pack.requirements_json || []),
        capabilities_json: packJson(pack.capabilities_json || []),
        attachments_json: packJson(pack.attachments_json || []),
        visibility: pack.visibility || 'private',
        summary_md: pack.summary_md || '',
        docs_url: pack.docs_url || null,
        source_pack_id: pack.source_pack_id || null,
        source_workspace_id: pack.source_workspace_id || null,
        install_count: Number(pack.install_count) || 0,
        last_requested_at: pack.last_requested_at || null,
        clone_depth: Number(pack.clone_depth) || 0,
      })
      const metric = metrics[pack.pack_id]
      const metricPayload = metric || {
        runs: 0,
        failures: 0,
        avg_latency_ms: 0,
        trust_score: Number(pack.trust_score) || 0,
        success_rate: 0,
        last_verified_at: null,
        last_run_duration_ms: 0,
      }
      insertMetric.run({
        pack_id: pack.pack_id,
        period: 'current',
        runs: Number(metricPayload.runs) || 0,
        failures: Number(metricPayload.failures) || 0,
        avg_latency_ms: Number(metricPayload.avg_latency_ms) || 0,
        trust_score: Number(metricPayload.trust_score) || 0,
        success_rate: Number(metricPayload.success_rate) || 0,
        last_verified_at: metricPayload.last_verified_at || null,
        last_run_duration_ms: Number(metricPayload.last_run_duration_ms) || 0,
        updated_at: nowIso(),
      })
    }

    for (const item of (payload.lifecycle || [])) {
      insertLifecycle.run({
        pack_id: item.pack_id,
        from_state: item.from_state,
        to_state: item.to_state,
        actor: item.actor || 'operator',
        at: item.at || nowIso(),
        notes: item.notes || null,
        verifier_id: item.verifier_id || null,
      })
    }

    for (const item of (payload.deployments || [])) {
      insertDeployment.run({
        pack_id: item.pack_id,
        env: item.env || 'default',
        deployed_at: item.deployed_at || nowIso(),
        agent_id: item.agent_id || item.pack_id || 'unknown',
        status: item.status || 'running',
        runtime_notes: item.runtime_notes || '',
        actor: item.actor || 'operator',
      })
    }

    for (const item of (payload.verification_runs || [])) {
      insertVerification.run({
        pack_id: item.pack_id,
        verification_state: item.status || 'unknown',
        last_run_at: item.at || nowIso(),
        last_run_duration_ms: Number(item.latency_ms) || 0,
        success_rate: Number(item.trust_score) || 0,
        last_error: item.status === 'fail' ? 'simulering' : null,
        actor: item.actor || 'operator',
        trust_score: Number(item.trust_score) || 0,
      })
    }

    for (const item of (payload.requests || [])) {
      insertRequest.run({
        pack_id: item.pack_id,
        source_workspace_id: item.source_workspace_id || 'default',
        target_workspace_id: item.target_workspace_id || 'default',
        actor: item.actor || 'operator',
        requested_at: item.requested_at || nowIso(),
        status: item.status || 'open',
        notes: item.notes || null,
      })
    }

    for (const item of (payload.installs || [])) {
      insertInstall.run({
        source_pack_id: item.source_pack_id,
        installed_pack_id: item.installed_pack_id,
        source_workspace_id: item.source_workspace_id || 'default',
        target_workspace_id: item.target_workspace_id || 'default',
        actor: item.actor || 'operator',
        installed_at: item.installed_at || nowIso(),
        mode: item.mode || 'install',
        notes: item.notes || null,
      })
    }
  })

  tx(state)
}

export function forgeDb() {
  return DB
}
