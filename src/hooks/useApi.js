import { useState, useEffect, useCallback } from 'react'

export function useApi(path, deps = []) {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  const fetch_ = useCallback(async ({ background = false } = {}) => {
    if (!path) {
      setLoading(false)
      return
    }
    if (!background) setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api${path}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setData(await res.json())
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [path])

  useEffect(() => { fetch_() }, [fetch_, ...deps])

  return { data, loading, error, refetch: fetch_ }
}

export function usePoll(path, intervalMs = 5000) {
  const result = useApi(path)
  useEffect(() => {
    const id = setInterval(() => result.refetch({ background: true }), intervalMs)
    return () => clearInterval(id)
  }, [result.refetch, intervalMs])
  return result
}
