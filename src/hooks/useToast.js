import { createContext, createElement, useContext, useState, useCallback, useRef } from 'react'

const ToastContext = createContext(null)

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null)
  const timerRef = useRef(null)

  const showToast = useCallback((message, type = 'ok', duration = 3500) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setToast({ message, type, id: Date.now() })
    timerRef.current = setTimeout(() => setToast(null), duration)
  }, [])

  const dismissToast = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setToast(null)
  }, [])

  // Convenience wrappers
  const toastOk = useCallback((msg) => showToast(msg, 'ok'), [showToast])
  const toastErr = useCallback((msg) => showToast(msg, 'error'), [showToast])
  const toastInfo = useCallback((msg) => showToast(msg, 'info'), [showToast])

  return createElement(
    ToastContext.Provider,
    { value: { toast, showToast, dismissToast, toastOk, toastErr, toastInfo } },
    children,
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>')
  return ctx
}
