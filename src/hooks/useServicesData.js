// src/hooks/useServicesData.js
// Hook for services polling and service actions (start/restart/stop).
// Uses real backend data only — no mock, no random, no fake fallbacks.

import { useState, useCallback, useRef, useEffect } from 'react'
import { usePoll } from './useApi.ts'
import { apiFetch } from '../utils/auth'

/**
 * @param {boolean} enabled — only poll when tab is active
 * @param {number} intervalMs — poll interval (default 5s)
 */
export function useServicesData(enabled = true, intervalMs = 5000) {
  const { data, loading, error, refetch, lastUpdated } = usePoll(
    enabled ? '/control/services' : null,
    intervalMs,
  )

  const [busyAction, setBusyAction] = useState(null) // e.g. "hermes-gateway:restart"
  const [actionMsg, setActionMsg] = useState(null)    // { type: 'ok'|'err', text }
  const msgTimerRef = useRef(null)

  // Clear action message after timeout
  const showActionMsg = useCallback((msg, ttlMs = 5000) => {
    if (msgTimerRef.current) clearTimeout(msgTimerRef.current)
    setActionMsg(msg)
    if (msg) {
      msgTimerRef.current = setTimeout(() => setActionMsg(null), ttlMs)
    }
  }, [])

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (msgTimerRef.current) clearTimeout(msgTimerRef.current)
    }
  }, [])

  // Execute a service action (start/restart/stop)
  const onAction = useCallback(async (serviceName, action) => {
    if (busyAction) return // prevent concurrent actions
    const key = `${serviceName}:${action}`
    setBusyAction(key)
    setActionMsg(null)

    try {
      const res = await apiFetch(`/api/control/services/${serviceName}/${action}`, {
        method: 'POST',
      })
      const body = await res.json().catch(() => ({}))
      const applied = body?.applied !== false

      if (res.ok && body?.ok !== false && applied) {
        const detail = body?.gateway_state ? ` (${body.gateway_state})` : ''
        showActionMsg({ type: 'ok', text: `${serviceName} ${action} applied${detail}` })
      } else {
        showActionMsg({ type: 'err', text: body?.error || `${serviceName} ${action} not applied` })
      }
      // Refetch to get updated state
      refetch({ background: true })
    } catch {
      showActionMsg({ type: 'err', text: `${serviceName} ${action} failed` })
    } finally {
      setBusyAction(null)
    }
  }, [busyAction, refetch, showActionMsg])

  // Normalize services from backend payload
  const services = normalizeServicesPayload(data)

  return {
    services,
    loading,
    error,
    lastUpdated,
    refetch,
    busyAction,
    actionMsg,
    onAction,
  }
}

// ── Normalization ────────────────────────────────────────────────────────────

function normalizeServicesPayload(raw) {
  if (!raw || !Array.isArray(raw.services)) return []
  return raw.services.map(normalizeService)
}

function normalizeService(s) {
  return {
    key: s.key || 'unknown',
    label: s.label || s.key || 'Unknown Service',
    unit: s.unit || null,
    active: Boolean(s.active),
    state: s.state || null,
    substate: s.substate || null,
    pid: s.pid ?? null,
    uptime_s: s.uptime_s ?? null,
    cmdline: s.cmdline || null,
    observed_at: s.observed_at || null,
  }
}
