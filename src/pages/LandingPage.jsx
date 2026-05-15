import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Brain, Activity, Network, Database, Zap, ArrowRight, GitBranch, BookOpen, CheckCircle } from 'lucide-react'

export function LandingPage() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const features = [
    {
      icon: Brain,
      title: 'Real-time Monitoring',
      description: 'Live telemetry on agent state, memory, and activity. Know what\'s happening 24/7.',
      stats: ['100% uptime', '24/7 operation']
    },
    {
      icon: Network,
      title: 'Autonomous Orchestration',
      description: 'Spawn independent agents, coordinate parallel workflows across different tasks.',
      stats: ['3x faster', '0 conflicts']
    },
    {
      icon: Database,
      title: 'Memory & Context',
      description: 'Centralized memory across sessions. Unified knowledge graph for intelligent operations.',
      stats: ['50+ entries', 'Real-time updates']
    },
    {
      icon: Activity,
      title: 'Session Management',
      description: 'Coordinate multiple Claude Code sessions. Prevent conflicts with intelligent session tracking.',
      stats: ['Unlimited', 'Auto-coordination']
    }
  ]

  const stats = [
    { value: '50+', label: 'Entries in MEMORY.md' },
    { value: '24/7', label: 'Continuous operation' },
    { value: '3x', label: 'Faster development' },
    { value: '0', label: 'Conflicts by default' }
  ]

  if (!mounted) {
    return null
  }

  return (
    <div className="min-h-screen bg-[#0a0b10] text-white">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-[#0a0b10]/80 backdrop-blur-md border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <Brain className="w-8 h-8 text-amber-500" />
            <span className="text-xl font-bold">Hermes</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link to="/docs" className="text-sm text-gray-400 hover:text-white transition-colors">
              Documentation
            </Link>
            <Link to="/overview" className="px-4 py-2 text-sm bg-amber-500 text-black font-semibold rounded-lg hover:bg-amber-400 transition-colors">
              Launch Dashboard
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-7xl mx-auto text-center">
          <div className="mb-6 inline-flex items-center gap-2 px-4 py-2 bg-amber-500/10 border border-amber-500/30 rounded-full">
            <Zap className="w-4 h-4 text-amber-500" />
            <span className="text-sm text-amber-500 font-medium">Your AI-Powered Operations Partner</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-white via-amber-500 to-white bg-clip-text text-transparent">
            Hermes Dashboard
          </h1>
          <p className="text-xl md:text-2xl text-gray-400 mb-8 max-w-3xl mx-auto">
            Real-time monitoring • Session management • Autonomous orchestration
          </p>
          <p className="text-lg text-gray-500 mb-12 max-w-2xl mx-auto italic">
            "Hermes is your personal operator. Not a tool. Not a service. A partner that thinks with you."
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link 
              to="/overview" 
              className="flex items-center gap-2 px-8 py-4 bg-amber-500 text-black font-semibold rounded-lg hover:bg-amber-400 transition-all hover:scale-105"
            >
              Start Dashboard
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link 
              to="/docs" 
              className="px-8 py-4 text-sm border border-white/20 rounded-lg hover:bg-white/5 transition-all"
            >
              Documentation
            </Link>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold mb-16 text-center">
            Everything you need to orchestrate AI operations
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <div
                key={index}
                className="p-6 bg-[#1a1c28] border border-white/10 rounded-xl hover:border-amber-500/50 transition-all hover:scale-105 hover:shadow-xl hover:shadow-amber-500/10"
              >
                <feature.icon className="w-12 h-12 text-amber-500 mb-4" />
                <h3 className="text-xl font-semibold mb-3">{feature.title}</h3>
                <p className="text-gray-400 mb-6">{feature.description}</p>
                <div className="flex flex-wrap gap-2">
                  {feature.stats.map((stat, i) => (
                    <span key={i} className="text-xs px-3 py-1 bg-white/5 rounded-full text-gray-300">
                      {stat}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20 px-6 bg-gradient-to-b from-[#1a1c28] to-transparent">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold mb-16 text-center">
            Metrics that matter
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="text-4xl md:text-5xl font-bold text-amber-500 mb-2">
                  {stat.value}
                </div>
                <div className="text-lg text-gray-400">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Architecture Diagram */}
      <section className="py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold mb-8 text-center">
            Architecture
          </h2>
          <div className="bg-[#1a1c28] border border-white/10 rounded-xl p-8 overflow-x-auto">
            <pre className="text-sm font-mono text-gray-300 whitespace-pre">
{`┌─────────────────────────────────────────────────────────────┐
│  Client (Browser)                                            │
│         ↓                                                   │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Vite Dev Server (5175)                               │  │
│  │  ├─ Frontend: React Components                        │  │
│  │  ├─ API Proxy: /api/* → 5174                          │  │
│  │  └─ Hot Reload                                        │  │
│  └──────────────────────────────────────────────────────┘  │
│         ↓                                                   │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Express API Server (5174)                            │  │
│  │  ├─ REST Endpoints (/api/dashboard, /api/memory)     │  │
│  │  ├─ CORS Handler                                      │  │
│  │  └─ Session Management                                │  │
│  └──────────────────────────────────────────────────────┘  │
│         ↓                                                   │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Python Memory Engine (entries, graph, search)       │  │
│  │  ├─ MEMORY.md / USER.md parsing                       │  │
│  │  ├─ Knowledge Graph (D3 force layout)                 │  │
│  │  ├─ Full-text search                                  │  │
│  │  └─ Activity timeline                                 │  │
│  └──────────────────────────────────────────────────────┘  │
│         ↓                                                   │
│  ┌─────────────────────┐  ┌─────────────────────┐          │
│  │  Claude Code        │  │  Hermes Agent       │          │
│  │  (Main execution)   │  │  (Orchestration)    │          │
│  └─────────────────────┘  └─────────────────────┘          │
└─────────────────────────────────────────────────────────────┘`}
            </pre>
          </div>
        </div>
      </section>

      {/* Use Cases */}
      <section className="py-20 px-6 bg-gradient-to-b from-[#1a1c28] to-transparent">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold mb-16 text-center">
            Use Cases
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 bg-[#1a1c28] border border-white/10 rounded-xl">
              <CheckCircle className="w-8 h-8 text-green-500 mb-4" />
              <h3 className="text-xl font-semibold mb-3">Development Workflows</h3>
              <p className="text-gray-400">
                "Define once, execute everywhere" - spawn multiple agents for parallel testing and validation
              </p>
            </div>
            <div className="p-6 bg-[#1a1c28] border border-white/10 rounded-xl">
              <CheckCircle className="w-8 h-8 text-green-500 mb-4" />
              <h3 className="text-xl font-semibold mb-3">System Monitoring</h3>
              <p className="text-gray-400">
                "Know what's happening in real-time" - track memory usage, session counts, API response times
              </p>
            </div>
            <div className="p-6 bg-[#1a1c28] border border-white/10 rounded-xl">
              <CheckCircle className="w-8 h-8 text-green-500 mb-4" />
              <h3 className="text-xl font-semibold mb-3">Team Operations</h3>
              <p className="text-gray-400">
                "One source of truth for AI operations" - shared dashboard, session coordination, audit trails
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            Ready to elevate your AI operations?
          </h2>
          <p className="text-xl text-gray-400 mb-12">
            Start using Hermes Dashboard today
          </p>
          <Link 
            to="/overview" 
            className="inline-flex items-center gap-2 px-10 py-4 bg-amber-500 text-black font-semibold rounded-lg hover:bg-amber-400 transition-all hover:scale-105"
          >
            Start Hermes Dashboard
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-white/10">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-amber-500" />
            <span className="font-semibold">Hermes</span>
          </div>
          <div className="flex items-center gap-6">
            <Link to="/docs" className="text-sm text-gray-400 hover:text-white transition-colors">
              Documentation
            </Link>
            <Link to="/github" className="text-sm text-gray-400 hover:text-white transition-colors">
              GitHub
            </Link>
            <Link to="/contact" className="text-sm text-gray-400 hover:text-white transition-colors">
              Contact
            </Link>
          </div>
          <div className="text-sm text-gray-500">
            © 2026 Hermes. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  )
}
