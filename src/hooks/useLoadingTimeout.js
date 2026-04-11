import { useState, useEffect } from 'react'

/**
 * Hook to detect when loading takes too long
 * @param {boolean} loading - Current loading state
 * @param {number} timeoutMs - Timeout in milliseconds (default: 8000)
 * @returns {boolean} True if loading has timed out
 */
export function useLoadingTimeout(loading, timeoutMs = 8000) {
  const [loadingTimedOut, setLoadingTimedOut] = useState(false)

  useEffect(() => {
    if (!loading) {
      setLoadingTimedOut(false)
      return
    }

    const id = setTimeout(() => setLoadingTimedOut(true), timeoutMs)
    return () => clearTimeout(id)
  }, [loading, timeoutMs])

  const resetTimeout = () => setLoadingTimedOut(false)

  return { loadingTimedOut, resetTimeout }
}
