import Table from 'cli-table3'
import { log, header, json } from '../lib/logger.js'
import { withSpinner } from '../lib/exec.js'
import { buildCommandResult } from '../lib/command-result.js'
import { readFileSync, existsSync } from 'fs'

const FORGE_BASE = 'http://localhost:5174/api/forge'

async function httpFetch(path, options = {}) {
  const controller = new AbortController()
  const timeoutMs = Number(options.timeout || 12000)
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(`${FORGE_BASE}${path}`, {
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
      ...options,
    })
    clearTimeout(timer)

    const text = await response.text()
    const payload = text ? JSON.parse(text) : {}
    return {
      ok: response.ok,
      status: response.status,
      payload,
    }
  } catch (error) {
    clearTimeout(timer)
    return {
      ok: false,
      status: 0,
      payload: { status: 'error', error: error.message || 'Network error' },
    }
  }
}

function commaList(value) {
  if (!value) return []
  if (Array.isArray(value)) return value
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function buildListQuery(status, workspace, options = {}) {
  const p = new URLSearchParams()
  if (status) p.set('status', status)
  if (workspace) p.set('workspace', workspace)
  if (options.visibility) p.set('visibility', options.visibility)
  if (options.q) p.set('q', options.q)
  if (options.sort) p.set('sort', options.sort)
  if (options.catalog) p.set('catalog', '1')
  const s = p.toString()
  return s ? `?${s}` : ''
}

async function listPacks(status, workspace, options, jsonMode) {
  const endpoint = `/packs${buildListQuery(status, workspace, options)}`
  const result = await withSpinner('Loading forge packs...', { json: jsonMode }, () =>
    httpFetch(endpoint),
  )

  if (!result.ok) {
    throw new Error(result.payload?.error || `List failed with HTTP ${result.status}`)
  }

  if (jsonMode) return json(result.payload)

  const packs = result.payload?.packs || []
  const headerLine = status ? `Forge Packs [${status}]` : 'Forge Packs'
  const table = new Table({
    head: ['Pack ID', 'Workspace', 'Card', 'Theme', 'Status', 'Trust', 'Rarity'],
    style: { head: [] },
  })

  for (const pack of packs) {
    table.push([
      pack.pack_id,
      pack.workspace_id || 'default',
      pack.card_name || pack.name,
      pack.card_theme || 'utility',
      pack.status,
      pack.trust_score ?? 0,
      pack.rarity_label || pack.rarity_tier || 'starter',
    ])
  }

  header(headerLine)
  log.info(table.toString())
  log.info(`Total: ${result.payload?.total ?? packs.length}`)
}

async function showPack(packId, jsonMode) {
  const result = await withSpinner(`Loading pack ${packId}...`, { json: jsonMode }, () =>
    httpFetch(`/packs/${encodeURIComponent(packId)}`),
  )
  if (!result.ok) {
    throw new Error(result.payload?.error || `Show failed with HTTP ${result.status}`)
  }
  if (jsonMode) return json(result.payload)

  const pack = result.payload.pack || {}
  const metrics = pack.metrics || {}
  const history = result.payload.lifecycle || []
  const summary = [
    ['Pack ID', pack.pack_id],
    ['Workspace', pack.workspace_id || 'default'],
    ['Name', pack.name],
    ['Card', pack.card_name],
    ['Theme', pack.card_theme],
    ['Visibility', pack.visibility || 'private'],
    ['Version', pack.version],
    ['Status', pack.status],
    ['Docs', pack.docs_url || '—'],
    ['Trust', pack.trust_score],
    ['Rarity', pack.rarity_tier],
    ['Verification', pack.verification_state],
    ['Runs', metrics.runs || 0],
    ['Failures', metrics.failures || 0],
    ['Avg latency', `${metrics.avg_latency_ms || 0}ms`],
    ['Success rate', `${metrics.success_rate || 0}%`],
    ['Last updated', pack.updated_at || '—'],
  ]
  header(`Pack ${pack.pack_id}`)
  const detail = new Table({ head: ['Field', 'Value'], style: { head: [] } })
  summary.forEach((row) => detail.push(row))
  log.info(detail.toString())

  const timeline = new Table({
    head: ['When', 'From', 'To', 'Actor', 'Notes'],
    style: { head: [] },
  })
  history.slice(0, 10).forEach((entry) => {
    timeline.push([
      entry.at || '—',
      entry.from_state || '—',
      entry.to_state || '—',
      entry.actor || '—',
      entry.notes || '—',
    ])
  })
  log.dim('\nLifecycle')
  if (history.length) {
    log.info(timeline.toString())
  } else {
    log.info('  no lifecycle events yet')
  }
  return result.payload
}

async function registerPack(opts, jsonMode, targetId = null) {
  const body = {
    ...opts.payloadObject || {},
    pack_id: targetId || opts.packId || undefined,
    name: opts.name,
    card_name: opts.cardName,
    card_title: opts.cardTitle,
    card_theme: opts.cardTheme,
    slug: opts.slug,
    entrypoint: opts.entrypoint,
    requirements_json: commaList(opts.requirements),
    capabilities_json: commaList(opts.capabilities),
    status: opts.initialStatus,
    owner: opts.owner || 'operator',
    workspace_id: opts.workspace,
    visibility: opts.visibility,
    summary_md: opts.summary,
    docs_url: opts.docsUrl,
  }

  Object.keys(body).forEach((key) => {
    if (body[key] === undefined || body[key] === null || body[key] === '') delete body[key]
  })

  if (Object.keys(body).length === 0) {
    throw new Error('No pack payload provided. Use --payload, --name, or --card-name')
  }

  const result = await withSpinner('Registering pack...', { json: jsonMode }, () =>
    httpFetch('/packs', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  )
  if (!result.ok) {
    throw new Error(result.payload?.error || `Register failed with HTTP ${result.status}`)
  }
  if (jsonMode) return json(result.payload)
  log.dim('\nRegistered')
  log.info(`  Pack ID: ${result.payload?.pack?.pack_id}`)
  return result.payload
}

async function setLifecycle(packId, toState, jsonMode, opts) {
  if (!toState) throw new Error('Missing --to-state')
  const body = {
    to_state: toState,
    actor: opts.actor,
    notes: opts.notes,
    verifier_id: opts.verifier,
  }
  const result = await withSpinner(`Updating lifecycle: ${packId} -> ${toState}`, { json: jsonMode }, () =>
    httpFetch(`/packs/${encodeURIComponent(packId)}/lifecycle`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  )
  if (!result.ok) {
    throw new Error(result.payload?.error || `Lifecycle failed with HTTP ${result.status}`)
  }
  if (jsonMode) return json(result.payload)
  const transition = result.payload?.transition || {}
  log.info(`  ${packId}: ${transition.from} -> ${transition.to}`)
  return result.payload
}

async function deployPack(packId, jsonMode, opts) {
  const result = await withSpinner(`Deploying pack ${packId}...`, { json: jsonMode }, () =>
    httpFetch(`/packs/${encodeURIComponent(packId)}/deploy`, {
      method: 'POST',
      body: JSON.stringify({
        env: opts.environment,
        agent_id: opts.agentId,
        actor: opts.actor,
        runtime_notes: opts.runtimeNotes,
      }),
    }),
  )
  if (!result.ok) {
    throw new Error(result.payload?.error || `Deploy failed with HTTP ${result.status}`)
  }
  if (jsonMode) return json(result.payload)
  const deployment = result.payload?.deployment || {}
  log.info(`  Running in env: ${deployment.env}`)
  log.info(`  Agent ID: ${deployment.agent_id}`)
  return result.payload
}

async function verifyPack(packId, jsonMode, opts) {
  const result = await withSpinner(`Verifying pack ${packId}...`, { json: jsonMode }, () =>
    httpFetch(`/packs/${encodeURIComponent(packId)}/verify`, {
      method: 'POST',
      body: JSON.stringify({
        actor: opts.actor,
      }),
    }),
  )
  if (!result.ok) {
    throw new Error(result.payload?.error || `Verify failed with HTTP ${result.status}`)
  }
  if (jsonMode) return json(result.payload)
  const verification = result.payload?.verification || {}
  log.info(`  status: ${verification.status}`)
  log.info(`  trust: ${verification.trust_score}`)
  log.info(`  rarity: ${result.payload?.pack?.rarity_tier}`)
  return result.payload
}

async function showMetrics(packId, jsonMode) {
  const path = packId ? `/packs/${encodeURIComponent(packId)}/metrics` : '/metrics'
  const result = await withSpinner('Loading metrics...', { json: jsonMode }, () => httpFetch(path))
  if (!result.ok) {
    throw new Error(result.payload?.error || `Metrics failed with HTTP ${result.status}`)
  }
  if (jsonMode) return json(result.payload)

  if (packId) {
    const metrics = result.payload?.metrics || {}
    const rows = ['pack_id', 'runs', 'failures', 'success_rate', 'avg_latency_ms', 'trust_score', 'last_verified_at']
    const table = new Table({
      head: ['Metric', 'Value'],
      style: { head: [] },
    })
    rows.forEach((row) => {
      table.push([row, metrics[row] ?? '—'])
    })
    header(`Pack Metrics (${packId})`)
    log.info(table.toString())
    return result.payload
  }

  const metrics = result.payload?.metrics || {}
  const entries = Object.entries(metrics)
  const table = new Table({
    head: ['Pack ID', 'Runs', 'Failures', 'Success', 'Latency', 'Trust'],
    style: { head: [] },
  })
  entries.forEach(([packIdKey, value]) => {
    table.push([
      packIdKey,
      value.runs || 0,
      value.failures || 0,
      `${value.success_rate || 0}%`,
      `${value.avg_latency_ms || 0}ms`,
      value.trust_score || 0,
    ])
  })
  header('Forge Metrics')
  log.info(table.toString())
  return result.payload
}

async function showLogs(packId, jsonMode) {
  if (!packId) throw new Error('Missing pack id')
  const result = await withSpinner('Loading logs...', { json: jsonMode }, () =>
    httpFetch(`/packs/${encodeURIComponent(packId)}/logs`)
  )
  if (!result.ok) {
    throw new Error(result.payload?.error || `Logs failed with HTTP ${result.status}`)
  }
  if (jsonMode) return json(result.payload)

  const logs = result.payload?.logs || []
  const table = new Table({
    head: ['At', 'Status', 'Actor', 'Trust'],
    style: { head: [] },
  })
  logs.forEach((item) => {
    table.push([
      item.at || '—',
      item.status || '—',
      item.actor || '—',
      item.trust_score ?? 0,
    ])
  })
  header(`Pack Logs (${packId})`)
  if (logs.length) {
    log.info(table.toString())
  } else {
    log.info('  no logs')
  }
  return result.payload
}

async function showInstallPreview(packId, jsonMode, opts) {
  if (!packId) throw new Error('Missing pack id')
  const params = new URLSearchParams()
  if (opts.workspace) params.set('workspace', opts.workspace)
  const suffix = params.toString() ? `?${params.toString()}` : ''
  const result = await withSpinner(`Loading install preview for ${packId}...`, { json: jsonMode }, () =>
    httpFetch(`/packs/${encodeURIComponent(packId)}/install-preview${suffix}`)
  )
  if (!result.ok) {
    throw new Error(result.payload?.error || `Install preview failed with HTTP ${result.status}`)
  }
  if (jsonMode) return json(result.payload)

  const preview = result.payload?.preview || {}
  const summary = new Table({ head: ['Field', 'Value'], style: { head: [] } })
  summary.push(['Source pack', preview.source?.pack_id || packId])
  summary.push(['Target workspace', preview.target_workspace_id || opts.workspace || 'default'])
  summary.push(['Install count', preview.install_count ?? 0])
  summary.push(['Conflicts', (preview.conflicts || []).length])
  header(`Install Preview (${packId})`)
  log.info(summary.toString())

  const permissions = preview.permissions || []
  if (permissions.length) {
    log.dim('\nPermissions')
    permissions.forEach((item) => log.info(`  - ${item}`))
  }
  const dependencies = preview.dependencies || []
  if (dependencies.length) {
    log.dim('\nDependencies')
    dependencies.forEach((item) => log.info(`  - ${item.type}: ${item.value}`))
  }
  return result.payload
}

async function installPack(packId, jsonMode, opts) {
  if (!packId) throw new Error('Missing pack id')
  const result = await withSpinner(`Installing pack ${packId}...`, { json: jsonMode }, () =>
    httpFetch(`/packs/${encodeURIComponent(packId)}/install`, {
      method: 'POST',
      body: JSON.stringify({
        actor: opts.actor,
        target_workspace_id: opts.workspace,
        visibility: opts.visibility,
        notes: opts.notes,
      }),
    }),
  )
  if (!result.ok) {
    throw new Error(result.payload?.error || `Install failed with HTTP ${result.status}`)
  }
  if (jsonMode) return json(result.payload)
  log.info(`  Installed as: ${result.payload?.installed_pack?.pack_id}`)
  log.info(`  Workspace: ${result.payload?.installed_pack?.workspace_id || opts.workspace || 'default'}`)
  return result.payload
}

async function clonePack(packId, jsonMode, opts) {
  if (!packId) throw new Error('Missing pack id')
  const result = await withSpinner(`Cloning pack ${packId}...`, { json: jsonMode }, () =>
    httpFetch(`/packs/${encodeURIComponent(packId)}/clone`, {
      method: 'POST',
      body: JSON.stringify({
        actor: opts.actor,
        target_workspace_id: opts.workspace,
        visibility: opts.visibility,
        notes: opts.notes,
        name: opts.name,
        card_name: opts.cardName,
      }),
    }),
  )
  if (!result.ok) {
    throw new Error(result.payload?.error || `Clone failed with HTTP ${result.status}`)
  }
  if (jsonMode) return json(result.payload)
  log.info(`  Clone created: ${result.payload?.cloned_pack?.pack_id}`)
  log.info(`  Workspace: ${result.payload?.cloned_pack?.workspace_id || opts.workspace || 'default'}`)
  return result.payload
}

async function showDependencies(packId, jsonMode) {
  if (!packId) throw new Error('Missing pack id')
  const result = await withSpinner(`Loading dependencies for ${packId}...`, { json: jsonMode }, () =>
    httpFetch(`/packs/${encodeURIComponent(packId)}/dependencies`)
  )
  if (!result.ok) {
    throw new Error(result.payload?.error || `Dependencies failed with HTTP ${result.status}`)
  }
  if (jsonMode) return json(result.payload)
  const table = new Table({ head: ['Type', 'Value'], style: { head: [] } })
  ;(result.payload?.dependencies || []).forEach((item) => {
    table.push([item.type || 'unknown', item.value || '—'])
  })
  header(`Dependencies (${packId})`)
  if (table.length) {
    log.info(table.toString())
  } else {
    log.info('  no dependencies')
  }
  const permissions = result.payload?.permissions || []
  if (permissions.length) {
    log.dim('\nPermissions')
    permissions.forEach((item) => log.info(`  - ${item}`))
  }
  return result.payload
}

async function showVersions(packId, jsonMode) {
  if (!packId) throw new Error('Missing pack id')
  const result = await withSpinner(`Loading versions for ${packId}...`, { json: jsonMode }, () =>
    httpFetch(`/packs/${encodeURIComponent(packId)}/versions`)
  )
  if (!result.ok) {
    throw new Error(result.payload?.error || `Versions failed with HTTP ${result.status}`)
  }
  if (jsonMode) return json(result.payload)
  const table = new Table({ head: ['Pack ID', 'Workspace', 'Version', 'Status', 'Lineage'], style: { head: [] } })
  ;(result.payload?.versions || []).forEach((item) => {
    table.push([
      item.pack_id,
      item.workspace_id || 'default',
      item.version || '0.1.0',
      item.status || 'draft',
      item.source_pack_id || 'root',
    ])
  })
  header(`Versions (${packId})`)
  log.info(table.toString())
  return result.payload
}

async function listWorkspaces(jsonMode) {
  const result = await withSpinner('Loading forge workspaces...', { json: jsonMode }, () =>
    httpFetch('/workspaces')
  )
  if (!result.ok) {
    throw new Error(result.payload?.error || `Workspace listing failed with HTTP ${result.status}`)
  }
  if (jsonMode) return json(result.payload)
  const table = new Table({ head: ['Workspace', 'Packs'], style: { head: [] } })
  ;(result.payload?.workspaces || []).forEach((item) => table.push([item.id, item.count]))
  header('Forge Workspaces')
  log.info(table.toString())
  return result.payload
}

function parsePayload(value) {
  if (!value) return null
  try {
    return JSON.parse(value)
  } catch (error) {
    throw new Error(`Invalid JSON payload: ${error.message}`)
  }
}

function parsePayloadFromFile(filePath) {
  if (!filePath) return null
  if (!existsSync(filePath)) {
    throw new Error(`Payload file not found: ${filePath}`)
  }
  try {
    const raw = readFileSync(filePath, 'utf8')
    return JSON.parse(raw)
  } catch (error) {
    throw new Error(`Invalid payload file ${filePath}: ${error.message}`)
  }
}

export default async function pack(action = 'list', target = null, opts = {}) {
  const commandResult = buildCommandResult({ command: 'pack', status: 'ok', payload: {} })

  try {
    const jsonMode = !!opts.json
    const actionName = String(action || 'list')
    const targetId = target || opts.packId || null

    if (actionName === 'list') {
      await listPacks(opts.status, opts.workspace, {
        visibility: opts.visibility,
        q: opts.query,
        sort: opts.sort,
        catalog: opts.catalog,
      }, jsonMode)
      return commandResult
    }

    if (actionName === 'show') {
      if (!targetId) throw new Error('Missing pack id')
      await showPack(targetId, jsonMode)
      return commandResult
    }

    if (actionName === 'register') {
      const payloadObject = opts.file ? parsePayloadFromFile(opts.file) : (opts.payload ? parsePayload(opts.payload) : null)
      await registerPack({ ...opts, payloadObject }, jsonMode, targetId)
      return commandResult
    }

    if (actionName === 'lifecycle') {
      if (!targetId) throw new Error('Missing pack id')
      await setLifecycle(targetId, opts.toState, jsonMode, opts)
      return commandResult
    }

    if (actionName === 'deploy') {
      if (!targetId) throw new Error('Missing pack id')
      await deployPack(targetId, jsonMode, opts)
      return commandResult
    }

    if (actionName === 'verify') {
      if (!targetId) throw new Error('Missing pack id')
      await verifyPack(targetId, jsonMode, opts)
      return commandResult
    }

    if (actionName === 'preview') {
      if (!targetId) throw new Error('Missing pack id')
      await showInstallPreview(targetId, jsonMode, opts)
      return commandResult
    }

    if (actionName === 'install') {
      if (!targetId) throw new Error('Missing pack id')
      await installPack(targetId, jsonMode, opts)
      return commandResult
    }

    if (actionName === 'clone') {
      if (!targetId) throw new Error('Missing pack id')
      await clonePack(targetId, jsonMode, opts)
      return commandResult
    }

    if (actionName === 'dependencies') {
      if (!targetId) throw new Error('Missing pack id')
      await showDependencies(targetId, jsonMode)
      return commandResult
    }

    if (actionName === 'versions') {
      if (!targetId) throw new Error('Missing pack id')
      await showVersions(targetId, jsonMode)
      return commandResult
    }

    if (actionName === 'workspaces') {
      await listWorkspaces(jsonMode)
      return commandResult
    }

    if (actionName === 'metrics') {
      await showMetrics(targetId, jsonMode)
      return commandResult
    }

    if (actionName === 'logs') {
      await showLogs(targetId, jsonMode)
      return commandResult
    }

    if (jsonMode) {
      json({
        ...commandResult,
        status: 'error',
        ok: false,
        error: { message: `action "${actionName}" is not supported` },
      })
      process.exit(2)
      return
    }

    log.error('Unknown action')
    log.error(`Reason: action "${actionName}" is not supported`)
    log.error('Action: use one of list, show, register, lifecycle, deploy, verify, preview, install, clone, dependencies, versions, workspaces, metrics, logs')
    process.exit(2)
  } catch (error) {
    if (opts.json) {
      json({
        ...commandResult,
        status: 'error',
        ok: false,
        error: { message: error.message },
      })
      process.exit(2)
      return
    }
    log.error('Command failed')
    log.error(`Reason: ${error.message}`)
    log.error('Action: review command input and try again')
    process.exit(1)
  }
}
