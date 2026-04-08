import React from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error?.message || error, error?.stack, info.componentStack)
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null })
  }

  handleDismiss = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      const { fallback } = this.props
      if (fallback) return fallback(this.state.error, this.handleReload)

      return (
        <div
          className="flex flex-col items-center justify-center min-h-[200px] p-6 rounded-lg border"
          style={{
            background: '#0d0f17',
            borderColor: '#4a2010',
          }}
        >
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
            style={{
              background: 'rgba(224,95,64,0.12)',
              border: '1px solid rgba(224,95,64,0.25)',
            }}
          >
            <AlertTriangle size={24} style={{ color: '#e05f40' }} />
          </div>
          <h3
            className="text-sm font-bold mb-1"
            style={{ color: '#d8d8e0' }}
          >
            Component crashed
          </h3>
          <p
            className="text-xs text-center mb-4 max-w-sm"
            style={{ color: '#6b6b80' }}
          >
            {this.state.error?.message
              ? this.state.error.message.slice(0, 120)
              : 'An unexpected error occurred. The rest of the dashboard is unaffected.'}
          </p>
          <div className="flex gap-2">
            <button
              onClick={this.handleDismiss}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{
                background: 'transparent',
                border: '1px solid #1a1b24',
                color: '#6b6b80',
              }}
            >
              Dismiss
            </button>
            <button
              onClick={this.handleReload}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
              style={{
                background: '#e05f40',
                color: '#fff',
              }}
            >
              <RefreshCw size={11} />
              Retry
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
