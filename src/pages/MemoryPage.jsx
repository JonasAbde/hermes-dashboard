import { useState, useEffect, useRef, useCallback, useId } from 'react'
import { usePoll } from '../hooks/useApi'
import { apiFetch } from '../utils/auth'
import { Chip } from '../components/ui/Chip'
import { PagePrimer } from '../components/ui/PagePrimer'
import {
  Brain, FileText, RefreshCw, List, Network, AlertTriangle,
  ZoomIn, ZoomOut, Maximize2, Search, X, Clock, Database,
  ChevronRight, Star, BookOpen, Layers, Activity, Shuffle, Info,
  GitBranch, Filter, Plus, ArrowUpDown, Save, Edit3, Trash2, BookMarked
} from 'lucide-react'
import * as d3 from 'd3'

// ─── Knowledge Graph ──────────────────────────────────────────────────────

// Icon paths for node types (inline SVG paths, no lucide import needed)
const NODE_ICONS = {
  root:      { path: 'M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z', size: 10 },
  category:  { path: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z', size: 9 },
  subcategory: { path: 'M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z', size: 7 },
  item:      { path: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8', size: 6 },
}

function D3ForceGraph({ nodes, links, searchQuery, onNodeClick }) {
  const uid = useId()
  const svgRef = useRef(null)
  const simRef = useRef(null)
  const containerRef = useRef(null)
  // Guard: SVG must have explicit pixel dimensions before d3 zoom runs.
  // Use requestAnimationFrame to wait for layout pass first.
  const fixSvgDims = () => {
    requestAnimationFrame(() => {
      if (!svgRef.current) return
      const el = svgRef.current
      if (!el.getAttribute('width') || el.getAttribute('width') === '13') {
        el.setAttribute('width', el.clientWidth || 800)
        el.setAttribute('height', el.clientHeight || 520)
      }
    })
  }
  const [selectedNode, setSelectedNode] = useState(null)
  const [tooltip, setTooltip] = useState({ visible: false, x: 0, y: 0, node: null })
  const zoomRef = useRef(null)
  const currentTransform = useRef(d3.zoomIdentity)

  const COLOR_MAP = {
    root:       { fill: '#ffffff', glow: '#ffffff', ring: '#ffffff44' },
    category:   { fill: '#00b478', glow: '#00b478', ring: '#00b47844' },
    subcategory:{ fill: '#4a80c8', glow: '#4a80c8', ring: '#4a80c844' },
    item:       { fill: '#e09040', glow: '#e09040', ring: '#e0904033' },
  }
  const RADIUS_MAP = { root: 11, category: 8, subcategory: 6, item: 4.5 }
  const FONT_MAP = { root: '11px', category: '10px', subcategory: '9px', item: '8px' }

  useEffect(() => {
    if (!nodes?.length || !svgRef.current) return
    fixSvgDims() // Set explicit pixel dims on SVG before d3 zoom

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()
    if (simRef.current) simRef.current.stop()

    const W = svgRef.current.clientWidth || 800
    const H = 520
    const MM_W = 130, MM_H = 85

    const defs = svg.append('defs')

    // Glow filter
    const glow = defs.append('filter').attr('id', `glow-${uid}`).attr('x', '-50%').attr('y', '-50%').attr('width', '200%').attr('height', '200%')
    glow.append('feGaussianBlur').attr('stdDeviation', '4').attr('result', 'coloredBlur')
    const glowMerge = glow.append('feMerge')
    glowMerge.append('feMergeNode').attr('in', 'coloredBlur')
    glowMerge.append('feMergeNode').attr('in', 'SourceGraphic')

    // Glow2 — stronger for selected
    const glow2 = defs.append('filter').attr('id', `glow-strong-${uid}`).attr('x', '-100%').attr('y', '-100%').attr('width', '300%').attr('height', '300%')
    glow2.append('feGaussianBlur').attr('stdDeviation', '8').attr('result', 'coloredBlur')
    const glow2Merge = glow2.append('feMerge')
    glow2Merge.append('feMergeNode').attr('in', 'coloredBlur')
    glow2Merge.append('feMergeNode').attr('in', 'SourceGraphic')

    // Arrow marker
    defs.append('marker')
      .attr('id', 'arrow').attr('viewBox', '0 -4 8 8').attr('refX', 18).attr('refY', 0)
      .attr('markerWidth', 5).attr('markerHeight', 5).attr('orient', 'auto')
      .append('path').attr('d', 'M0,-4L8,0L0,4').attr('fill', '#2a2d3a')

    // Gradient defs per node type
    Object.entries(COLOR_MAP).forEach(([type, colors]) => {
      const grad = defs.append('radialGradient').attr('id', `radial-${type}`)
        .attr('cx', '35%').attr('cy', '35%').attr('r', '65%')
      grad.append('stop').attr('offset', '0%').attr('stop-color', colors.fill).attr('stop-opacity', 1)
      grad.append('stop').attr('offset', '100%').attr('stop-color', colors.glow).attr('stop-opacity', 0.7)
    })

    const g = svg.append('g')

    // Zoom
    const zoom = d3.zoom().scaleExtent([0.08, 8]).on('zoom', e => {
      g.attr('transform', e.transform)
      currentTransform.current = e.transform
      updateMinimap(e.transform)
    })
    zoomRef.current = zoom
    svg.call(zoom).on('dblclick.zoom', null)
    // Background grid dots
    const gridG = g.append('g').attr('class', 'grid')
    const gridSpacing = 40
    for (let x = 0; x < W; x += gridSpacing) {
      for (let y = 0; y < H; y += gridSpacing) {
        gridG.append('circle').attr('cx', x).attr('cy', y).attr('r', 0.8)
          .attr('fill', '#2a2d3a').attr('opacity', 0.5)
      }
    }

    // Valid links
    const validNodeIds = new Set(nodes.map(n => n.id))
    const validLinks = links.filter(l =>
      l.source && l.target &&
      validNodeIds.has(typeof l.source === 'object' ? l.source.id : l.source) &&
      validNodeIds.has(typeof l.target === 'object' ? l.target.id : l.target)
    )

    // Build adjacency for path highlighting
    const nodeMap = {}
    nodes.forEach(n => { nodeMap[n.id] = n })
    const getNeighbors = (nodeId) => {
      const neighbors = new Set()
      validLinks.forEach(l => {
        const sid = typeof l.source === 'object' ? l.source.id : l.source
        const tid = typeof l.target === 'object' ? l.target.id : l.target
        if (sid === nodeId) neighbors.add(tid)
        if (tid === nodeId) neighbors.add(sid)
      })
      return neighbors
    }

    const sim = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(validLinks).id(d => d.id)
        .distance(d => d.value === 5 ? 120 : d.value === 3 ? 75 : 45)
        .strength(0.8))
      .force('charge', d3.forceManyBody().strength(-250).distanceMax(350))
      .force('center', d3.forceCenter(W / 2, H / 2))
      .force('x', d3.forceX(W / 2).strength(0.05))
      .force('y', d3.forceY(H / 2).strength(0.05))
      .force('collide', d3.forceCollide(d => (RADIUS_MAP[d.type] || 4) + 22))

    simRef.current = sim

    // Link groups (bg glow + line + arrow)
    const linkGroup = g.append('g').attr('class', 'links')
    const linkBg = linkGroup.selectAll('line.lbg').data(validLinks).join('line')
      .attr('class', 'lbg').attr('stroke', '#1a1c28').attr('stroke-opacity', 0.8).attr('stroke-width', d => (d.value === 5 ? 4 : d.value === 3 ? 2.5 : 1.5))
    const linkLine = linkGroup.selectAll('line.lfg').data(validLinks).join('line')
      .attr('class', 'lfg').attr('stroke', d => {
        const sid = typeof d.source === 'object' ? d.source.id : d.source
        const tid = typeof d.target === 'object' ? d.target.id : d.target
        const src = nodeMap[sid]
        const tgt = nodeMap[tid]
        if (src && tgt) return COLOR_MAP[src.type]?.fill || '#4a80c8'
        return '#4a80c8'
      }).attr('stroke-opacity', 0.4).attr('stroke-width', d => Math.sqrt(d.value || 1))
      .attr('marker-end', d => d.value >= 3 ? 'url(#arrow)' : null)

    // Node groups
    const nodeG = g.append('g').attr('class', 'nodes')

    // Build node hierarchy map for search
    const rootNode = nodes.find(n => n.type === 'root')

    // Apply initial positions in a radial layout for a nicer starting state
    if (rootNode) {
      const categories = nodes.filter(n => n.type === 'category')
      categories.forEach((cat, ci) => {
        const angle = (ci / categories.length) * 2 * Math.PI - Math.PI / 2
        const r = 160
        cat.x = W / 2 + r * Math.cos(angle)
        cat.y = H / 2 + r * Math.sin(angle)
      })
    }

    const node = nodeG.selectAll('g.nd').data(nodes).join('g')
      .attr('class', 'nd').attr('cursor', 'pointer')
      .on('click', (_, d) => { setSelectedNode(d); onNodeClick?.(d) })
      .on('mouseenter', (event, d) => {
        const [mx, my] = d3.pointer(event, svgRef.current)
        setTooltip({ visible: true, x: mx, y: my, node: d })
        // Highlight connected
        const neighs = getNeighbors(d.id)
        node.select('circle.circ').attr('opacity', n =>
          n.id === d.id || neighs.has(n.id) ? 1 : 0.15
        )
        node.select('text.lbl').attr('opacity', n =>
          n.id === d.id || neighs.has(n.id) ? 1 : 0.1
        )
        linkLine.attr('stroke-opacity', l => {
          const sid = typeof l.source === 'object' ? l.source.id : l.source
          const tid = typeof l.target === 'object' ? l.target.id : l.target
          return (sid === d.id || tid === d.id) ? 0.9 : 0.05
        })
      })
      .on('mousemove', (event) => {
        const [mx, my] = d3.pointer(event, svgRef.current)
        setTooltip(t => ({ ...t, x: mx, y: my }))
      })
      .on('mouseleave', () => {
        setTooltip(t => ({ ...t, visible: false }))
        node.select('circle.circ').attr('opacity', 1)
        node.select('text.lbl').attr('opacity', 1)
        linkLine.attr('stroke-opacity', 0.4)
      })
      .call(d3.drag()
        .on('start', (e, d) => { if (!e.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y })
        .on('drag', (e, d) => { d.fx = e.x; d.fy = e.y })
        .on('end', (e, d) => { if (!e.active) sim.alphaTarget(0); d.fx = null; d.fy = null }))

    // Outer ring
    node.append('circle').attr('class', 'ring')
      .attr('r', d => (RADIUS_MAP[d.type] || 4) + 3)
      .attr('fill', 'none').attr('stroke', d => COLOR_MAP[d.type]?.ring || '#ffffff22')
      .attr('stroke-width', 1.5).attr('opacity', 0.6)

    // Main circle
    node.append('circle').attr('class', 'circ')
      .attr('r', d => RADIUS_MAP[d.type] || 4)
      .attr('fill', d => `url(#radial-${d.type})`)
      .attr('filter', d => d.type === 'root' ? `url(#glow-strong-${uid})` : `url(#glow-${uid})`)
      .attr('stroke', d => COLOR_MAP[d.type]?.fill || '#ffffff')
      .attr('stroke-width', 0.5)
      .attr('stroke-opacity', 0.8)

    // Inner icon (SVG path)
    node.each(function(d) {
      const icon = NODE_ICONS[d.type]
      if (!icon) return
      d3.select(this).append('path')
        .attr('d', icon.path)
        .attr('fill', d.type === 'root' ? '#1e2130' : 'rgba(0,0,0,0.5)')
        .attr('transform', `translate(${-icon.size / 2},${-icon.size / 2}) scale(${icon.size / 24})`)
        .style('pointer-events', 'none')
    })

    // Label background
    node.append('rect').attr('class', 'lblbg')
      .attr('x', d => (RADIUS_MAP[d.type] || 4) + 4)
      .attr('y', -7)
      .attr('height', 14).attr('rx', 3)
      .attr('fill', 'rgba(10,11,18,0.75)').attr('opacity', 0.85)
      .each(function(d) {
        const label = d.label || d.id
        const fontSize = parseInt(FONT_MAP[d.type]) || 9
        const textWidth = label.length * fontSize * 0.58
        d3.select(this).attr('width', textWidth + 6)
      })

    // Label text
    node.append('text').attr('class', 'lbl')
      .text(d => {
        const raw = d.label || d.id
        return raw.length > 38 ? raw.slice(0, 36) + '…' : raw
      })
      .attr('x', d => (RADIUS_MAP[d.type] || 4) + 7)
      .attr('y', 4)
      .attr('font-size', d => FONT_MAP[d.type] || '9px')
      .attr('font-family', 'Inter, sans-serif')
      .attr('font-weight', d => d.type === 'root' || d.type === 'category' ? '600' : '400')
      .attr('fill', d => d.type === 'root' ? '#ffffff' : d.type === 'category' ? '#00b478' : '#94a3b8')
      .style('pointer-events', 'none')

    // Search filtering
    function applySearch(query) {
      if (!query) {
        node.select('circle.circ').attr('opacity', 1)
        node.select('text.lbl').attr('opacity', 1)
        linkLine.attr('stroke-opacity', 0.4)
        node.select('circle.ring').attr('stroke-opacity', 0.6)
        return
      }
      const q = query.toLowerCase()
      const matched = new Set()
      nodes.forEach(n => {
        if ((n.label || '').toLowerCase().includes(q) || (n.content || '').toLowerCase().includes(q)) {
          matched.add(n.id)
          // Also add neighbors
          getNeighbors(n.id).forEach(id => matched.add(id))
        }
      })
      node.select('circle.circ').attr('opacity', d => matched.has(d.id) ? 1 : 0.08)
      node.select('text.lbl').attr('opacity', d => matched.has(d.id) ? 1 : 0.05)
      linkLine.attr('stroke-opacity', l => {
        const sid = typeof l.source === 'object' ? l.source.id : l.source
        const tid = typeof l.target === 'object' ? l.target.id : l.target
        return matched.has(sid) || matched.has(tid) ? 0.7 : 0.02
      })
    }

    // Minimap
    const mmG = svg.append('g').attr('class', 'minimap').attr('transform', `translate(${W - MM_W - 12}, ${H - MM_H - 12})`)
    mmG.append('rect').attr('x', -2).attr('y', -2).attr('width', MM_W + 4).attr('height', MM_H + 4)
      .attr('rx', 8).attr('fill', 'rgba(10,11,18,0.85)').attr('stroke', '#2a2d3a').attr('stroke-width', 1)
    const mmContent = mmG.append('g')
    const mmLinks = mmContent.append('g')
    const mmNodes = mmContent.append('g')

    const mmScaleX = (x) => (x / W) * MM_W
    const mmScaleY = (y) => (y / H) * MM_H

    function updateMinimap(transform) {
      mmContent.attr('transform', `translate(${mmScaleX(-transform.x / transform.k)},${mmScaleY(-transform.y / transform.k)}) scale(${transform.k})`)
    }

    // Initialize minimap nodes (static circles, update positions on tick)
    const mmNodeDots = mmNodes.selectAll('circle').data(nodes).join('circle')
      .attr('r', d => (RADIUS_MAP[d.type] || 4) * 0.7)
      .attr('fill', d => COLOR_MAP[d.type]?.fill || '#6b6b80').attr('opacity', 0.7)
    const mmLinkLines = mmLinks.selectAll('line').data(validLinks).join('line')
      .attr('stroke', '#2a2d3a').attr('stroke-width', 0.5).attr('stroke-opacity', 0.5)

    // Viewport rect in minimap
    const vpRect = mmG.append('rect').attr('rx', 2)
      .attr('fill', 'none').attr('stroke', '#f59e0b').attr('stroke-width', 1.5)
      .attr('stroke-opacity', 0.8)

    // Minimap click to pan
    mmG.on('click', (event) => {
      event.stopPropagation()
      const [mx, my] = d3.pointer(event, svgRef.current)
      const scale = currentTransform.current.k
      const tx = W / 2 - mx * scale
      const ty = H / 2 - my * scale
      d3.select(svgRef.current).transition().duration(400)
        .call(zoom.transform, d3.zoomIdentity.translate(tx, ty).scale(scale))
    })

    // Store refs for search effect
    nodeG.attr('data-search', '')

    sim.on('tick', () => {
      linkBg
        .attr('x1', d => d.source?.x ?? 0).attr('y1', d => d.source?.y ?? 0)
        .attr('x2', d => d.target?.x ?? 0).attr('y2', d => d.target?.y ?? 0)
      linkLine
        .attr('x1', d => d.source?.x ?? 0).attr('y1', d => d.source?.y ?? 0)
        .attr('x2', d => d.target?.x ?? 0).attr('y2', d => d.target?.y ?? 0)

      node.attr('transform', d => `translate(${d.x ?? 0},${d.y ?? 0})`)

      // Update minimap
      mmNodeDots.attr('cx', d => mmScaleX(d.x ?? 0)).attr('cy', d => mmScaleY(d.y ?? 0))
      mmLinkLines
        .attr('x1', d => mmScaleX(d.source?.x ?? 0)).attr('y1', d => mmScaleY(d.source?.y ?? 0))
        .attr('x2', d => mmScaleX(d.target?.x ?? 0)).attr('y2', d => mmScaleY(d.target?.y ?? 0))

      // Viewport
      const t = currentTransform.current
      vpRect.attr('x', Math.max(0, -t.x / t.k * MM_W / W))
        .attr('y', Math.max(0, -t.y / t.k * MM_H / H))
        .attr('width', Math.min(MM_W, W / t.k * MM_W / W))
        .attr('height', Math.min(MM_H, H / t.k * MM_H / H))
    })

    // Expose search to external effect
    svgRef.current._applySearch = applySearch

    // Center view on load — track timeout so we can clean up on unmount
    const centerTimeout = setTimeout(() => {
      svg.transition().duration(800).call(zoom.transform, d3.zoomIdentity.translate(0, 20))
    }, 600)

    return () => {
      sim.stop()
      clearTimeout(centerTimeout)
    }
  }, [nodes, links])

  // Apply search externally — searchQuery comes from props
  useEffect(() => {
    if (svgRef.current?._applySearch) {
      svgRef.current._applySearch(searchQuery || '')
    }
  }, [searchQuery])

  const resetZoom = () => {
    if (!svgRef.current || !zoomRef.current) return
    d3.select(svgRef.current).transition().duration(600)
      .call(zoomRef.current.transform, d3.zoomIdentity.translate(0, 20))
  }

  const zoomIn = () => {
    if (!svgRef.current || !zoomRef.current) return
    d3.select(svgRef.current).transition().duration(300)
      .call(zoomRef.current.scaleBy, 1.5)
  }

  const zoomOut = () => {
    if (!svgRef.current || !zoomRef.current) return
    d3.select(svgRef.current).transition().duration(300)
      .call(zoomRef.current.scaleBy, 0.67)
  }

  const focusNode = (node) => {
    if (!svgRef.current || !zoomRef.current || !node) return
    const W = svgRef.current.clientWidth || 800
    const H = 520
    d3.select(svgRef.current).transition().duration(700)
      .call(zoomRef.current.transform,
        d3.zoomIdentity.translate(W / 2, H / 2).scale(2.8).translate(-(node.x ?? 0), -(node.y ?? 0))
      )
  }

  useEffect(() => {
    if (selectedNode) focusNode(selectedNode)
  }, [selectedNode])

  // Format content for display
  const formatContent = (content) => {
    if (!content) return null
    return content.replace(/\*\*(.+?)\*\*/g, '$1').replace(/~~(.+?)~~/g, '$1').replace(/`(.+?)`/g, '$1')
  }

  return (
    <div className="relative" ref={containerRef}>
      <svg ref={svgRef} width={800} height={520} className="w-full border border-border rounded-xl bg-bg/50" />

      {/* Zoom controls — always visible with frosted glass */}
      <div className="absolute top-3 right-3 flex flex-col gap-1.5 p-1.5 bg-bg/70 backdrop-blur-xl border border-border/60 rounded-xl shadow-xl">
        <button onClick={zoomIn}    className="p-2 rounded-lg text-t3 hover:text-t1 hover:bg-surface2 transition-all active:scale-95" title="Zoom in"><ZoomIn size={13} /></button>
        <button onClick={zoomOut}   className="p-2 rounded-lg text-t3 hover:text-t1 hover:bg-surface2 transition-all active:scale-95" title="Zoom out"><ZoomOut size={13} /></button>
        <div className="h-px bg-border mx-1" />
        <button onClick={resetZoom} className="p-2 rounded-lg text-t3 hover:text-t1 hover:bg-surface2 transition-all active:scale-95" title="Fit to view"><Maximize2 size={13} /></button>
        <div className="h-px bg-border mx-1" />
        <button onClick={() => {
          if (!svgRef.current || !simRef.current) return
          simRef.current.alpha(0.8).restart()
        }} className="p-2 rounded-lg text-t3 hover:text-amber hover:bg-amber/10 transition-all active:scale-95" title="Re-layout graph">
          <Shuffle size={13} />
        </button>
      </div>

      {/* Hover tooltip */}
      {tooltip.visible && tooltip.node && (
        <div
          className="absolute pointer-events-none z-50"
          style={{ left: tooltip.x + 14, top: tooltip.y - 12, transform: 'translateY(-100%)' }}
        >
          <div className="px-3 py-2 bg-surface/95 backdrop-blur-xl border border-border/80 rounded-lg shadow-2xl max-w-xs">
            <div className="flex items-center gap-1.5 mb-1">
              <div className={`w-1.5 h-1.5 rounded-full ${tooltip.node.type === 'root' ? 'bg-white' : tooltip.node.type === 'category' ? 'bg-[#00b478]' : tooltip.node.type === 'subcategory' ? 'bg-[#4a80c8]' : 'bg-[#e09040]'}`} />
              <span className="text-[9px] uppercase tracking-widest font-bold text-t3">{tooltip.node.type}</span>
            </div>
            <p className="text-[10px] text-t1 font-semibold leading-snug">{tooltip.node.label}</p>
            {tooltip.node.content && tooltip.node.content !== tooltip.node.label && (
              <p className="text-[9px] text-t3 mt-0.5 leading-snug line-clamp-2">
                {formatContent(tooltip.node.content)}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Node detail overlay */}
      {selectedNode && (
        <div className="absolute bottom-4 left-4 right-4 p-5 bg-surface/95 backdrop-blur-2xl border border-border rounded-2xl shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-start gap-4">
            {/* Node color indicator */}
            <div className="flex-shrink-0 flex flex-col items-center gap-1 pt-0.5">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                selectedNode.type === 'root' ? 'bg-white/20' :
                selectedNode.type === 'category' ? 'bg-[#00b478]/20' :
                selectedNode.type === 'subcategory' ? 'bg-[#4a80c8]/20' : 'bg-[#e09040]/20'
              }`}>
                <Info size={14} className={
                  selectedNode.type === 'root' ? 'text-white' :
                  selectedNode.type === 'category' ? 'text-[#00b478]' :
                  selectedNode.type === 'subcategory' ? 'text-[#4a80c8]' : 'text-[#e09040]'
                } />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-[9px] uppercase tracking-widest font-bold px-2 py-0.5 rounded-full ${
                  selectedNode.type === 'root' ? 'bg-white/10 text-white' :
                  selectedNode.type === 'category' ? 'bg-[#00b478]/15 text-[#00b478]' :
                  selectedNode.type === 'subcategory' ? 'bg-[#4a80c8]/15 text-[#4a80c8]' : 'bg-[#e09040]/15 text-[#e09040]'
                }`}>{selectedNode.type}</span>
                {selectedNode.group !== undefined && (
                  <span className="text-[9px] text-t3 font-mono">Grp {selectedNode.group}</span>
                )}
              </div>
              <h3 className="text-sm font-bold text-t1 mb-1.5">{selectedNode.label}</h3>
              {selectedNode.content && selectedNode.content !== selectedNode.label && (
                <p className="text-[11px] text-t2 leading-relaxed opacity-80 max-h-24 overflow-y-auto">
                  {formatContent(selectedNode.content)}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-1.5 flex-shrink-0">
              <button onClick={() => focusNode(selectedNode)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber/10 border border-amber/20 hover:bg-amber/20 rounded-lg text-amber text-[10px] font-bold transition-all">
                <Maximize2 size={10} /> Fokus
              </button>
              <button onClick={() => setSelectedNode(null)}
                className="p-1.5 hover:bg-surface2 rounded-lg text-t3 hover:text-t1 transition-colors text-sm text-center">✕
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
      <div className="flex flex-wrap items-center gap-1 px-4 pt-3 pb-2 border-b border-border bg-surface2/30">
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
        <div className="hidden sm:block flex-1" />
        {/* Sort */}
        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value)}
          className="text-[10px] bg-transparent text-t3 border border-border rounded px-2 py-1 sm:mr-2"
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

// ─── Entries Tab ─────────────────────────────────────────────────────────

function EntriesTab({ entries, target, onRefresh, loading, searchQ, onSearch, searchResults, onRefreshStats }) {
  const [showAdd, setShowAdd] = useState(false)
  const [addContent, setAddContent] = useState('')
  const [editEntry, setEditEntry] = useState(null)
  const [editText, setEditText] = useState('')
  const [activeTab, setActiveTab] = useState(target || 'memory')
  // entries = { memory: [...], user: [...] } from unified API
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [localSearch, setLocalSearch] = useState('')
  const [sortOrder, setSortOrder] = useState('desc') // 'desc' | 'asc'

  // Use passed searchQ or local
  const activeSearchQ = searchQ !== undefined ? searchQ : localSearch
  const setActiveSearchQ = onSearch || setLocalSearch

  // Determine which entries to show based on activeTab
  const displayEntries = entries[activeTab] || []

  // Filter by search
  const filtered = !activeSearchQ
    ? displayEntries
    : displayEntries.filter(e =>
        (e.content || '').toLowerCase().includes(activeSearchQ.toLowerCase())
      )

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    const dateA = new Date(a.created_at || 0).getTime()
    const dateB = new Date(b.created_at || 0).getTime()
    return sortOrder === 'desc' ? dateB - dateA : dateA - dateB
  })

  // Show search results if searching
  const searchResults_ = searchResults?.results || []

  const showSuccess = (msg) => {
    setSuccess(msg)
    setTimeout(() => setSuccess(null), 3000)
  }

  const currentTarget = activeTab

  const handleAdd = async () => {
    if (!addContent.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await apiFetch('/api/memory/entries', {
        method: 'POST',
        body: JSON.stringify({ target: currentTarget, content: addContent.trim() }),
      })
      const data = await res.json()
      if (data.success) {
        setAddContent('')
        setShowAdd(false)
        showSuccess('Entry added!')
        onRefresh?.()
        onRefreshStats?.()
      } else {
        setError(data.error || 'Failed to add entry')
      }
    } catch (e) {
      setError(e.message)
    }
    setSubmitting(false)
  }

  const handleRemove = async (entryId) => {
    if (!confirm('Remove this entry?')) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await apiFetch('/api/memory/entries', {
        method: 'DELETE',
        body: JSON.stringify({ target: currentTarget, entry_id: entryId }),
      })
      const data = await res.json()
      if (data.success) {
        showSuccess('Entry removed!')
        onRefresh?.()
        onRefreshStats?.()
      } else {
        setError(data.error || 'Failed to remove entry')
      }
    } catch (e) {
      setError(e.message)
    }
    setSubmitting(false)
  }

  const targetLabel = { memory: 'Memory', user: 'User Profile' }

  return (
    <div className="space-y-4">
      {/* Status messages */}
      {success && (
        <div className="bg-[#00b478]/10 border border-[#00b478]/30 rounded-lg px-4 py-2 text-[11px] text-[#00b478]">
          ✓ {success}
        </div>
      )}
      {error && (
        <div className="bg-rust/10 border border-rust/30 rounded-lg px-4 py-2 text-[11px] text-rust">
          ✗ {error}
        </div>
      )}

      {/* Add entry form */}
      {showAdd && (
        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold text-t2">New Entry — {targetLabel[currentTarget]}</span>
            <button onClick={() => { setShowAdd(false); setAddContent('') }} className="text-t3 hover:text-t1">
              <X size={14} />
            </button>
          </div>
          <textarea
            value={addContent}
            onChange={e => setAddContent(e.target.value)}
            placeholder="Indtast note til hukommelsen..."
            className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-[11px] text-t1 placeholder-t3 outline-none focus:border-amber/50 resize-y font-mono"
            rows={4}
          />
          <div className="flex justify-end mt-2">
            <button onClick={handleAdd} disabled={submitting || !addContent.trim()}
              className="px-3 py-1.5 text-[11px] bg-amber text-bg font-semibold rounded-lg hover:bg-amber/90 transition-colors disabled:opacity-40 flex items-center gap-1.5">
              {submitting ? <RefreshCw size={11} className="animate-spin" /> : <Plus size={11} />}
              Gem Entry
            </button>
          </div>
        </div>
      )}

      {/* Search + controls bar */}
      <div className="flex items-center gap-2">
        <div className="flex-1 flex items-center gap-2 bg-surface border border-border rounded-lg px-3 py-2">
          <Search size={12} className="text-t3 flex-shrink-0" />
          <input
            value={activeSearchQ}
            onChange={e => setActiveSearchQ(e.target.value)}
            placeholder="Søg i entries..."
            className="bg-transparent text-[11px] text-t1 placeholder-t3 flex-1 outline-none"
          />
          {activeSearchQ && <button onClick={() => setActiveSearchQ('')} className="text-t3 hover:text-t1"><X size={11} /></button>}
        </div>
        <button onClick={() => setShowAdd(true)} className="px-3 py-2 text-[11px] bg-amber/10 border border-amber/30 text-amber rounded-lg hover:bg-amber/20 transition-colors flex items-center gap-1.5">
          <Plus size={11} /> Add
        </button>
        <button onClick={() => setSortOrder(s => s === 'desc' ? 'asc' : 'desc')}
          className="p-2 text-t3 hover:text-t2 rounded-lg hover:bg-surface2 transition-colors" title="Sort order">
          <ArrowUpDown size={12} />
        </button>
      </div>

      {/* Entry tabs */}
      <div className="flex items-center gap-1 border-b border-border">
        {['memory', 'user'].map(t => {
          const count = (entries[t] || []).length
          return (
            <button key={t}
              onClick={() => setActiveTab(t)}
              className={`px-3 py-2 text-[11px] font-semibold border-b-2 transition-all ${
                activeTab === t ? 'border-amber text-t1 -mb-px' : 'border-transparent text-t3 hover:text-t2'
              }`}
            >
              {targetLabel[t]} <span className="ml-1 text-[9px] opacity-60">({count})</span>
            </button>
          )
        })}
      </div>

      {/* Loading indicator */}
      {loading && (
        <div className="flex items-center gap-2 text-[11px] text-t3 py-2">
          <RefreshCw size={12} className="animate-spin" /> Indlæser entries...
        </div>
      )}

      {/* Search results mode */}
      {activeSearchQ && searchResults_.length > 0 && (
        <div className="bg-surface border border-border rounded-xl p-4 mb-4">
          <div className="text-[10px] font-bold text-t3 uppercase tracking-widest mb-2 flex items-center gap-2">
            <Filter size={10} /> Søgeresultater: {searchResults_.length} fundet for "{activeSearchQ}"
          </div>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {searchResults_.map((r, i) => (
              <div key={i} className="bg-bg border border-border rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <div className={`w-1.5 h-1.5 rounded-full ${r.entry?.target === 'memory' ? 'bg-[#00b478]' : 'bg-[#4a80c8]'}`} />
                  <span className="text-[9px] font-mono text-t3">{r.entry?.id}</span>
                  <span className="text-[9px] font-mono text-amber">{r.score} point</span>
                  {r.matched_in?.map(m => (
                    <span key={m} className="text-[8px] font-mono px-1 py-0.5 rounded bg-surface2 text-t3">{m}</span>
                  ))}
                </div>
                <pre className="text-[10px] text-t2 font-mono whitespace-pre-wrap leading-relaxed">{r.snippet}</pre>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Entries list */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-2 border-b border-border flex items-center justify-between">
          <span className="text-[10px] font-bold text-t3 uppercase tracking-widest">
            {sorted.length} entries
            {sorted.length !== displayEntries.length ? ` (filtreret fra ${displayEntries.length})` : ''}
          </span>
          <span className="text-[9px] font-mono text-t3">
            {sortOrder === 'desc' ? 'nyeste → ældste' : 'ældste → nyeste'}
          </span>
        </div>
        <div className="divide-y divide-border max-h-[500px] overflow-y-auto">
          {sorted.length === 0 && (
            <div className="py-8 text-center text-[12px] text-t3">
              {activeSearchQ ? `Ingen entries matcher "${activeSearchQ}"` : 'No entries yet. Click "Add" to create one.'}
            </div>
          )}
          {sorted.map((entry, i) => (
            <div key={entry.id || i} className="group px-4 py-3 hover:bg-surface2 transition-colors">
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  {/* Entry metadata */}
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <span className={`text-[8px] font-mono px-1 py-0.5 rounded border ${
                      entry.target === 'memory' ? 'text-[#00b478] border-[#00b478]/30' : 'text-[#4a80c8] border-[#4a80c8]/30'
                    }`}>{entry.target?.toUpperCase() || 'MEM'}</span>
                    <span className="text-[9px] font-mono text-t3">{entry.id}</span>
                    {entry.is_injected && (
                      <span className="text-[8px] font-mono px-1 py-0.5 rounded bg-surface2 text-t3">injected</span>
                    )}
                    {entry.tags?.slice(0, 2).map(tag => (
                      <span key={tag} className="text-[8px] font-mono px-1 py-0.5 rounded bg-amber/10 text-amber">#{tag}</span>
                    ))}
                    <span className="text-[9px] font-mono text-t3 ml-auto">
                      {entry.created_at ? new Date(entry.created_at).toLocaleDateString('da-DK', { day: '2-digit', month: 'short' }) : ''}
                    </span>
                  </div>
                  {/* Content */}
                  <pre className="text-[11px] text-t2 whitespace-pre-wrap leading-relaxed font-mono">
                    {entry.content}
                  </pre>
                  {/* References */}
                  {entry.references?.length > 0 && (
                    <div className="flex items-center gap-1 mt-1.5">
                      <GitBranch size={8} className="text-t3" />
                      {entry.references.slice(0, 4).map(ref => (
                        <span key={ref} className="text-[9px] font-mono text-t3">{ref}</span>
                      ))}
                      {entry.references.length > 4 && (
                        <span className="text-[9px] text-t3">+{entry.references.length - 4}</span>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex-shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleRemove(entry.id)}
                    className="p-1.5 text-t3 hover:text-rust rounded transition-colors"
                    title="Remove entry">
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────

export function MemoryPage() {
  const [view, setView] = useState('graph')  // graph | entries | files | activity | timeline
  const [graphSearch, setGraphSearch] = useState('')
  const [filesTab, setFilesTab] = useState('all')
  const [searchQ, setSearchQ] = useState('')
  const [timelinePage, setTimelinePage] = useState(0)

  const { data: memData, loading: memLoading, refetch: memRefetch } = usePoll('/memory', 30000)
  const { data: graphData, loading: graphLoading, error: graphError, refetch: graphRefetch } = usePoll(view === 'graph' ? '/memory/graph' : null, 60000)
  const { data: actData, loading: actLoading, refetch: actRefetch } = usePoll(view === 'activity' ? '/memory/activity' : null, 30000)
  const { data: entriesData, loading: entriesLoading, refetch: entriesRefetch } = usePoll(
    view === 'entries' ? '/memory/entries?limit=100' : null, 20000)
  const { data: timelineData, loading: timelineLoading, refetch: timelineRefetch } = usePoll(
    view === 'timeline' ? `/memory/timeline?limit=50&offset=${timelinePage * 50}` : null, 30000)
  const { data: searchData, loading: searchLoading, refetch: searchRefetch } = usePoll(
    searchQ ? `/memory/search?q=${encodeURIComponent(searchQ)}` : null, 10000)

  const nodes = graphData?.nodes || []
  const links = graphData?.links || []
  const [searchQuery, setSearchQuery] = useState('')

  const allEntries = entriesData?.entries ?? []
  const memoryEntries = allEntries.filter(e => e.target === 'memory')
  const userEntries = allEntries.filter(e => e.target === 'user')

  const handleNodeClick = useCallback((node) => {}, [])

  const viewTabs = [
    { key: 'graph',    label: 'Vidensgraf',  icon: Network },
    { key: 'entries',  label: 'Entries',     icon: BookMarked },
    { key: 'timeline', label: 'Tidslinje',  icon: Clock },
    { key: 'files',    label: 'Filer',       icon: FileText },
    { key: 'activity', label: 'Aktivitet',   icon: Activity },
  ]

  // Refresh helper that covers all views
  const handleRefresh = () => {
    memRefetch()
    if (view === 'graph') graphRefetch()
    if (view === 'entries') entriesRefetch()
    if (view === 'activity') actRefetch()
    if (view === 'timeline') timelineRefetch()
  }

  return (
    <div className="space-y-6">
      <PagePrimer
        title="Memory"
        body="Use this page to inspect what Hermes has learned and stored over time."
        tip="If you are new, start in the 'Entries' view. Use the graph after you understand the basics."
      />
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-amber/10 border border-amber/20 flex items-center justify-center">
            <Brain size={20} className="text-amber" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-t1 leading-none">Hukommelse</h1>
            <p className="text-[11px] text-t3 mt-1 uppercase tracking-wider">
              {memData?.total_entries ?? '—'} entries · {memData?.by_category?.curated ?? '—'} curated filer
              {entriesData?.total ? ` · ${entriesData.total} strukturerede` : ''}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* View tabs */}
          <div className="flex bg-surface border border-border rounded-lg p-0.5 safe-scroll-x max-w-full">
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
            onClick={handleRefresh}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-t3 hover:text-t2 hover:bg-surface2 transition-all"
          >
            <RefreshCw size={14} className={(memLoading || graphLoading || entriesLoading || actLoading || timelineLoading) ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Content layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5 min-w-0">
        {/* Main content */}
        <div className="lg:col-span-3 space-y-4">
          {view === 'entries' && (
            <EntriesTab
              entries={{ memory: memoryEntries, user: userEntries }}
              target="memory"
              onRefresh={entriesRefetch}
              onRefreshStats={memRefetch}
              searchQ={searchQ}
              onSearch={setSearchQ}
              searchResults={searchData}
              loading={entriesLoading}
            />
          )}

          {view === 'timeline' && (
            <div className="bg-surface border border-border rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock size={14} className="text-amber" />
                  <span className="text-[11px] font-bold text-t2">Hukommelse Tidslinje</span>
                  <span className="text-[10px] text-t3 font-mono">
                    {timelineData?.total ?? 0} entries · side {timelinePage + 1}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setTimelinePage(p => Math.max(0, p - 1))}
                    disabled={timelinePage === 0}
                    className="px-2 py-1 text-[10px] text-t3 hover:text-t1 disabled:opacity-30"
                  >← Forrige</button>
                  <button
                    onClick={() => setTimelinePage(p => p + 1)}
                    disabled={!timelineData?.entries?.length}
                    className="px-2 py-1 text-[10px] text-t3 hover:text-t1 disabled:opacity-30"
                  >Næste →</button>
                </div>
              </div>

              {timelineLoading ? (
                <div className="p-8 text-center">
                  <RefreshCw size={20} className="animate-spin mx-auto mb-3 text-t3 opacity-40" />
                  <div className="text-xs font-mono text-t3">Indlæser tidslinje...</div>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {(timelineData?.entries ?? []).map((entry, i) => (
                    <div key={entry.id || i} className="px-4 py-4 hover:bg-surface2 transition-colors group">
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 mt-0.5">
                          <div className={`w-1.5 h-1.5 rounded-full mt-1.5 ${entry.target === 'memory' ? 'bg-[#00b478]' : 'bg-[#4a80c8]'}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${
                              entry.target === 'memory'
                                ? 'text-[#00b478] border-[#00b478]/30'
                                : 'text-[#4a80c8] border-[#4a80c8]/30'
                            }`}>{entry.target === 'memory' ? 'MEMORY' : 'USER'}</span>
                            <span className="text-[9px] font-mono text-t3">{entry.id}</span>
                            {entry.source && entry.source !== 'hermes' && (
                              <span className="text-[9px] font-mono text-amber">{entry.source}</span>
                            )}
                          </div>
                          <pre className="text-[11px] text-t2 whitespace-pre-wrap leading-relaxed font-mono">
                            {entry.content}
                          </pre>
                          {entry.tags?.length > 0 && (
                            <div className="flex gap-1 mt-2">
                              {entry.tags.map(tag => (
                                <span key={tag} className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-surface2 text-t3">
                                  #{tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex-shrink-0 text-right">
                          <div className="text-[9px] font-mono text-t3">
                            {entry.created_at ? new Date(entry.created_at).toLocaleDateString('da-DK', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}
                          </div>
                          {entry.references?.length > 0 && (
                            <div className="flex items-center gap-1 mt-1 text-[9px] text-t3">
                              <GitBranch size={8} />
                              {entry.references.length} refs
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  {timelineData?.entries?.length === 0 && (
                    <div className="py-12 text-center text-[12px] text-t3">Ingen entries endnu</div>
                  )}
                </div>
              )}
            </div>
          )}

          {view === 'graph' && (
            <>
              {/* Graph search bar */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
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
                <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono text-t3">
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
              activeTab={filesTab}
              setActiveTab={setFilesTab}
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
