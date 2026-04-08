import { useState, useEffect, useRef } from 'react'
import { Shield, AlertCircle, Loader } from 'lucide-react'
import { setCsrfToken } from '../utils/auth'

export function LoginPage() {
  const TOKEN_KEY = import.meta.env.VITE_TOKEN_KEY || 'hermes_dashboard_token'
  const [token, setToken] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!token.trim()) return
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: token.trim() }),
      })
      const data = await res.json()

      if (data.ok) {
        if (data?.csrfToken) setCsrfToken(data.csrfToken)
        localStorage.setItem(TOKEN_KEY, token.trim())
        window.location.href = '/'
      } else {
        setError('Forkert token. Prøv igen.')
        setLoading(false)
      }
    } catch (e) {
      setError('Kunne ikke forbinde til serveren. Er API\'et online?')
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-border"
               style={{ background: 'linear-gradient(135deg, #1a1510 0%, #2a2015 100%)' }}>
            <Shield size={32} className="text-brand" />
          </div>
          <h1 className="text-2xl font-bold text-text">Hermes Dashboard</h1>
          <p className="mt-1 text-sm text-muted">Indtast din adgangstoken for at fortsætte</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="password"
              value={token}
              onChange={(e) => { setToken(e.target.value); setError('') }}
              placeholder="Adgangstoken"
              autoFocus
              disabled={loading}
              className="w-full rounded-lg border border-border bg-surface px-4 py-3 text-text
                         placeholder-muted transition-colors
                         focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/30
                         disabled:opacity-50"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-red-900/40 bg-red-950/30
                           px-3 py-2 text-sm text-red-400">
              <AlertCircle size={14} />
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !token.trim()}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 py-3
                       font-medium text-black transition-all hover:brightness-110
                       disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader size={16} className="animate-spin" />
                Verificerer...
              </>
            ) : (
              'Log ind'
            )}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-muted">
          Token er sat i <code className="rounded bg-surface px-1 py-0.5">~/.hermes/.env</code>
        </p>
      </div>
    </div>
  )
}
