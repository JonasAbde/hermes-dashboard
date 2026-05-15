import { useMemo, useState, useCallback } from 'react'
import { Package, RefreshCw, Activity, Play, RotateCw, FileCheck, Send, FileText, X, Search, ExternalLink, ShoppingBag, Eye, Download, Copy, Layers } from 'lucide-react'
import { clsx } from 'clsx'
import { usePoll } from '../../hooks/useApi.ts'
import { apiFetch } from '../../utils/auth.ts'
import { Card } from '../ui/Card'
import { Chip } from '../ui/Chip'

const LIFECYCLE_TRANSITIONS = {
  draft: ['review'],
  review: ['publish', 'draft'],
  publish: ['deployed'],
  deployed: ['verified'],
  verified: ['rarity_update'],
  rarity_update: ['publish', 'deployed'],
}

function normalizeStatus(value) {
  return String(value || 'draft').toLowerCase().replace(/_/g, ' ')
}

function statusVariant(value) {
  const status = normalizeStatus(value).replace(/\s+/g, ' ').trim()
  if (status === 'verified' || status === 'deployed' || status === 'publish') return 'online'
  if (status === 'review' || status === 'rarity update') return 'pending'
  return 'offline'
}

function prettyStatus(value) {
  return String(value || 'draft')
    .split('_')
    .join(' ')
    .replace(/\b\w/g, (match) => match.toUpperCase())
}

function visibilityVariant(value) {
  const visibility = String(value || 'private').toLowerCase()
  if (visibility === 'public') return 'online'
  if (visibility === 'workspace') return 'pending'
  return 'model'
}

function prettyVisibility(value) {
  const visibility = String(value || 'private').toLowerCase()
  if (visibility === 'public') return 'Public'
  if (visibility === 'workspace') return 'Workspace'
  return 'Private'
}

function formatAt(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch {
    return '—'
  }
}

function ListSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3">
      {[1, 2].map((i) => (
        <div key={i} className="rounded-lg border border-border bg-surface p-3 animate-pulse">
          <div className="h-4 w-3/5 bg-white/[0.05] rounded mb-2" />
          <div className="h-3 w-1/2 bg-white/[0.05] rounded mb-2" />
          <div className="h-3 w-1/3 bg-white/[0.05] rounded" />
        </div>
      ))}
    </div>
  )
}

function ArrayList({ title, items }) {
  if (!Array.isArray(items) || items.length === 0) {
    return (
      <div className="text-t3 text-xs">
        <span className="font-semibold">{title}:</span> —
      </div>
    )
  }

  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-t3 mb-1">{title}</div>
      <ul className="list-disc list-inside space-y-1 text-xs text-t2">
        {items.map((item, index) => (
          <li key={`${title}-${index}`}>{String(item)}</li>
        ))}
      </ul>
    </div>
  )
}

function EventRow({ item }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-white/[0.04] px-2 py-1.5 text-xs">
      <Chip variant="model">{item.at ? formatAt(item.at) : '—'}</Chip>
      <div className="text-t3 flex-1">{item.from_state || '—'} → {item.to_state || '—'}</div>
      <div className="text-t2">{item.actor || 'operator'}</div>
      <div className="text-t3">{item.notes || '—'}</div>
    </div>
  )
}

/**
 * @param {{ hideTopHeader?: boolean, defaultCatalog?: boolean }} props
 * When true (e.g. on /forge page with PagePrimer), omits duplicate title row but keeps sync + refresh.
 */
export default function OperationsForgeTab({ hideTopHeader = false, defaultCatalog = false } = {}) {
  const [workspaceFilter, setWorkspaceFilter] = useState('')
  const [query, setQuery] = useState('')
  const [visibilityFilter, setVisibilityFilter] = useState('')
  const [sortOrder, setSortOrder] = useState(defaultCatalog ? 'trust-desc' : 'updated-desc')
  const [catalogOnly, setCatalogOnly] = useState(defaultCatalog)
  const listPath = useMemo(() => {
    const p = new URLSearchParams()
    if (workspaceFilter) p.set('workspace', workspaceFilter)
    if (query) p.set('q', query)
    if (visibilityFilter) p.set('visibility', visibilityFilter)
    if (sortOrder) p.set('sort', sortOrder)
    if (catalogOnly) p.set('catalog', '1')
    const s = p.toString()
    return s ? `/forge/packs?${s}` : '/forge/packs'
  }, [workspaceFilter, query, visibilityFilter, sortOrder, catalogOnly])

  const { data, loading, error, lastUpdated, refetch } = usePoll(listPath, 10000)
  const [selectedPackId, setSelectedPackId] = useState(null)
  const [selectedPack, setSelectedPack] = useState(null)
  const [selectedLoading, setSelectedLoading] = useState(false)
  const [actionBusy, setActionBusy] = useState('')
  const [feedback, setFeedback] = useState(null)
  const [logs, setLogs] = useState([])
  const [logsLoading, setLogsLoading] = useState(false)
  const [preview, setPreview] = useState(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  const packs = useMemo(() => data?.packs || [], [data])
  const workspaceOptions = useMemo(() => data?.workspaces || [], [data])

  async function loadPackDetails(packId, options = {}) {
    if (!packId) return
    setSelectedLoading(true)
    try {
      const res = await apiFetch(`/api/forge/packs/${encodeURIComponent(packId)}`, {
        method: 'GET',
        ...(options?.signal ? { signal: options.signal } : {}),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(payload?.error || `Failed to load pack ${packId}`)
      }
      setSelectedPack(payload)
      setFeedback({ type: 'ok', text: `Pack ${packId} genindlæst` })
      setTimeout(() => setFeedback(null), 1400)
      return payload
    } catch (err) {
      setFeedback({ type: 'err', text: err?.message || 'Kunne ikke hente pack-detaljer' })
      setSelectedPack(null)
      return null
    } finally {
      setSelectedLoading(false)
    }
  }

  async function loadInstallPreview(packId, targetWorkspace = workspaceFilter || 'default') {
    if (!packId) return null
    setPreviewLoading(true)
    try {
      const params = new URLSearchParams({
        workspace: targetWorkspace || 'default',
      })
      const res = await apiFetch(`/api/forge/packs/${encodeURIComponent(packId)}/install-preview?${params.toString()}`)
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(payload?.error || `Failed to load install preview for ${packId}`)
      }
      setPreview(payload?.preview || null)
      return payload
    } catch (err) {
      setPreview(null)
      setFeedback({ type: 'err', text: err?.message || 'Kunne ikke hente install preview' })
      return null
    } finally {
      setPreviewLoading(false)
    }
  }

  function onSelectPack(pack) {
    setSelectedPackId(pack?.pack_id)
    if (!pack?.pack_id) return
    void loadPackDetails(pack.pack_id)
    void loadLogs(pack.pack_id)
    void loadInstallPreview(pack.pack_id)
  }

  async function execPackAction(packId, type, body = {}) {
    if (!packId || actionBusy) return
    const key = `${packId}:${type}`
    setActionBusy(key)
    setFeedback(null)
    try {
      const action = type === 'lifecycle'
        ? 'lifecycle'
        : type === 'deploy'
          ? 'deploy'
          : type
      const endpoint = `/api/forge/packs/${encodeURIComponent(packId)}/${action}`
      const res = await apiFetch(endpoint, { method: 'POST', body: JSON.stringify(body) })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(payload?.error || `Action failed: ${type}`)
      }
      setFeedback({
        type: 'ok',
        text: type === 'lifecycle'
          ? `Lifecycle opdateret: ${payload?.transition?.from || '?'} → ${payload?.transition?.to || '?'}`
          : `Pack ${type} påbegyndt`,
      })
      await refetch({ background: true })
      if (selectedPackId === packId) {
        await loadPackDetails(packId)
        await loadLogs(packId)
      }
      return payload
    } catch (err) {
      setFeedback({ type: 'err', text: err?.message || `Kunne ikke udføre ${type}` })
      return null
    } finally {
      setActionBusy('')
      setTimeout(() => setFeedback(null), 2200)
    }
  }

  async function onLifecycle(packId, toState) {
    if (!toState) return
    return execPackAction(packId, 'lifecycle', {
      to_state: toState,
      actor: 'operator',
    })
  }

  async function onDeploy(packId) {
    return execPackAction(packId, 'deploy', {
      actor: 'operator',
      env: 'default',
      runtime_notes: 'Manual deploy via dashboard',
    })
  }

  async function onVerify(packId) {
    return execPackAction(packId, 'verify', { actor: 'operator' })
  }

  async function onRequest(packId) {
    if (!packId || actionBusy) return null
    const key = `${packId}:request`
    setActionBusy(key)
    setFeedback(null)
    try {
      const res = await apiFetch(`/api/forge/packs/${encodeURIComponent(packId)}/request`, {
        method: 'POST',
        body: JSON.stringify({
          actor: 'operator',
          target_workspace_id: workspaceFilter || 'default',
          notes: catalogOnly ? 'Requested from catalog shell' : 'Requested from Forge UI',
        }),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(payload?.error || 'Request failed')
      }
      setFeedback({ type: 'ok', text: `Request oprettet for workspace ${payload?.request?.target_workspace_id || 'default'}` })
      if (selectedPackId === packId) {
        await loadPackDetails(packId)
      }
      return payload
    } catch (err) {
      setFeedback({ type: 'err', text: err?.message || 'Kunne ikke oprette request' })
      return null
    } finally {
      setActionBusy('')
      setTimeout(() => setFeedback(null), 2200)
    }
  }

  async function onInstall(packId) {
    if (!packId || actionBusy) return null
    const key = `${packId}:install`
    setActionBusy(key)
    setFeedback(null)
    try {
      const res = await apiFetch(`/api/forge/packs/${encodeURIComponent(packId)}/install`, {
        method: 'POST',
        body: JSON.stringify({
          actor: 'operator',
          target_workspace_id: workspaceFilter || 'default',
          visibility: 'private',
          notes: 'Installed from Forge catalog UI',
        }),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(payload?.error || 'Install failed')
      }
      setFeedback({ type: 'ok', text: `Installeret som ${payload?.installed_pack?.pack_id || 'lokal kopi'}` })
      await refetch({ background: true })
      if (selectedPackId === packId) {
        await loadPackDetails(packId)
        await loadInstallPreview(packId)
      }
      return payload
    } catch (err) {
      setFeedback({ type: 'err', text: err?.message || 'Kunne ikke installere pack' })
      return null
    } finally {
      setActionBusy('')
      setTimeout(() => setFeedback(null), 2200)
    }
  }

  async function onClone(packId) {
    if (!packId || actionBusy) return null
    const key = `${packId}:clone`
    setActionBusy(key)
    setFeedback(null)
    try {
      const res = await apiFetch(`/api/forge/packs/${encodeURIComponent(packId)}/clone`, {
        method: 'POST',
        body: JSON.stringify({
          actor: 'operator',
          target_workspace_id: workspaceFilter || 'default',
          visibility: 'private',
          notes: 'Cloned from Forge UI',
        }),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(payload?.error || 'Clone failed')
      }
      setFeedback({ type: 'ok', text: `Klon oprettet som ${payload?.cloned_pack?.pack_id || 'nyt draft'}` })
      await refetch({ background: true })
      if (selectedPackId === packId) {
        await loadPackDetails(packId)
        await loadInstallPreview(packId)
      }
      return payload
    } catch (err) {
      setFeedback({ type: 'err', text: err?.message || 'Kunne ikke clone pack' })
      return null
    } finally {
      setActionBusy('')
      setTimeout(() => setFeedback(null), 2200)
    }
  }

  async function loadLogs(packId) {
    if (!packId) return
    setLogsLoading(true)
    try {
      const res = await apiFetch(`/api/forge/packs/${encodeURIComponent(packId)}/logs`)
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(payload?.error || `Unable to load logs for ${packId}`)
      }
      setLogs(Array.isArray(payload.logs) ? payload.logs : [])
    } catch {
      setLogs([])
    } finally {
      setLogsLoading(false)
    }
  }

  function onRefresh() {
    setFeedback(null)
    void refetch()
    if (selectedPackId) {
      void loadPackDetails(selectedPackId)
      void loadLogs(selectedPackId)
      void loadInstallPreview(selectedPackId)
    }
  }

  const selected = selectedPack?.pack || null
  const selectedMetrics = selected?.metrics || selectedPack?.metrics || {}
  const selectedLifecycle = selectedPack?.lifecycle || []
  const selectedDeployments = selectedPack?.deployments || []
  const selectedRecentRuns = selectedPack?.recent_runs || []
  const selectedRecentRequests = selectedPack?.recent_requests || []
  const selectedRecentInstalls = selectedPack?.recent_installs || []
  const selectedVersions = selectedPack?.versions || []
  const metricsRows = [
    ['Runs', selectedMetrics.runs || 0],
    ['Failures', selectedMetrics.failures || 0],
    ['Success rate', `${selectedMetrics.success_rate || 0}%`],
    ['Avg latency', `${selectedMetrics.avg_latency_ms || 0}ms`],
    ['Trust score', selectedMetrics.trust_score || 0],
    ['Last verify', selectedMetrics.last_verified_at ? formatAt(selectedMetrics.last_verified_at) : '—'],
  ]

  const onWorkspaceChange = useCallback((e) => {
    setWorkspaceFilter(e.target.value)
    setSelectedPackId(null)
    setSelectedPack(null)
    setLogs([])
    setPreview(null)
  }, [])

  const onCatalogToggle = useCallback(() => {
    setCatalogOnly((value) => !value)
    setSelectedPackId(null)
    setSelectedPack(null)
    setLogs([])
    setPreview(null)
  }, [])

  const syncToolbar = (
    <div className="space-y-3">
      <div className={clsx('flex items-center gap-3 flex-wrap', hideTopHeader ? 'justify-end' : 'justify-between')}>
      {!hideTopHeader && (
        <div className="flex items-center gap-2 flex-wrap">
          <Package size={16} className="text-blue" />
          <h2 className="text-lg font-bold text-t1">Hermes Forge</h2>
          <span className="font-mono text-[10px] text-t3">
            {lastUpdated ? `synkroniseret ${Math.max(0, Math.round((Date.now() - lastUpdated) / 1000))}s siden` : 'synkroniserer…'}
          </span>
          <Chip variant="model">
            {packs.length} pack(e)
          </Chip>
        </div>
      )}
      {hideTopHeader && (
        <div className="flex items-center gap-2 mr-auto text-[10px] text-t3 font-mono flex-wrap">
          <span>
            {lastUpdated ? `synkroniseret ${Math.max(0, Math.round((Date.now() - lastUpdated) / 1000))}s siden` : 'synkroniserer…'}
          </span>
          <Chip variant="model">{packs.length} pack(e)</Chip>
        </div>
      )}
      <button
        type="button"
        onClick={onRefresh}
        className="px-3 py-1.5 rounded text-[11px] border border-border text-t2 hover:bg-surface2"
      >
        <RefreshCw size={12} className={clsx('inline mr-1', loading && 'animate-spin')} />
        Opdater
      </button>
      </div>

      <div className="rounded-lg border border-border bg-surface p-3">
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 flex-1 min-w-[220px]">
            <Search size={13} className="text-t3" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Søg på pack, kort, capability eller snippet"
              className="w-full rounded border border-border bg-bg px-2 py-1.5 text-sm text-t1 placeholder:text-t3 outline-none"
            />
          </label>

          <label className="flex items-center gap-1.5 text-[10px] text-t3">
            <span className="uppercase tracking-wide">Workspace</span>
            <select
              value={workspaceFilter}
              onChange={onWorkspaceChange}
              className="rounded border border-border bg-bg px-2 py-1 text-[11px] text-t1 font-mono"
            >
              <option value="">Alle</option>
              {workspaceOptions.map((item) => (
                <option key={item.id} value={item.id}>{item.id}</option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-1.5 text-[10px] text-t3">
            <span className="uppercase tracking-wide">Visibility</span>
            <select
              value={visibilityFilter}
              onChange={(e) => setVisibilityFilter(e.target.value)}
              className="rounded border border-border bg-bg px-2 py-1 text-[11px] text-t1 font-mono"
            >
              <option value="">Alle</option>
              <option value="public">public</option>
              <option value="workspace">workspace</option>
              <option value="private">private</option>
            </select>
          </label>

          <label className="flex items-center gap-1.5 text-[10px] text-t3">
            <span className="uppercase tracking-wide">Sort</span>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              className="rounded border border-border bg-bg px-2 py-1 text-[11px] text-t1 font-mono"
            >
              <option value="updated-desc">senest opdateret</option>
              <option value="trust-desc">trust høj-lav</option>
              <option value="trust-asc">trust lav-høj</option>
              <option value="name-asc">navn A-Å</option>
            </select>
          </label>

          <button
            type="button"
            onClick={onCatalogToggle}
            className={clsx(
              'px-3 py-1.5 rounded text-[11px] border',
              catalogOnly ? 'border-blue/40 text-blue bg-blue/10' : 'border-border text-t2 hover:bg-surface2',
            )}
          >
            Katalog: {catalogOnly ? 'On' : 'Off'}
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="space-y-4">
      {syncToolbar}

      {feedback && (
        <div className={clsx(
          'text-[11px] font-mono px-3 py-2 rounded border',
          feedback.type === 'ok' ? 'text-green border-green/30 bg-green/10' : 'text-rust border-rust/30 bg-rust/10',
        )}>
          {feedback.text}
        </div>
      )}

      {error && (
        <div className="text-[11px] text-rust bg-rust/5 border border-rust/25 rounded-lg p-3">
          {error}
        </div>
      )}

      {loading && packs.length === 0 && !error && (
        <ListSkeleton />
      )}

      {!loading && !error && packs.length === 0 && (
        <div className="rounded-lg border border-border bg-surface p-6 text-center text-[11px] text-t3">
          Ingen packs endnu. Registrér en ny pack via <span className="text-t1">hdb pack register</span> eller API.
        </div>
      )}

      {!error && packs.length > 0 && (
        <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_1fr] gap-4">
          <Card className="overflow-hidden">
            <div className="px-4 py-3 border-b border-border text-xs font-semibold text-t2">Pack-liste</div>
            <div className="p-3 space-y-3">
              {packs.map((pack) => {
                const stateRaw = String(pack.status || 'draft').toLowerCase()
                const state = normalizeStatus(pack.status)
                const transitions = LIFECYCLE_TRANSITIONS[stateRaw] || []
                const isInstallable = pack.visibility === 'public' && ['publish', 'deployed', 'verified', 'rarity_update'].includes(stateRaw)
                const isBusy = !!actionBusy && actionBusy.startsWith(`${pack.pack_id}:`)
                const isBusyLifecycle = actionBusy === `${pack.pack_id}:lifecycle`
                const isBusyDeploy = actionBusy === `${pack.pack_id}:deploy`
                const isBusyVerify = actionBusy === `${pack.pack_id}:verify`

                return (
                  <div key={pack.pack_id} className="rounded-lg border border-white/[0.05] p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <button
                        onClick={() => onSelectPack(pack)}
                        className="text-left min-w-0"
                      >
                        <div className="text-sm font-semibold text-t1 truncate">{pack.card_name || pack.name}</div>
                        <div className="text-[11px] text-t3 truncate">{pack.card_theme || 'utility'}</div>
                        <div className="text-[10px] text-t3 font-mono">ws: {pack.workspace_id || 'default'}</div>
                      </button>
                      <div className="flex items-center gap-2">
                        <Chip variant={visibilityVariant(pack.visibility)}>{prettyVisibility(pack.visibility)}</Chip>
                        <Chip variant={statusVariant(state)}>{prettyStatus(pack.status)}</Chip>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-t3">
                      <span>Trust</span>
                      <span className="text-t1 font-mono">{pack.trust_score ?? 0}</span>
                      <span>·</span>
                      <span>Rarity</span>
                      <span className="text-t1 font-mono">{pack.rarity_tier || pack.rarity_label || 'starter'}</span>
                    </div>
                    <div className="text-[11px] text-t2 leading-relaxed">{pack.summary_md || pack.card_snippet || '—'}</div>
                    <div className="text-[10px] text-t3 break-words">{pack.card_snippet || '—'}</div>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {pack.docs_url && (
                        <a
                          href={pack.docs_url}
                          target="_blank"
                          rel="noreferrer"
                          className="px-2 py-1 rounded border border-border text-t2 text-[10px] hover:bg-surface2"
                        >
                          <ExternalLink size={10} className="inline mr-1" />
                          Docs
                        </a>
                      )}
                      <button
                        onClick={() => {
                          onSelectPack(pack)
                          void loadInstallPreview(pack.pack_id)
                        }}
                        disabled={isBusy || previewLoading}
                        className="px-2 py-1 rounded border border-border text-t2 text-[10px] hover:bg-surface2 disabled:opacity-50"
                      >
                        <Eye size={10} className="inline mr-1" />
                        Preview
                      </button>
                      {isInstallable && (
                        <button
                          onClick={() => onInstall(pack.pack_id)}
                          disabled={isBusy || actionBusy === `${pack.pack_id}:install`}
                          className="px-2 py-1 rounded border border-emerald-400/30 text-emerald-300 text-[10px] hover:bg-emerald-400/10 disabled:opacity-50"
                        >
                          {actionBusy === `${pack.pack_id}:install`
                            ? <RotateCw size={10} className="inline mr-1 animate-spin" />
                            : <Download size={10} className="inline mr-1" />}
                          Install
                        </button>
                      )}
                      <button
                        onClick={() => onClone(pack.pack_id)}
                        disabled={isBusy || actionBusy === `${pack.pack_id}:clone`}
                        className="px-2 py-1 rounded border border-fuchsia-400/30 text-fuchsia-300 text-[10px] hover:bg-fuchsia-400/10 disabled:opacity-50"
                      >
                        {actionBusy === `${pack.pack_id}:clone`
                          ? <RotateCw size={10} className="inline mr-1 animate-spin" />
                          : <Copy size={10} className="inline mr-1" />}
                        Clone
                      </button>
                      {pack.visibility === 'public' && (
                        <button
                          onClick={() => onRequest(pack.pack_id)}
                          disabled={isBusy || actionBusy === `${pack.pack_id}:request`}
                          className="px-2 py-1 rounded border border-purple-400/30 text-purple-300 text-[10px] hover:bg-purple-400/10 disabled:opacity-50"
                        >
                          {actionBusy === `${pack.pack_id}:request`
                            ? <RotateCw size={10} className="inline mr-1 animate-spin" />
                            : <ShoppingBag size={10} className="inline mr-1" />}
                          Request
                        </button>
                      )}
                      <button
                        onClick={() => onDeploy(pack.pack_id)}
                        disabled={isBusy || isBusyDeploy || state !== 'publish'}
                        className="px-2 py-1 rounded border border-blue/30 text-blue text-[10px] hover:bg-blue/10 disabled:opacity-50"
                      >
                        {isBusyDeploy ? <RotateCw size={10} className="inline mr-1 animate-spin" /> : <Play size={10} className="inline mr-1" />}
                        Deploy
                      </button>
                      <button
                        onClick={() => onVerify(pack.pack_id)}
                        disabled={isBusy || isBusyVerify}
                        className="px-2 py-1 rounded border border-green/30 text-green text-[10px] hover:bg-green/10 disabled:opacity-50"
                      >
                        {isBusyVerify ? <RotateCw size={10} className="inline mr-1 animate-spin" /> : <FileCheck size={10} className="inline mr-1" />}
                        Verify
                      </button>
                      {transitions.length > 0 && transitions.map((nextState) => (
                        <button
                          key={nextState}
                          onClick={() => onLifecycle(pack.pack_id, nextState)}
                          disabled={isBusy || isBusyLifecycle}
                          className="px-2 py-1 rounded border border-amber/30 text-amber text-[10px] hover:bg-amber/10 disabled:opacity-50"
                        >
                          {isBusyLifecycle ? <RotateCw size={10} className="inline mr-1 animate-spin" /> : <Send size={10} className="inline mr-1" />}
                          {prettyStatus(nextState)}
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>

          <Card className="overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-t2">Pack-detaljer</span>
              {selected && (
                <button
                  onClick={() => {
                    setSelectedPackId(null)
                    setSelectedPack(null)
                    setLogs([])
                    setPreview(null)
                  }}
                  className="px-2 py-1 text-[10px] border border-border rounded text-t3 hover:text-t2"
                >
                  <X size={10} className="inline mr-1" />
                  Luk
                </button>
              )}
            </div>
            {!selectedPackId && (
              <div className="p-4 text-[11px] text-t3">
                Vælg en pack i listen for at se livscyklus, metric og logvisning.
              </div>
            )}

            {selectedPackId && selectedLoading && (
              <div className="p-4 text-xs text-t3">Henter detaljer…</div>
            )}

            {selected && !selectedLoading && (
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-1 gap-3">
                  <div className="rounded-lg border border-white/[0.04] p-3">
                    <div className="text-[10px] text-t3 uppercase tracking-wider">Identitet</div>
                    <div className="mt-1 text-sm font-bold text-t1">{selected.card_name || selected.name}</div>
                    <div className="text-xs text-t3 mt-1">ID: <span className="font-mono text-t2">{selected.pack_id}</span></div>
                    <div className="text-xs text-t3">Version: <span className="font-mono text-t2">{selected.version || '0.1.0'}</span></div>
                    <div className="text-xs text-t3">Workspace: <span className="font-mono text-t2">{selected.workspace_id || 'default'}</span></div>
                    <div className="text-xs text-t3">Visibility: <span className="font-mono text-t2">{selected.visibility || 'private'}</span></div>
                    <div className="text-xs text-t3">Install count: <span className="font-mono text-t2">{selected.install_count || 0}</span></div>
                    <div className="text-xs text-t3">Clone depth: <span className="font-mono text-t2">{selected.clone_depth || 0}</span></div>
                    {selected.source_pack_id && (
                      <div className="text-xs text-t3">
                        Lineage: <span className="font-mono text-t2">{selected.source_pack_id}</span> fra <span className="font-mono text-t2">{selected.source_workspace_id || 'default'}</span>
                      </div>
                    )}
                    <div className="mt-2">
                      <Chip variant={statusVariant(normalizeStatus(selected.status))}>Status: {prettyStatus(selected.status)}</Chip>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {metricsRows.map(([label, value]) => (
                      <div key={label} className="rounded-lg border border-white/[0.04] p-2 bg-white/[0.02]">
                        <div className="text-[9px] uppercase tracking-wider text-t3">{label}</div>
                        <div className="text-sm text-t1 font-mono">{value}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="rounded-lg border border-white/[0.04] p-3 bg-white/[0.02]">
                    <div className="text-[10px] uppercase tracking-wide text-t3 mb-1">Why this pack exists</div>
                    <div className="text-sm text-t2 leading-relaxed">
                      {selected.summary_md || selected.card_snippet || 'Ingen forklaring endnu.'}
                    </div>
                    {selected.docs_url && (
                      <a
                        href={selected.docs_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 mt-2 text-[11px] text-blue hover:underline"
                      >
                        <ExternalLink size={12} />
                        Åbn docs
                      </a>
                    )}
                  </div>
                  <ArrayList title="Capabilities" items={selected.capabilities_json} />
                  <ArrayList title="Requirements" items={selected.requirements_json} />
                  <ArrayList title="Attachments" items={(selected.attachments_json || []).map((item) => item.label ? `${item.label}: ${item.url}` : item.url || String(item))} />
                </div>

                <div className="rounded-lg border border-white/[0.04] p-3 bg-white/[0.02] space-y-2">
                  <div className="flex items-center gap-2 text-[10px] uppercase tracking-wide text-t3">
                    <Layers size={12} />
                    Install preview
                  </div>
                  {previewLoading ? (
                    <div className="text-xs text-t3">Beregner preview…</div>
                  ) : !preview ? (
                    <div className="text-xs text-t3">Ingen preview endnu.</div>
                  ) : (
                    <>
                      <div className="text-xs text-t2">Target workspace: <span className="font-mono">{preview.target_workspace_id || 'default'}</span></div>
                      <div className="text-xs text-t2">Konflikter: <span className="font-mono">{(preview.conflicts || []).length}</span></div>
                      <ArrayList title="Permissions" items={preview.permissions} />
                      <ArrayList title="Dependencies" items={(preview.dependencies || []).map((item) => `${item.type}: ${item.value}`)} />
                    </>
                  )}
                </div>

                {selectedLifecycle.length > 0 && (
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-t3 mb-2">Livscyklus</div>
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {selectedLifecycle.map((entry, index) => (
                        <EventRow key={`${entry.from_state || index}-${entry.to_state || index}-${index}`} item={entry} />
                      ))}
                    </div>
                  </div>
                )}

                {selectedDeployments.length > 0 && (
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-t3 mb-2">Deploymenter</div>
                    <div className="space-y-2">
                      {selectedDeployments.map((item, index) => (
                        <div key={`${item.env || index}-${index}`} className="rounded border border-white/[0.04] px-2 py-1.5 text-xs">
                          <div className="text-t2">{item.env || 'default'} · {formatAt(item.deployed_at)}</div>
                          <div className="text-t3">{item.agent_id || 'agent_id mangler'} · {item.runtime_notes || '—'}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedRecentRuns.length > 0 && (
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-t3 mb-2">Seneste verifieringer</div>
                    <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                      {selectedRecentRuns.slice(0, 5).map((run, idx) => (
                        <div key={`${run.at}-${run.status}-${idx}`} className="rounded border border-white/[0.04] px-2 py-1.5 text-[11px] flex items-center gap-2">
                          <Chip variant={run.status === 'pass' ? 'online' : 'offline'}>{run.status || 'unknown'}</Chip>
                          <span className="font-mono text-t3">{run.at ? formatAt(run.at) : '—'}</span>
                          <span className="text-t2">{run.actor || 'operator'}</span>
                          <span className="text-t3">{run.latency_ms ? `${run.latency_ms}ms` : '—'}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedRecentRequests.length > 0 && (
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-t3 mb-2">Marketplace shell requests</div>
                    <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                      {selectedRecentRequests.slice(0, 5).map((item, idx) => (
                        <div key={`${item.requested_at}-${idx}`} className="rounded border border-white/[0.04] px-2 py-1.5 text-[11px]">
                          <div className="text-t2 font-mono">{item.requested_at ? formatAt(item.requested_at) : '—'} · {item.target_workspace_id}</div>
                          <div className="text-t3">{item.actor || 'operator'} · {item.status || 'open'}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedRecentInstalls.length > 0 && (
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-t3 mb-2">Install / clone lineage</div>
                    <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                      {selectedRecentInstalls.slice(0, 5).map((item, idx) => (
                        <div key={`${item.installed_at}-${idx}`} className="rounded border border-white/[0.04] px-2 py-1.5 text-[11px]">
                          <div className="text-t2 font-mono">{item.installed_at ? formatAt(item.installed_at) : '—'} · {item.mode || 'install'} · {item.target_workspace_id}</div>
                          <div className="text-t3">{item.installed_pack_id} · {item.actor || 'operator'}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedVersions.length > 0 && (
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-t3 mb-2">Lineage versions</div>
                    <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                      {selectedVersions.slice(0, 6).map((item) => (
                        <div key={item.pack_id} className="rounded border border-white/[0.04] px-2 py-1.5 text-[11px]">
                          <div className="text-t2 font-mono">{item.pack_id} · {item.workspace_id || 'default'} · v{item.version || '0.1.0'}</div>
                          <div className="text-t3">{item.status || 'draft'} · root {item.source_pack_id || 'self'}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] uppercase tracking-wider text-t3">Verification logs</span>
                    <button
                      onClick={() => loadLogs(selected.pack_id)}
                      className="ml-auto px-2 py-1 text-[10px] border border-border rounded text-t2 hover:bg-surface2"
                    >
                      {logsLoading ? 'Henter…' : 'Opdater logs'}
                    </button>
                  </div>
                  {logs.length === 0 ? (
                    <div className="text-xs text-t3">Ingen logs endnu</div>
                  ) : (
                    <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                      {logs.map((run, idx) => (
                        <div key={`${run.pack_id || selected.pack_id}-${idx}`} className="rounded border border-white/[0.04] px-2 py-1.5 text-[11px]">
                          <div className="text-t2 font-mono flex items-center gap-2">
                            <FileText size={11} />
                            {formatAt(run.at)}
                            <Chip variant={run.status === 'pass' ? 'online' : 'offline'}>
                              {run.status || 'n/a'}
                            </Chip>
                          </div>
                          <div className="text-t3">trust: {run.trust_score ?? 0}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </Card>
        </div>
      )}

      <div className="text-[10px] text-t3 font-mono">
        <Activity size={10} className="inline mr-1" /> Polling hvert 10. sekund
      </div>
    </div>
  )
}
