/// <reference types="vite/client" />
import { useState, useEffect, useCallback, useRef } from 'react'
import { apiFetch } from '../utils/auth.ts'

function createAbortError(message = 'Aborted'): DOMException | Error {
  try {
    return new DOMException(message, 'AbortError')
  } catch {
    const error = new Error(message)
    error.name = 'AbortError'
    return error
  }
}

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timer)
      signal?.removeEventListener('abort', onAbort)
      reject(createAbortError())
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    if (signal?.aborted) {
      clearTimeout(timer)
      reject(createAbortError())
      return
    }
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500
}

interface HttpError extends Error {
  status?: number
}

interface FetchOptions {
  background?: boolean
  signal?: AbortSignal
}

interface UseApiResult<T = unknown> {
  data: T | null
  loading: boolean
  error: string | null
  lastUpdated: number | null
  refetch: (opts?: FetchOptions) => Promise<void>
}

interface RetryOptions {
  signal?: AbortSignal
  retries?: number
  baseDelayMs?: number
}

async function fetchWithRetry(url: string, { signal, retries = 2, baseDelayMs = 500 }: RetryOptions = {}): Promise<Response> {
  let lastError: HttpError | null = null
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const res = await apiFetch(url, { timeout: 10000, signal })
      if (!res.ok) {
        const error = new Error(`HTTP ${res.status}`) as HttpError
        error.status = res.status
        throw error
      }
      return res
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') throw error
      lastError = error instanceof Error ? (error as HttpError) : new Error(String(error))
      const status = typeof lastError.status === 'number' ? lastError.status : null
      const retryable = status == null || isRetryableStatus(status)
      if (!retryable) throw lastError
      if (attempt < retries) {
        if (signal?.aborted) throw createAbortError()
        const jitter = Math.round(baseDelayMs * 0.25 * Math.random())
        await wait(baseDelayMs * (attempt + 1) + jitter, signal)
      }
    }
  }
  throw lastError || new Error('Request failed')
}

export function useApi<T = unknown>(path: string | null, deps: unknown[] = []): UseApiResult<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<number | null>(null)
  const requestSeq = useRef(0)
  const activeRequests = useRef(0)

  const fetch_ = useCallback(async ({ background = false, signal }: FetchOptions = {}) => {
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
      setData(await res.json() as T)
      setLastUpdated(Date.now())
      setError(null)
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return
      if (requestId !== requestSeq.current) return
      setError(e instanceof Error ? e.message : String(e))
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

export function usePoll<T = unknown>(path: string | null, intervalMs = 5000): UseApiResult<T> {
  const result = useApi<T>(path)
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
