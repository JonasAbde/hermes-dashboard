import { useState, useEffect, useRef } from 'react'
import { useApi } from '../hooks/useApi'
import { Chip } from '../components/ui/Chip'
import { Brain, FileText, RefreshCw, List, Network, AlertTriangle, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react'
import * as d3 from 'd3'

// ─── Knowledge Graph with D3 ───────────────────────────────────────────────

function D3ForceGraph({ nodes, links }) {
  const svgRef = useRef(null)
  const containerRef = useRef(null)
  const [selectedNode, setSelectedNode] = useState(null)

  useEffect(() => {
    // Always clear previous SVG contents at the start of the effect
    const svg = d3.select(svgRef.current)
    if (svgRef.current) {
      svg.selectAll('*').remove()
    }

    if (!nodes?.length || nodes.length === 0 || !svgRef.current) {
      return
    }

    const g = svg.append('g')

    // Add zoom behavior
    const zoom = d3.zoom()
      .scaleExtent([0.1, 5])
      .on('zoom', (event) => {
        g.attr('transform', event.transform)
      })

    svg.call(zoom)

    // Simulation setup
    // 1. Sanitize links: ensure both source and target exist in nodes array
    const validNodeIds = new Set(nodes.map(n => n.id))
    const validLinks = links.filter(l => 
        l.source && l.target && 
        validNodeIds.has(typeof l.source === 'object' ? l.source.id : l.source) &&
        validNodeIds.has(typeof l.target === 'object' ? l.target.id : l.target)
    )

    const simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(validLinks).id(d => d.id).distance(d => {
          if (d.value === 5) return 80  // Root to H2
          if (d.value === 3) return 50  // H2 to H3
          return 30                     // H3 to Leaf
      }))
      .force('charge', d3.forceManyBody().strength(-150).distanceMax(250))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('x', d3.forceX(width / 2).strength(0.05))
      .force('y', d3.forceY(height / 2).strength(0.05))

    // Define colors
    const colorMap = {
      root: '#ffffff',
      category: '#00b478',
      subcategory: '#4a80c8',
      item: '#e09040'
    }

    // Link lines
    const link = g.append('g')
      .attr('stroke', '#1e2130')
      .attr('stroke-opacity', 0.6)
      .selectAll('line')
      .data(validLinks)
      .join('line')
      .attr('stroke-width', d => Math.sqrt(d.value || 1))

    // Node groups
    const node = g.append('g')
      .selectAll('g')
      .data(nodes)
      .join('g')
      .attr('cursor', 'pointer')
      .on('click', (event, d) => setSelectedNode(d))
      .call(d3.drag()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended))

    // Node background circle
    node.append('circle')
      .attr('r', d => d.type === 'root' ? 12 : d.type === 'category' ? 8 : 4)
      .attr('fill', d => colorMap[d.type] || '#6b6b80')
      .attr('filter', 'url(#glow)')

    // Glow filter
    const defs = svg.append('defs')
    const filter = defs.append('filter')
      .attr('id', 'glow')
    filter.append('feGaussianBlur')
      .attr('stdDeviation', '2.5')
      .attr('result', 'coloredBlur')
    const feMerge = filter.append('feMerge')
    feMerge.append('feMergeNode').attr('in', 'coloredBlur')
    feMerge.append('feMergeNode').attr('in', 'SourceGraphic')

    // Labels
    node.append('text')
      .text(d => d.label)
      .attr('x', 12)
      .attr('y', 4)
      .attr('fill', '#94a3b8')
      .attr('font-size', d => d.type === 'item' ? '9px' : '11px')
      .attr('font-family', 'Inter, sans-serif')
      .style('pointer-events', 'none')
      .style('text-shadow', '0 0 10px rgba(0,0,0,0.8)')

    simulation.on('tick', () => {
      try {
        link
          .attr('x1', d => d.source?.x ?? 0)
          .attr('y1', d => d.source?.y ?? 0)
          .attr('x2', d => d.target?.x ?? 0)
          .attr('y2', d => d.target?.y ?? 0)

        node
          .attr('transform', d => `translate(${d.x ?? 0},${d.y ?? 0})`)
      } catch (err) {
        console.error('D3 Tick Error:', err)
        simulation.stop()
      }
    })

    function dragstarted(event) {
      if (!event.active) simulation.alphaTarget(0.3).restart()
      event.subject.fx = event.subject.x
      event.subject.fy = event.subject.y
    }

    function dragged(event) {
      event.subject.fx = event.x
      event.subject.fy = event.y
    }

    function dragended(event) {
      if (!event.active) simulation.alphaTarget(0)
      event.subject.fx = null
      event.subject.fy = null
    }

    return () => simulation.stop()
  }, [nodes, links])

  const resetZoom = () => {
    const svg = d3.select(svgRef.current)
    svg.transition().duration(750).call(
      d3.zoom().transform,
      d3.zoomIdentity
    )
  }

  return (
    <div className="relative group" ref={containerRef}>
      <svg
        ref={svgRef}
        className="w-full h-[500px] border border-border rounded-xl bg-bg/50 backdrop-blur-md"
      />
      
      {/* Controls Overlay */}
      <div className="absolute top-4 right-4 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={resetZoom} className="p-2 bg-surface border border-border rounded-lg text-t3 hover:text-t1 shadow-xl">
          <Maximize2 size={16} />
        </button>
      </div>

      {/* Node Details Overlay */}
      {selectedNode && (
        <div className="absolute bottom-6 left-6 right-6 p-5 bg-surface/90 backdrop-blur-2xl border border-border rounded-2xl shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-300">
           <div className="flex items-start justify-between gap-6">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                   <div className={`w-2 h-2 rounded-full ${
                      selectedNode.type === 'root' ? 'bg-white' : 
                      selectedNode.type === 'category' ? 'bg-[#00b478]' : 
                      selectedNode.type === 'subcategory' ? 'bg-[#4a80c8]' : 'bg-[#e09040]'
                   }`} />
                   <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-t3">{selectedNode.type}</span>
                </div>
                <h3 className="text-base font-bold text-t1 mb-1">{selectedNode.label}</h3>
                {selectedNode.content && selectedNode.content !== selectedNode.label && (
                  <p className="text-xs text-t2 leading-relaxed opacity-80 mt-2 font-medium">
                    {selectedNode.content}
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <button 
                  onClick={() => {
                    const svg = d3.select(svgRef.current)
                    const width = containerRef.current?.clientWidth || 800
                    const height = 500
                    svg.transition().duration(750).call(
                      d3.zoom().transform,
                      d3.zoomIdentity.translate(width / 2, height / 2).scale(2).translate(-selectedNode.x, -selectedNode.y)
                    )
                  }}
                  className="flex items-center justify-center gap-2 px-3 py-2 bg-amber/10 border border-amber/20 hover:bg-amber/20 rounded-lg text-amber text-[11px] font-bold transition-all active:scale-95"
                >
                  <Maximize2 size={12} /> Fokus
                </button>
                <button 
                  onClick={() => setSelectedNode(null)}
                  className="p-2 hover:bg-surface2 rounded-lg text-t3 hover:text-t1 transition-colors"
                >
                  ✕
                </button>
              </div>
           </div>
        </div>
      )}
    </div>
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
      <div className="skeleton w-16 h-3" />
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function MemoryPage() {
  const [view, setView] = useState('graph') // Default to graph for WOW factor
  const { data: listData, loading: listLoading, error: listError, refetch: listRefetch } = useApi('/memory')
  const { data: graphData, loading: graphLoading, error: graphError, refetch: graphRefetch } = useApi(view === 'graph' ? '/memory/graph' : null)

  const files = listData?.files ?? []
  const total = listData?.total_kb ?? 0
  const max = listData?.max_kb ?? 500
  const pct = Math.round((total / max) * 100)

  const graphNodes = graphData?.nodes ?? []
  const graphLinks = graphData?.links ?? []

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber/10 border border-amber/20 flex items-center justify-center">
            <Brain size={20} className="text-amber" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-t1 leading-none">Hukommelse</h1>
            <p className="text-[11px] text-t3 mt-1 uppercase tracking-wider">Neural Knowledge Graph & Storage</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex bg-surface border border-border rounded-lg p-0.5">
            <button
              onClick={() => setView('graph')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all ${
                view === 'graph' ? 'bg-surface2 text-t1 shadow-sm' : 'text-t3 hover:text-t2'
              }`}
            >
              <Network size={12} /> Graph
            </button>
            <button
              onClick={() => setView('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all ${
                view === 'list' ? 'bg-surface2 text-t1 shadow-sm' : 'text-t3 hover:text-t2'
              }`}
            >
              <List size={12} /> Files
            </button>
          </div>
          <button
            onClick={view === 'list' ? listRefetch : graphRefetch}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-t3 hover:text-t2 hover:bg-surface2 transition-all active:scale-95"
          >
            <RefreshCw size={14} className={graphLoading || listLoading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="col-span-1 md:col-span-2">
           {view === 'graph' ? (
              <div className="space-y-4">
                 {graphLoading ? (
                    <div className="h-[500px] border border-border rounded-xl bg-surface/50 animate-pulse flex items-center justify-center text-t3 font-mono text-xs">
                       <RefreshCw size={20} className="animate-spin mr-3 opacity-30" />
                       GENERATING NEURAL WEIGHTS...
                    </div>
                 ) : graphError ? (
                    <div className="h-[500px] border border-rust/30 rounded-xl bg-rust/5 flex items-center justify-center p-10 text-center">
                       <div>
                          <AlertTriangle size={32} className="text-rust mx-auto mb-4 opacity-50" />
                          <div className="text-sm font-bold text-rust mb-2">Graph Error</div>
                          <div className="text-xs text-t3 max-w-xs mx-auto">{graphError}</div>
                       </div>
                    </div>
                 ) : (
                    <D3ForceGraph nodes={graphNodes} links={graphLinks} />
                 )}
              </div>
           ) : (
              <div className="bg-surface border border-border rounded-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-border bg-surface2/50">
                  <h3 className="text-xs font-bold text-t2">Knowledge Stores</h3>
                </div>
                <div className="divide-y divide-border px-5">
                  {listLoading
                    ? Array.from({ length: 6 }, (_, i) => <SkeletonRow key={i} />)
                    : files.map(f => <MemoryFileRow key={f.name} file={f} />)
                  }
                </div>
              </div>
           )}
        </div>

        <div className="space-y-5">
            <div className="bg-surface border border-border rounded-xl p-5 card-amber">
               <h4 className="text-[10px] font-bold text-t3 uppercase tracking-widest mb-4">Storage Usage</h4>
               <div className="flex items-end justify-between mb-2">
                  <div className="text-3xl font-black text-t1">{pct}%</div>
                  <div className="text-[10px] text-t3 font-mono mb-1">{total.toFixed(0)}/{max} KB</div>
               </div>
               <div className="h-1.5 bg-border rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-amber shadow-[0_0_12px_rgba(251,191,36,0.5)] transition-all duration-1000"
                    style={{ width: `${pct}%` }}
                  />
               </div>
               <p className="text-[10px] text-t3 mt-4 leading-relaxed font-mono">
                  {pct > 80 ? '⚠️ High pressure. Consider compression.' : 'System state is healthy and responsive.'}
               </p>
            </div>

            <div className="bg-surface border border-border rounded-xl p-5">
               <h4 className="text-[10px] font-bold text-t3 uppercase tracking-widest mb-4">Graph Legend</h4>
               <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-white shadow-lg" />
                    <span className="text-[11px] text-t2 font-semibold">Core Memory</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-[#00b478] shadow-lg" />
                    <span className="text-[11px] text-t2">Categories</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-[#4a80c8] shadow-lg" />
                    <span className="text-[11px] text-t2">Sub-concepts</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-[#e09040] shadow-lg" />
                    <span className="text-[11px] text-t2">Data Points</span>
                  </div>
               </div>
            </div>
        </div>
      </div>
    </div>
  )
}

