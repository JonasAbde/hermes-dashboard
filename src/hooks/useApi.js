import { useState, useEffect, useCallback, useRef } from 'react'
import { apiFetch } from '../utils/auth'

function createAbortError(message = 'Aborted') {
  try {
    return new DOMException(message, 'AbortError')
  } catch {
    const error = new Error(message)
    error.name = 'AbortError'
    return error
  }
}

function wait(ms, signal) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener?.('abort', onAbort)
      resolve()
    }, ms)
    const onAbort = () => {
      clearTimeout(timer)
      signal?.removeEventListener?.('abort', onAbort)
      reject(createAbortError())
    }
    if (signal?.aborted) {
      clearTimeout(timer)
      reject(createAbortError())
      return
    }
    signal?.addEventListener?.('abort', onAbort, { once: true })
  })
}

function isRetryableStatus(status) {
  return status === 408 || status === 429 || status >= 500
}

async function fetchWithRetry(url, { signal, retries = 2, baseDelayMs = 500 } = {}) {
  let lastError = null
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const res = await apiFetch(url, { timeout: 10000, signal })
      if (!res.ok) {
        const error = new Error(`HTTP ${res.status}`)
        error.status = res.status
        throw error
      }
      return res
    } catch (error) {
      if (error?.name === 'AbortError') throw error
      lastError = error
      const status = typeof error?.status === 'number' ? error.status : null
      const retryable = status == null || isRetryableStatus(status)
      if (!retryable) throw error
      if (attempt < retries) {
        if (signal?.aborted) throw createAbortError()
        const jitter = Math.round(baseDelayMs * 0.25 * Math.random())
        await wait(baseDelayMs * (attempt + 1) + jitter, signal)
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
  const requestSeq = useRef(0)
  const activeRequests = useRef(0)

  const fetch_ = useCallback(async ({ background = false, signal } = {}) => {
    const requestId = ++requestSeq.current
    if (!path) {
      setLoading(false)
      return
    }
    if (background && activeRequests.current > 0) return
    activeRequests.current += 1
    if (!background) setLoading(true)
    if (!background) setError(null)
    try {
      const res = await fetchWithRetry(`/api${path}`, { signal })
      if (signal?.aborted || requestId !== requestSeq.current) return
      setData(await res.json())
      setLastUpdated(Date.now())
      setError(null)
    } catch (e) {
      if (e.name === 'AbortError') return
      if (requestId !== requestSeq.current) return
      setError(e.message)
    } finally {
      activeRequests.current = Math.max(0, activeRequests.current - 1)
      if (!background && requestId === requestSeq.current) setLoading(false)
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
  const { refetch } = result

  useEffect(() => {
    if (!path || intervalMs <= 0) return
    const refresh = () => refetch({ background: true })
    const id = setInterval(refresh, intervalMs)
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    const onFocus = () => refresh()
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('focus', onFocus)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('focus', onFocus)
    }
  }, [path, refetch, intervalMs])

  return result
}
