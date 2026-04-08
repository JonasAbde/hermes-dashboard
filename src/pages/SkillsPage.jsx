import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Wrench, Search, X, Edit3, Save, Copy, BookOpen,
  ChevronRight, RefreshCw, Tag, FolderOpen, FileCode
} from 'lucide-react'
import { clsx } from 'clsx'
import { Chip } from '../components/ui/Chip'
import { apiFetch } from '../utils/auth'

/* ── helpers ─────────────────────────────────────────── */
function parseFrontmatter(content) {
  const fm = content.match(/^---\n([\s\S]+?)\n---\n?([\s\S]*)$/)
  if (!fm) return { frontmatter: {}, body: content }
  try {
    // Simple YAML parser for our frontmatter format
    const lines = fm[1].split('\n')
    const obj = {}
    let currentKey = null
    let inBlock = false
    let blockIndent = 0
    const stack = [{ obj, indent: -1 }]

    for (const line of lines) {
      if (inBlock) {
        const indent = line.match(/^(\s*)/)[1].length
        if (indent <= blockIndent && line.trim()) {
          inBlock = false
          currentKey = null
        } else if (line.trim()) {
          const match = line.match(/^(\s*)(-?\s*)(.+)/)
          if (match) {
            const [, pre, bullet, val] = match
            const value = val.trim()
            if (value.endsWith(':')) {
              const key = value.replace(/:$/, '')
              const newObj = {}
              if (Array.isArray(stack[stack.length - 1].obj)) {
                stack[stack.length - 1].obj.push(newObj)
              } else {
                stack[stack.length - 1].obj[key] = newObj
              }
              stack.push({ obj: newObj, indent: indent + pre.length + bullet.length })
            } else if (value) {
              const parsed = value.replace(/^["']|["']$/g, '')
              if (Array.isArray(stack[stack.length - 1].obj)) {
                stack[stack.length - 1].obj.push(parsed)
              } else {
                stack[stack.length - 1].obj[currentKey] = parsed
              }
            }
          }
          continue
        }
      }

      const keyMatch = line.match(/^(\s*)([^:]+):\s*(.*)$/)
      if (keyMatch) {
        const [, pre, key, rawVal] = keyMatch
        const trimmedKey = key.trim()
        const indent = pre.length
        while (stack.length > 1 && stack[stack.length - 1].indent >= indent) stack.pop()

        if (rawVal.trim() === '' || rawVal.trim() === '|') {
          currentKey = trimmedKey
          if (Array.isArray(stack[stack.length - 1].obj)) {
            stack[stack.length - 1].obj.push({})
            stack.push({ obj: stack[stack.length - 1].obj[stack[stack.length - 1].obj.length - 1], indent })
          } else {
            stack[stack.length - 1].obj[trimmedKey] = {}
            stack.push({ obj: stack[stack.length - 1].obj[trimmedKey], indent })
          }
        } else if (rawVal.trim() === '[') {
          stack[stack.length - 1].obj[trimmedKey] = []
          currentKey = trimmedKey
        } else if (rawVal.trim() === ']') {
          // array closed
        } else {
          let val = rawVal.trim()
          if (val === 'true') val = true
          else if (val === 'false') val = false
          else val = val.replace(/^["']|["']$/g, '')
          stack[stack.length - 1].obj[trimmedKey] = val
        }
      } else if (line.trim().startsWith('-')) {
        const val = line.replace(/^\s*-\s*/, '').trim().replace(/^["']|["']$/g, '')
        if (stack.length > 0) {
          if (!Array.isArray(stack[stack.length - 1].obj)) {
            stack[stack.length - 1].obj[currentKey] = stack[stack.length - 1].obj[currentKey] || []
          }
          if (Array.isArray(stack[stack.length - 1].obj[currentKey])) {
            stack[stack.length - 1].obj[currentKey].push(val)
          }
        }
      }
    }

    return { frontmatter: obj, body: fm[2]?.trim() || '' }
  } catch {
    // acceptable: malformed frontmatter — falls back to empty object gracefully
    return { frontmatter: {}, body: content }
  }
}

function serializeFrontmatter(fm) {
  const lines = []
  for (const [key, val] of Object.entries(fm)) {
    if (val === null || val === undefined) continue
    if (Array.isArray(val)) {
      lines.push(`${key}:`)
      if (val.length > 0) {
        for (const item of val) {
          if (typeof item === 'object') {
            lines.push(`  ${Object.entries(item).map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`).join(', ')}`)
          } else {
            lines.push(`  - ${item}`)
          }
        }
      } else {
        lines.push(`  []`)
      }
    } else if (typeof val === 'object') {
      lines.push(`${key}:`)
      for (const [k, v] of Object.entries(val)) {
        lines.push(`  ${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`)
      }
    } else {
      const str = typeof val === 'string' && (val.includes(':') || val.includes('#')) ? `"${val}"` : val
      lines.push(`${key}: ${str}`)
    }
  }
  return lines.join('\n')
}

function skillPathToName(path) {
  // Extract the skill identifier from path like "mlops/models/whisper"
  return path.replace(/^skills\/?/, '').replace(/\/SKILL\.md$/, '')
}

function nameToSkillPath(name) {
  return name
}

/* ── Skill Card ──────────────────────────────────────── */
function SkillCard({ skill, onClick }) {
  const fm = skill.frontmatter || {}
  const category = skill.category || skill.path?.split('/').slice(0, -1).join('/') || 'other'
  const source = skill.source || 'custom'
  // Status: prefer skill.enabled, then fm.enabled, default to true (Aktiv)
  const isEnabled = skill.enabled ?? fm.enabled ?? true

  return (
    <div
      onClick={() => onClick(skill)}
      className="bg-[#0d0f17] border border-[#111318] rounded-lg p-4 cursor-pointer 
                 hover:border-[#00b478]/40 transition-all duration-150 group"
    >
      <div className="flex items-start gap-3 mb-3">
        <div className="w-9 h-9 rounded-md bg-[#e05f40]/10 border border-[#e05f40]/20 
                        flex items-center justify-center flex-shrink-0 group-hover:bg-[#e05f40]/15 transition-colors">
          <FileCode size={14} className="text-[#e05f40]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-[#d8d8e0] truncate group-hover:text-white transition-colors">
            {fm.name || skill.name}
          </div>
          <div className="text-[11px] text-[#6b6b80] font-mono mt-0.5 truncate">
            {skill.name}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Chip variant={isEnabled ? 'online' : 'offline'} pulse={isEnabled}>
            {isEnabled ? 'Aktiv' : 'Inaktiv'}
          </Chip>
          <Chip variant={source === 'builtin' ? 'blue' : 'online'}>
            {source === 'builtin' ? 'builtin' : 'custom'}
          </Chip>
        </div>
      </div>

      {fm.description && (
        <p className="text-[11px] text-[#6b6b80] leading-relaxed line-clamp-2 mb-3">
          {fm.description}
        </p>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        {fm.category && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full 
                           bg-[#4a80c8]/10 text-[#4a80c8] text-[10px] font-mono border border-[#4a80c8]/20">
            <Tag size={9} />
            {fm.category}
          </span>
        )}
        {fm.version && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full 
                           bg-[#6b6b80]/10 text-[#6b6b80] text-[10px] font-mono">
            v{fm.version}
          </span>
        )}
      </div>
    </div>
  )
}

/* ── Category Chip ───────────────────────────────────── */
function CategoryChip({ category, count, active, onClick }) {
  return (
    <button
      onClick={() => onClick(category)}
      className={clsx(
        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md font-mono text-[11px] transition-all',
        active
          ? 'bg-[#00b478]/15 text-[#00b478] border border-[#00b478]/30'
          : 'bg-[#0d0f17] text-[#6b6b80] border border-[#111318] hover:border-[#6b6b80]/40 hover:text-[#d8d8e0]'
      )}
    >
      <FolderOpen size={11} />
      <span>{category === 'all' ? 'All Skills' : category}</span>
      <span className={clsx(
        'px-1.5 py-0.5 rounded text-[10px]',
        active ? 'bg-[#00b478]/20' : 'bg-[#111318]'
      )}>
        {count}
      </span>
    </button>
  )
}

/* ── Skill Modal ─────────────────────────────────────── */
function SkillModal({ skill, onClose, onRefresh }) {
  const [content, setContent] = useState(null)
  const [frontmatter, setFrontmatter] = useState({})
  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(true)
  const [editMode, setEditMode] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editedContent, setEditedContent] = useState('')
  const [editedFrontmatter, setEditedFrontmatter] = useState({})
  const [editedBody, setEditedBody] = useState('')
  const [hasChanges, setHasChanges] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState(null)

  const skillName = skill.name

  useEffect(() => {
    setLoading(true)
    setError(null)
    apiFetch(`/api/skills/${encodeURIComponent(skillName)}`)
      .then(r => r.json())
      .then(data => {
        if (data.exists === false) {
          setError('Skill not found on disk')
          setLoading(false)
          return
        }
        setContent(data.content || '')
        const fm = data.frontmatter || {}
        setFrontmatter(fm)
        setBody(data.content || '')
        setEditedContent(data.content || '')
        setEditedFrontmatter({ ...fm })
        setEditedBody(data.content || '')
        setLoading(false)
      })
      .catch(e => {
        setError(e.message)
        setLoading(false)
      })
  }, [skillName])

  const handleEdit = () => {
    setEditMode(true)
    setEditedContent(content)
    setEditedFrontmatter({ ...frontmatter })
    setEditedBody(body)
  }

  const handleCancel = () => {
    setEditMode(false)
    setEditedContent(content)
    setEditedFrontmatter({ ...frontmatter })
    setEditedBody(body)
    setHasChanges(false)
  }

  const handleContentChange = (newContent) => {
    setEditedContent(newContent)
    const { frontmatter: fm, body: b } = parseFrontmatter(newContent)
    setEditedFrontmatter(fm)
    setEditedBody(b)
    setHasChanges(true)
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      const newContent = `---\n${serializeFrontmatter(editedFrontmatter)}\n---\n\n${editedBody}`
      const res = await apiFetch(`/api/skills/${encodeURIComponent(skillName)}`, {
        method: 'PUT',
        body: JSON.stringify({ content: newContent })
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setContent(newContent)
      setFrontmatter(editedFrontmatter)
      setBody(editedBody)
      setEditMode(false)
      setHasChanges(false)
    } catch (e) {
      setError('Failed to save: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleRefresh = async () => {
    if (onRefresh) await onRefresh(skillName)
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const fm = frontmatter

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div 
        className="relative w-full max-w-3xl max-h-[85vh] bg-[#0a0b10] border border-[#111318] rounded-xl shadow-2xl flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#111318] bg-[#060608]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-md bg-[#e05f40]/10 border border-[#e05f40]/20 
                            flex items-center justify-center flex-shrink-0">
              <BookOpen size={13} className="text-[#e05f40]" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-[#d8d8e0] truncate">
                {fm.name || skillName}
              </h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] font-mono text-[#6b6b80]">
                  {skillName}
                </span>
                <Chip variant={skill.source === 'builtin' ? 'blue' : 'online'}>
                  {skill.source || 'custom'}
                </Chip>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {hasChanges && (
              <span className="text-[10px] text-[#e09040] font-mono animate-pulse">
                ● Unsaved
              </span>
            )}
            <button
              onClick={handleRefresh}
              className="p-2 rounded-md text-[#6b6b80] hover:text-[#d8d8e0] hover:bg-[#0d0f17] transition-colors"
              title="Refresh skill"
            >
              <RefreshCw size={14} />
            </button>
            <button
              onClick={handleCopy}
              className="p-2 rounded-md text-[#6b6b80] hover:text-[#d8d8e0] hover:bg-[#0d0f17] transition-colors"
              title="Copy content"
            >
              <Copy size={14} className={copied ? 'text-[#00b478]' : ''} />
            </button>
            {!editMode ? (
              <>
                <button
                  onClick={handleEdit}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md 
                           bg-[#4a80c8]/15 text-[#4a80c8] border border-[#4a80c8]/30 
                           hover:bg-[#4a80c8]/25 transition-colors text-xs"
                >
                  <Edit3 size={12} />
                  Edit
                </button>
                <button
                  onClick={onClose}
                  className="p-2 rounded-md text-[#6b6b80] hover:text-[#d8d8e0] hover:bg-[#0d0f17] transition-colors"
                >
                  <X size={14} />
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleCancel}
                  className="px-3 py-1.5 rounded-md text-[#6b6b80] hover:text-[#d8d8e0] 
                           border border-[#111318] hover:border-[#6b6b80]/40 transition-colors text-xs"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md 
                           bg-[#00b478]/15 text-[#00b478] border border-[#00b478]/30 
                           hover:bg-[#00b478]/25 transition-colors text-xs disabled:opacity-50"
                >
                  <Save size={12} />
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Frontmatter metadata */}
        {!loading && !error && (
          <div className="px-5 py-3 border-b border-[#111318] bg-[#060608]/50">
            <div className="flex items-center gap-4 flex-wrap text-[11px]">
              {fm.description && (
                <div className="text-[#6b6b80]">
                  <span className="text-[#4a80c8] font-mono">description:</span>{' '}
                  <span className="text-[#d8d8e0]">{fm.description}</span>
                </div>
              )}
              {fm.category && (
                <div className="flex items-center gap-1">
                  <span className="text-[#4a80c8] font-mono">category:</span>
                  <span className="text-[#d8d8e0]">{fm.category}</span>
                </div>
              )}
              {fm.version && (
                <div className="flex items-center gap-1">
                  <span className="text-[#4a80c8] font-mono">version:</span>
                  <span className="text-[#d8d8e0]">{fm.version}</span>
                </div>
              )}
              {fm.author && (
                <div className="flex items-center gap-1">
                  <span className="text-[#4a80c8] font-mono">author:</span>
                  <span className="text-[#d8d8e0]">{fm.author}</span>
                </div>
              )}
              {fm.triggers && Array.isArray(fm.triggers) && fm.triggers.length > 0 && (
                <div className="flex items-center gap-1 flex-wrap">
                  <span className="text-[#4a80c8] font-mono">triggers:</span>
                  {fm.triggers.slice(0, 3).map((t, i) => (
                    <span key={i} className="px-1.5 py-0.5 rounded bg-[#e09040]/10 text-[#e09040] text-[10px]">
                      {t}
                    </span>
                  ))}
                  {fm.triggers.length > 3 && (
                    <span className="text-[#6b6b80]">+{fm.triggers.length - 3} more</span>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Content area */}
        <div className="flex-1 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="flex items-center gap-3 text-[#6b6b80]">
                <RefreshCw size={16} className="animate-spin" />
                <span className="text-sm">Loading skill...</span>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="text-[#e05f40] text-sm mb-2">Failed to load skill</div>
                <div className="text-[#6b6b80] text-xs">{error}</div>
              </div>
            </div>
          ) : editMode ? (
            <div className="h-full flex flex-col">
              {/* Frontmatter editor */}
              <div className="p-4 border-b border-[#111318]">
                <div className="text-[10px] font-mono text-[#6b6b80] mb-2 uppercase tracking-wider">
                  Frontmatter
                </div>
                <textarea
                  value={serializeFrontmatter(editedFrontmatter)}
                  onChange={(e) => {
                    try {
                      const lines = e.target.value.split('\n')
                      const obj = {}
                      for (const line of lines) {
                        const match = line.match(/^(\s*)([^:]+):\s*(.*)$/)
                        if (match) {
                          const [, pre, key, val] = match
                          let value = val.trim()
                          if (value === 'true') value = true
                          else if (value === 'false') value = false
                          else value = value.replace(/^["']|["']$/g, '')
                          obj[key.trim()] = value
                        }
                      }
                      setEditedFrontmatter(obj)
                      setHasChanges(true)
                    } catch {} // acceptable: malformed frontmatter — falls back gracefully
                  }}
                  className="w-full h-32 bg-[#0d0f17] border border-[#111318] rounded-md 
                           text-[11px] font-mono text-[#d8d8e0] p-3 resize-none
                           focus:outline-none focus:border-[#4a80c8]/50"
                  spellCheck={false}
                />
              </div>
              {/* Body editor */}
              <div className="flex-1 p-4 overflow-hidden flex flex-col">
                <div className="text-[10px] font-mono text-[#6b6b80] mb-2 uppercase tracking-wider">
                  Content
                </div>
                <textarea
                  value={editedBody}
                  onChange={(e) => {
                    setEditedBody(e.target.value)
                    handleContentChange(`---\n${serializeFrontmatter(editedFrontmatter)}\n---\n\n${e.target.value}`)
                  }}
                  className="flex-1 w-full bg-[#0d0f17] border border-[#111318] rounded-md 
                           text-[11px] font-mono text-[#d8d8e0] p-3 resize-none
                           focus:outline-none focus:border-[#4a80c8]/50"
                  spellCheck={false}
                />
              </div>
            </div>
          ) : (
            <div className="h-full overflow-y-auto p-5">
              <pre className="text-[11px] font-mono text-[#d8d8e0] leading-relaxed whitespace-pre-wrap
                            bg-[#0d0f17] rounded-lg p-4 border border-[#111318] max-h-[60vh] overflow-auto">
                {content}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ── Main Skills Page ───────────────────────────────── */
export function SkillsPage() {
  const [skills, setSkills] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [selectedSkill, setSelectedSkill] = useState(null)
  const [refreshing, setRefreshing] = useState(null)

  const fetchSkills = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiFetch('/api/skills')
      const data = await res.json()
      setSkills(data.skills || [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSkills()
  }, [fetchSkills])

  // Build category list with counts
  const categories = useMemo(() => {
    const cats = { all: skills.length }
    for (const skill of skills) {
      const cat = skill.category || 'other'
      cats[cat] = (cats[cat] || 0) + 1
    }
    return Object.entries(cats)
      .sort(([a], [b]) => a === 'all' ? -1 : b === 'all' ? 1 : a.localeCompare(b))
  }, [skills])

  // Filter skills
  const filteredSkills = useMemo(() => {
    let result = skills

    // Category filter
    if (categoryFilter !== 'all') {
      result = result.filter(s => (s.category || 'other') === categoryFilter)
    }

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(s => {
        const fm = s.frontmatter || {}
        return (
          s.name?.toLowerCase().includes(q) ||
          s.path?.toLowerCase().includes(q) ||
          fm.description?.toLowerCase().includes(q) ||
          fm.category?.toLowerCase().includes(q)
        )
      })
    }

    return result
  }, [skills, categoryFilter, searchQuery])

  const handleRefreshSkill = async (skillName) => {
    setRefreshing(skillName)
    try {
      await apiFetch(`/api/skills/${encodeURIComponent(skillName)}/refresh`, { method: 'POST' })
      await fetchSkills()
    } catch (e) { if (import.meta.env.DEV) console.error('[SkillsPage] skill refresh error:', e) }
    setRefreshing(null)
  }

  return (
    <div className="max-w-5xl space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#e05f40]/10 border border-[#e05f40]/20 
                          flex items-center justify-center">
            <Wrench size={18} className="text-[#e05f40]" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-[#d8d8e0]">Skills</h1>
            <p className="text-[11px] text-[#6b6b80]">
              {skills.length} skills installed • {filteredSkills.length} shown
            </p>
          </div>
        </div>
        <button
          onClick={fetchSkills}
          className="flex items-center gap-2 px-3 py-2 rounded-md 
                   bg-[#0d0f17] border border-[#111318] text-[#6b6b80] 
                   hover:text-[#d8d8e0] hover:border-[#6b6b80]/40 transition-colors text-xs"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6b6b80]" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search skills by name, category, or description..."
          className="w-full pl-10 pr-4 py-2.5 bg-[#0d0f17] border border-[#111318] rounded-lg
                   text-sm text-[#d8d8e0] placeholder-[#6b6b80]
                   focus:outline-none focus:border-[#4a80c8]/50 transition-colors"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6b6b80] hover:text-[#d8d8e0]"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Category chips */}
      <div className="flex items-center gap-2 flex-wrap">
        {categories.map(([cat, count]) => (
          <CategoryChip
            key={cat}
            category={cat}
            count={count}
            active={categoryFilter === cat}
            onClick={setCategoryFilter}
          />
        ))}
      </div>

      {/* Skills grid */}
      {error ? (
        <div className="py-12 text-center">
          <div className="text-[#e05f40] text-sm mb-2">Failed to load skills</div>
          <div className="text-[#6b6b80] text-xs">{error}</div>
          <button
            onClick={fetchSkills}
            className="mt-4 px-4 py-2 rounded-md bg-[#0d0f17] border border-[#111318] 
                     text-[#6b6b80] hover:text-[#d8d8e0] text-xs"
          >
            Try again
          </button>
        </div>
      ) : loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="bg-[#0d0f17] border border-[#111318] rounded-lg p-4">
              <div className="flex gap-3 mb-3">
                <div className="skeleton w-9 h-9 rounded-md" />
                <div className="flex-1">
                  <div className="skeleton h-3 w-2/3 mb-2" />
                  <div className="skeleton h-2 w-1/3" />
                </div>
              </div>
              <div className="skeleton h-8 w-full mb-2" />
              <div className="skeleton h-4 w-full" />
            </div>
          ))}
        </div>
      ) : filteredSkills.length === 0 ? (
        <div className="py-12 text-center">
          <div className="text-[#6b6b80] text-sm">
            {searchQuery || categoryFilter !== 'all'
              ? 'No skills match your filters'
              : 'Skills hub is empty'}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredSkills.map((skill) => (
            <SkillCard
              key={skill.name}
              skill={skill}
              onClick={setSelectedSkill}
            />
          ))}
        </div>
      )}

      {/* Skill detail modal */}
      {selectedSkill && (
        <SkillModal
          skill={selectedSkill}
          onClose={() => setSelectedSkill(null)}
          onRefresh={handleRefreshSkill}
        />
      )}
    </div>
  )
}
