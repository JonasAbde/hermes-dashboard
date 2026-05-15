// src/hooks/useFleetData.js
// Hook for agent fleet polling and agent actions (start/stop).
// Uses real backend data only — no mock, no random, no fake fallbacks.

import { useState, useCallback, useRef, useEffect } from 'react'
import { apiFetch } from '../utils/auth'

/**
 * @param {boolean} enabled — only poll when tab is active
 * @param {number} intervalMs — poll interval (default 12s)
 */
export function useFleetData(enabled = true, intervalMs = 12000) {
  const [agents, setAgents] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)

  const [pendingActions, setPendingActions] = useState({}) // { [agentId]: 'start'|'stop' }
  const [actionMsg, setActionMsg] = useState(null)
  const msgTimerRef = useRef(null)
  const intervalRef = useRef(null)
  const abortRef = useRef(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      if (abortRef.current) abortRef.current.abort()
      if (intervalRef.current) clearInterval(intervalRef.current)
      if (msgTimerRef.current) clearTimeout(msgTimerRef.current)
    }
  }, [])

  const showActionMsg = useCallback((msg, ttlMs = 4000) => {
    if (msgTimerRef.current) clearTimeout(msgTimerRef.current)
    setActionMsg(msg)
    if (msg) {
      msgTimerRef.current = setTimeout(() => {
        if (mountedRef.current) setActionMsg(null)
      }, ttlMs)
    }
  }, [])

  // Fetch agents from real backend
  const fetchAgents = useCallback(async () => {
    if (abortRef.current) abortRef.current.abort()
    const controller = new AbortController()
    abortRef.current = controller

    try {
      setLoading(true)
      const res = await apiFetch('/api/agent/list', {
        timeout: 8000,
        signal: controller.signal,
      })
      if (!mountedRef.current) return

      if (res.ok) {
        const data = await res.json().catch(() => ({ agents: [] }))
        const rawAgents = Array.isArray(data?.agents) ? data.agents : []
        setAgents(rawAgents.map(normalizeAgent))
        setError(null)
        setLastUpdated(new Date())
      } else {
        setError(`API returned ${res.status}`)
      }
    } catch (e) {
      if (mountedRef.current && e.name !== 'AbortError') {
        setError(e.message || 'Fetch failed')
      }
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [])

  // Poll only when enabled
  useEffect(() => {
    if (!enabled) {
      if (intervalRef.current) clearInterval(intervalRef.current)
      return
    }
    fetchAgents() // initial fetch
    intervalRef.current = setInterval(fetchAgents, intervalMs)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [enabled, intervalMs, fetchAgents])

  // Agent start action
  const handleStartAgent = useCallback(async (agentId) => {
    if (!agentId || pendingActions[agentId]) return
    setPendingActions(prev => ({ ...prev, [agentId]: 'start' }))
    setActionMsg(null)

    try {
      const res = await apiFetch('/api/agent/start', {
        method: 'POST',
        body: JSON.stringify({ agent_id: agentId }),
      })
      const body = await res.json().catch(() => ({}))

      if (!mountedRef.current) return

      if (res.ok && body?.ok !== false) {
        showActionMsg({ type: 'ok', text: `Agent ${agentId} started` })
        // Optimistic update
        setAgents(prev => prev.map(a =>
          a.id === agentId ? { ...a, status: 'active' } : a
        ))
      } else {
        showActionMsg({ type: 'err', text: body?.error || `Failed to start ${agentId}` })
      }
    } catch {
      if (mountedRef.current) {
        showActionMsg({ type: 'err', text: `Failed to start ${agentId}` })
      }
    } finally {
      if (mountedRef.current) {
        setPendingActions(prev => {
          const next = { ...prev }
          delete next[agentId]
          return next
        })
      }
    }
  }, [pendingActions, showActionMsg])

  // Agent stop action
  const handleStopAgent = useCallback(async (agentId) => {
    if (!agentId || pendingActions[agentId]) return
    setPendingActions(prev => ({ ...prev, [agentId]: 'stop' }))
    setActionMsg(null)

    try {
      const res = await apiFetch('/api/agent/stop', {
        method: 'POST',
        body: JSON.stringify({ agent_id: agentId }),
      })
      const body = await res.json().catch(() => ({}))

      if (!mountedRef.current) return

      if (res.ok && body?.ok !== false) {
        showActionMsg({ type: 'ok', text: `Agent ${agentId} stopped` })
        setAgents(prev => prev.map(a =>
          a.id === agentId ? { ...a, status: 'idle' } : a
        ))
      } else {
        showActionMsg({ type: 'err', text: body?.error || `Failed to stop ${agentId}` })
      }
    } catch {
      if (mountedRef.current) {
        showActionMsg({ type: 'err', text: `Failed to stop ${agentId}` })
      }
    } finally {
      if (mountedRef.current) {
        setPendingActions(prev => {
          const next = { ...prev }
          delete next[agentId]
          return next
        })
      }
    }
  }, [pendingActions, showActionMsg])

  return {
    agents,
    loading,
    error,
    lastUpdated,
    refetch: fetchAgents,
    pendingActions,
    actionMsg,
    handleStartAgent,
    handleStopAgent,
  }
}

// ── Normalization ────────────────────────────────────────────────────────────
// Backend shape (from gateway_state.json):
//   { id, name, role, status, rhythm, metrics: { tps, latency } }
//
// We only render what the backend actually gives us.
// Missing fields → null (displayed as "Not reported" in UI).

function normalizeAgent(raw) {
  if (!raw || typeof raw !== 'object') return null

  return {
    id: raw.id || raw.name || 'unknown',
    name: raw.name || raw.id || 'Unknown Agent',
    role: raw.role || null,
    status: normalizeStatus(raw.status),
    rhythm: raw.rhythm || null,
    metrics: normalizeMetrics(raw.metrics),
  }
}

function normalizeStatus(status) {
  if (status === 'active' || status === 'running') return 'active'
  if (status === 'idle' || status === 'stopped' || status === 'hibernation') return 'idle'
  return 'unknown'
}

function normalizeMetrics(metrics) {
  if (!metrics || typeof metrics !== 'object') return null
  return {
    tps: metrics.tps ?? null,
    latency: metrics.latency ?? null,
  }
}
