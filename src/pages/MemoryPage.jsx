import { useState, useEffect, useRef, useCallback } from 'react'
import { usePoll } from '../hooks/useApi'
import { Chip } from '../components/ui/Chip'
import {
  Brain, FileText, RefreshCw, List, Network, AlertTriangle,
  ZoomIn, ZoomOut, Maximize2, Search, X, Clock, Database,
  ChevronRight, Star, BookOpen, Layers, Activity
} from 'lucide-react'
import * as d3 from 'd3'

// ─── Knowledge Graph ──────────────────────────────────────────────────────

function D3ForceGraph({ nodes, links, searchQuery, onNodeClick }) {
  const svgRef = useRef(null)
  const simRef = useRef(null)
  const containerRef = useRef(null)
  const [selectedNode, setSelectedNode] = useState(null)
  const [highlighted, setHighlighted] = useState(new Set())

  // Rebuild graph when data changes
  useEffect(() => {
    if (!nodes?.length || !svgRef.current) return

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()
    if (simRef.current) simRef.current.stop()

    const W = svgRef.current.clientWidth || 800
    const H = 520

    const g = svg.append('g')

    // Defs: glow filter + arrow marker
    const defs = svg.append('defs')
    const filter = defs.append('filter').attr('id', 'glow')
    filter.append('feGaussianBlur').attr('stdDeviation', '3').attr('result', 'coloredBlur')
    const feMerge = filter.append('feMerge')
    feMerge.append('feMergeNode').attr('in', 'coloredBlur')
    feMerge.append('feMergeNode').attr('in', 'SourceGraphic')

    // Zoom + pan
    const zoom = d3.zoom().scaleExtent([0.1, 6]).on('zoom', e => g.attr('transform', e.transform))
    svg.call(zoom).on('dblclick.zoom', null)

    // Valid links
    const validNodeIds = new Set(nodes.map(n => n.id))
    const validLinks = links.filter(l =>
      l.source && l.target &&
      validNodeIds.has(typeof l.source === 'object' ? l.source.id : l.source) &&
      validNodeIds.has(typeof l.target === 'object' ? l.target.id : l.target)
    )

    const sim = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(validLinks).id(d => d.id).distance(d => d.value === 5 ? 90 : d.value === 3 ? 55 : 35))
      .force('charge', d3.forceManyBody().strength(-180).distanceMax(300))
      .force('center', d3.forceCenter(W / 2, H / 2))
      .force('x', d3.forceX(W / 2).strength(0.04))
      .force('y', d3.forceY(H / 2).strength(0.04))
      .force('collide', d3.forceCollide(18))

    simRef.current = sim

    const colorMap = { root: '#ffffff', category: '#00b478', subcategory: '#4a80c8', item: '#e09040' }
    const radiusMap = { root: 10, category: 7, subcategory: 5, item: 4 }

    // Links
    const link = g.append('g').attr('stroke', '#1e2130').attr('stroke-opacity', 0.5)
      .selectAll('line').data(validLinks).join('line')
      .attr('stroke-width', d => Math.sqrt(d.value || 1))

    // Nodes
    const node = g.append('g').selectAll('g').data(nodes).join('g')
      .attr('cursor', 'pointer')
      .on('click', (_, d) => { setSelectedNode(d); onNodeClick?.(d) })
      .call(d3.drag()
        .on('start', (e, d) => { if (!e.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y })
        .on('drag', (e, d) => { d.fx = e.x; d.fy = e.y })
        .on('end', (e, d) => { if (!e.active) sim.alphaTarget(0); d.fx = null; d.fy = null }))

    // Circles
    node.append('circle')
      .attr('r', d => radiusMap[d.type] || 4)
      .attr('fill', d => colorMap[d.type] || '#6b6b80')
      .attr('filter', 'url(#glow)')
      .attr('opacity', d => {
        if (!searchQuery) return 1
        const match = d.label?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          d.content?.toLowerCase().includes(searchQuery.toLowerCase())
        return match ? 1 : 0.2
      })

    // Labels
    node.append('text')
      .text(d => d.label || d.id)
      .attr('x', d => (radiusMap[d.type] || 4) + 5)
      .attr('y', 4)
      .attr('fill', d => {
        if (!searchQuery) return '#94a3b8'
        return d.label?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          d.content?.toLowerCase().includes(searchQuery.toLowerCase())
          ? '#ffffff' : '#3a3b4a'
      })
      .attr('font-size', d => d.type === 'item' ? '9px' : '11px')
      .attr('font-family', 'Inter, sans-serif')
      .style('pointer-events', 'none')
      .style('text-shadow', '0 1px 4px rgba(0,0,0,0.9)')

    sim.on('tick', () => {
      link
        .attr('x1', d => d.source?.x ?? 0).attr('y1', d => d.source?.y ?? 0)
        .attr('x2', d => d.target?.x ?? 0).attr('y2', d => d.target?.y ?? 0)
      node.attr('transform', d => `translate(${d.x ?? 0},${d.y ?? 0})`)
    })

    return () => sim.stop()
  }, [nodes, links, searchQuery])

  const resetZoom = () => {
    if (!svgRef.current) return
    d3.select(svgRef.current).transition().duration(600)
      .call(d3.zoom().transform, d3.zoomIdentity)
  }

  const zoomIn = () => {
    if (!svgRef.current) return
    d3.select(svgRef.current).transition().duration(300)
      .call(d3.zoom().scaleBy, 1.4)
  }

  const zoomOut = () => {
    if (!svgRef.current) return
    d3.select(svgRef.current).transition().duration(300)
      .call(d3.zoom().scaleBy, 0.7)
  }

  const focusNode = (node) => {
    if (!svgRef.current || !node) return
    const W = svgRef.current.clientWidth || 800
    const H = 520
    d3.select(svgRef.current).transition().duration(700)
      .call(d3.zoom().transform,
        d3.zoomIdentity.translate(W / 2, H / 2).scale(2.5).translate(-(node.x ?? 0), -(node.y ?? 0))
      )
  }

  useEffect(() => {
    if (selectedNode) focusNode(selectedNode)
  }, [selectedNode])

  return (
    <div className="relative" ref={containerRef}>
      <svg ref={svgRef} className="w-full h-[520px] border border-border rounded-xl bg-bg/50" />
      {/* Controls */}
      <div className="absolute top-3 right-3 flex flex-col gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={zoomIn}    className="p-2 bg-surface/90 border border-border rounded-lg text-t3 hover:text-t1 hover:bg-surface2 transition-all" title="Zoom in"><ZoomIn size={14} /></button>
        <button onClick={zoomOut}   className="p-2 bg-surface/90 border border-border rounded-lg text-t3 hover:text-t1 hover:bg-surface2 transition-all" title="Zoom out"><ZoomOut size={14} /></button>
        <button onClick={resetZoom} className="p-2 bg-surface/90 border border-border rounded-lg text-t3 hover:text-t1 hover:bg-surface2 transition-all" title="Fit to view"><Maximize2 size={14} /></button>
      </div>
      {/* Node detail overlay */}
      {selectedNode && (
        <div className="absolute bottom-4 left-4 right-4 p-5 bg-surface/95 backdrop-blur-2xl border border-border rounded-2xl shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-start gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5">
                <div className={`w-2 h-2 rounded-full ${
                  selectedNode.type === 'root' ? 'bg-white' :
                  selectedNode.type === 'category' ? 'bg-[#00b478]' :
                  selectedNode.type === 'subcategory' ? 'bg-[#4a80c8]' : 'bg-[#e09040]'
                }`} />
                <span className="text-[10px] uppercase tracking-widest font-bold text-t3">{selectedNode.type}</span>
              </div>
              <h3 className="text-base font-bold text-t1 mb-1">{selectedNode.label}</h3>
              {selectedNode.content && selectedNode.content !== selectedNode.label && (
                <p className="text-xs text-t2 leading-relaxed opacity-80">{selectedNode.content}</p>
              )}
            </div>
            <div className="flex flex-col gap-2 flex-shrink-0">
              <button onClick={() => focusNode(selectedNode)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber/10 border border-amber/20 hover:bg-amber/20 rounded-lg text-amber text-[11px] font-bold transition-all">
                <Maximize2 size={11} /> Fokus
              </button>
              <button onClick={() => setSelectedNode(null)}
                className="p-2 hover:bg-surface2 rounded-lg text-t3 hover:text-t1 transition-colors text-sm">✕
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Storage Panel ────────────────────────────────────────────────────────

function StoragePanel({ data }) {
  const storageKb = data?.storage_kb ?? 0
  const cacheKb = data?.cache_kb ?? 0
  const maxKb = data?.max_kb ?? 2500
  const totalEntries = data?.total_entries ?? 0
  const lastUpdate = data?.last_memory_update ?? null
  const byCat = data?.by_category ?? {}
  const pct = Math.min(Math.round((storageKb / maxKb) * 100), 100)

  const healthColor = pct > 80 ? '#e63946' : pct > 60 ? '#f59e0b' : '#00b478'

  const timeAgo = (iso) => {
    if (!iso) return 'Aldrig'
    const diff = Date.now() - new Date(iso).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 60) return `${mins}m siden`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}t siden`
    return `${Math.floor(hrs / 24)}d siden`
  }

  return (
    <div className="space-y-4">
      {/* Main storage bar */}
      <div className="bg-surface border border-border rounded-xl p-4">
        <div className="flex items-end justify-between mb-2">
          <span className="text-[10px] font-bold text-t3 uppercase tracking-widest">Memory Storage</span>
          <span className="font-mono text-[10px] text-t3">{storageKb} / {maxKb} KB</span>
        </div>
        <div className="h-2.5 bg-border rounded-full overflow-hidden mb-2">
          <div className="h-full rounded-full transition-all duration-1000"
            style={{ width: `${pct}%`, background: healthColor, boxShadow: `0 0 12px ${healthColor}66` }} />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-2xl font-black text-t1">{pct}%</span>
          <span className="text-[10px] text-t3 font-mono">
            {pct > 80 ? '⚠ Høj belastning' : pct > 60 ? '◐ Moderat' : '✓ Stabil'}
          </span>
        </div>
      </div>

      {/* Entry count */}
      <div className="bg-surface border border-border rounded-xl p-4">
        <div className="flex items-center gap-2 mb-1">
          <Layers size={12} className="text-amber" />
          <span className="text-[10px] font-bold text-t3 uppercase tracking-widest">Memory Entries</span>
        </div>
        <div className="text-2xl font-black text-t1">{totalEntries}</div>
        <div className="text-[10px] text-t3 mt-0.5">
          <Clock size={9} className="inline mr-1" />
          Sidst opdateret: {timeAgo(lastUpdate)}
        </div>
      </div>

      {/* Category breakdown */}
      <div className="bg-surface border border-border rounded-xl p-4">
        <span className="text-[10px] font-bold text-t3 uppercase tracking-widest mb-3 block">Fil-kategorier</span>
        <div className="space-y-2">
          {[
            { key: 'curated', label: 'Curated', color: '#00b478', icon: Star },
            { key: 'daily',   label: 'Daglige noter', color: '#4a80c8', icon: BookOpen },
            { key: 'cache',   label: 'Cache', color: '#6b6b80', icon: Database },
            { key: 'other',   label: 'Andet', color: '#3a3b4a', icon: FileText },
          ].map(cat => (
            <div key={cat.key} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: cat.color }} />
                <span className="text-[11px] text-t2">{cat.label}</span>
              </div>
              <span className="font-mono text-[11px] text-t3">{byCat[cat.key] ?? 0}</span>
            </div>
          ))}
        </div>
        {cacheKb > 0 && (
          <div className="mt-3 pt-3 border-t border-border">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-t3">Cache (exkluderet)</span>
              <span className="font-mono text-[10px] text-t3">{cacheKb} KB</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Activity Panel ───────────────────────────────────────────────────────

function ActivityPanel({ data }) {
  const dayGrid = data?.day_grid ?? []
  const recentWrites = data?.recent_writes ?? []
  const lastWrite = data?.last_write ?? null
  const maxCount = Math.max(...dayGrid.map(d => d.count), 1)

  const timeAgo = (iso) => {
    if (!iso) return 'Aldrig'
    const diff = Date.now() - new Date(iso).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'Lige nu'
    if (mins < 60) return `${mins}m siden`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}t siden`
    return `${Math.floor(hrs / 24)}d siden`
  }

  const formatTime = (iso) => {
    if (!iso) return ''
    return new Date(iso).toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="space-y-4">
      {/* 7-day activity grid */}
      <div className="bg-surface border border-border rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Activity size={12} className="text-amber" />
          <span className="text-[10px] font-bold text-t3 uppercase tracking-widest">Aktivitet — 7 dage</span>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {dayGrid.map(day => {
            const height = day.count > 0 ? Math.max(Math.round((day.count / maxCount) * 40), 4) : 4
            const isToday = day.date === new Date().toISOString().slice(0, 10)
            return (
              <div key={day.date} className="flex flex-col items-center gap-1">
                <div className="w-full flex flex-col items-center justify-end" style={{ height: 44 }}>
                  <div className="w-4 rounded-sm transition-all" style={{
                    height,
                    background: day.count > 0 ? (isToday ? '#f59e0b' : '#00b478') : '#1e2130',
                    boxShadow: day.count > 0 ? `0 0 6px ${isToday ? '#f59e0b' : '#00b478'}66` : 'none',
                    opacity: day.count > 0 ? 0.9 : 1,
                  }} />
                </div>
                <span className={`text-[9px] font-mono ${isToday ? 'text-amber font-bold' : 'text-t3'}`}>
                  {day.label}
                </span>
                {day.count > 0 && (
                  <span className="text-[8px] text-t3 font-mono">{day.count}</span>
                )}
              </div>
            )
          })}
        </div>
        <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
          <span className="text-[10px] text-t3">Seneste skriv:</span>
          <span className="text-[10px] font-mono text-amber">{timeAgo(lastWrite)}</span>
        </div>
      </div>

      {/* Recent writes */}
      <div className="bg-surface border border-border rounded-xl p-4">
        <span className="text-[10px] font-bold text-t3 uppercase tracking-widest mb-3 block">Seneste ændringer</span>
        <div className="space-y-2">
          {recentWrites.length === 0 && (
            <div className="text-[11px] text-t3 text-center py-3">Ingen aktivitet endnu</div>
          )}
          {recentWrites.map((w, i) => (
            <div key={i} className="flex items-center gap-2 py-1.5 border-b border-border last:border-0">
              <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${w.type === 'note' ? 'bg-[#00b478]' : 'bg-[#4a80c8]'}`} />
              <div className="flex-1 min-w-0">
                <div className="text-[11px] text-t2 font-semibold truncate">{w.name}</div>
                <div className="text-[9px] text-t3 font-mono">{formatTime(w.mtime)} · {w.size_kb} KB</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── File List ────────────────────────────────────────────────────────────

const CATEGORY_ORDER = { curated: 0, daily: 1, cache: 2, other: 3 }

function FileListTab({ files, activeTab, setActiveTab }) {
  const [sortBy, setSortBy] = useState('mtime')  // mtime | size | name
  const [search, setSearch] = useState('')
  const [expandedFile, setExpandedFile] = useState(null)

  const tabs = [
    { key: 'all',      label: 'Alle',      count: files.length },
    { key: 'curated',  label: 'Curated',   count: files.filter(f => f.category === 'curated').length },
    { key: 'daily',    label: 'Daglige',   count: files.filter(f => f.category === 'daily').length },
    { key: 'cache',    label: 'Cache',     count: files.filter(f => f.category === 'cache').length },
  ]

  const filtered = files
    .filter(f => activeTab === 'all' || f.category === activeTab)
    .filter(f => !search || f.name.toLowerCase().includes(search.toLowerCase()) || f.preview?.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === 'size')  return b.size_kb - a.size_kb
      if (sortBy === 'name')  return a.name.localeCompare(b.name)
      return new Date(b.mtime) - new Date(a.mtime)  // mtime default
    })

  const catColor = { curated: '#00b478', daily: '#4a80c8', cache: '#6b6b80', other: '#3a3b4a', snapshot: '#e09040' }
  const catLabel = { curated: 'Curated', daily: 'Daglig', cache: 'Cache', other: 'Andet', snapshot: 'Snapshot' }

  return (
    <div className="bg-surface border border-border rounded-xl overflow-hidden">
      {/* Tab bar */}
      <div className="flex items-center gap-1 px-4 pt-3 pb-0 border-b border-border bg-surface2/30">
        {tabs.map(tab => (
          <button key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-3 py-2 text-[11px] font-semibold border-b-2 transition-all ${
              activeTab === tab.key
                ? 'border-amber text-t1 -mb-px'
                : 'border-transparent text-t3 hover:text-t2'
            }`}
          >
            {tab.label} <span className="ml-1 text-[9px] opacity-60">{tab.count}</span>
          </button>
        ))}
        <div className="flex-1" />
        {/* Sort */}
        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value)}
          className="text-[10px] bg-transparent text-t3 border border-border rounded px-2 py-1 mr-2"
        >
          <option value="mtime">Seneste</option>
          <option value="size">Størrelse</option>
          <option value="name">Navn</option>
        </select>
      </div>

      {/* Search */}
      <div className="px-4 py-2 border-b border-border">
        <div className="flex items-center gap-2 bg-bg border border-border rounded-lg px-3 py-2">
          <Search size={12} className="text-t3 flex-shrink-0" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Søg i filer..."
            className="bg-transparent text-[11px] text-t1 placeholder-t3 flex-1 outline-none"
          />
          {search && <button onClick={() => setSearch('')} className="text-t3 hover:text-t1"><X size={11} /></button>}
        </div>
      </div>

      {/* File list */}
      <div className="divide-y divide-border max-h-[420px] overflow-y-auto">
        {filtered.length === 0 && (
          <div className="py-8 text-center text-[12px] text-t3">Ingen filer matcher</div>
        )}
        {filtered.map(file => (
          <div key={file.name + file.path} className="group">
            <div
              className="flex items-start gap-3 px-4 py-3 hover:bg-surface2 transition-colors cursor-pointer"
              onClick={() => setExpandedFile(expandedFile === file.name ? null : file.name)}
            >
              <FileText size={13} className="text-t3 flex-shrink-0 mt-0.5" style={{ color: catColor[file.category] || '#6b6b80' }} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[12px] font-semibold text-t1 truncate">{file.name}</span>
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded border"
                    style={{ color: catColor[file.category], borderColor: catColor[file.category] + '44' }}>
                    {catLabel[file.category]}
                  </span>
                </div>
                {file.preview && (
                  <div className="text-[10px] text-t3 font-mono truncate mt-0.5 leading-relaxed">{file.preview}</div>
                )}
                {file.entry_count > 0 && (
                  <div className="text-[9px] text-amber mt-0.5">{file.entry_count} entries</div>
                )}
              </div>
              <div className="flex-shrink-0 text-right">
                <div className="font-mono text-[10px] text-t3">{file.size_kb} KB</div>
                <div className="font-mono text-[9px] text-t3 mt-0.5">
                  {new Date(file.mtime).toLocaleDateString('da-DK', { day: '2-digit', month: 'short' })}
                </div>
              </div>
            </div>
            {/* Expanded preview */}
            {expandedFile === file.name && file.preview && (
              <div className="mx-4 mb-3 p-3 bg-bg border border-border rounded-lg">
                <pre className="text-[10px] text-t2 font-mono whitespace-pre-wrap leading-relaxed">
                  {file.preview}
                </pre>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────

export function MemoryPage() {
  const [view, setView] = useState('graph')  // graph | files | activity
  const [graphSearch, setGraphSearch] = useState('')

  const { data: memData, loading: memLoading, refetch: memRefetch } = usePoll('/memory', 30000)
  const { data: graphData, loading: graphLoading, error: graphError, refetch: graphRefetch } = usePoll(view === 'graph' ? '/memory/graph' : null, 60000)
  const { data: actData, loading: actLoading, refetch: actRefetch } = usePoll(view === 'activity' ? '/memory/activity' : null, 30000)

  const graphNodes = graphData?.nodes ?? []
  const graphLinks = graphData?.links ?? []
  const files = memData?.files ?? []

  const handleNodeClick = useCallback((node) => {}, [])

  const viewTabs = [
    { key: 'graph',   label: 'Vidensgraf',  icon: Network },
    { key: 'files',   label: 'Filer',        icon: FileText },
    { key: 'activity', label: 'Aktivitet',   icon: Activity },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber/10 border border-amber/20 flex items-center justify-center">
            <Brain size={20} className="text-amber" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-t1 leading-none">Hukommelse</h1>
            <p className="text-[11px] text-t3 mt-1 uppercase tracking-wider">
              {memData?.total_entries ?? '—'} entries · {memData?.by_category?.curated ?? '—'} curated filer
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* View tabs */}
          <div className="flex bg-surface border border-border rounded-lg p-0.5">
            {viewTabs.map(tab => {
              const Icon = tab.icon
              return (
                <button key={tab.key}
                  onClick={() => setView(tab.key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all ${
                    view === tab.key ? 'bg-surface2 text-t1 shadow-sm' : 'text-t3 hover:text-t2'
                  }`}
                >
                  <Icon size={12} />
                  {tab.label}
                </button>
              )
            })}
          </div>
          <button
            onClick={view === 'graph' ? graphRefetch : view === 'files' ? memRefetch : actRefetch}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-t3 hover:text-t2 hover:bg-surface2 transition-all"
          >
            <RefreshCw size={14} className={(memLoading || graphLoading || actLoading) ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Content layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
        {/* Main content */}
        <div className="lg:col-span-3 space-y-4">
          {view === 'graph' && (
            <>
              {/* Graph search bar */}
              <div className="flex items-center gap-3">
                <div className="flex-1 flex items-center gap-2 bg-surface border border-border rounded-lg px-3 py-2">
                  <Search size={13} className="text-t3 flex-shrink-0" />
                  <input
                    value={graphSearch}
                    onChange={e => setGraphSearch(e.target.value)}
                    placeholder="Søg i grafen for at highlighte noder..."
                    className="bg-transparent text-[12px] text-t1 placeholder-t3 flex-1 outline-none"
                  />
                  {graphSearch && (
                    <button onClick={() => setGraphSearch('')} className="text-t3 hover:text-t1">
                      <X size={12} />
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2 text-[10px] font-mono text-t3">
                  <div className="w-2 h-2 rounded-full bg-white" /> Core
                  <div className="w-2 h-2 rounded-full bg-[#00b478]" /> Kategori
                  <div className="w-2 h-2 rounded-full bg-[#4a80c8]" /> Sub
                  <div className="w-2 h-2 rounded-full bg-[#e09040]" /> Data
                </div>
              </div>

              {/* Graph */}
              <div className="group">
                {graphLoading ? (
                  <div className="h-[520px] border border-border rounded-xl bg-surface/50 animate-pulse flex items-center justify-center">
                    <div className="text-center">
                      <RefreshCw size={24} className="animate-spin mx-auto mb-3 text-t3 opacity-30" />
                      <div className="text-xs font-mono text-t3">GENERATING NEURAL WEIGHTS...</div>
                    </div>
                  </div>
                ) : graphError ? (
                  <div className="h-[520px] border border-rust/30 rounded-xl bg-rust/5 flex items-center justify-center">
                    <div className="text-center p-8">
                      <AlertTriangle size={32} className="text-rust mx-auto mb-4 opacity-50" />
                      <div className="text-sm font-bold text-rust mb-2">Graf fejl</div>
                      <div className="text-xs text-t3">{String(graphError)}</div>
                    </div>
                  </div>
                ) : graphNodes.length === 0 ? (
                  <div className="h-[520px] border border-border rounded-xl bg-surface/50 flex items-center justify-center">
                    <div className="text-center p-8">
                      <Brain size={32} className="text-t3 mx-auto mb-4 opacity-30" />
                      <div className="text-sm font-bold text-t3 mb-2">Ingen grafddata</div>
                      <div className="text-xs text-t3">Memory graph er tom — tilføj indhold til MEMORY.md</div>
                    </div>
                  </div>
                ) : (
                  <D3ForceGraph
                    nodes={graphNodes}
                    links={graphLinks}
                    searchQuery={graphSearch}
                    onNodeClick={handleNodeClick}
                  />
                )}
              </div>
            </>
          )}

          {view === 'files' && (
            <FileListTab
              files={files}
              activeTab="all"
              setActiveTab={() => {}}
            />
          )}

          {view === 'activity' && (
            <div className="bg-surface border border-border rounded-xl p-5">
              {actLoading ? (
                <div className="h-40 animate-pulse flex items-center justify-center text-t3 text-xs font-mono">
                  <RefreshCw size={16} className="animate-spin mr-2" /> Indlæser...
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2 mb-4">
                    <Activity size={14} className="text-amber" />
                    <h3 className="text-sm font-bold text-t1">Memory Aktivitet</h3>
                  </div>
                  {/* 7-day grid inline */}
                  <div className="mb-4">
                    <div className="flex items-end justify-between mb-2">
                      {(actData?.day_grid ?? []).map(day => {
                        const max = Math.max(...(actData?.day_grid ?? [{count:0}]).map(d => d.count), 1)
                        const h = day.count > 0 ? Math.max(Math.round((day.count / max) * 40), 4) : 4
                        const isToday = day.date === new Date().toISOString().slice(0, 10)
                        return (
                          <div key={day.date} className="flex flex-col items-center gap-1 flex-1">
                            <div className="w-full flex flex-col items-center justify-end" style={{ height: 44 }}>
                              <div className="w-5 rounded-sm" style={{
                                height: h,
                                background: day.count > 0 ? (isToday ? '#f59e0b' : '#00b478') : '#1e2130',
                                boxShadow: day.count > 0 ? `0 0 8px ${isToday ? '#f59e0b' : '#00b478'}55` : 'none'
                              }} />
                            </div>
                            <span className={`text-[9px] font-mono ${isToday ? 'text-amber font-bold' : 'text-t3'}`}>
                              {day.label}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                  {/* Recent writes */}
                  <div className="border-t border-border pt-4">
                    <h4 className="text-[10px] font-bold text-t3 uppercase tracking-widest mb-3">Seneste ændringer</h4>
                    <div className="space-y-2">
                      {(actData?.recent_writes ?? []).map((w, i) => (
                        <div key={i} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                          <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${w.type === 'note' ? 'bg-[#00b478]' : 'bg-[#4a80c8]'}`} />
                          <span className="text-[11px] text-t2 font-semibold flex-1 truncate">{w.name}</span>
                          <span className="text-[10px] font-mono text-t3">
                            {new Date(w.mtime).toLocaleDateString('da-DK', { day: '2-digit', month: 'short' })}
                          </span>
                        </div>
                      ))}
                      {actData?.recent_writes?.length === 0 && (
                        <div className="text-[11px] text-t3 text-center py-4">Ingen aktivitet</div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-1 space-y-4">
          {view !== 'files' && <StoragePanel data={memData} />}
          {view === 'activity' && <ActivityPanel data={actData} />}

          {view === 'graph' && (
            <div className="bg-surface border border-border rounded-xl p-4">
              <h4 className="text-[10px] font-bold text-t3 uppercase tracking-widest mb-3">Graf-linse</h4>
              <div className="space-y-2">
                {[
                  { color: 'bg-white',     label: 'Core Memory',   desc: 'Hukommelse rod' },
                  { color: 'bg-[#00b478]', label: 'Kategorier',    desc: 'Hovedemner' },
                  { color: 'bg-[#4a80c8]', label: 'Sub-koncepter', desc: 'Underemner' },
                  { color: 'bg-[#e09040]', label: 'Datapunkter',   desc: 'Specifik viden' },
                ].map(l => (
                  <div key={l.label} className="flex items-center gap-2.5">
                    <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 shadow-lg ${l.color}`} />
                    <div>
                      <div className="text-[11px] font-semibold text-t2">{l.label}</div>
                      <div className="text-[9px] text-t3">{l.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-3 border-t border-border text-[10px] text-t3 leading-relaxed">
                <b className="text-t2">Tip:</b> Klik en node for at se indhold.<br />
                Dobbeltklik for at zoome ind. Brug zoom-knapperne i grafen.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
