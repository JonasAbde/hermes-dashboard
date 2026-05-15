// api/routes/forge.js — Agent Pack registry, lifecycle, deploy, verify, metrics
import { Router } from 'express'
import { createHash, randomUUID } from 'crypto'
import { loadForgeState, saveForgeState } from './lib/forge-db.js'

const router = Router()
const VALID_STATES = ['draft', 'review', 'publish', 'deployed', 'verified', 'rarity_update']
const VALID_VISIBILITY = ['private', 'workspace', 'public']
const ALLOWED_TRANSITIONS = {
  draft: ['review'],
  review: ['publish', 'draft'],
  publish: ['deployed'],
  deployed: ['verified'],
  verified: ['rarity_update'],
  rarity_update: ['publish', 'deployed'],
}

function nowIso() {
  return new Date().toISOString()
}

function normalizeStatus(value) {
  const status = String(value || '').toLowerCase().trim()
  return VALID_STATES.includes(status) ? status : 'draft'
}

function normalizeArray(value) {
  if (Array.isArray(value)) return value.map((v) => String(v || '').trim()).filter(Boolean)
  if (value == null || value === '') return []
  return [String(value).trim()]
}

function normalizeWorkspace(value) {
  const s = String(value ?? 'default').trim().toLowerCase()
  if (!s) return 'default'
  const cleaned = s.replace(/[^a-z0-9._-]/g, '-').replace(/-+/g, '-').replace(/^[-.]+|[-.]+$/g, '')
  if (!cleaned) return 'default'
  return cleaned.slice(0, 64)
}

function normalizeVisibility(value) {
  const visibility = String(value || 'private').trim().toLowerCase()
  return VALID_VISIBILITY.includes(visibility) ? visibility : 'private'
}

function normalizeSlug(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}\s_-]+/gu, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

function buildCardSeed(pack) {
  const source = `${pack.pack_id}:${pack.version}:${(pack.capabilities_json || []).join('|')}`
  return createHash('sha1').update(source).digest('hex').slice(0, 10)
}

function deriveRarity(score) {
  if (score >= 92) return 'battle-tested'
  if (score >= 80) return 'proven'
  if (score >= 60) return 'trusted'
  return 'starter'
}

function createLifecycleEntry(packId, fromState, toState, actor, notes, verifierId) {
  return {
    pack_id: packId,
    from_state: fromState,
    to_state: toState,
    actor: actor || 'operator',
    at: nowIso(),
    notes: notes || null,
    verifier_id: verifierId || null,
  }
}

function createPack(raw) {
  const name = String(raw.name || raw.card_name || 'Agent Pack')
  const slug = normalizeSlug(raw.slug || name)
  const packId = String(raw.pack_id || raw.id || `${slug}-${randomUUID().slice(0, 8)}`)
  const version = String(raw.version || '0.1.0')

  const pack = {
    pack_id: packId,
    slug,
    name,
    card_name: String(raw.card_name || name),
    card_title: String(raw.card_title || name),
    card_theme: String(raw.card_theme || 'utility'),
    card_rarity_seed: String(raw.card_rarity_seed || ''),
    card_snippet: String(raw.card_snippet || 'Et operativt samlekort med målbar værdi.'),
    version,
    status: normalizeStatus(raw.status || 'draft'),
    entrypoint: String(raw.entrypoint || 'agents/default'),
    requirements_json: normalizeArray(raw.requirements_json),
    capabilities_json: normalizeArray(raw.capabilities_json),
    attachments_json: Array.isArray(raw.attachments_json) ? raw.attachments_json : [],
    owner: String(raw.owner || 'operator'),
    workspace_id: normalizeWorkspace(raw.workspace_id),
    visibility: normalizeVisibility(raw.visibility),
    summary_md: String(raw.summary_md || raw.character_snippet || raw.card_snippet || ''),
    docs_url: raw.docs_url ? String(raw.docs_url) : null,
    source_pack_id: raw.source_pack_id ? String(raw.source_pack_id) : null,
    source_workspace_id: raw.source_workspace_id ? normalizeWorkspace(raw.source_workspace_id) : null,
    install_count: Number(raw.install_count) || 0,
    last_requested_at: raw.last_requested_at || null,
    clone_depth: Number(raw.clone_depth) || 0,
    trust_score: Number(raw.trust_score) || 0,
    rarity_tier: String(raw.rarity_tier || 'starter'),
    verification_state: String(raw.verification_state || 'not_verified'),
    rarity_label: String(raw.rarity_label || 'starter'),
    created_at: raw.created_at || nowIso(),
    updated_at: nowIso(),
    published_at: raw.published_at || null,
    deployed_at: raw.deployed_at || null,
    last_error: raw.last_error || null,
  }

  pack.card_rarity_seed = String(pack.card_rarity_seed || buildCardSeed(pack))
  pack.rarity_tier = deriveRarity(pack.trust_score)
  pack.rarity_label = pack.rarity_tier
  return pack
}

function initialPacks() {
  const createdAt = nowIso()
  return [
    createPack({
      pack_id: 'pack-health-hurtig-harald',
      slug: 'hurtig-harald',
      name: 'Health Pack',
      card_name: 'Hurtig Harald',
      card_title: 'Health Pack',
      card_theme: 'infrastruktur',
      card_snippet: 'Kører health checks på gateway og API',
      summary_md: 'Et public health-kort, der gør det nemt at se om Hermes-miljøet er deploy-klar og stabilt nok til drift.',
      docs_url: 'https://forge.hermes.local/docs/health-pack',
      attachments_json: [{ label: 'Runbook', url: 'https://forge.hermes.local/docs/health-pack/runbook' }],
      visibility: 'public',
      status: 'publish',
      entrypoint: 'agents.health.check',
      requirements_json: ['stats', 'gateway_state'],
      capabilities_json: ['ping', 'check_api', 'check_gateway', 'health_report'],
      owner: 'phase0-seed',
      trust_score: 82,
      verification_state: 'verified',
      created_at: createdAt,
      updated_at: createdAt,
      published_at: createdAt,
    }),
    createPack({
      pack_id: 'pack-config-sure-sam',
      slug: 'sure-sam',
      name: 'Config Pack',
      card_name: 'Sure Sam',
      card_title: 'Config Pack',
      card_theme: 'governance',
      card_snippet: 'Validerer og skriver config ændringer',
      summary_md: 'Et workspace-pack til governance og sikre config-ændringer, så teams kan deploye uden at miste rollback og validering.',
      docs_url: 'https://forge.hermes.local/docs/config-pack',
      attachments_json: [{ label: 'Spec', url: 'https://forge.hermes.local/docs/config-pack/spec' }],
      visibility: 'workspace',
      status: 'review',
      entrypoint: 'agents.config.apply',
      requirements_json: ['config.yaml'],
      capabilities_json: ['read_config', 'validate_config', 'apply_delta', 'rollback'],
      owner: 'phase0-seed',
      trust_score: 64,
      created_at: createdAt,
      updated_at: createdAt,
    }),
    createPack({
      pack_id: 'pack-session-session-sven',
      slug: 'session-sven',
      name: 'Session Pack',
      card_name: 'Session Sven',
      card_title: 'Session Pack',
      card_theme: 'driftsforbedring',
      card_snippet: 'Liste og vedligeholder sessionhistorik',
      summary_md: 'Et privat maintenance-pack, der holder sessioner ryddelige og giver bedre overblik over driftsaktivitet.',
      docs_url: 'https://forge.hermes.local/docs/session-pack',
      attachments_json: [{ label: 'Ops guide', url: 'https://forge.hermes.local/docs/session-pack/ops' }],
      visibility: 'private',
      status: 'draft',
      entrypoint: 'agents.session.maintenance',
      requirements_json: ['state.db'],
      capabilities_json: ['list_sessions', 'close_old_sessions', 'session_summary'],
      owner: 'phase0-seed',
      trust_score: 31,
      created_at: createdAt,
      updated_at: createdAt,
    }),
  ]
}

function defaultState() {
  const packs = initialPacks()
  return {
    schema_version: '1.3',
    updated_at: nowIso(),
    packs,
    lifecycle: packs.map((pack) => createLifecycleEntry(pack.pack_id, 'seed', pack.status, 'system', 'seeded')),
    deployments: [],
    metrics: {},
    verification_runs: [],
    requests: [],
    installs: [],
  }
}

function getState() {
  try {
    return loadForgeState()
  } catch (error) {
    console.error('[forge] Failed to load DB state, fallback to seed state', error.message)
    return defaultState()
  }
}

function saveState(state) {
  const next = { ...state, updated_at: nowIso() }
  try {
    saveForgeState(next)
  } catch (error) {
    console.error('[forge] Failed to persist state', error.message)
  }
  return next
}

function getPack(state, packId) {
  const idx = state.packs.findIndex((pack) => pack.pack_id === packId)
  return idx === -1 ? null : { pack: state.packs[idx], index: idx }
}

function collectMetrics(state, packId) {
  const raw = state.metrics?.[packId]
  if (!raw || typeof raw !== 'object') {
    return {
      pack_id: packId,
      runs: 0,
      failures: 0,
      avg_latency_ms: 0,
      trust_score: 0,
      success_rate: 0,
      last_verified_at: null,
      last_run_duration_ms: 0,
    }
  }
  return {
    pack_id: packId,
    runs: Number(raw.runs) || 0,
    failures: Number(raw.failures) || 0,
    avg_latency_ms: Number(raw.avg_latency_ms) || 0,
    trust_score: Number(raw.trust_score) || 0,
    success_rate: Number(raw.success_rate) || 0,
    last_verified_at: raw.last_verified_at || null,
    last_run_duration_ms: Number(raw.last_run_duration_ms) || 0,
  }
}

function canTransition(fromState, toState) {
  if (fromState === toState) return true
  return ALLOWED_TRANSITIONS[fromState]?.includes(toState)
}

function packSummary(pack) {
  return {
    pack_id: pack.pack_id,
    slug: pack.slug,
    name: pack.name,
    status: pack.status,
    workspace_id: pack.workspace_id || 'default',
    visibility: pack.visibility || 'private',
    card_snippet: pack.card_snippet || '',
    summary_md: pack.summary_md || '',
    docs_url: pack.docs_url || null,
    source_pack_id: pack.source_pack_id || null,
    source_workspace_id: pack.source_workspace_id || null,
    install_count: Number(pack.install_count) || 0,
    last_requested_at: pack.last_requested_at || null,
    clone_depth: Number(pack.clone_depth) || 0,
    trust_score: pack.trust_score,
    rarity_tier: pack.rarity_tier,
    verification_state: pack.verification_state,
    updated_at: pack.updated_at,
  }
}

function isCatalogEligible(pack) {
  const visibleStates = new Set(['publish', 'deployed', 'verified', 'rarity_update'])
  return pack.visibility === 'public' && visibleStates.has(pack.status)
}

function matchesQuery(pack, query) {
  if (!query) return true
  const haystack = [
    pack.pack_id,
    pack.slug,
    pack.name,
    pack.card_name,
    pack.card_title,
    pack.card_theme,
    pack.card_snippet,
    pack.summary_md,
    ...(pack.capabilities_json || []),
    ...(pack.requirements_json || []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return haystack.includes(query)
}

function sortPacks(packs, sort) {
  const list = [...packs]
  if (sort === 'name-asc') return list.sort((a, b) => a.name.localeCompare(b.name))
  if (sort === 'updated-asc') return list.sort((a, b) => String(a.updated_at || '').localeCompare(String(b.updated_at || '')))
  if (sort === 'trust-desc') return list.sort((a, b) => (b.trust_score || 0) - (a.trust_score || 0))
  if (sort === 'trust-asc') return list.sort((a, b) => (a.trust_score || 0) - (b.trust_score || 0))
  return list.sort((a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || '')))
}

function collectWorkspaceMeta(state, catalogOnly) {
  const base = catalogOnly ? state.packs.filter(isCatalogEligible) : state.packs
  const counts = new Map()
  for (const pack of base) {
    const key = pack.workspace_id || 'default'
    counts.set(key, (counts.get(key) || 0) + 1)
  }
  return [...counts.entries()]
    .map(([id, count]) => ({ id, count }))
    .sort((a, b) => a.id.localeCompare(b.id))
}

function collectRecentRequests(state, packId) {
  return (state.requests || [])
    .filter((item) => item.pack_id === packId)
    .slice(0, 20)
}

function collectRecentInstalls(state, packId) {
  return (state.installs || [])
    .filter((item) => item.source_pack_id === packId || item.installed_pack_id === packId)
    .slice(0, 20)
}

function collectVersions(state, pack) {
  const lineageRoot = pack.source_pack_id || pack.pack_id
  return state.packs
    .filter((item) => item.pack_id === lineageRoot || item.source_pack_id === lineageRoot)
    .sort((a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || '')))
    .map((item) => ({
      ...packSummary(item),
      version: item.version,
      owner: item.owner,
    }))
}

function buildDerivedDependencies(pack) {
  const dependencies = []
  for (const requirement of (pack.requirements_json || [])) {
    dependencies.push({ type: 'requirement', value: requirement })
  }
  if (pack.entrypoint) {
    dependencies.push({ type: 'entrypoint', value: pack.entrypoint })
  }
  return dependencies
}

function buildDerivedPermissions(pack) {
  const permissions = new Set()
  const entrypoint = String(pack.entrypoint || '')
  if (entrypoint.includes('config')) permissions.add('config:write')
  if (entrypoint.includes('session')) permissions.add('state:read')
  if (entrypoint.includes('health')) permissions.add('api:read')
  if ((pack.capabilities_json || []).some((item) => /rollback|apply_delta/i.test(item))) permissions.add('config:rollback')
  if ((pack.capabilities_json || []).some((item) => /close_old_sessions/i.test(item))) permissions.add('session:close')
  return [...permissions]
}

function buildInstallPreview(state, sourcePack, targetWorkspace) {
  const normalizedWorkspace = normalizeWorkspace(targetWorkspace || 'default')
  const lineageRoot = sourcePack.source_pack_id || sourcePack.pack_id
  const conflicts = state.packs.filter((item) =>
    (item.workspace_id || 'default') === normalizedWorkspace &&
    ((item.source_pack_id || item.pack_id) === lineageRoot || item.slug === sourcePack.slug)
  )

  return {
    source: {
      ...packSummary(sourcePack),
      version: sourcePack.version,
      attachments_count: Array.isArray(sourcePack.attachments_json) ? sourcePack.attachments_json.length : 0,
    },
    target_workspace_id: normalizedWorkspace,
    permissions: buildDerivedPermissions(sourcePack),
    dependencies: buildDerivedDependencies(sourcePack),
    requirements: sourcePack.requirements_json || [],
    capabilities: sourcePack.capabilities_json || [],
    conflicts: conflicts.map((item) => ({
      pack_id: item.pack_id,
      name: item.name,
      status: item.status,
      workspace_id: item.workspace_id,
      source_pack_id: item.source_pack_id || null,
    })),
    install_count: Number(sourcePack.install_count) || 0,
  }
}

function createRequestRecord(packId, sourceWorkspaceId, targetWorkspaceId, actor, notes) {
  return {
    pack_id: packId,
    source_workspace_id: sourceWorkspaceId || 'default',
    target_workspace_id: targetWorkspaceId || 'default',
    actor: actor || 'operator',
    requested_at: nowIso(),
    status: 'open',
    notes: notes || null,
  }
}

function createInstallRecord(sourcePack, installedPack, actor, mode, notes) {
  return {
    source_pack_id: sourcePack.source_pack_id || sourcePack.pack_id,
    installed_pack_id: installedPack.pack_id,
    source_workspace_id: sourcePack.source_workspace_id || sourcePack.workspace_id || 'default',
    target_workspace_id: installedPack.workspace_id || 'default',
    actor: actor || 'operator',
    installed_at: nowIso(),
    mode: mode || 'install',
    notes: notes || null,
  }
}

function createInstalledPack(sourcePack, raw = {}, mode = 'install') {
  const lineageRoot = sourcePack.source_pack_id || sourcePack.pack_id
  const sourceWorkspace = sourcePack.source_workspace_id || sourcePack.workspace_id || 'default'
  const targetWorkspace = normalizeWorkspace(raw.target_workspace_id || raw.workspace_id || 'default')
  const cloneDepth = Number(sourcePack.clone_depth || 0) + 1
  const shortId = randomUUID().slice(0, 8)
  const baseName = raw.name || sourcePack.name
  const cardName = raw.card_name || (mode === 'clone' ? `${sourcePack.card_name} Clone` : `${sourcePack.card_name} Install`)
  const slugBase = raw.slug || `${sourcePack.slug}-${targetWorkspace}-${shortId}`

  return createPack({
    ...sourcePack,
    pack_id: raw.pack_id || `${slugBase}`,
    slug: slugBase,
    name: baseName,
    card_name: cardName,
    card_title: raw.card_title || sourcePack.card_title,
    workspace_id: targetWorkspace,
    visibility: raw.visibility || 'private',
    source_pack_id: lineageRoot,
    source_workspace_id: sourceWorkspace,
    install_count: 0,
    last_requested_at: null,
    clone_depth: cloneDepth,
    status: raw.status || 'draft',
    owner: raw.actor || raw.owner || 'operator',
    summary_md: raw.summary_md || `${sourcePack.summary_md || sourcePack.card_snippet}\n\nDerived via ${mode} from ${sourcePack.card_name}.`,
  })
}

function applyVerifySim(state, pack, actor) {
  const runMs = Math.max(60, Math.floor(Math.random() * 250) + 60)
  const current = collectMetrics(state, pack.pack_id)
  const failed = Math.random() < 0.15

  const failures = current.failures + (failed ? 1 : 0)
  const runs = current.runs + 1
  const successRate = runs > 0 ? Math.round(((runs - failures) / runs) * 100) : 0
  const avgLatency = current.runs === 0 ? runMs : Math.round((current.avg_latency_ms * current.runs + runMs) / runs)
  const trustScore = Math.max(0, Math.min(100, Math.round(successRate * 0.87 + (100 - Math.min(avgLatency, 600)) * 0.13)))

  state.metrics[pack.pack_id] = {
    runs,
    failures,
    avg_latency_ms: avgLatency,
    trust_score: trustScore,
    success_rate: successRate,
    last_verified_at: nowIso(),
    last_run_duration_ms: runMs,
  }

  const logItem = {
    pack_id: pack.pack_id,
    status: failed ? 'fail' : 'pass',
    latency_ms: runMs,
    actor: actor || 'operator',
    at: nowIso(),
    trust_score: trustScore,
  }
  state.verification_runs = [logItem, ...state.verification_runs].slice(0, 300)

  pack.trust_score = trustScore
  pack.verification_state = failed ? 'failed' : 'verified'
  pack.rarity_tier = deriveRarity(trustScore)
  pack.rarity_label = pack.rarity_tier
  pack.updated_at = nowIso()
  pack.last_error = failed ? 'Simulering: midlertidig verifikationsfejl' : null
  return logItem
}

router.get('/packs', (req, res) => {
  const state = getState()
  const status = String(req.query.status || '').toLowerCase().trim()
  const workspace = String(req.query.workspace || '').trim().toLowerCase()
  const visibility = String(req.query.visibility || '').trim().toLowerCase()
  const query = String(req.query.q || '').trim().toLowerCase()
  const sort = String(req.query.sort || '').trim().toLowerCase()
  const catalog = String(req.query.catalog || '').trim().toLowerCase()
  const catalogOnly = ['1', 'true', 'yes'].includes(catalog)

  let packs = state.packs
  if (catalogOnly) {
    packs = packs.filter(isCatalogEligible)
  }
  if (workspace) {
    packs = packs.filter((pack) => (pack.workspace_id || 'default') === workspace)
  }
  if (status) {
    packs = packs.filter((pack) => pack.status === status)
  }
  if (visibility) {
    packs = packs.filter((pack) => (pack.visibility || 'private') === visibility)
  }
  if (query) {
    packs = packs.filter((pack) => matchesQuery(pack, query))
  }
  packs = sortPacks(packs, sort || (catalogOnly ? 'trust-desc' : 'updated-desc'))

  const byStatus = VALID_STATES.reduce((acc, nextStatus) => {
    acc[nextStatus] = state.packs.filter((pack) => pack.status === nextStatus).length
    return acc
  }, {})

  const filters = {}
  if (status) filters.status = status
  if (workspace) filters.workspace = workspace
  if (visibility) filters.visibility = visibility
  if (query) filters.q = query
  if (sort) filters.sort = sort
  if (catalogOnly) filters.catalog = true

  res.json({
    status: 'ok',
    source: 'forge-registry',
    updated_at: state.updated_at,
    total: packs.length,
    by_status: status || workspace || visibility || query || catalogOnly ? undefined : byStatus,
    filters: Object.keys(filters).length ? filters : null,
    workspaces: collectWorkspaceMeta(state, catalogOnly),
    packs: packs.map((pack) => ({
      ...packSummary(pack),
      card_name: pack.card_name,
      card_title: pack.card_title,
      card_theme: pack.card_theme,
      rarity_label: pack.rarity_label,
      attachments_count: Array.isArray(pack.attachments_json) ? pack.attachments_json.length : 0,
    })),
  })
})

router.get('/packs/:packId', (req, res) => {
  const state = getState()
  const found = getPack(state, req.params.packId)
  if (!found) return res.status(404).json({ status: 'error', error: 'Pack not found' })

  const recentRuns = (state.verification_runs || [])
    .filter((run) => run.pack_id === found.pack.pack_id)
    .slice(0, 20)

  res.json({
    status: 'ok',
    source: 'forge-registry',
    updated_at: state.updated_at,
    pack: {
      ...found.pack,
      metrics: collectMetrics(state, found.pack.pack_id),
    },
    metrics: collectMetrics(state, found.pack.pack_id),
    recent_runs: recentRuns,
    recent_requests: collectRecentRequests(state, found.pack.pack_id),
    recent_installs: collectRecentInstalls(state, found.pack.pack_id),
    versions: collectVersions(state, found.pack),
    lifecycle: state.lifecycle.filter((entry) => entry.pack_id === found.pack.pack_id).slice(0, 50),
    deployments: state.deployments.filter((entry) => entry.pack_id === found.pack.pack_id).slice(0, 20),
  })
})

router.get('/workspaces', (_req, res) => {
  const state = getState()
  res.json({
    status: 'ok',
    source: 'forge-registry',
    updated_at: state.updated_at,
    workspaces: collectWorkspaceMeta(state, false),
  })
})

router.get('/packs/:packId/dependencies', (req, res) => {
  const state = getState()
  const found = getPack(state, req.params.packId)
  if (!found) return res.status(404).json({ status: 'error', error: 'Pack not found' })

  res.json({
    status: 'ok',
    source: 'forge-registry',
    updated_at: state.updated_at,
    pack_id: found.pack.pack_id,
    dependencies: buildDerivedDependencies(found.pack),
    permissions: buildDerivedPermissions(found.pack),
    requirements: found.pack.requirements_json || [],
    capabilities: found.pack.capabilities_json || [],
  })
})

router.get('/packs/:packId/install-preview', (req, res) => {
  const state = getState()
  const found = getPack(state, req.params.packId)
  if (!found) return res.status(404).json({ status: 'error', error: 'Pack not found' })

  const targetWorkspace = normalizeWorkspace(req.query.workspace || req.query.target_workspace_id || 'default')
  res.json({
    status: 'ok',
    source: 'forge-registry',
    updated_at: state.updated_at,
    preview: buildInstallPreview(state, found.pack, targetWorkspace),
  })
})

router.post('/packs', (req, res) => {
  const state = getState()
  const payload = req.body || {}
  const candidate = createPack(payload)
  if (state.packs.find((pack) => pack.pack_id === candidate.pack_id)) {
    return res.status(409).json({ status: 'error', error: `Pack exists: ${candidate.pack_id}` })
  }
  if (state.packs.find((pack) =>
    pack.card_name === candidate.card_name &&
    pack.card_theme === candidate.card_theme &&
    pack.slug === candidate.slug &&
    (pack.workspace_id || 'default') === (candidate.workspace_id || 'default') &&
    pack.status !== 'draft'
  )) {
    return res.status(409).json({
      status: 'error',
      error: `Duplicate card identity: ${candidate.card_name} / ${candidate.card_theme} (workspace ${candidate.workspace_id || 'default'})`,
    })
  }

  state.packs.push(candidate)
  state.lifecycle.push(createLifecycleEntry(candidate.pack_id, 'seed', candidate.status, payload.actor || 'operator', 'register'))
  const next = saveState(state)
  res.status(201).json({
    status: 'ok',
    source: 'forge-registry',
    updated_at: next.updated_at,
    pack: packSummary(candidate),
  })
})

router.post('/packs/:packId/lifecycle', (req, res) => {
  const state = getState()
  const found = getPack(state, req.params.packId)
  if (!found) return res.status(404).json({ status: 'error', error: 'Pack not found' })

  const requested = req.body?.to_state || req.body?.to || req.body?.state
  if (!requested) return res.status(400).json({ status: 'error', error: 'to_state is required' })
  const target = normalizeStatus(requested)
  if (!canTransition(found.pack.status, target)) {
    return res.status(409).json({
      status: 'error',
      error: `Invalid transition ${found.pack.status} -> ${target}`,
      allowed: ALLOWED_TRANSITIONS[found.pack.status] || [],
    })
  }

  const previous = found.pack.status
  found.pack.status = target
  found.pack.updated_at = nowIso()
  if (target === 'publish') found.pack.published_at = nowIso()
  if (target === 'deployed') found.pack.deployed_at = nowIso()
  state.lifecycle.push(createLifecycleEntry(found.pack.pack_id, previous, target, req.body?.actor, req.body?.notes, req.body?.verifier_id))
  const next = saveState(state)

  res.json({
    status: 'ok',
    source: 'forge-registry',
    updated_at: next.updated_at,
    pack: packSummary(found.pack),
    transition: {
      from: previous,
      to: target,
    },
  })
})

router.post('/packs/:packId/deploy', (req, res) => {
  const state = getState()
  const found = getPack(state, req.params.packId)
  if (!found) return res.status(404).json({ status: 'error', error: 'Pack not found' })

  const actor = String(req.body?.actor || 'operator')
  const env = String(req.body?.env || req.body?.environment || 'default')
  const agentId = String(req.body?.agent_id || req.body?.agentId || found.pack.pack_id)

  const deployRecord = {
    pack_id: found.pack.pack_id,
    env,
    deployed_at: nowIso(),
    agent_id: agentId,
    status: 'running',
    runtime_notes: String(req.body?.runtime_notes || ''),
    actor,
  }

  const previous = found.pack.status
  found.pack.status = 'deployed'
  found.pack.deployed_at = deployRecord.deployed_at
  found.pack.updated_at = nowIso()
  state.deployments.unshift(deployRecord)
  state.deployments = state.deployments.slice(0, 200)
  state.lifecycle.push(createLifecycleEntry(found.pack.pack_id, previous, 'deployed', actor, `deploy:${env}`))

  const next = saveState(state)
  res.json({
    status: 'ok',
    source: 'forge-registry',
    updated_at: next.updated_at,
    pack: packSummary(found.pack),
    deployment: deployRecord,
  })
})

router.post('/packs/:packId/verify', (req, res) => {
  const state = getState()
  const found = getPack(state, req.params.packId)
  if (!found) return res.status(404).json({ status: 'error', error: 'Pack not found' })

  const actor = String(req.body?.actor || 'operator')
  const previous = found.pack.status
  const verification = applyVerifySim(state, found.pack, actor)
  if (verification.status === 'pass' && found.pack.status !== 'verified') {
    found.pack.status = 'verified'
    state.lifecycle.push(createLifecycleEntry(found.pack.pack_id, previous, 'verified', actor, 'verification passed'))
  }
  if (verification.status !== 'pass' && found.pack.status === 'verified') {
    found.pack.status = 'deployed'
    state.lifecycle.push(createLifecycleEntry(found.pack.pack_id, 'verified', 'deployed', actor, 'verification failed'))
  }
  const next = saveState(state)

  res.json({
    status: 'ok',
    source: 'forge-registry',
    updated_at: next.updated_at,
    verification,
    pack: {
      ...packSummary(found.pack),
      verification_state: found.pack.verification_state,
      rarity_tier: found.pack.rarity_tier,
      rarity_label: found.pack.rarity_label,
      trust_score: found.pack.trust_score,
    },
  })
})

router.get('/packs/:packId/metrics', (req, res) => {
  const state = getState()
  const found = getPack(state, req.params.packId)
  if (!found) return res.status(404).json({ status: 'error', error: 'Pack not found' })

  res.json({
    status: 'ok',
    source: 'forge-registry',
    updated_at: state.updated_at,
    pack_id: found.pack.pack_id,
    metrics: collectMetrics(state, found.pack.pack_id),
    recent_runs: state.verification_runs.filter((run) => run.pack_id === found.pack.pack_id).slice(0, 10),
  })
})

router.get('/packs/:packId/logs', (req, res) => {
  const state = getState()
  const found = getPack(state, req.params.packId)
  if (!found) return res.status(404).json({ status: 'error', error: 'Pack not found' })

  const logs = state.verification_runs
    .filter((run) => run.pack_id === found.pack.pack_id)
    .slice(0, 50)
  res.json({
    status: 'ok',
    source: 'forge-registry',
    updated_at: state.updated_at,
    pack_id: found.pack.pack_id,
    logs,
  })
})

router.post('/packs/:packId/request', (req, res) => {
  const state = getState()
  const found = getPack(state, req.params.packId)
  if (!found) return res.status(404).json({ status: 'error', error: 'Pack not found' })
  if (!isCatalogEligible(found.pack)) {
    return res.status(409).json({ status: 'error', error: 'Pack is not available in catalog' })
  }

  const targetWorkspace = normalizeWorkspace(req.body?.target_workspace_id || req.body?.workspace_id || 'default')
  const sourceWorkspace = normalizeWorkspace(found.pack.workspace_id || 'default')
  const actor = String(req.body?.actor || 'operator')
  const notes = req.body?.notes ? String(req.body.notes) : null

  const existing = (state.requests || []).find((item) =>
    item.pack_id === found.pack.pack_id &&
    item.target_workspace_id === targetWorkspace &&
    item.status === 'open'
  )
  if (existing) {
    return res.status(409).json({ status: 'error', error: `Open request already exists for workspace ${targetWorkspace}` })
  }

  const request = createRequestRecord(found.pack.pack_id, sourceWorkspace, targetWorkspace, actor, notes)
  found.pack.last_requested_at = request.requested_at
  found.pack.updated_at = nowIso()
  state.requests = [request, ...(state.requests || [])].slice(0, 500)
  const next = saveState(state)
  res.status(201).json({
    status: 'ok',
    source: 'forge-registry',
    updated_at: next.updated_at,
    request,
    pack: packSummary(found.pack),
  })
})

router.post('/packs/:packId/install', (req, res) => {
  const state = getState()
  const found = getPack(state, req.params.packId)
  if (!found) return res.status(404).json({ status: 'error', error: 'Pack not found' })
  if (!isCatalogEligible(found.pack)) {
    return res.status(409).json({ status: 'error', error: 'Pack is not installable from catalog' })
  }

  const actor = String(req.body?.actor || 'operator')
  const targetWorkspace = normalizeWorkspace(req.body?.target_workspace_id || req.body?.workspace_id || 'default')
  const preview = buildInstallPreview(state, found.pack, targetWorkspace)
  const installedPack = createInstalledPack(found.pack, { ...req.body, target_workspace_id: targetWorkspace, actor }, 'install')
  const installRecord = createInstallRecord(found.pack, installedPack, actor, 'install', req.body?.notes ? String(req.body.notes) : null)

  found.pack.install_count = Number(found.pack.install_count || 0) + 1
  found.pack.last_requested_at = installRecord.installed_at
  found.pack.updated_at = nowIso()
  state.packs.push(installedPack)
  state.lifecycle.push(createLifecycleEntry(installedPack.pack_id, 'seed', installedPack.status, actor, `install:${targetWorkspace}`))
  state.installs = [installRecord, ...(state.installs || [])].slice(0, 500)
  const next = saveState(state)

  res.status(201).json({
    status: 'ok',
    source: 'forge-registry',
    updated_at: next.updated_at,
    source_pack: packSummary(found.pack),
    installed_pack: {
      ...packSummary(installedPack),
      version: installedPack.version,
    },
    preview,
    install: installRecord,
  })
})

router.post('/packs/:packId/clone', (req, res) => {
  const state = getState()
  const found = getPack(state, req.params.packId)
  if (!found) return res.status(404).json({ status: 'error', error: 'Pack not found' })

  const actor = String(req.body?.actor || 'operator')
  const targetWorkspace = normalizeWorkspace(req.body?.target_workspace_id || req.body?.workspace_id || found.pack.workspace_id || 'default')
  const clonedPack = createInstalledPack(found.pack, { ...req.body, target_workspace_id: targetWorkspace, actor }, 'clone')
  const installRecord = createInstallRecord(found.pack, clonedPack, actor, 'clone', req.body?.notes ? String(req.body.notes) : null)

  found.pack.install_count = Number(found.pack.install_count || 0) + 1
  found.pack.updated_at = nowIso()
  state.packs.push(clonedPack)
  state.lifecycle.push(createLifecycleEntry(clonedPack.pack_id, 'seed', clonedPack.status, actor, `clone:${targetWorkspace}`))
  state.installs = [installRecord, ...(state.installs || [])].slice(0, 500)
  const next = saveState(state)

  res.status(201).json({
    status: 'ok',
    source: 'forge-registry',
    updated_at: next.updated_at,
    source_pack: packSummary(found.pack),
    cloned_pack: {
      ...packSummary(clonedPack),
      version: clonedPack.version,
    },
    clone: installRecord,
  })
})

router.get('/packs/:packId/versions', (req, res) => {
  const state = getState()
  const found = getPack(state, req.params.packId)
  if (!found) return res.status(404).json({ status: 'error', error: 'Pack not found' })

  res.json({
    status: 'ok',
    source: 'forge-registry',
    updated_at: state.updated_at,
    pack_id: found.pack.pack_id,
    versions: collectVersions(state, found.pack),
  })
})

router.get('/metrics', (req, res) => {
  const state = getState()
  const payload = state.packs.reduce((acc, pack) => {
    acc[pack.pack_id] = collectMetrics(state, pack.pack_id)
    return acc
  }, {})
  res.json({
    status: 'ok',
    source: 'forge-registry',
    updated_at: state.updated_at,
    metrics: payload,
  })
})

export default router
