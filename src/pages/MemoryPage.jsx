import { useState, useEffect } from 'react'
import { usePoll } from '../hooks/useApi.ts'
import { apiFetch } from '../utils/auth'
import { HermesCharacterMedium, rhythmToVariant } from '../components/avatar'
import { PagePrimer } from '../components/ui/PagePrimer'
import { StoragePanel, ActivityPanel, FileListTab, EntriesTab } from './MemoryPageComponents'

// ─── Quick Stats Grid ───────────────────────────────────────────────────────

function QuickStats({ memData, entriesData, actData }) {
  const storageKb = memData?.storage_kb ?? 0
  const totalEntries = memData?.total_entries ?? 0
  const maxKb = memData?.max_kb ?? 2500
  const lastUpdate = memData?.last_memory_update ?? null

  const timeAgo = (iso) => {
    if (!iso) return '—'
    const diff = Date.now() - new Date(iso).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 60) return `${mins}m`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}t`
    return `${Math.floor(hrs / 24)}d`
  }

  const pct = Math.round((storageKb / maxKb) * 100)

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {/* Agent Status */}
      <div className="bg-surface border border-border rounded-xl p-4">
        <div className="text-[10px] font-bold text-t3 uppercase tracking-wider mb-2">Agent</div>
        <div className="flex items-center gap-3">
          <HermesCharacterMedium
            variant={rhythmToVariant(memData?.agent_status?.rhythm || 'steady')}
            className="opacity-80"
          />
          <div className="min-w-0">
            <div className="text-xs font-bold text-t1">{memData?.agent_status?.rhythm || 'steady'}</div>
            <div className="text-[10px] text-t3">{timeAgo(lastUpdate)}</div>
          </div>
        </div>
      </div>

      {/* Memory Storage */}
      <div className="bg-surface border border-border rounded-xl p-4">
        <div className="text-[10px] font-bold text-t3 uppercase tracking-wider mb-2">Storage</div>
        <div className="text-2xl font-black text-t1">{pct}%</div>
        <div className="text-[10px] text-t3">{storageKb} / {maxKb} KB</div>
      </div>

      {/* Entries */}
      <div className="bg-surface border border-border rounded-xl p-4">
        <div className="text-[10px] font-bold text-t3 uppercase tracking-wider mb-2">Entries</div>
        <div className="text-2xl font-black text-t1">{totalEntries}</div>
        <div className="text-[10px] text-t3">
          {memData?.by_category?.curated ?? 0} curated
        </div>
      </div>

      {/* Activity */}
      <div className="bg-surface border border-border rounded-xl p-4">
        <div className="text-[10px] font-bold text-t3 uppercase tracking-wider mb-2">Activity</div>
        <div className="text-2xl font-black text-t1">
          {(actData?.day_grid?.[0]?.count ?? 0)}
        </div>
        <div className="text-[10px] text-t3">dages total</div>
      </div>
    </div>
  )
}

// ─── View Switcher ─────────────────────────────────────────────────────────

function ViewSwitcher({ view, setView, viewTabs }) {
  return (
    <div className="flex bg-surface border border-border rounded-lg p-0.5">
      {viewTabs.map(tab => (
        <button
          key={tab.key}
          onClick={() => setView(tab.key)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all ${
            view === tab.key ? 'bg-surface2 text-t1 shadow-sm' : 'text-t3 hover:text-t2'
          }`}
        >
          <span>{tab.label}</span>
        </button>
      ))}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────

export function MemoryPage() {
  const [view, setView] = useState('entries')  // entries | graph | files | activity | timeline
  const [filesTab, setFilesTab] = useState('all')
  const [searchQ, setSearchQ] = useState('')
  const [timelinePage, setTimelinePage] = useState(0)

  const { data: memData, loading: memLoading, refetch: memRefetch } = usePoll('/memory', 30000)
  const { data: graphData, loading: graphLoading, refetch: graphRefetch } = usePoll(
    view === 'graph' ? '/memory/graph' : null, 60000)
  const { data: actData, loading: actLoading, refetch: actRefetch } = usePoll(
    view === 'activity' ? '/memory/activity' : null, 30000)
  const { data: entriesData, loading: entriesLoading, refetch: entriesRefetch } = usePoll(
    view === 'entries' ? '/memory/entries?limit=100' : null, 20000)
  const { data: timelineData, loading: timelineLoading, refetch: timelineRefetch } = usePoll(
    view === 'timeline' ? `/memory/timeline?limit=50&offset=${timelinePage * 50}` : null, 30000)
  const { data: searchData, loading: searchLoading, refetch: searchRefetch } = usePoll(
    searchQ ? `/memory/search?q=${encodeURIComponent(searchQ)}` : null, 10000)

  const nodes = graphData?.nodes || []
  const links = graphData?.links || []
  const files = memData?.files ?? []
  const allEntries = entriesData?.entries ?? []
  const memoryEntries = allEntries.filter(e => e.target === 'memory')
  const userEntries = allEntries.filter(e => e.target === 'user')

  const viewTabs = [
    { key: 'graph', label: 'Graf', icon: null },
    { key: 'entries', label: 'Entries', icon: null },
    { key: 'timeline', label: 'Tidslinje', icon: null },
    { key: 'files', label: 'Filer', icon: null },
    { key: 'activity', label: 'Aktivitet', icon: null },
  ]

  const handleRefresh = () => {
    memRefetch()
    if (view === 'graph') graphRefetch()
    if (view === 'entries') entriesRefetch()
    if (view === 'activity') actRefetch()
    if (view === 'timeline') timelineRefetch()
  }

  return (
    <div className="space-y-4">
      <PagePrimer
        title="Memory"
        body="Overview over hvad Hermes har lært og gemt"
      />

      {/* Quick Stats */}
      <QuickStats memData={memData} entriesData={entriesData} actData={actData} />

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="text-2xl font-black text-t1">
            Hukommelse
          </div>
          <div className="hidden sm:block text-[11px] text-t3 font-mono">
            {memData?.total_entries ?? 0} entries
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <ViewSwitcher view={view} setView={setView} viewTabs={viewTabs} />
          <button
            onClick={handleRefresh}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-t3 hover:text-t2 hover:bg-surface2 transition-all"
            title="Refresh"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="border border-border rounded-xl bg-surface/50">
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
          <div className="p-4 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[11px] font-bold text-t2">Tidslinje</span>
              <span className="text-[10px] text-t3 font-mono">
                {timelineData?.total ?? 0} entries · side {timelinePage + 1}
              </span>
            </div>

            {timelineLoading ? (
              <div className="text-center py-8 text-[12px] text-t3">
                Indlæser...
              </div>
            ) : (
              <div className="divide-y divide-border">
                {(timelineData?.entries ?? []).map((entry, i) => (
                  <div key={entry.id || i} className="px-4 py-3 hover:bg-surface2">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-surface2 text-t3">
                        {entry.target === 'memory' ? 'MEM' : 'USER'}
                      </span>
                      <span className="text-[9px] font-mono text-t3">{entry.id}</span>
                    </div>
                    <pre className="text-[11px] text-t2 whitespace-pre-wrap leading-relaxed font-mono">
                      {entry.content}
                    </pre>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {view === 'graph' && (
          <div className="h-[520px] p-4">
            {graphLoading ? (
              <div className="h-full flex items-center justify-center text-t3 text-[12px] font-mono">
                GENERATING...
              </div>
            ) : graphNodes.length === 0 ? (
              <div className="h-full flex items-center justify-center text-t3 text-[12px]">
                Ingen graf data
              </div>
            ) : (
              <D3ForceGraph nodes={graphNodes} links={graphLinks} searchQuery={''} />
            )}
          </div>
        )}

        {view === 'files' && (
          <FileListTab files={files} activeTab={filesTab} setActiveTab={setFilesTab} />
        )}

        {view === 'activity' && (
          <div className="p-4 space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-t2">Aktivitet</span>
            </div>
            {actLoading ? (
              <div className="text-center py-4 text-[12px] text-t3">Indlæser...</div>
            ) : (
              <ActivityPanel data={actData} />
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── D3 Force Graph ─────────────────────────────────────────────────────────

function D3ForceGraph({ nodes, links, searchQuery, onNodeClick }) {
  return (
    <div className="relative w-full h-full">
      {/* Placeholder for D3ForceGraph - integrate when needed */}
      <div className="h-full flex items-center justify-center text-t3 text-[12px]">
        D3 Graph view
      </div>
    </div>
  )
}
