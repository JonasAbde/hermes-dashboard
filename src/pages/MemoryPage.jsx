import { useState, useEffect, useRef, useCallback } from 'react'
import { useApi } from '../hooks/useApi'
import { Chip } from '../components/ui/Chip'
import { Brain, FileText, RefreshCw, List, Network, AlertTriangle } from 'lucide-react'

// ─── Knowledge Graph (pure SVG, no D3) ─────────────────────────────────────

function NodeColors() {
  return { entity: '#00b478', project: '#4a80c8', skill: '#e05f40' }
}

function SimpleForceGraph({ nodes, links }) {
  const svgRef = useRef(null)
  const [dims, setDims] = useState({ w: 800, h: 400 })
  const [positions, setPositions] = useState(null)
  const colors = NodeColors()

  // Simple force-directed layout — one-shot random positions, then spring relaxation
  useEffect(() => {
    if (!nodes?.length) return
    const w = svgRef.current?.clientWidth || 800
    const h = svgRef.current?.clientHeight || 400
    setDims({ w, h })

    // Init random positions near center
    const pos = nodes.map((_, i) => ({
      x: w / 2 + (Math.random() - 0.5) * w * 0.4,
      y: h / 2 + (Math.random() - 0.5) * h * 0.4,
      vx: 0,
      vy: 0,
    }))

    const ITER = 120
    const REPULSE = 3000
    const ATTRACT = 0.04
    const DAMPING = 0.88
    const BOUND = 0.15

    for (let iter = 0; iter < ITER; iter++) {
      for (let i = 0; i < pos.length; i++) {
        for (let j = 0; j < pos.length; j++) {
          if (i === j) continue
          const dx = pos[i].x - pos[j].x
          const dy = pos[i].y - pos[j].y
          const dist = Math.sqrt(dx * dx + dy * dy) + 0.01
          const force = REPULSE / (dist * dist)
          pos[i].vx += (dx / dist) * force
          pos[i].vy += (dy / dist) * force
        }
      }

      // Attract linked nodes
      links.forEach(l => {
        const si = nodes.findIndex(n => n.id === l.source)
        const ti = nodes.findIndex(n => n.id === l.target)
        if (si < 0 || ti < 0) return
        const dx = pos[ti].x - pos[si].x
        const dy = pos[ti].y - pos[si].y
        pos[si].vx += dx * ATTRACT
        pos[si].vy += dy * ATTRACT
        pos[ti].vx -= dx * ATTRACT
        pos[ti].vy -= dy * ATTRACT
      })

      pos.forEach(p => {
        p.vx *= DAMPING
        p.vy *= DAMPING
        p.x = Math.max(w * BOUND, Math.min(w * (1 - BOUND), p.x + p.vx))
        p.y = Math.max(h * BOUND, Math.min(h * (1 - BOUND), p.y + p.vy))
      })
    }

    setPositions(pos)
  }, [nodes, links])

  if (!nodes?.length || !positions) {
    return (
      <div className="flex items-center justify-center h-64 text-t3 text-sm">
        {nodes ? 'Beregner layout…' : 'Ingen graph data'}
      </div>
    )
  }

  const nodeMap = Object.fromEntries(nodes.map((n, i) => [n.id, i]))

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${dims.w} ${dims.h}`}
      className="w-full h-80"
      style={{ background: '#060608', borderRadius: 8 }}
    >
      {/* Links */}
      {links.map((l, i) => {
        const si = nodeMap[l.source]
        const ti = nodeMap[l.target]
        if (si == null || ti == null || !positions[si] || !positions[ti]) return null
        return (
          <line
            key={i}
            x1={positions[si].x}
            y1={positions[si].y}
            x2={positions[ti].x}
            y2={positions[ti].y}
            stroke="#1e2130"
            strokeWidth={1.5}
          />
        )
      })}
      {/* Nodes */}
      {nodes.map((node, i) => {
        const p = positions[i]
        const color = colors[node.type] ?? '#6b6b80'
        return (
          <g key={node.id} transform={`translate(${p.x},${p.y})`}>
            <circle r={22} fill={color} fillOpacity={0.15} />
            <circle r={15} fill={color} fillOpacity={0.85} />
            <text
              textAnchor="middle"
              dy="0.35em"
              fontSize={9}
              fill="#fff"
              fontFamily="JetBrains Mono, monospace"
              fontWeight="600"
            >
              {node.label?.slice(0, 3).toUpperCase() ?? node.id.slice(0, 3)}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

// ─── File List Table ─────────────────────────────────────────────────────────

function MemoryFileRow({ file, maxKb }) {
  const pct = Math.min(file.size_kb / 100, 1)
  return (
    <div className="flex items-center gap-3 py-3 border-b border-border last:border-0 hover:bg-surface2 transition-colors">
      <FileText size={13} className="text-t3 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-t1 truncate">{file.name}</div>
        {file.preview && (
          <div className="text-[10px] text-t3 font-mono truncate mt-0.5">{file.preview}</div>
        )}
      </div>
      <div className="w-24 hidden sm:block">
        <div className="h-1 bg-border rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${pct * 100}%`,
              background: pct > 0.8 ? '#e09040' : pct > 0.5 ? '#4a80c8' : '#00b478',
            }}
          />
        </div>
      </div>
      <div className="font-mono text-[11px] text-t2 w-16 text-right flex-shrink-0">
        {file.size_kb.toFixed(1)} KB
      </div>
    </div>
  )
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 py-3">
      <div className="skeleton w-4 h-4 rounded flex-shrink-0" />
      <div className="flex-1">
        <div className="skeleton h-3 w-2/3 mb-1.5" />
        <div className="skeleton h-2 w-1/3" />
      </div>
      <div className="skeleton w-16 h-1 rounded-full hidden sm:block" />
      <div className="skeleton w-16 h-3" />
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function MemoryPage() {
  const [view, setView] = useState('list') // 'list' | 'graph'
  const { data: listData, loading: listLoading, error: listError, refetch: listRefetch } = useApi('/memory')
  const { data: graphData, loading: graphLoading, error: graphError, refetch: graphRefetch } = useApi(view === 'graph' ? '/memory/graph' : null)

  const files = listData?.files ?? []
  const total = listData?.total_kb ?? 0
  const max = listData?.max_kb ?? 500
  const pct = Math.round((total / max) * 100)

  const graphNodes = graphData?.nodes ?? []
  const graphLinks = graphData?.links ?? []

  return (
    <div className="max-w-4xl space-y-5">

      {/* Page Header */}
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-amber/10 border border-amber/20 flex items-center justify-center flex-shrink-0">
          <Brain size={16} className="text-amber" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-bold text-t1">Memory System</div>
          <div className="text-[11px] text-t3 mt-0.5">
            Persistent knowledge storage for Hermes agent context
          </div>
        </div>
        <Chip variant={pct >= 90 ? 'warn' : pct >= 70 ? 'model' : 'online'}>
          {pct}% brugt
        </Chip>
      </div>

      {/* Memory Usage Bar */}
      <div className="bg-surface border border-border rounded-lg overflow-hidden card-amber">
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs font-bold text-t2">Storage</div>
            <div className="font-mono text-[10px] text-t3">
              {total.toFixed(1)} KB / {max} KB · {files.length} filer
            </div>
          </div>
          <div className="h-2 bg-border rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${pct}%`,
                background: pct >= 90 ? '#e09040' : pct >= 70 ? '#4a80c8' : '#00b478',
                boxShadow: pct >= 90
                  ? '0 0 10px rgba(224,144,64,0.5)'
                  : pct >= 70
                    ? '0 0 8px rgba(74,128,200,0.35)'
                    : '0 0 8px rgba(0,180,120,0.35)',
              }}
            />
          </div>
          {pct >= 90 && (
            <div className="mt-3 flex items-start gap-2 text-[11px] text-amber font-mono">
              <AlertTriangle size={11} className="flex-shrink-0 mt-0.5" />
              <span>Memory er over 90% — overvej at køre <code className="text-amber">/compress</code> eller /flush gamle entries</span>
            </div>
          )}
        </div>
      </div>

      {/* View Toggle */}
      <div className="flex items-center gap-2">
        <div className="flex bg-surface border border-border rounded-lg p-0.5">
          <button
            onClick={() => setView('list')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] font-semibold transition-colors ${
              view === 'list'
                ? 'bg-surface2 text-t1'
                : 'text-t3 hover:text-t2'
            }`}
          >
            <List size={12} /> List
          </button>
          <button
            onClick={() => setView('graph')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] font-semibold transition-colors ${
              view === 'graph'
                ? 'bg-surface2 text-t1'
                : 'text-t3 hover:text-t2'
            }`}
          >
            <Network size={12} /> Graph
          </button>
        </div>

        <button
          onClick={view === 'list' ? listRefetch : graphRefetch}
          className="ml-auto w-7 h-7 rounded-md flex items-center justify-center text-t3 hover:text-t2 hover:bg-surface2 transition-colors"
          title="Refresh"
        >
          <RefreshCw size={13} />
        </button>
      </div>

      {/* List View */}
      {view === 'list' && (
        <div className="bg-surface border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border flex items-center gap-2">
            <span className="text-[9px] font-bold uppercase tracking-widest text-t3">Filer</span>
            <span className="text-[9px] uppercase tracking-widest text-t3 ml-4">Preview</span>
            <span className="text-[9px] uppercase tracking-widest text-t3 ml-auto">Size</span>
          </div>
          <div className="px-4">
            {listLoading
              ? Array.from({ length: 5 }, (_, i) => <SkeletonRow key={i} />)
              : listError
                ? <ErrorState message={listError} onRetry={listRefetch} />
                : files.length === 0
                  ? <EmptyState message="Ingen memory filer fundet — kør /remember for at tilføje entries" />
                  : files.map(f => <MemoryFileRow key={f.name} file={f} maxKb={max} />)
            }
          </div>
        </div>
      )}

      {/* Graph View */}
      {view === 'graph' && (
        <div className="bg-surface border border-border rounded-lg overflow-hidden card-green">
          <div className="px-4 py-3 border-b border-border flex items-center gap-4">
            <span className="text-xs font-bold text-t2">Knowledge Graph</span>
            <div className="flex items-center gap-3 ml-auto font-mono text-[10px]">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full" style={{ background: '#00b478' }} /> entity
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full" style={{ background: '#4a80c8' }} /> project
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full" style={{ background: '#e05f40' }} /> skill
              </span>
              <span className="text-t3">{graphNodes.length} nodes · {graphLinks.length} links</span>
            </div>
          </div>
          <div className="px-4 py-4">
            {graphLoading
              ? <div className="h-80 flex items-center justify-center text-t3 text-sm">Beregner force-layout…</div>
              : graphError
                ? <ErrorState message={graphError} onRetry={graphRefetch} />
                : graphNodes.length === 0
                  ? <EmptyState message="Ingen graph data tilgængelig — memory graph er tom" />
                  : <SimpleForceGraph nodes={graphNodes} links={graphLinks} />
            }
          </div>
        </div>
      )}
    </div>
  )
}

function ErrorState({ message, onRetry }) {
  return (
    <div className="py-10 text-center">
      <AlertTriangle size={18} className="text-rust mx-auto mb-2" />
      <div className="text-sm font-semibold text-rust">Fejl ved indlæsning</div>
      <div className="text-[11px] text-t3 mt-1 mb-3">{message}</div>
      <button
        onClick={onRetry}
        className="px-3 py-1.5 rounded-md bg-surface2 border border-border text-xs text-t2 hover:text-t1 transition-colors"
      >
        Prøv igen
      </button>
    </div>
  )
}

function EmptyState({ message }) {
  return (
    <div className="py-12 text-center">
      <Brain size={20} className="text-t3 mx-auto mb-2" />
      <div className="text-sm text-t3">{message}</div>
    </div>
  )
}
