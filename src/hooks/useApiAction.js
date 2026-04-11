import { useState, useCallback } from 'react'
import { apiFetch } from '../utils/auth'

/**
 * Generic hook for API actions with busy state and message handling
 * @param {Object} options - Configuration options
 * @param {Function} options.onSuccess - Callback on success (receives data, action)
 * @param {Function} options.onError - Callback on error (receives error, action)
 * @param {Function} options.refetch - Function to call after successful action
 * @param {number} options.messageDuration - How long to show message (default: 4000ms)
 * @param {string} options.successTemplate - Template for success message
 * @param {string} options.errorTemplate - Template for error message
 */
export function useApiAction(options = {}) {
  const {
    onSuccess,
    onError,
    refetch,
    messageDuration = 4000,
    successTemplate = '{id}: {action} applied',
    errorTemplate = '{id}: {action} failed',
  } = options

  const [busyAction, setBusyAction] = useState(null)
  const [message, setMessage] = useState(null)

  const clearMessage = useCallback(() => setMessage(null), [])

  const execute = useCallback(
    async (actionId, action, apiEndpoint, method = 'POST', body = null) => {
      const actionKey = `${actionId}:${action}`
      setBusyAction(actionKey)
      setMessage(null)

      try {
        const res = await apiFetch(apiEndpoint, {
          method,
          body: body ? JSON.stringify(body) : undefined,
        })
        const responseBody = await res.json().catch(() => ({}))

        const applied = responseBody?.applied !== false
        const success = res.ok && responseBody?.ok !== false && applied

        if (success) {
          const detail = responseBody?.gateway_state
            ? ` (${responseBody.gateway_state})`
            : ''
          setMessage({
            type: 'ok',
            text:
              responseBody.message ||
              successTemplate
                .replace('{id}', actionId)
                .replace('{action}', action) + detail,
          })
          onSuccess?.(responseBody, { id: actionId, action })
        } else {
          setMessage({
            type: 'err',
            text:
              responseBody.error ||
              errorTemplate.replace('{id}', actionId).replace('{action}', action),
          })
          onError?.(new Error(responseBody.error || 'Action failed'), {
            id: actionId,
            action,
          })
        }

        if (refetch) await refetch({ background: true })
      } catch (e) {
        setMessage({
          type: 'err',
          text: errorTemplate
            .replace('{id}', actionId)
            .replace('{action}', action),
        })
        onError?.(e, { id: actionId, action })
      } finally {
        setBusyAction(null)
        if (messageDuration > 0) {
          setTimeout(() => setMessage(null), messageDuration)
        }
      }
    },
    [onSuccess, onError, refetch, messageDuration, successTemplate, errorTemplate]
  )

  const isBusy = useCallback(
    (id, action) => {
      if (!busyAction) return false
      if (action) return busyAction === `${id}:${action}`
      return busyAction.startsWith(`${id}:`)
    },
    [busyAction]
  )

  return { busyAction, message, execute, isBusy, clearMessage }
}
