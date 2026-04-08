import { createContext, createElement, useContext, useState, useCallback, useRef, useEffect } from 'react'

const ToastContext = createContext(null)

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null)
  const timerRef = useRef(null)
  const isMountedRef = useRef(true)

  // Clean up active timers if provider unmounts while toast is showing
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const showToast = useCallback((message, type = 'ok', duration = 3500) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setToast({ message, type, id: Date.now() })
    timerRef.current = setTimeout(() => {
      if (isMountedRef.current) setToast(null)
    }, duration)
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
