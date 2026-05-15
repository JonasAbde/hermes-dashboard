/// <reference types="vite/client" />
import { useState, useEffect, useCallback, useRef } from 'react'
import { apiFetch } from '../utils/auth.ts'

interface PollingConfig<T = unknown> {
  /** Endpoint path to poll */
  path: string
  /** Minimum interval between requests in ms */
  minInterval?: number
  /** Maximum interval in case of errors (exponential backoff) */
  maxInterval?: number
  /** Maximum number of attempts */
  maxAttempts?: number
  /** Whether to pause when tab is hidden */
  pauseOnHide?: boolean
}

interface PollingResult<T = unknown> {
  data: T | null
  loading: boolean
  error: string | null
  lastUpdated: number | null
  refetch: () => Promise<void>
  forceRefetch: () => Promise<void>
  pause: () => void
  resume: () => void
}

const DEFAULT_CONFIG = {
  minInterval: 10000,
  maxInterval: 60000,
  maxAttempts: 3,
  pauseOnHide: true,
} as const

export function useUnifiedPolling<T = unknown>(
  config: PollingConfig<T>
): PollingResult<T> {
  const {
    path,
    minInterval = DEFAULT_CONFIG.minInterval,
    maxInterval = DEFAULT_CONFIG.maxInterval,
    maxAttempts = DEFAULT_CONFIG.maxAttempts,
    pauseOnHide = DEFAULT_CONFIG.pauseOnHide,
  } = config

  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<number | null>(null)

  const isMountedRef = useRef(true)
  const isPausedRef = useRef(false)
  const isActiveRef = useRef(true)
  const requestSeq = useRef(0)
  const attemptCount = useRef(0)
  const timerRef = useRef<number | undefined>(undefined)

  // Construct full API path
  const apiUrl = path.startsWith('/api') ? path : `/api${path.startsWith('/') ? path : '/' + path}`

  // Fetch with retry
  async function fetchWithRetry(signal?: AbortSignal): Promise<T> {
    let lastError: Error | null = null
    let currentAttempts = 0

    for (currentAttempts = 0; currentAttempts < maxAttempts; currentAttempts++) {
      try {
        const res = await apiFetch(apiUrl, { timeout: 10000, signal })
        if (!res.ok) {
          const err = new Error(`HTTP ${res.status}`) as Error & { status: number }
          err.status = res.status
          throw err
        }
        return await res.json()
      } catch (err) {
        lastError = err as Error
        const status = (err as Error & { status?: number }).status

        // Don't retry on client errors
        if (status && status >= 400 && status < 500) {
          throw err
        }

        // Don't retry if signal is aborted or seq changed
        if (signal?.aborted || requestSeq.current !== attemptCount.current) {
          throw err
        }

        // Exponential backoff
        if (currentAttempts < maxAttempts - 1) {
          const delay = Math.min(minInterval * Math.pow(2, currentAttempts), maxInterval)
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }
    }

    throw lastError || new Error('Fetch failed after maximum attempts')
  }

  // Core fetch function
  async function doFetch(force = false) {
    if (!isMountedRef.current) return
    if (isPausedRef.current && !force) return
    if (!isActiveRef.current) return

    const requestId = ++requestSeq.current
    const currentAttempt = attemptCount.current

    setLoading(true)
    setError(null)

    try {
      const controller = new AbortController()
      const signal = controller.signal

      const result = await fetchWithRetry(signal)

      if (isMountedRef.current && requestSeq.current === requestId) {
        setData(result)
        setLastUpdated(Date.now())
        attemptCount.current = 0
      }
    } catch (err) {
      if (isMountedRef.current && requestSeq.current === requestId) {
        if (err instanceof Error && err.name !== 'AbortError') {
          setError(err.message)
        }
        attemptCount.current++
      }
    } finally {
      if (isMountedRef.current && requestSeq.current === requestId) {
        setLoading(false)
      }
    }
  }

  // Refetch
  const refetch = useCallback(() => doFetch(true), [doFetch])
  const forceRefetch = useCallback(() => doFetch(true), [doFetch])

  // Pause/Resume
  const pause = useCallback(() => {
    isPausedRef.current = true
  }, [])

  const resume = useCallback(() => {
    isPausedRef.current = false
    if (!loading && !error) {
      doFetch()
    }
  }, [loading, error, doFetch])

  // Visibility change handler
  useEffect(() => {
    if (!pauseOnHide) return

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !isPausedRef.current && !loading && !error) {
        doFetch()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [pauseOnHide, loading, error, doFetch])

  // Polling interval
  useEffect(() => {
    if (!path || minInterval <= 0) return

    let intervalId: number | undefined

    const poll = () => {
      if (isActiveRef.current && !isPausedRef.current && !loading && !error) {
        doFetch()
      }
    }

    intervalId = window.setInterval(poll, minInterval)
    return () => {
      if (intervalId !== undefined) {
        clearInterval(intervalId)
      }
    }
  }, [path, minInterval, loading, error, doFetch])

  // Mount/unmount handlers
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      isPausedRef.current = true
    }
  }, [])

  // Initial fetch
  useEffect(() => {
    doFetch()
  }, [path, doFetch])

  return {
    data,
    loading,
    error,
    lastUpdated,
    refetch,
    forceRefetch,
    pause,
    resume,
  }
}
