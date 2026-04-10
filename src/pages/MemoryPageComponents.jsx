import { useState } from 'react'
import { Chip } from '../components/ui/Chip'
import { Search, X, FileText, Layers, Clock, RefreshCw } from 'lucide-react'

// ─── Storage Panel ────────────────────────────────────────────────────────

export function StoragePanel({ data }) {
  const storageKb = data?.storage_kb ?? 0
  const maxKb = data?.max_kb ?? 2500
  const totalEntries = data?.total_entries ?? 0
  const lastUpdate = data?.last_memory_update ?? null
  const byCat = data?.by_category ?? {}

  const pct = Math.min(Math.round((storageKb / maxKb) * 100), 100)
  const healthColor = pct > 80 ? '#e63946' : pct > 60 ? '#f59e0b' : '#00b478'

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold text-t3 uppercase tracking-wider">Storage</span>
        <span className="text-[10px] font-mono text-t3">{storageKb} / {maxKb} KB</span>
      </div>
      <div className="h-2 bg-border rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-1000"
          style={{ width: `${pct}%`, background: healthColor, boxShadow: `0 0 12px ${healthColor}66` }}
        />
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xl font-black text-t1">{pct}%</span>
        <span className="text-[10px] text-t3 font-mono">
          {pct > 80 ? '⚠ High' : pct > 60 ? '◐ Medium' : '✓ Stable'}
        </span>
      </div>
      <div className="flex items-center justify-between border-t border-border pt-2">
        <span className="text-[10px] text-t3">
          <Layers size={10} className="inline mr-1" /> {totalEntries} entries
        </span>
        <span className="text-[10px] text-t3">
          <Clock size={10} className="inline mr-1" /> {lastUpdate ? 'Updated' : 'Never'}
        </span>
      </div>
    </div>
  )
}

// ─── Activity Panel ───────────────────────────────────────────────────────

export function ActivityPanel({ data }) {
  const dayGrid = data?.day_grid ?? []
  const lastWrite = data?.last_write ?? null
  const maxCount = Math.max(...dayGrid.map(d => d.count), 1)

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Layers size={12} className="text-amber" />
        <span className="text-[10px] font-bold text-t3 uppercase tracking-wider">7 Days</span>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {dayGrid.map(day => {
          const height = day.count > 0 ? Math.max(Math.round((day.count / maxCount) * 40), 4) : 4
          const isToday = day.date === new Date().toISOString().slice(0, 10)
          return (
            <div key={day.date} className="flex flex-col items-center gap-1">
              <div className="w-full flex items-center justify-end" style={{ height: 44 }}>
                <div
                  className="w-4 rounded-sm"
                  style={{
                    height,
                    background: day.count > 0 ? (isToday ? '#f59e0b' : '#00b478') : '#1e2130',
                    boxShadow: day.count > 0 ? `0 0 6px ${isToday ? '#f59e0b' : '#00b478'}66` : 'none',
                  }}
                />
              </div>
              <span className={`text-[9px] font-mono ${isToday ? 'text-amber font-bold' : 'text-t3'}`}>
                {day.label}
              </span>
            </div>
          )
        })}
      </div>

      {lastWrite && (
        <div className="flex items-center justify-between pt-2 border-t border-border">
          <span className="text-[10px] text-t3">Last activity:</span>
          <span className="text-[10px] font-mono text-amber">
            {new Date(lastWrite).toLocaleDateString('da-DK', { day: '2-digit', month: 'short' })}
          </span>
        </div>
      )}
    </div>
  )
}

// ─── File List Tab ─────────────────────────────────────────────────────────

export function FileListTab({ files, activeTab, setActiveTab }) {
  const [sortBy, setSortBy] = useState('mtime')
  const [search, setSearch] = useState('')
  const [expandedFile, setExpandedFile] = useState(null)

  const tabs = [
    { key: 'all', label: 'Alle', count: files.length },
    { key: 'curated', label: 'Curated', count: files.filter(f => f.category === 'curated').length },
    { key: 'daily', label: 'Daglig', count: files.filter(f => f.category === 'daily').length },
    { key: 'cache', label: 'Cache', count: files.filter(f => f.category === 'cache').length },
  ]

  const filtered = files
    .filter(f => activeTab === 'all' || f.category === activeTab)
    .filter(f => !search || f.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === 'size') return b.size_kb - a.size_kb
      if (sortBy === 'name') return a.name.localeCompare(b.name)
      return new Date(b.mtime) - new Date(a.mtime)
    })

  const catColor = { curated: '#00b478', daily: '#4a80c8', cache: '#6b6b80', other: '#3a3b4a', snapshot: '#e09040' }
  const catLabel = { curated: 'Curated', daily: 'Daglig', cache: 'Cache', other: 'Andet', snapshot: 'Snapshot' }

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex flex-wrap gap-1 px-4 pt-3 pb-2 border-b border-border bg-surface2/30">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-3 py-2 text-[11px] font-semibold transition-all ${
              activeTab === tab.key ? 'text-t1 border-b-2 border-amber' : 'text-t3 hover:text-t2'
            }`}
          >
            {tab.label} <span className="text-[9px] opacity-60">{tab.count}</span>
          </button>
        ))}
        <div className="hidden sm:block flex-1" />
        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value)}
          className="text-[10px] bg-transparent text-t3 border border-border rounded px-2 py-1"
        >
          <option value="mtime">Nyeste</option>
          <option value="size">Størrelse</option>
        </select>
      </div>

      {/* Search */}
      <div className="px-4 py-2 border-b border-border">
        <div className="flex items-center gap-2 bg-bg border border-border rounded-lg px-3 py-2">
          <Search size={12} className="text-t3" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Søg..."
            className="bg-transparent text-[11px] text-t1 flex-1 outline-none"
          />
          {search && <button onClick={() => setSearch('')} className="text-t3 hover:text-t1"><X size={11} /></button>}
        </div>
      </div>

      {/* File list */}
      <div className="divide-y divide-border max-h-[420px] overflow-y-auto">
        {filtered.length === 0 && (
          <div className="py-8 text-center text-[12px] text-t3">Ingen filer</div>
        )}
        {filtered.map(file => (
          <div key={file.name + file.path} className="group px-4 py-3 hover:bg-surface2 transition-colors">
            <div className="flex items-start gap-3">
              <FileText size={13} className="text-t3 flex-shrink-0 mt-0.5" style={{ color: catColor[file.category] }} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[12px] font-semibold text-t1">{file.name}</span>
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded border" style={{ color: catColor[file.category], borderColor: catColor[file.category] + '44' }}>
                    {catLabel[file.category]}
                  </span>
                </div>
              </div>
              <div className="flex-shrink-0 text-right">
                <div className="text-[10px] text-t3">{file.size_kb} KB</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Entries Tab ───────────────────────────────────────────────────────────

export function EntriesTab({ entries, target, onRefresh, loading, searchQ, onSearch, searchResults, onRefreshStats }) {
  const [showAdd, setShowAdd] = useState(false)
  const [addContent, setAddContent] = useState('')
  const [sortOrder, setSortOrder] = useState('desc')

  const displayEntries = entries[target] || []
  const filtered = !searchQ
    ? displayEntries
    : displayEntries.filter(e => (e.content || '').toLowerCase().includes(searchQ.toLowerCase()))

  const sorted = [...filtered].sort((a, b) => {
    const dateA = new Date(a.created_at || 0).getTime()
    const dateB = new Date(b.created_at || 0).getTime()
    return sortOrder === 'desc' ? dateB - dateA : dateA - dateB
  })

  const handleAdd = async () => {
    if (!addContent.trim()) return
    try {
      const res = await fetch('/api/memory/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target, content: addContent.trim() }),
      })
      const data = await res.json()
      if (data.success) {
        setAddContent('')
        setShowAdd(false)
        onRefresh?.()
        onRefreshStats?.()
      }
    } catch (e) {
      console.error('Failed to add entry', e)
    }
  }

  const handleRemove = async (entryId) => {
    if (!confirm('Remove?')) return
    try {
      const res = await fetch('/api/memory/entries', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target, entry_id: entryId }),
      })
      if (res.ok) {
        onRefresh?.()
        onRefreshStats?.()
      }
    } catch (e) {
      console.error('Failed to remove entry', e)
    }
  }

  return (
    <div className="space-y-4">
      {/* Add button */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setShowAdd(true)}
          className="px-3 py-1.5 text-[11px] bg-amber/10 border border-amber/30 text-amber rounded-lg hover:bg-amber/20 flex items-center gap-1.5"
        >
          + Add
        </button>
        <button
          onClick={() => setSortOrder(s => s === 'desc' ? 'asc' : 'desc')}
          className="p-2 text-t3 hover:text-t2 rounded-lg"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
          </svg>
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold text-t2">New Entry</span>
            <button onClick={() => setShowAdd(false)} className="text-t3 hover:text-t1">
              <X size={14} />
            </button>
          </div>
          <textarea
            value={addContent}
            onChange={e => setAddContent(e.target.value)}
            placeholder="Indtast note..."
            className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-[11px] text-t1 outline-none focus:border-amber/50 resize-y font-mono"
            rows={3}
          />
          <div className="flex justify-end mt-2">
            <button
              onClick={handleAdd}
              disabled={!addContent.trim()}
              className="px-3 py-1.5 text-[11px] bg-amber text-bg font-semibold rounded-lg hover:bg-amber/90 disabled:opacity-40 flex items-center gap-1.5"
            >
              Save
            </button>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="flex items-center gap-2 bg-surface border border-border rounded-lg px-3 py-2">
        <Search size={12} className="text-t3" />
        <input
          value={searchQ}
          onChange={e => onSearch?.(e.target.value)}
          placeholder="Søg..."
          className="bg-transparent text-[11px] text-t1 flex-1 outline-none"
        />
        {searchQ && <button onClick={() => onSearch?.('')} className="text-t3 hover:text-t1"><X size={11} /></button>}
      </div>

      {/* List */}
      <div className="divide-y divide-border max-h-[500px] overflow-y-auto">
        {sorted.length === 0 && (
          <div className="py-8 text-center text-[12px] text-t3">No entries</div>
        )}
        {sorted.map((entry, i) => (
          <div key={entry.id || i} className="px-4 py-3 hover:bg-surface2">
            <div className="flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span className={`text-[8px] font-mono px-1.5 py-0.5 rounded border ${
                    entry.target === 'memory' ? 'text-[#00b478] border-[#00b478]/30' : 'text-[#4a80c8] border-[#4a80c8]/30'
                  }`}>{entry.target?.toUpperCase() || 'MEM'}</span>
                  <span className="text-[9px] font-mono text-t3">{entry.id}</span>
                </div>
                <pre className="text-[11px] text-t2 whitespace-pre-wrap leading-relaxed font-mono">
                  {entry.content}
                </pre>
              </div>
              <button
                onClick={() => handleRemove(entry.id)}
                className="text-t3 hover:text-rust flex-shrink-0"
                title="Remove"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
