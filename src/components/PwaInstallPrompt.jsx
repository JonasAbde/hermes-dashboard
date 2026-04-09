import { useState, useEffect } from 'react'
import { Download, X } from 'lucide-react'

export default function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [show, setShow] = useState(false)
  const [dismissed, setDismissed] = useState(() => {
    return localStorage.getItem('pwa_install_dismissed') === 'true'
  })

  useEffect(() => {
    if (dismissed) return

    const handler = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setShow(true)
    }

    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [dismissed])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      setShow(false)
      setDeferredPrompt(null)
    }
  }

  const handleDismiss = () => {
    setShow(false)
    setDismissed(true)
    localStorage.setItem('pwa_install_dismissed', 'true')
  }

  if (!show) return null

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        zIndex: 9999,
        background: '#0d0f17',
        border: '1px solid #00b478',
        borderRadius: 12,
        padding: '16px 20px',
        maxWidth: 320,
        boxShadow: '0 8px 32px rgba(0,180,120,0.15)',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <button
        onClick={handleDismiss}
        style={{
          position: 'absolute',
          top: 10,
          right: 10,
          background: 'none',
          border: 'none',
          color: '#666',
          cursor: 'pointer',
          padding: 4,
        }}
      >
        <X size={16} />
      </button>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 8,
            background: 'linear-gradient(135deg, #e05f40, #4a80c8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Download size={20} color="white" />
        </div>
        <div>
          <div style={{ color: '#e0e0e0', fontWeight: 600, fontSize: 14 }}>
            Install Hermes
          </div>
          <div style={{ color: '#888', fontSize: 12 }}>
            Add to home screen
          </div>
        </div>
      </div>
      <button
        onClick={handleInstall}
        style={{
          width: '100%',
          padding: '8px 16px',
          background: '#00b478',
          color: '#060608',
          border: 'none',
          borderRadius: 8,
          fontWeight: 600,
          fontSize: 13,
          cursor: 'pointer',
        }}
      >
        Install
      </button>
    </div>
  )
}
