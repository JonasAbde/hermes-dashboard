import { useState, useEffect, useCallback } from 'react'
import { apiFetch } from '../utils/auth'

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchWithRetry(url, retries = 2, baseDelayMs = 500) {
  let lastError = null
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const res = await apiFetch(url, { timeout: 10000 })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res
    } catch (error) {
      lastError = error
      if (attempt < retries) {
        const jitter = Math.round(baseDelayMs * 0.25 * Math.random())
        await wait(baseDelayMs * (attempt + 1) + jitter)
      }
    }
  }
  throw lastError || new Error('Request failed')
}

export function useApi(path, deps = []) {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)

  const fetch_ = useCallback(async ({ background = false, signal } = {}) => {
    if (!path) {
      setLoading(false)
      return
    }
    if (!background) setLoading(true)
    setError(null)
    try {
      const res = await fetchWithRetry(`/api${path}`)
      if (signal?.aborted) return
      setData(await res.json())
      setLastUpdated(Date.now())
    } catch (e) {
      if (e.name === 'AbortError') return
      setError(e.message)
    } finally {
      if (!background) setLoading(false)
    }
  }, [path])

  useEffect(() => {
    const controller = new AbortController()
    fetch_({ signal: controller.signal })
    return () => controller.abort()
  }, [fetch_, ...deps])

  return { data, loading, error, lastUpdated, refetch: fetch_ }
}

export function usePoll(path, intervalMs = 5000) {
  const result = useApi(path)
  useEffect(() => {
    const id = setInterval(() => result.refetch({ background: true }), intervalMs)
    return () => clearInterval(id)
  }, [result.refetch, intervalMs])
  return result
}
