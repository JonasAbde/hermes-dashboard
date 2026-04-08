/// <reference types="vite/client" />
import { useState, useEffect, useCallback } from 'react'
import { apiFetch } from '../utils/auth.ts'

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
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

async function fetchWithRetry(url: string, retries = 2, baseDelayMs = 500): Promise<Response> {
  let lastError: Error | null = null
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const res = await apiFetch(url, { timeout: 10000 })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      if (attempt < retries) {
        const jitter = Math.round(baseDelayMs * 0.25 * Math.random())
        await wait(baseDelayMs * (attempt + 1) + jitter)
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

  const fetch_ = useCallback(async ({ background = false, signal }: FetchOptions = {}) => {
    if (!path) {
      setLoading(false)
      return
    }
    if (!background) setLoading(true)
    setError(null)
    try {
      const res = await fetchWithRetry(`/api${path}`)
      if (signal?.aborted) return
      setData(await res.json() as T)
      setLastUpdated(Date.now())
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return
      setError(e instanceof Error ? e.message : String(e))
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

export function usePoll<T = unknown>(path: string | null, intervalMs = 5000): UseApiResult<T> {
  const result = useApi<T>(path)
  useEffect(() => {
    const id = setInterval(() => result.refetch({ background: true }), intervalMs)
    return () => clearInterval(id)
  }, [result.refetch, intervalMs])
  return result
}
