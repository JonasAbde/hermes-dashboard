import { useState, useCallback } from 'react'
import { apiFetch } from '../utils/auth'

/**
 * Generic hook for optimistic switch operations (Model, Personality, etc.)
 * @param {string} apiEndpoint - API endpoint path
 * @param {string} method - HTTP method ('POST', 'PUT', etc.)
 * @param {string} payloadKey - Key for the payload object (e.g., 'model', 'personality')
 * @param {Function} refetch - Function to refetch data after successful switch
 * @param {Object} options - Additional options
 * @param {string} options.successMessage - Custom success message template
 * @param {Function} options.onSuccess - Callback on success
 * @param {Function} options.onError - Callback on error
 */
export function useOptimisticSwitch(
  apiEndpoint,
  method,
  payloadKey,
  refetch,
  options = {}
) {
  const { successMessage, onSuccess, onError } = options
  const [switching, setSwitching] = useState(false)
  const [result, setResult] = useState(null)
  const [optimistic, setOptimistic] = useState(null)

  const handleSwitch = useCallback(
    async (value) => {
      if (switching) return

      setSwitching(true)
      setResult(null)
      setOptimistic(value)

      try {
        const res = await apiFetch(apiEndpoint, {
          method,
          body: JSON.stringify({ [payloadKey]: value }),
        })
        const body = await res.json().catch(() => ({}))

        if (res.ok) {
          const message = successMessage
            ? successMessage.replace('{value}', value)
            : `Switched to ${value}`
          setResult({ ok: true, message })
          await refetch()
          setOptimistic(null)
          onSuccess?.(value, body)
        } else {
          setResult({
            ok: false,
            message: body.error ?? `HTTP ${res.status}`,
          })
          setOptimistic(null)
          onError?.(new Error(body.error ?? `HTTP ${res.status}`), value)
        }
      } catch (e) {
        setResult({ ok: false, message: e.message })
        setOptimistic(null)
        onError?.(e, value)
      } finally {
        setSwitching(false)
      }
    },
    [apiEndpoint, method, payloadKey, refetch, switching, successMessage, onSuccess, onError]
  )

  const clearResult = useCallback(() => setResult(null), [])

  return { switching, result, optimistic, handleSwitch, clearResult }
}
