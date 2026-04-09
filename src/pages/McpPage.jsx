import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Wrench, Play, Clock, Search, ChevronDown, ChevronUp,
  Copy, CheckCheck, X, Terminal, BookOpen,
  AlertCircle, RotateCcw, Server, Package
} from 'lucide-react'
import { clsx } from 'clsx'
import { Chip } from '../components/ui/Chip'
import { apiFetch } from '../utils/auth'

/* ── Mock data ─────────────────────────────────────────────────────────────── */

const MOCK_TOOLS = [
  {
    name: 'read_file',
    description: 'Read the contents of a file from the filesystem.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Absolute path to the file to read' },
        offset: { type: 'integer', description: 'Line number to start reading from (1-indexed)', default: 1 },
        limit: { type: 'integer', description: 'Maximum number of lines to read', default: 500 },
      },
      required: ['path'],
    },
    server: 'filesystem',
  },
  {
    name: 'write_file',
    description: 'Write content to a file, creating it if it does not exist.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Absolute path of the file to write' },
        content: { type: 'string', description: 'Content to write to the file' },
        append: { type: 'boolean', description: 'Append to existing file instead of overwriting', default: false },
      },
      required: ['path', 'content'],
    },
    server: 'filesystem',
  },
  {
    name: 'list_directory',
    description: 'List the contents of a directory.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Absolute path of the directory to list' },
        recursive: { type: 'boolean', description: 'Recursively list subdirectories', default: false },
      },
      required: ['path'],
    },
    server: 'filesystem',
  },
  {
    name: 'search_code',
    description: 'Search for code patterns across files in a directory.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Regex or text pattern to search for' },
        path: { type: 'string', description: 'Root directory to search within', default: '.' },
        file_glob: { type: 'string', description: 'Glob pattern to filter files (e.g. "*.js")' },
        limit: { type: 'integer', description: 'Maximum number of results', default: 50 },
      },
      required: ['query'],
    },
    server: 'filesystem',
  },
  {
    name: 'http_request',
    description: 'Perform an HTTP request to an external URL.',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'The URL to request' },
        method: { type: 'string', description: 'HTTP method', enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'], default: 'GET' },
        headers: { type: 'object', description: 'HTTP headers to include' },
        body: { type: 'string', description: 'Request body (for POST/PUT/PATCH)' },
      },
      required: ['url'],
    },
    server: 'http',
  },
  {
    name: 'postgres_query',
    description: 'Execute a read-only SQL query against the PostgreSQL database.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'SQL query to execute (read-only)' },
        params: { type: 'array', description: 'Query parameter values for prepared statements' },
      },
      required: ['query'],
    },
    server: 'database',
  },
]

/* ── Helpers ──────────────────────────────────────────────────────────────── */

function schemaToFields(schema) {
  if (!schema || schema.type !== 'object' || !schema.properties) return []
  return Object.entries(schema.properties).map(([name, prop]) => ({
    name,
    type: prop.type || 'string',
    description: prop.description || '',
    enum: prop.enum,
    default: prop.default,
    required: schema.required?.includes(name) || false,
  }))
}

function getDefaultValues(fields) {
  return Object.fromEntries(
    fields.map((f) => [f.name, f.default !== undefined ? f.default : ''])
  )
}

function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`
}

function timestamp() {
  return new Date().toLocaleTimeString('en-GB', { hour12: false })
}

/* ── Schema viewer ────────────────────────────────────────────────────────── */

function SchemaViewer({ schema }) {
  const [open, setOpen] = useState(false)
  if (!schema) return null

  return (
    <div className="mt-2 border border-white/[0.05] rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-3 py-2 text-[10px] font-mono text-t3 hover:text-t2 hover:bg-white/[0.02] transition-colors"
      >
        {open ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
        input_schema.json
        <span className="ml-auto text-[9px] opacity-50">JSON</span>
      </button>
      {open && (
        <pre className="px-3 pb-3 text-[10px] font-mono text-blue leading-relaxed overflow-x-auto bg-black/20">
          {JSON.stringify(schema, null, 2)}
        </pre>
      )}
    </div>
  )
}

/* ── Tool Card ─────────────────────────────────────────────────────────────── */

function ToolCard({ tool, onInvoke, expanded, onToggle }) {
  const fields = schemaToFields(tool.inputSchema)
  const isServerHealthy = true // servers are fetched separately; assume ok for now

  return (
    <div className="bg-surface border border-border rounded-xl overflow-hidden">
      <div
        className="flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-white/[0.02] transition-colors"
        onClick={onToggle}
      >
        {/* Icon */}
        <div className={clsx(
          'w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5',
          'bg-[#4a80c8]/10 border border-[#4a80c8]/20'
        )}>
          <Wrench size={13} className="text-[#4a80c8]" />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-t1">{tool.name}</span>
            <Chip variant="blue">{tool.server || 'unknown'}</Chip>
          </div>
          <p className="text-[11px] text-t3 mt-0.5 line-clamp-2 leading-relaxed">
            {tool.description}
          </p>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className="text-[10px] font-mono text-t3">
              {fields.length} param{fields.length !== 1 ? 's' : ''}
            </span>
            {fields.filter((f) => f.required).map((f) => (
              <span key={f.name} className="text-[10px] font-mono text-rust/70">
                {f.name}
              </span>
            ))}
          </div>
        </div>

        {/* Expand toggle */}
        <div className="flex-shrink-0 mt-1">
          {expanded ? (
            <ChevronUp size={14} className="text-t3" />
          ) : (
            <ChevronDown size={14} className="text-t3" />
          )}
        </div>
      </div>

      {/* Expanded: schema + invoke */}
      {expanded && (
        <div className="border-t border-white/[0.05] px-4 py-4 space-y-3">
          {/* Parameters */}
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-t3 mb-2">
              Parameters
            </div>
            {fields.length === 0 ? (
              <div className="text-[11px] text-t3 italic">No parameters</div>
            ) : (
              <div className="space-y-2">
                {fields.map((field) => (
                  <div key={field.name} className="flex items-start gap-2">
                    <div className="flex items-center gap-1.5 min-w-0 w-40 flex-shrink-0">
                      <span className={clsx(
                        'text-[11px] font-mono font-semibold',
                        field.required ? 'text-rust' : 'text-t2'
                      )}>
                        {field.name}
                      </span>
                      {field.required && (
                        <span className="text-[9px] text-rust/50">*</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] text-t3 leading-relaxed">
                        {field.description}
                      </div>
                      {field.enum && (
                        <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                          {field.enum.map((opt) => (
                            <span key={opt} className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#4a80c8]/10 text-[#4a80c8]">
                              {opt}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="text-[9px] text-t3/60 mt-0.5 font-mono">
                        type: {field.type}
                        {field.default !== undefined ? ` · default: ${JSON.stringify(field.default)}` : ''}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Schema */}
          <SchemaViewer schema={tool.inputSchema} />

          {/* Invoke button */}
          <div className="pt-1">
            <button
              onClick={(e) => { e.stopPropagation(); onInvoke(tool) }}
              className={clsx(
                'inline-flex items-center gap-2 px-4 py-2 rounded-lg text-[11px] font-semibold',
                'bg-[#00b478]/15 text-[#00b478] border border-[#00b478]/30',
                'hover:bg-[#00b478]/25 transition-colors',
              )}
            >
              <Play size={11} />
              Invoke tool
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Invocation Form ──────────────────────────────────────────────────────── */

function InvokeForm({ tool, onSubmit, onClose, submitting }) {
  const fields = schemaToFields(tool.inputSchema)
  const defaults = getDefaultValues(fields)
  const [values, setValues] = useState(defaults)
  const [copied, setCopied] = useState(false)

  const handleChange = (name, type, value) => {
    let parsed = value
    if (type === 'integer') parsed = value === '' ? '' : parseInt(value, 10)
    if (type === 'number') parsed = value === '' ? '' : parseFloat(value)
    if (type === 'boolean') parsed = value === 'true'
    setValues((v) => ({ ...v, [name]: parsed }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const payload = {}
    for (const f of fields) {
      if (f.required || values[f.name] !== '') {
        payload[f.name] = values[f.name]
      }
    }
    onSubmit(tool.name, payload)
  }

  const payloadPreview = JSON.stringify({ name: tool.name, arguments: values }, null, 2)

  const handleCopy = () => {
    navigator.clipboard.writeText(payloadPreview)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="bg-[#0a0b10] border border-[#111318] rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[#111318] bg-[#060608]">
        <div className="w-7 h-7 rounded-md bg-[#00b478]/10 border border-[#00b478]/20 flex items-center justify-center flex-shrink-0">
          <Play size={12} className="text-[#00b478]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-t1 truncate">Invoke: {tool.name}</div>
          <div className="text-[10px] font-mono text-t3 truncate">{tool.server}</div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-md text-t3 hover:text-t2 hover:bg-white/[0.05] transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="p-4 space-y-4">
        {fields.length === 0 ? (
          <div className="text-[11px] text-t3 italic text-center py-4">
            This tool takes no parameters — ready to invoke.
          </div>
        ) : (
          fields.map((field) => (
            <div key={field.name} className="space-y-1">
              <label className="flex items-center gap-1.5 text-[11px]">
                <span className={clsx(
                  'font-mono font-semibold',
                  field.required ? 'text-rust' : 'text-t2'
                )}>
                  {field.name}
                </span>
                {field.required && (
                  <span className="text-[9px] text-rust/60">required</span>
                )}
                <span className="text-[10px] font-mono text-t3/60 ml-auto">{field.type}</span>
              </label>
              {field.enum ? (
                <select
                  value={values[field.name]}
                  onChange={(e) => handleChange(field.name, field.type, e.target.value)}
                  className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-xs text-t1 font-mono focus:outline-none focus:border-[#4a80c8]/50"
                >
                  <option value="">— select —</option>
                  {field.enum.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              ) : field.type === 'boolean' ? (
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 text-[11px] text-t2 cursor-pointer">
                    <input
                      type="radio"
                      name={field.name}
                      value="true"
                      checked={values[field.name] === true}
                      onChange={() => handleChange(field.name, 'boolean', true)}
                      className="accent-[#00b478]"
                    />
                    true
                  </label>
                  <label className="flex items-center gap-2 text-[11px] text-t2 cursor-pointer">
                    <input
                      type="radio"
                      name={field.name}
                      value="false"
                      checked={values[field.name] === false}
                      onChange={() => handleChange(field.name, 'boolean', false)}
                      className="accent-[#00b478]"
                    />
                    false
                  </label>
                </div>
              ) : field.type === 'integer' || field.type === 'number' ? (
                <input
                  type="number"
                  step={field.type === 'integer' ? 1 : 'any'}
                  value={values[field.name]}
                  onChange={(e) => handleChange(field.name, field.type, e.target.value)}
                  placeholder={field.default !== undefined ? `default: ${field.default}` : '0'}
                  className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-xs text-t1 font-mono focus:outline-none focus:border-[#4a80c8]/50 placeholder:text-t3/40"
                />
              ) : field.type === 'array' || field.type === 'object' ? (
                <textarea
                  value={typeof values[field.name] === 'string' ? values[field.name] : JSON.stringify(values[field.name], null, 2)}
                  onChange={(e) => {
                    try {
                      handleChange(field.name, field.type, JSON.parse(e.target.value))
                    } catch {
                      handleChange(field.name, field.type, e.target.value)
                    }
                  }}
                  rows={3}
                  placeholder={`JSON ${field.type}`}
                  className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-xs text-t1 font-mono focus:outline-none focus:border-[#4a80c8]/50 placeholder:text-t3/40 resize-none"
                />
              ) : (
                <textarea
                  value={values[field.name]}
                  onChange={(e) => handleChange(field.name, field.type, e.target.value)}
                  rows={2}
                  placeholder={field.description}
                  className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-xs text-t1 focus:outline-none focus:border-[#4a80c8]/50 placeholder:text-t3/40 resize-none"
                />
              )}
              {field.description && (
                <div className="text-[10px] text-t3 leading-relaxed">{field.description}</div>
              )}
            </div>
          ))
        )}

        {/* Payload preview */}
        <div className="border border-white/[0.05] rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-3 py-1.5 bg-white/[0.02]">
            <span className="text-[10px] font-mono text-t3">payload.json</span>
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1 text-[10px] text-t3 hover:text-t2 transition-colors"
            >
              {copied ? <CheckCheck size={10} className="text-green" /> : <Copy size={10} />}
              {copied ? 'copied' : 'copy'}
            </button>
          </div>
          <pre className="px-3 py-2 text-[10px] font-mono text-blue leading-relaxed overflow-x-auto max-h-40">
            {payloadPreview}
          </pre>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-1">
          <button
            type="submit"
            disabled={submitting}
            className={clsx(
              'inline-flex items-center gap-2 px-4 py-2 rounded-lg text-[11px] font-semibold',
              'bg-[#00b478] text-[#060608] hover:bg-[#00c87f] transition-colors',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            {submitting ? (
              <RotateCcw size={11} className="animate-spin" />
            ) : (
              <Play size={11} />
            )}
            {submitting ? 'Invoking…' : 'Invoke'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-[11px] font-semibold text-t2 border border-border hover:bg-surface transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}

/* ── Invocation History ────────────────────────────────────────────────────── */

function InvocationHistory({ history, onRerun }) {
  const [expandedId, setExpandedId] = useState(null)

  if (!history.length) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <Terminal size={28} className="text-t3/30 mb-3" />
        <div className="text-sm text-t3">No invocations yet</div>
        <div className="text-[11px] text-t3/60 mt-1">
          Select a tool and invoke it to see history here
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {history.map((entry) => {
        const isOpen = expandedId === entry.id
        const ok = entry.status === 'ok'
        const duration = entry.durationMs != null

        return (
          <div
            key={entry.id}
            className={clsx(
              'bg-surface border rounded-xl overflow-hidden transition-colors',
              ok ? 'border-green/20' : 'border-rust/20'
            )}
          >
            {/* Row header */}
            <div
              className="flex items-center gap-2.5 px-3 py-2.5 cursor-pointer hover:bg-white/[0.02] transition-colors"
              onClick={() => setExpandedId(isOpen ? null : entry.id)}
            >
              {/* Status dot */}
              <div
                className={clsx(
                  'w-2 h-2 rounded-full flex-shrink-0',
                  ok ? 'bg-green shadow-[0_0=6px_rgba(34,197,94,0.6)]' : 'bg-rust shadow-[0_0=6px_rgba(224,95,64,0.6)]'
                )}
              />

              {/* Tool name */}
              <span className="text-xs font-semibold text-t1 font-mono flex-shrink-0">
                {entry.tool}
              </span>

              {/* Duration */}
              {duration && (
                <span className="text-[10px] font-mono text-t3 flex-shrink-0">
                  {formatDuration(entry.durationMs)}
                </span>
              )}

              {/* Timestamp */}
              <span className="text-[10px] font-mono text-t3 ml-auto flex-shrink-0">
                <Clock size={9} className="inline mr-0.5" />
                {entry.timestamp}
              </span>

              {/* Rerun */}
              <button
                onClick={(e) => { e.stopPropagation(); onRerun(entry) }}
                className="p-1 rounded text-t3 hover:text-t2 hover:bg-white/[0.05] transition-colors flex-shrink-0"
                title="Re-run invocation"
              >
                <RotateCcw size={11} />
              </button>

              {/* Expand */}
              {isOpen ? (
                <ChevronUp size={12} className="text-t3 flex-shrink-0" />
              ) : (
                <ChevronDown size={12} className="text-t3 flex-shrink-0" />
              )}
            </div>

            {/* Expanded detail */}
            {isOpen && (
              <div className="border-t border-white/[0.05] px-3 py-3 space-y-3">
                {/* Arguments */}
                {entry.arguments && Object.keys(entry.arguments).length > 0 && (
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-t3 mb-1.5">
                      Arguments
                    </div>
                    <pre className="text-[10px] font-mono text-blue bg-black/20 rounded-lg px-3 py-2 overflow-x-auto leading-relaxed">
                      {JSON.stringify(entry.arguments, null, 2)}
                    </pre>
                  </div>
                )}

                {/* Result */}
                {entry.result !== undefined && (
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="text-[10px] font-bold uppercase tracking-widest text-t3">
                        Result
                      </div>
                      {ok && (
                        <span className="text-[10px] font-mono text-green">✓ ok</span>
                      )}
                      {!ok && (
                        <span className="text-[10px] font-mono text-rust">✗ error</span>
                      )}
                    </div>
                    <pre className={clsx(
                      'text-[10px] font-mono rounded-lg px-3 py-2 overflow-x-auto leading-relaxed max-h-60',
                      ok ? 'text-green/80 bg-green/5' : 'text-rust/80 bg-rust/5'
                    )}>
                      {typeof entry.result === 'string'
                        ? entry.result
                        : JSON.stringify(entry.result, null, 2)}
                    </pre>
                  </div>
                )}

                {/* Error */}
                {entry.error && (
                  <div className="text-[11px] text-rust bg-rust/10 border border-rust/20 rounded-lg px-3 py-2">
                    <AlertCircle size={11} className="inline mr-1" />
                    {entry.error}
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

/* ── Main Page ─────────────────────────────────────────────────────────────── */

export function McpPage() {
  const [tools, setTools] = useState([])
  const [loadingTools, setLoadingTools] = useState(true)
  const [toolsError, setToolsError] = useState(null)

  const [servers, setServers] = useState([])
  const [loadingServers, setLoadingServers] = useState(true)

  const [selectedTool, setSelectedTool] = useState(null)
  const [formOpen, setFormOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [history, setHistory] = useState([])
  const [historyFilter, setHistoryFilter] = useState('all')

  const [search, setSearch] = useState('')
  const [serverFilter, setServerFilter] = useState('all')
  const [expandedTool, setExpandedTool] = useState(null)

  // Load tools
  const loadTools = useCallback(async () => {
    setLoadingTools(true)
    setToolsError(null)
    try {
      const res = await apiFetch('/api/mcp/tools')
      if (res.ok) {
        const data = await res.json()
        setTools(Array.isArray(data.tools) ? data.tools : MOCK_TOOLS)
      } else {
        setTools(MOCK_TOOLS)
      }
    } catch {
      setTools(MOCK_TOOLS)
    } finally {
      setLoadingTools(false)
    }
  }, [])

  // Load servers
  const loadServers = useCallback(async () => {
    setLoadingServers(true)
    try {
      const res = await apiFetch('/api/mcp')
      if (res.ok) {
        const data = await res.json()
        setServers(data.servers || [])
      }
    } catch {
      // non-critical
    } finally {
      setLoadingServers(false)
    }
  }, [])

  useEffect(() => {
    loadTools()
    loadServers()
  }, [loadTools, loadServers])

  // Filter tools
  const filteredTools = useMemo(() => {
    return tools.filter((t) => {
      const matchSearch = !search ||
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        t.description?.toLowerCase().includes(search.toLowerCase())
      const matchServer = serverFilter === 'all' || t.server === serverFilter
      return matchSearch && matchServer
    })
  }, [tools, search, serverFilter])

  const serverOptions = useMemo(() => {
    const seen = new Set()
    return tools
      .map((t) => t.server)
      .filter((s) => s && !seen[s] && (seen[s] = true))
  }, [tools])

  const handleInvoke = (tool) => {
    setSelectedTool(tool)
    setFormOpen(true)
    setExpandedTool(null)
  }

  const handleSubmit = async (toolName, arguments_) => {
    setSubmitting(true)
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`
    const entry = {
      id,
      tool: toolName,
      arguments: arguments_,
      timestamp: timestamp(),
      status: 'pending',
      result: null,
      error: null,
      durationMs: null,
    }
    setHistory((h) => [entry, ...h])
    setFormOpen(false)
    setSubmitting(false)

    const start = Date.now()
    try {
      const res = await apiFetch('/api/mcp/invoke', {
        method: 'POST',
        body: JSON.stringify({ name: toolName, arguments: arguments_ }),
      })
      const body = await res.json().catch(() => ({}))
      const duration = Date.now() - start

      setHistory((h) =>
        h.map((e) =>
          e.id === id
            ? {
                ...e,
                status: res.ok ? 'ok' : 'err',
                result: body.result ?? body.data ?? body,
                error: body.error || (res.ok ? null : `HTTP ${res.status}`),
                durationMs: duration,
              }
            : e
        )
      )
    } catch (e) {
      const duration = Date.now() - start
      setHistory((h) =>
        h.map((e) =>
          e.id === id
            ? { ...e, status: 'err', error: e.message || 'Network error', durationMs: duration }
            : e
        )
      )
    }
  }

  const handleRerun = (entry) => {
    const tool = tools.find((t) => t.name === entry.tool)
    if (!tool) return
    setSelectedTool(tool)
    setFormOpen(true)
  }

  const handleClearHistory = () => setHistory([])

  const filteredHistory = useMemo(() => {
    if (historyFilter === 'all') return history
    if (historyFilter === 'ok') return history.filter((e) => e.status === 'ok')
    if (historyFilter === 'err') return history.filter((e) => e.status === 'err')
    return history
  }, [history, historyFilter])

  const runningCount = servers.filter((s) => s.status === 'running').length
  const totalTools = tools.length

  return (
    <div className="relative isolate max-w-6xl min-w-0 space-y-5 pb-8">
      {/* Ambient background */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-20 left-8 h-64 w-64 rounded-full bg-[#4a80c8]/8 blur-3xl" />
        <div className="absolute top-32 right-[-4rem] h-64 w-64 rounded-full bg-[#00b478]/8 blur-3xl" />
      </div>

      {/* Header */}
      <section className="relative overflow-hidden rounded-[28px] border border-white/[0.07] bg-[linear-gradient(180deg,rgba(10,11,16,0.96),rgba(10,11,16,0.88))] shadow-[0_30px_80px_rgba(0,0,0,0.45)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(74,128,200,0.12),transparent_34%),radial-gradient(circle_at_80%_20%,rgba(0,180,120,0.10),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(224,95,64,0.08),transparent_30%)]" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        <div className="relative z-10 flex flex-col gap-4 p-5 sm:p-6 lg:p-7 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-[0.28em] text-t3">
              <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[#4a80c8]">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#4a80c8] shadow-[0_0_5px_#4a80c8]" />
                  MCP Tools
                </span>
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-t1">MCP Tool Browser</h1>
            <div className="flex flex-wrap items-center gap-3 text-sm text-t2">
              <span className="inline-flex items-center gap-1.5">
                <Package size={13} className="text-[#4a80c8]" />
                <span className="font-mono">{totalTools} tools</span>
              </span>
              <span className="text-t3">·</span>
              <span className="inline-flex items-center gap-1.5">
                <Server size={13} className="text-green" />
                <span className="font-mono">
                  {loadingServers ? '…' : `${runningCount}/${servers.length} servers running`}
                </span>
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { loadTools(); loadServers() }}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border text-[11px] text-t2 hover:bg-surface2 transition-colors"
            >
              <RotateCcw size={12} className={loadingTools ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        </div>
      </section>

      {/* Tool browser + History layout */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        {/* Tool browser — 3 cols */}
        <div className="xl:col-span-3 space-y-3">
          {/* Controls */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Search */}
            <div className="relative flex-1 min-w-48">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-t3" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search tools…"
                className="w-full bg-surface border border-border rounded-lg pl-9 pr-3 py-2 text-xs text-t1 placeholder:text-t3/50 focus:outline-none focus:border-[#4a80c8]/50"
              />
            </div>
            {/* Server filter */}
            <select
              value={serverFilter}
              onChange={(e) => setServerFilter(e.target.value)}
              className="bg-surface border border-border rounded-lg px-3 py-2 text-xs text-t1 font-mono focus:outline-none focus:border-[#4a80c8]/50"
            >
              <option value="all">All servers</option>
              {serverOptions.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Tool list */}
          {loadingTools ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-surface border border-border rounded-xl p-4 animate-pulse">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 rounded-md bg-border" />
                    <div className="space-y-2 flex-1">
                      <div className="h-4 w-32 rounded bg-border" />
                      <div className="h-3 w-48 rounded bg-border" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : toolsError ? (
            <div className="bg-surface border border-rust/30 rounded-xl p-6 text-center">
              <AlertCircle size={20} className="text-rust mx-auto mb-2" />
              <div className="text-sm text-rust">Failed to load tools</div>
              <div className="text-[11px] text-t3 mt-1">{toolsError}</div>
              <button
                onClick={loadTools}
                className="mt-3 px-3 py-1.5 rounded-lg text-[11px] border border-border text-t2 hover:bg-surface2"
              >
                Retry
              </button>
            </div>
          ) : filteredTools.length === 0 ? (
            <div className="bg-surface border border-border rounded-xl p-8 text-center">
              <Search size={24} className="text-t3/30 mx-auto mb-2" />
              <div className="text-sm text-t3">No tools match your filter</div>
              {(search || serverFilter !== 'all') && (
                <button
                  onClick={() => { setSearch(''); setServerFilter('all') }}
                  className="mt-2 text-[11px] text-[#4a80c8] hover:underline"
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredTools.map((tool) => (
                <ToolCard
                  key={tool.name}
                  tool={tool}
                  expanded={expandedTool === tool.name}
                  onToggle={() => setExpandedTool(expandedTool === tool.name ? null : tool.name)}
                  onInvoke={handleInvoke}
                />
              ))}
            </div>
          )}
        </div>

        {/* Right panel — 2 cols */}
        <div className="xl:col-span-2 space-y-3">
          {/* Invoke form (when a tool is selected) */}
          {formOpen && selectedTool && (
            <div className="sticky top-3">
              <InvokeForm
                tool={selectedTool}
                onSubmit={handleSubmit}
                onClose={() => { setFormOpen(false); setSelectedTool(null) }}
                submitting={submitting}
              />
            </div>
          )}

          {/* Invocation history */}
          <div className="bg-surface border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-white/[0.05] flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Terminal size={13} className="text-[#4a80c8]" />
                <span className="text-xs font-bold text-t2">Invocation History</span>
                {history.length > 0 && (
                  <span className="font-mono text-[10px] text-t3">{history.length}</span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                {/* Filter tabs */}
                {['all', 'ok', 'err'].map((f) => (
                  <button
                    key={f}
                    onClick={() => setHistoryFilter(f)}
                    className={clsx(
                      'px-2 py-0.5 rounded text-[10px] font-mono transition-colors',
                      historyFilter === f
                        ? 'bg-[#4a80c8]/20 text-[#4a80c8]'
                        : 'text-t3 hover:text-t2'
                    )}
                  >
                    {f === 'all' ? 'All' : f === 'ok' ? '✓' : '✗'}
                  </button>
                ))}
                {history.length > 0 && (
                  <button
                    onClick={handleClearHistory}
                    className="ml-1 p-1 rounded text-t3 hover:text-rust hover:bg-rust/10 transition-colors"
                    title="Clear history"
                  >
                    <X size={11} />
                  </button>
                )}
              </div>
            </div>
            <div className="p-3 max-h-[60vh] overflow-y-auto">
              <InvocationHistory
                history={filteredHistory}
                onRerun={handleRerun}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
