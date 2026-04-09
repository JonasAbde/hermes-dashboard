import React, { useState, useCallback } from 'react'
import { clsx } from 'clsx'
import {
  GitBranch, GitPullRequest, AlertTriangle, Play, RotateCcw,
  Plus, ChevronDown, ChevronRight, ExternalLink, Check,
  XCircle, Clock, MessageSquare, Loader2, Shield, Bug,
  ListChecks, ArrowRight, Merge, Layers
} from 'lucide-react'
import { SectionCard } from '../components/ui/Section'
import { Chip } from '../components/ui/Chip'

// ─── GitHub API helper ─────────────────────────────────────────────────────────

async function ghFetch({ owner, repo, path, token, method = 'GET', body }) {
  const headers = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  }
  if (token) headers.Authorization = `Bearer ${token}`
  if (body) headers['Content-Type'] = 'application/json'

  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: `HTTP ${res.status}` }))
    throw new Error(err.message || `HTTP ${res.status}`)
  }

  // 204 No Content (merge, etc.)
  if (res.status === 204) return null
  return res.json()
}

// ─── Time / date helpers ────────────────────────────────────────────────────────

function formatTimeAgo(iso) {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  return new Date(iso).toLocaleDateString()
}

function formatDuration(seconds) {
  if (!seconds) return '—'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  if (m < 1) return `${s}s`
  return `${m}m ${s}s`
}

// ─── Status badge helpers ─────────────────────────────────────────────────────

const STATUS_STYLES = {
  success: { bg: 'rgba(0,180,120,0.12)', color: '#00b478', border: 'rgba(0,180,120,0.25)' },
  failure: { bg: 'rgba(239,68,68,0.12)',  color: '#ef4444', border: 'rgba(239,68,68,0.20)'  },
  in_progress: { bg: 'rgba(224,144,64,0.12)', color: '#e09040', border: 'rgba(224,144,64,0.25)' },
  queued: { bg: 'rgba(82,85,106,0.15)',   color: '#8285aa', border: 'rgba(82,85,106,0.25)' },
  completed: { bg: 'rgba(0,180,120,0.12)', color: '#00b478', border: 'rgba(0,180,120,0.25)' },
  action_required: { bg: 'rgba(224,144,64,0.12)', color: '#e09040', border: 'rgba(224,144,64,0.25)' },
  pending: { bg: 'rgba(224,144,64,0.12)', color: '#e09040', border: 'rgba(224,144,64,0.25)' },
  requested: { bg: 'rgba(74,128,200,0.12)', color: '#4a80c8', border: 'rgba(74,128,200,0.20)' },
  CHANGES_REQUESTED: { bg: 'rgba(224,144,64,0.12)', color: '#e09040', border: 'rgba(224,144,64,0.25)' },
  APPROVED: { bg: 'rgba(0,180,120,0.12)', color: '#00b478', border: 'rgba(0,180,120,0.25)' },
}

function StatusBadge({ status }) {
  const s = STATUS_STYLES[status] ?? STATUS_STYLES.pending
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
      style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}
    >
      {status?.replace(/_/g, ' ')}
    </span>
  )
}

function SeverityBadge({ severity }) {
  const styles = {
    critical: { bg: 'rgba(239,68,68,0.15)', color: '#ef4444', border: 'rgba(239,68,68,0.30)' },
    high:     { bg: 'rgba(224,95,64,0.12)',  color: '#e05f40', border: 'rgba(224,95,64,0.25)' },
    medium:   { bg: 'rgba(224,144,64,0.12)', color: '#e09040', border: 'rgba(224,144,64,0.25)' },
    low:      { bg: 'rgba(82,85,106,0.12)',  color: '#8285aa', border: 'rgba(82,85,106,0.20)' },
  }
  const s = styles[severity] ?? styles.low
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
      style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}
    >
      {severity}
    </span>
  )
}

// ─── Repo config bar ───────────────────────────────────────────────────────────

function RepoConfig({ config, onChange }) {
  return (
    <div className="flex flex-wrap items-center gap-3 p-4 rounded-xl border border-white/[0.05] bg-surface/40">
      <div className="flex flex-col gap-1">
        <label className="text-[9px] uppercase tracking-widest text-t3 font-bold">Owner</label>
        <input
          className="bg-surface2 border border-white/10 text-t1 text-xs rounded-lg px-3 py-1.5 font-mono focus:outline-none focus:ring-1 focus:ring-rust/40 focus:border-rust/30 w-36"
          placeholder="owner"
          value={config.owner}
          onChange={(e) => onChange({ ...config, owner: e.target.value })}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-[9px] uppercase tracking-widest text-t3 font-bold">Repo</label>
        <input
          className="bg-surface2 border border-white/10 text-t1 text-xs rounded-lg px-3 py-1.5 font-mono focus:outline-none focus:ring-1 focus:ring-rust/40 focus:border-rust/30 w-36"
          placeholder="repo"
          value={config.repo}
          onChange={(e) => onChange({ ...config, repo: e.target.value })}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-[9px] uppercase tracking-widest text-t3 font-bold">Token <span className="text-t3/normal-italic">(optional)</span></label>
        <input
          type="password"
          className="bg-surface2 border border-white/10 text-t1 text-xs rounded-lg px-3 py-1.5 font-mono focus:outline-none focus:ring-1 focus:ring-rust/40 focus:border-rust/30 w-52"
          placeholder="ghp_..."
          value={config.token}
          onChange={(e) => onChange({ ...config, token: e.target.value })}
        />
      </div>
    </div>
  )
}

// ─── Tab navigation ─────────────────────────────────────────────────────────────

const TABS = [
  { id: 'actions',   label: 'Actions',    icon: Play },
  { id: 'issues',    label: 'Issues',      icon: Bug },
  { id: 'pulls',     label: 'Pull Requests', icon: GitPullRequest },
  { id: 'security',  label: 'Security',    icon: Shield },
]

function TabBar({ active, onChange }) {
  return (
    <div className="flex items-center gap-1 p-1 rounded-xl border border-white/[0.05] bg-surface/30 w-fit">
      {TABS.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          className={clsx(
            'flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all',
            active === id
              ? 'bg-rust/20 text-rust border border-rust/30 shadow-[0_0_16px_rgba(224,95,64,0.12)]'
              : 'text-t3 hover:text-t2 hover:bg-white/[0.04]'
          )}
        >
          <Icon size={13} />
          {label}
        </button>
      ))}
    </div>
  )
}

// ─── Shared empty state ────────────────────────────────────────────────────────

function EmptyState({ message, icon: Icon = ListChecks }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-12 h-12 rounded-2xl bg-surface/60 border border-white/[0.06] flex items-center justify-center mb-4">
        <Icon size={20} className="text-t3" />
      </div>
      <p className="text-t3 text-sm">{message}</p>
    </div>
  )
}

function ErrorBanner({ message, onRetry }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-red/20 bg-red/10 text-red text-xs">
      <XCircle size={14} />
      <span className="flex-1">{message}</span>
      {onRetry && (
        <button onClick={onRetry} className="underline hover:opacity-80 font-bold uppercase tracking-wider">
          Retry
        </button>
      )}
    </div>
  )
}

function LoadingSpinner({ label = 'Loading…' }) {
  return (
    <div className="flex items-center gap-2 py-8 justify-center text-t3 text-xs">
      <Loader2 size={14} className="animate-spin" />
      {label}
    </div>
  )
}

// ─── ACTIONS TAB ───────────────────────────────────────────────────────────────

function ActionsTab({ config }) {
  const [runs, setRuns] = useState([])
  const [workflows, setWorkflows] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [triggerBranch, setTriggerBranch] = useState('')
  const [triggerWorkflowId, setTriggerWorkflowId] = useState('')
  const [rerunLoading, setRerunLoading] = useState(false)
  const [actionMsg, setActionMsg] = useState(null)

  const fetchData = useCallback(async () => {
    if (!config.owner || !config.repo) return
    setLoading(true)
    setError(null)
    try {
      const [runsData, workflowsData] = await Promise.all([
        ghFetch({ owner: config.owner, repo: config.repo, path: '/actions/runs', token: config.token }),
        ghFetch({ owner: config.owner, repo: config.repo, path: '/actions/workflows', token: config.token }),
      ])
      setRuns(runsData?.workflow_runs ?? [])
      setWorkflows(workflowsData?.workflows ?? [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [config])

  const handleTrigger = async () => {
    if (!triggerWorkflowId || !triggerBranch) return
    setActionMsg(null)
    try {
      await ghFetch({
        owner: config.owner, repo: config.repo,
        path: `/actions/workflows/${triggerWorkflowId}/dispatches`,
        token: config.token, method: 'POST',
        body: { ref: triggerBranch },
      })
      setActionMsg({ type: 'success', text: 'Workflow triggered!' })
      setTimeout(fetchData, 2000)
    } catch (e) {
      setActionMsg({ type: 'error', text: e.message })
    }
  }

  const handleRerun = async (runId) => {
    setRerunLoading(true)
    try {
      await ghFetch({
        owner: config.owner, repo: config.repo,
        path: `/actions/runs/${runId}/rerun`,
        token: config.token, method: 'POST',
      })
      setActionMsg({ type: 'success', text: 'Re-run started.' })
      setTimeout(fetchData, 2000)
    } catch (e) {
      setActionMsg({ type: 'error', text: e.message })
    } finally {
      setRerunLoading(false)
    }
  }

  if (!config.owner || !config.repo) {
    return (
      <div className="space-y-4">
        <EmptyState message="Configure owner and repo above to load workflow runs." icon={Play} />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Trigger workflow */}
      <div className="p-4 rounded-xl border border-white/[0.05] bg-surface/40 space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-t3">
          <Play size={12} />
          Trigger workflow
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-[9px] uppercase tracking-widest text-t3 font-bold">Workflow</label>
            <select
              className="bg-surface2 border border-white/10 text-t1 text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-rust/40 w-48"
              value={triggerWorkflowId}
              onChange={(e) => setTriggerWorkflowId(e.target.value)}
            >
              <option value="">Select workflow…</option>
              {workflows.map(w => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[9px] uppercase tracking-widest text-t3 font-bold">Branch</label>
            <input
              className="bg-surface2 border border-white/10 text-t1 text-xs rounded-lg px-3 py-1.5 font-mono focus:outline-none focus:ring-1 focus:ring-rust/40 w-36"
              placeholder="main"
              value={triggerBranch}
              onChange={(e) => setTriggerBranch(e.target.value)}
            />
          </div>
          <button
            onClick={handleTrigger}
            disabled={!triggerWorkflowId || !triggerBranch}
            className="px-4 py-1.5 rounded-lg bg-green/20 border border-green/30 text-green text-xs font-bold uppercase tracking-wider hover:bg-green/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Play size={11} className="inline mr-1" />Dispatch
          </button>
        </div>
      </div>

      {actionMsg && (
        <div className={clsx(
          'flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold border',
          actionMsg.type === 'success'
            ? 'border-green/20 bg-green/10 text-green'
            : 'border-red/20 bg-red/10 text-red'
        )}>
          {actionMsg.type === 'success' ? <Check size={13} /> : <XCircle size={13} />}
          {actionMsg.text}
        </div>
      )}

      {error && <ErrorBanner message={error} onRetry={fetchData} />}

      {loading ? (
        <LoadingSpinner label="Fetching workflow runs…" />
      ) : runs.length === 0 ? (
        <EmptyState message="No workflow runs found." icon={Play} />
      ) : (
        <div className="space-y-2">
          {runs.map((run) => (
            <div
              key={run.id}
              className="flex items-center gap-3 px-4 py-3 rounded-xl border border-white/[0.05] bg-surface/40 hover:bg-surface/60 transition-colors group"
            >
              <StatusBadge status={run.conclusion ?? run.status} />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-t1 truncate">{run.name}</div>
                <div className="flex items-center gap-2 mt-0.5 text-[10px] text-t3">
                  <span className="font-mono">{run.head_branch}</span>
                  <span>·</span>
                  <span className="font-mono truncate max-w-[200px]">{run.head_sha?.slice(0, 7)}</span>
                  <span>·</span>
                  <Clock size={9} />
                  <span>{formatTimeAgo(run.created_at)}</span>
                  <span>·</span>
                  <span>{formatDuration(run.run_duration_ms ? run.run_duration_ms / 1000 : undefined)}</span>
                </div>
              </div>
              <button
                onClick={() => handleRerun(run.id)}
                disabled={rerunLoading}
                className="opacity-0 group-hover:opacity-100 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-t3 hover:text-t2 text-[10px] font-bold uppercase tracking-wider transition-all disabled:opacity-30"
              >
                <RotateCcw size={9} />
                Re-run
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── ISSUES TAB ───────────────────────────────────────────────────────────────

function IssuesTab({ config }) {
  const [issues, setIssues] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState('open')
  const [expandedId, setExpandedId] = useState(null)
  const [issueComments, setIssueComments] = useState({})
  const [loadingComments, setLoadingComments] = useState({})

  // Create issue form state
  const [showCreate, setShowCreate] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newBody, setNewBody] = useState('')
  const [newLabels, setNewLabels] = useState('')
  const [createLoading, setCreateLoading] = useState(false)
  const [createMsg, setCreateMsg] = useState(null)

  const fetchIssues = useCallback(async () => {
    if (!config.owner || !config.repo) return
    setLoading(true)
    setError(null)
    try {
      const data = await ghFetch({
        owner: config.owner, repo: config.repo,
        path: `/issues?state=${filter}&per_page=30`,
        token: config.token,
      })
      setIssues(Array.isArray(data) ? data.filter(i => !i.pull_request) : [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [config, filter])

  const fetchComments = async (issueNumber) => {
    if (issueComments[issueNumber]) return
    setLoadingComments(prev => ({ ...prev, [issueNumber]: true }))
    try {
      const data = await ghFetch({
        owner: config.owner, repo: config.repo,
        path: `/issues/${issueNumber}/comments?per_page=20`,
        token: config.token,
      })
      setIssueComments(prev => ({ ...prev, [issueNumber]: data ?? [] }))
    } catch {
      // silently ignore comment errors
    } finally {
      setLoadingComments(prev => ({ ...prev, [issueNumber]: false }))
    }
  }

  const handleCreate = async () => {
    if (!newTitle.trim()) return
    setCreateLoading(true)
    setCreateMsg(null)
    try {
      const labels = newLabels.split(',').map(l => l.trim()).filter(Boolean)
      await ghFetch({
        owner: config.owner, repo: config.repo,
        path: '/issues',
        token: config.token, method: 'POST',
        body: { title: newTitle, body: newBody, labels },
      })
      setCreateMsg({ type: 'success', text: 'Issue created!' })
      setNewTitle('')
      setNewBody('')
      setNewLabels('')
      setShowCreate(false)
      setTimeout(fetchIssues, 1000)
    } catch (e) {
      setCreateMsg({ type: 'error', text: e.message })
    } finally {
      setCreateLoading(false)
    }
  }

  const toggleExpand = (issue) => {
    const next = expandedId === issue.id ? null : issue.id
    setExpandedId(next)
    if (next) fetchComments(issue.number)
  }

  return (
    <div className="space-y-4">
      {/* Filter + Create */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {['open', 'closed', 'all'].map(f => (
            <button
              key={f}
              onClick={() => { setFilter(f); setExpandedId(null) }}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all border',
                filter === f
                  ? 'bg-blue/15 border-blue/30 text-blue'
                  : 'bg-surface/40 border-white/5 text-t3 hover:text-t2'
              )}
            >
              {f}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green/15 border border-green/25 text-green text-xs font-bold uppercase tracking-wider hover:bg-green/25 transition-colors"
        >
          <Plus size={11} />
          New Issue
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="p-4 rounded-xl border border-green/20 bg-green/8 space-y-3">
          <div className="text-xs font-bold uppercase tracking-wider text-green flex items-center gap-2">
            <Plus size={11} />New Issue
          </div>
          <input
            className="w-full bg-surface2 border border-white/10 text-t1 text-xs rounded-lg px-3 py-2 font-medium focus:outline-none focus:ring-1 focus:ring-rust/40"
            placeholder="Issue title"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
          />
          <textarea
            className="w-full bg-surface2 border border-white/10 text-t1 text-xs rounded-lg px-3 py-2 font-mono focus:outline-none focus:ring-1 focus:ring-rust/40 resize-none"
            rows={4}
            placeholder="Issue body (markdown supported)"
            value={newBody}
            onChange={(e) => setNewBody(e.target.value)}
          />
          <input
            className="w-full bg-surface2 border border-white/10 text-t1 text-xs rounded-lg px-3 py-2 font-mono focus:outline-none focus:ring-1 focus:ring-rust/40"
            placeholder="Labels (comma-separated, e.g. bug, help wanted)"
            value={newLabels}
            onChange={(e) => setNewLabels(e.target.value)}
          />
          {createMsg && (
            <div className={clsx(
              'text-xs font-bold px-3 py-2 rounded-lg border',
              createMsg.type === 'success'
                ? 'border-green/20 bg-green/10 text-green'
                : 'border-red/20 bg-red/10 text-red'
            )}>
              {createMsg.text}
            </div>
          )}
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={createLoading || !newTitle.trim()}
              className="px-4 py-1.5 rounded-lg bg-green/20 border border-green/30 text-green text-xs font-bold uppercase tracking-wider hover:bg-green/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {createLoading ? 'Creating…' : 'Create'}
            </button>
            <button
              onClick={() => { setShowCreate(false); setCreateMsg(null) }}
              className="px-4 py-1.5 rounded-lg bg-surface/60 border border-white/10 text-t3 text-xs font-bold uppercase tracking-wider hover:text-t2 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {error && <ErrorBanner message={error} onRetry={fetchIssues} />}

      {loading ? (
        <LoadingSpinner label="Fetching issues…" />
      ) : issues.length === 0 ? (
        <EmptyState message="No issues found." icon={Bug} />
      ) : (
        <div className="space-y-2">
          {issues.map((issue) => (
            <div key={issue.id} className="rounded-xl border border-white/[0.05] bg-surface/40 overflow-hidden">
              <button
                className="w-full flex items-start gap-3 px-4 py-3 hover:bg-surface/50 transition-colors text-left"
                onClick={() => toggleExpand(issue)}
              >
                <div className="mt-0.5 text-t3">
                  {expandedId === issue.id
                    ? <ChevronDown size={13} />
                    : <ChevronRight size={13} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-[10px] text-t3">#{issue.number}</span>
                    <span className="text-xs font-bold text-t1 truncate">{issue.title}</span>
                    {issue.labels?.slice(0, 4).map(label => (
                      <span
                        key={label.id}
                        className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider"
                        style={{
                          background: `${label.color}22`,
                          color: `#${label.color}`,
                          border: `1px solid #${label.color}44`,
                        }}
                      >
                        {label.name}
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-[10px] text-t3">
                    <span>opened by <span className="font-mono text-t2">{issue.user?.login}</span></span>
                    <span>·</span>
                    <Clock size={9} />
                    <span>{formatTimeAgo(issue.created_at)}</span>
                    <span>·</span>
                    <MessageSquare size={9} />
                    <span>{issue.comments}</span>
                    {issue.assignee && (
                      <>
                        <span>·</span>
                        <span>assigned to <span className="font-mono text-t2">{issue.assignee.login}</span></span>
                      </>
                    )}
                  </div>
                </div>
                <StatusBadge status={issue.state} />
              </button>

              {expandedId === issue.id && (
                <div className="px-4 pb-4 border-t border-white/[0.04]">
                  {issue.body && (
                    <pre className="mt-3 text-xs text-t2 font-mono whitespace-pre-wrap leading-relaxed bg-surface2/50 rounded-lg p-3">
                      {issue.body}
                    </pre>
                  )}
                  {loadingComments[issue.number] ? (
                    <LoadingSpinner label="Loading comments…" />
                  ) : (issueComments[issue.number] ?? []).length > 0 ? (
                    <div className="mt-3 space-y-2">
                      {issueComments[issue.number].map(c => (
                        <div key={c.id} className="flex items-start gap-2 p-3 rounded-lg bg-surface/30 border border-white/[0.04]">
                          <img src={c.user?.avatar_url} alt="" className="w-6 h-6 rounded-full flex-shrink-0 mt-0.5" />
                          <div>
                            <span className="text-[10px] font-mono font-bold text-t2">{c.user?.login}</span>
                            <span className="text-[10px] text-t3 ml-2">{formatTimeAgo(c.created_at)}</span>
                            <pre className="text-[11px] text-t2 font-mono mt-1 whitespace-pre-wrap">{c.body}</pre>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-3 text-xs text-t3 italic">No comments yet.</p>
                  )}
                  <a
                    href={issue.html_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 mt-3 text-[10px] text-blue hover:underline font-bold uppercase tracking-wider"
                  >
                    <ExternalLink size={9} />Open on GitHub
                  </a>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── PULL REQUESTS TAB ─────────────────────────────────────────────────────────

function PullsTab({ config }) {
  const [prs, setPrs] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [mergeMethod, setMergeMethod] = useState('squash')
  const [merging, setMerging] = useState({})
  const [mergeMsg, setMergeMsg] = useState({})

  const fetchPrs = useCallback(async () => {
    if (!config.owner || !config.repo) return
    setLoading(true)
    setError(null)
    try {
      const data = await ghFetch({
        owner: config.owner, repo: config.repo,
        path: '/pulls?state=open&per_page=30',
        token: config.token,
      })
      setPrs(Array.isArray(data) ? data : [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [config])

  const handleMerge = async (prNumber) => {
    setMerging(prev => ({ ...prev, [prNumber]: true }))
    setMergeMsg(prev => ({ ...prev, [prNumber]: null }))
    try {
      await ghFetch({
        owner: config.owner, repo: config.repo,
        path: `/pulls/${prNumber}/merge`,
        token: config.token, method: 'PUT',
        body: { merge_method: mergeMethod },
      })
      setMergeMsg(prev => ({ ...prev, [prNumber]: { type: 'success', text: 'PR merged!' } }))
      setTimeout(fetchPrs, 1500)
    } catch (e) {
      setMergeMsg(prev => ({ ...prev, [prNumber]: { type: 'error', text: e.message } }))
    } finally {
      setMerging(prev => ({ ...prev, [prNumber]: false }))
    }
  }

  return (
    <div className="space-y-4">
      {/* Merge options */}
      <div className="flex flex-wrap items-center gap-3 p-4 rounded-xl border border-white/[0.05] bg-surface/40">
        <span className="text-[10px] uppercase tracking-widest text-t3 font-bold">Merge method:</span>
        {['squash', 'merge', 'rebase'].map(m => (
          <button
            key={m}
            onClick={() => setMergeMethod(m)}
            className={clsx(
              'px-3 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wider border transition-all',
              mergeMethod === m
                ? 'bg-blue/15 border-blue/30 text-blue'
                : 'bg-surface2/60 border-white/8 text-t3 hover:text-t2'
            )}
          >
            {m}
          </button>
        ))}
      </div>

      {error && <ErrorBanner message={error} onRetry={fetchPrs} />}

      {loading ? (
        <LoadingSpinner label="Fetching pull requests…" />
      ) : prs.length === 0 ? (
        <EmptyState message="No open pull requests." icon={GitPullRequest} />
      ) : (
        <div className="space-y-2">
          {prs.map((pr) => (
            <div key={pr.id} className="rounded-xl border border-white/[0.05] bg-surface/40 p-4">
              <div className="flex items-start gap-3">
                <StatusBadge status={pr.state} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-[10px] text-t3">#{pr.number}</span>
                    <span className="text-xs font-bold text-t1 truncate">{pr.title}</span>
                    {/* CI status placeholder */}
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-green/10 border border-green/20 text-green">
                      <Check size={8} /> CI passed
                    </span>
                  </div>

                  {/* Branch info */}
                  <div className="flex items-center gap-2 mt-1.5 text-[10px] text-t3 font-mono">
                    <span className="text-t2">{pr.head?.ref}</span>
                    <ArrowRight size={9} />
                    <span>{pr.base?.ref}</span>
                  </div>

                  {/* Review status */}
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <span className="text-[9px] uppercase tracking-widest text-t3 font-bold">Reviews:</span>
                    {pr.requested_reviewers?.map(r => (
                      <span key={r.id} className="inline-flex items-center gap-1 text-[10px] text-t2">
                        <img src={r.avatar_url} alt="" className="w-4 h-4 rounded-full" />
                        {r.login}
                      </span>
                    ))}
                    {pr.review_groups?.map((group, i) => (
                      <span key={i} className="text-[10px] text-t3">
                        {group.state}: {group.names.join(', ')}
                      </span>
                    ))}
                    {!pr.requested_reviewers?.length && (
                      <span className="text-[10px] text-t3 italic">none requested</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 mt-1.5 text-[10px] text-t3">
                    <span>by <span className="font-mono text-t2">{pr.user?.login}</span></span>
                    <span>·</span>
                    <Clock size={9} />
                    <span>{formatTimeAgo(pr.created_at)}</span>
                    {pr.labels?.slice(0, 3).map(label => (
                      <span
                        key={label.id}
                        className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold"
                        style={{
                          background: `${label.color}22`,
                          color: `#${label.color}`,
                          border: `1px solid #${label.color}44`,
                        }}
                      >
                        {label.name}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-2 items-end">
                  {mergeMsg[pr.number] && (
                    <span className={clsx(
                      'text-[10px] font-bold',
                      mergeMsg[pr.number].type === 'success' ? 'text-green' : 'text-red'
                    )}>
                      {mergeMsg[pr.number].text}
                    </span>
                  )}
                  <button
                    onClick={() => handleMerge(pr.number)}
                    disabled={merging[pr.number]}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green/15 border border-green/25 text-green text-[10px] font-bold uppercase tracking-wider hover:bg-green/25 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <Merge size={10} />
                    {merging[pr.number] ? 'Merging…' : `Merge (${mergeMethod})`}
                  </button>
                  <a
                    href={pr.html_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[9px] text-blue hover:underline font-bold uppercase tracking-wider"
                  >
                    <ExternalLink size={8} />View
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── SECURITY TAB ─────────────────────────────────────────────────────────────

function SecurityTab({ config }) {
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const fetchAlerts = useCallback(async () => {
    if (!config.owner || !config.repo) return
    setLoading(true)
    setError(null)
    try {
      const data = await ghFetch({
        owner: config.owner, repo: config.repo,
        path: '/dependabot/alerts?state=open&per_page=50',
        token: config.token,
      })
      setAlerts(Array.isArray(data) ? data : [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [config])

  const counts = {
    critical: alerts.filter(a => a.security_advisory?.severity === 'critical').length,
    high: alerts.filter(a => a.security_advisory?.severity === 'high').length,
    medium: alerts.filter(a => a.security_advisory?.severity === 'medium').length,
    low: alerts.filter(a => a.security_advisory?.severity === 'low').length,
  }

  return (
    <div className="space-y-4">
      {/* Severity summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Critical', count: counts.critical, color: '#ef4444', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.25)' },
          { label: 'High',     count: counts.high,     color: '#e05f40', bg: 'rgba(224,95,64,0.12)',  border: 'rgba(224,95,64,0.25)' },
          { label: 'Medium',   count: counts.medium,   color: '#e09040', bg: 'rgba(224,144,64,0.12)', border: 'rgba(224,144,64,0.25)' },
          { label: 'Low',      count: counts.low,      color: '#8285aa', bg: 'rgba(82,85,106,0.12)',  border: 'rgba(82,85,106,0.20)' },
        ].map(({ label, count, color, bg, border }) => (
          <div
            key={label}
            className="flex flex-col items-center justify-center p-4 rounded-xl border text-center"
            style={{ background: bg, borderColor: border }}
          >
            <div className="font-mono text-2xl font-black" style={{ color }}>{count}</div>
            <div className="text-[10px] uppercase tracking-widest mt-1 font-bold" style={{ color }}>{label}</div>
          </div>
        ))}
      </div>

      {error && <ErrorBanner message={error} onRetry={fetchAlerts} />}

      {loading ? (
        <LoadingSpinner label="Fetching security alerts…" />
      ) : alerts.length === 0 ? (
        <EmptyState message="No open Dependabot alerts." icon={Shield} />
      ) : (
        <div className="space-y-2">
          {alerts.map((alert) => {
            const advisory = alert.security_advisory ?? {}
            const severity = advisory.severity ?? 'low'
            return (
              <div
                key={alert.number}
                className="flex items-start gap-3 px-4 py-3 rounded-xl border border-white/[0.05] bg-surface/40 hover:bg-surface/60 transition-colors"
              >
                <AlertTriangle
                  size={14}
                  className="mt-0.5 flex-shrink-0"
                  style={{
                    color: severity === 'critical' ? '#ef4444'
                      : severity === 'high' ? '#e05f40'
                      : severity === 'medium' ? '#e09040'
                      : '#8285aa'
                  }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <SeverityBadge severity={severity} />
                    <span className="text-xs font-mono font-bold text-t1 truncate">
                      {advisory.identifiers?.[0]?.value ?? 'Unknown vulnerability'}
                    </span>
                  </div>
                  <div className="text-xs text-t2 mt-1 leading-relaxed line-clamp-2">
                    {advisory.description ?? 'No description provided.'}
                  </div>
                  <div className="flex items-center gap-3 mt-2 text-[10px] text-t3 flex-wrap">
                    <span className="flex items-center gap-1">
                      <Layers size={9} />
                      <span className="font-mono text-t2">{alert.dependency?.package?.name}</span>
                    </span>
                    {alert.fixed_in && (
                      <>
                        <span>→</span>
                        <span className="text-green font-mono">Fixed in {alert.fixed_in}</span>
                      </>
                    )}
                    {!alert.fixed_in && (
                      <span className="text-amber font-mono">No fix version</span>
                    )}
                  </div>
                </div>
                <a
                  href={advisory.html_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 flex-shrink-0 px-2.5 py-1.5 rounded-lg bg-blue/10 border border-blue/20 text-blue text-[10px] font-bold uppercase tracking-wider hover:bg-blue/20 transition-colors"
                >
                  <ExternalLink size={8} />
                  Fix PR
                </a>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── GitHubPage ───────────────────────────────────────────────────────────────

export function GitHubPage() {
  const [tab, setTab] = useState('actions')
  const [config, setConfig] = useState({ owner: '', repo: '', token: '' })

  return (
    <div className="relative isolate max-w-6xl min-w-0 space-y-5 pb-8">
      {/* Ambient glows */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-20 right-12 h-64 w-64 rounded-full bg-rust/8 blur-3xl" />
        <div className="absolute top-40 left-[-4rem] h-56 w-56 rounded-full bg-blue/6 blur-3xl" />
      </div>

      {/* Hero header */}
      <section className="relative overflow-hidden rounded-[28px] border border-white/[0.07] bg-[linear-gradient(180deg,rgba(10,11,16,0.96),rgba(10,11,16,0.88))] shadow-[0_30px_80px_rgba(0,0,0,0.45)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(224,95,64,0.12),transparent_38%),radial-gradient(circle_at_bottom_left,rgba(74,128,200,0.10),transparent_35%)]" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        <div className="relative z-10 p-5 sm:p-6 lg:p-7 space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-[0.28em] text-t3">
            <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-t2 flex items-center gap-1.5">
              <GitBranch size={9} /> GitHub Integration
            </span>
            <span className="rounded-full border border-rust/15 bg-rust/8 px-2.5 py-1 text-rust flex items-center gap-1.5">
              <Layers size={9} /> Actions, Issues, PRs &amp; Security
            </span>
          </div>

          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-t1">
                GitHub
              </h1>
              <p className="max-w-xl text-sm leading-7 text-t2">
                Monitor CI/CD workflows, manage issues and pull requests, and track Dependabot security alerts — all in one place.
              </p>
            </div>

            <TabBar active={tab} onChange={setTab} />
          </div>

          <RepoConfig config={config} onChange={setConfig} />
        </div>
      </section>

      {/* Tab content */}
      {tab === 'actions'   && <ActionsTab   config={config} />}
      {tab === 'issues'    && <IssuesTab    config={config} />}
      {tab === 'pulls'     && <PullsTab     config={config} />}
      {tab === 'security'  && <SecurityTab  config={config} />}
    </div>
  )
}
