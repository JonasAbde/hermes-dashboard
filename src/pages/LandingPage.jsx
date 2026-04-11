import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Zap,
  Shield,
  Globe,
  Cpu,
  Clock,
  Activity,
  ChevronRight,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Star,
  Users,
  Rocket,
  BarChart3,
  Code2,
  Settings,
  Menu,
  X,
  MessageSquare,
  Sparkles,
  Play
} from 'lucide-react'

// Animations
const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, ease: 'easeOut' }
}

const staggerContainer = {
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2
    }
  }
}

const slideInLeft = {
  initial: { opacity: 0, x: -50 },
  animate: { opacity: 1, x: 0 },
  transition: { duration: 0.6 }
}

const slideInRight = {
  initial: { opacity: 0, x: 50 },
  animate: { opacity: 1, x: 0 },
  transition: { duration: 0.6 }
}

// Hero Sub-components
const HeroLogo = () => (
  <motion.div 
    initial={{ scale: 0.8, opacity: 0 }}
    animate={{ scale: 1, opacity: 1 }}
    transition={{ duration: 0.5 }}
    className="flex items-center justify-center"
  >
    <div className="relative">
      <div className="absolute inset-0 bg-gradient-to-r from-[#e05f40]/20 to-[#4a80c8]/20 blur-2xl rounded-2xl" />
      <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl border border-border bg-gradient-to-br from-[#0a0b10] to-[#0d0f17] shadow-2xl">
        <Zap size={40} className="text-[#e05f40]" />
      </div>
    </div>
  </motion.div>
)

const HeroTitle = () => (
  <motion.div {...fadeInUp}>
    <h1 className="text-5xl font-bold text-t1 sm:text-6xl lg:text-7xl">
      <span className="bg-gradient-to-r from-t1 via-[#d8d8e0] to-t1 bg-clip-text text-transparent">
        AI Agent
      </span>
      <span className="text-[#e05f40]">
        Control
      </span>
    </h1>
  </motion.div>
)

const HeroSubtitle = () => (
  <motion.p {...fadeInUp} transition={{ delay: 0.2 }}>
    <p className="text-xl text-t2 sm:text-2xl mt-6 max-w-2xl">
      Overvåg, styr og optimer dine kunstige intelligens-agenter i realtid.
      Denne dashboard-platform giver dig fuld synlighed og kontrol over AI-operationer.
    </p>
  </motion.div>
)

const HeroCTA = () => (
  <motion.div {...fadeInUp} transition={{ delay: 0.3 }} className="flex flex-wrap gap-4 mt-8">
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className="flex items-center gap-2 bg-[#e05f40] hover:bg-[#d14f30] text-white px-8 py-4 rounded-xl font-semibold transition-all"
      onClick={() => window.location.href = '/login'}
    >
      <Zap size={20} />
      Opret konto nu
      <ArrowRight size={20} />
    </motion.button>
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className="flex items-center gap-2 bg-[#111318] hover:bg-[#1a1c26] border border-border text-t1 px-8 py-4 rounded-xl font-semibold transition-all"
      onClick={() => window.location.href = '/docs'}
    >
      <BookOpen className="w-5 h-5" />
      Se dokumentation
    </motion.button>
  </motion.div>
)

// Feature Card Component
const FeatureCard = ({ icon, title, description, index }) => (
  <motion.div
    variants={fadeInUp}
    initial="initial"
    animate="animate"
    whileHover={{ y: -5, transition: { duration: 0.3 } }}
    className="group relative p-6 rounded-2xl bg-[#0d0f17] border border-border hover:border-[#e05f40]/30 transition-all duration-300"
  >
    <div className="absolute inset-0 bg-gradient-to-br from-[#e05f40]/5 to-transparent opacity-0 group-hover:opacity-100 rounded-2xl transition-opacity" />
    <div className="relative">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#111318] border border-border group-hover:border-[#e05f40]/30 transition-colors">
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-t1 mt-4">{title}</h3>
      <p className="text-sm text-t2 mt-2 leading-relaxed">{description}</p>
    </div>
  </motion.div>
)

const FeaturesGrid = () => (
  <motion.div {...staggerContainer}>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-16">
      <FeatureCard 
        icon={<Activity size={24} className="text-[#4a80c8]" />}
        title="Realtids overvågning"
        description="Fuld synlighed over dine AI-agters status, aktivitet og performance."
        index={0}
      />
      <FeatureCard 
        icon={<Zap size={24} className="text-[#e05f40]" />}
        title="Øjeblikkelig handling"
        description="Reager straks på ændringer med integrerede værktøjer og automatisering."
        index={1}
      />
      <FeatureCard 
        icon={<Shield size={24} className="text-[#00b478]" />}
        title="Fuldsikkerhed"
        description="Token-baseret authentication og sikkerhed for alle operations."
        index={2}
      />
      <FeatureCard 
        icon={<Users size={24} className="text-[#e09040]" />}
        title="Team collaboration"
        description="Arbejd sammen i realtid med kommunikations- og approvals-systemer."
        index={3}
      />
      <FeatureCard 
        icon={<BarChart3 size={24} className="text-[#e05f40]" />}
        title="Databaserede analyser"
        description="Dyp indsigt i token-costs, memory-usage og system metrics."
        index={4}
      />
      <FeatureCard 
        icon={<Globe size={24} className="text-[#4a80c8]" />}
        title="Global platform"
        description="Din dashboard er tilgængelig worldwide med lav latency."
        index={5}
      />
    </div>
  </motion.div>
)

// Stats Component
const StatsSection = () => {
  const stats = [
    { value: '10K+', label: 'Aktive brugere' },
    { value: '99.9%', label: 'Op tid' },
    { value: '50ms', label: 'Middel latency' },
    { value: '24/7', label: 'Support' }
  ]

  return (
    <div className="mt-24 p-8 rounded-2xl bg-gradient-to-r from-[#e05f40]/10 via-[#4a80c8]/10 to-[#00b478]/10 border border-border">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
        {stats.map((stat, index) => (
          <motion.div
            key={stat.value}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="text-center"
          >
            <div className="text-3xl font-bold text-[#e05f40]">{stat.value}</div>
            <div className="text-sm text-t2 mt-1">{stat.label}</div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

// Testimonial Component
const Testimonial = ({ quote, author, role, avatar }) => (
  <motion.div
    whileHover={{ scale: 1.02 }}
    className="p-6 rounded-2xl bg-[#0d0f17] border border-border"
  >
    <Star size={16} className="text-[#e09040] fill-[#e09040]/20 mb-4" />
    <p className="text-t2 mb-6 leading-relaxed">"{quote}"</p>
    <div className="flex items-center gap-3">
      {avatar && (
        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-[#e05f40] to-[#4a80c8] flex items-center justify-center text-white font-semibold">
          {avatar}
        </div>
      )}
      <div>
        <div className="font-semibold text-t1">{author}</div>
        <div className="text-sm text-t2">{role}</div>
      </div>
    </div>
  </motion.div>
)

const TestimonialsSection = () => (
  <div className="mt-24">
    <h2 className="text-3xl font-bold text-t1 text-center">Hvad siger brugerne</h2>
    <motion.div {...staggerContainer} className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
      <Testimonial 
        quote="Platformen har revolutioneret hvordan vi styrer vores AI-agters. Realtids overvågning og automatiserede workflows sparer os timer hver uge."
        author="Lars M."
        role="CTO @ TechCorp"
        avatar="LM"
      />
      <Testimonial 
        quote="Denne dashboard løste vores største udfordring med at overvåge distribuerede AI-systemer. Klar, intuitiv og kraftfuld."
        author="Anna K."
        role="Lead Engineer @ StartupX"
        avatar="AK"
      />
      <Testimonial 
        quote="Sikkerheden og token-systemet er utrolig effektivt. Vi føler tryghed ved at know at vores AI-operationer er godt beskyttet."
        author="Mikkel S."
        role="DevOps @ DataSystems"
        avatar="MS"
      />
    </motion.div>
  </div>
)

// Code Preview Component
const CodePreview = () => (
  <motion.div
    initial={{ opacity: 0, scale: 0.95 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{ duration: 0.5 }}
    className="mt-16 rounded-2xl bg-[#0a0b10] border border-border overflow-hidden"
  >
    <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
      <div className="flex gap-2">
        <div className="h-3 w-3 rounded-full bg-red-500" />
        <div className="h-3 w-3 rounded-full bg-yellow-500" />
        <div className="h-3 w-3 rounded-full bg-green-500" />
      </div>
      <span className="text-sm text-t3">dashboard.js</span>
    </div>
    <pre className="p-6 overflow-x-auto text-sm">
      <code className="text-t2">
        <span className="text-[#4a80c8]">const</span> {""}
        <span className="text-[#e05f40]">dashboard</span> = {""}
        <span className="text-[#4a80c8]">new</span> {""}
        <span className="text-[#00b478]">Dashboard</span>({""}
        <span className="text-[#e09040]">api</span>: <span className="text-[#00b478]">'wss://api.example.com'</span>,{""}
        <span className="text-[#e09040]">token</span>: <span className="text-[#00b478]">'your-token-here'</span>{""}
        <span className="text-[#4a80c8]">});</span>{""}
        {""}
        <span className="text-[#e09040]">dashboard</span>.{""}
        <span className="text-[#00b478]">on</span>(<span className="text-[#00b478]">'session.start'</span>, {""}
        <span className="text-[#4a80c8]">function</span>(session) {""}
        <span className="text-[#e09040]">console</span>.{""}
        <span className="text-[#00b478]">log</span>(<span className="text-[#00b478]">'Session started:'</span>, session);{""}
        <span className="text-[#4a80c8]">});</span>
      </code>
    </pre>
  </motion.div>
)

// CTA Section
const CTASection = () => (
  <div className="mt-24 p-12 rounded-2xl bg-gradient-to-br from-[#e05f40]/20 via-[#0a0b10] to-[#4a80c8]/20 border border-border">
    <div className="text-center max-w-3xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h2 className="text-4xl font-bold text-t1 sm:text-5xl mt-8">
          Klar til at tage dit AI-controldashboard
          <span className="text-[#e05f40]"> til næste niveau</span>?
        </h2>
        <p className="text-xl text-t2 mt-6">
          Begynd at styre dine AI-agters i dag. Gratis plan tilgængelig med fuld funktionalitet.
        </p>
      </motion.div>
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="flex items-center gap-2 bg-[#e05f40] hover:bg-[#d14f30] text-white px-10 py-5 rounded-xl font-semibold transition-all text-lg mt-8"
        onClick={() => window.location.href = '/login'}
      >
        <Zap size={24} />
        Opret din konto nu
        <ArrowRight size={24} />
      </motion.button>
    </div>
  </div>
)

// Footer
const Footer = () => (
  <footer className="mt-24 border-t border-border pt-12">
    <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Zap size={24} className="text-[#e05f40]" />
          <span className="text-lg font-semibold text-t1">AI Agent Control</span>
        </div>
        <p className="text-sm text-t2">
          Den ultimative platform til at styre og overvåge dine AI-agters.
        </p>
      </div>
      <div>
        <h4 className="font-semibold text-t1 mb-4">Produkt</h4>
        <ul className="space-y-2 text-sm text-t2">
          <li><Link to="/features" className="hover:text-[#e05f40] transition-colors">Features</Link></li>
          <li><Link to="/pricing" className="hover:text-[#e05f40] transition-colors">Pricing</Link></li>
          <li><Link to="/changelog" className="hover:text-[#e05f40] transition-colors">Changelog</Link></li>
        </ul>
      </div>
      <div>
        <h4 className="font-semibold text-t1 mb-4">Ressourcer</h4>
        <ul className="space-y-2 text-sm text-t2">
          <li><Link to="/docs" className="hover:text-[#e05f40] transition-colors">Dokumentation</Link></li>
          <li><Link to="/api" className="hover:text-[#e05f40] transition-colors">API Reference</Link></li>
          <li><Link to="/blog" className="hover:text-[#e05f40] transition-colors">Blog</Link></li>
        </ul>
      </div>
      <div>
        <h4 className="font-semibold text-t1 mb-4">Selskab</h4>
        <ul className="space-y-2 text-sm text-t2">
          <li><Link to="/about" className="hover:text-[#e05f40] transition-colors">Om os</Link></li>
          <li><Link to="/careers" className="hover:text-[#e05f40] transition-colors">Karriere</Link></li>
          <li><Link to="/contact" className="hover:text-[#e05f40] transition-colors">Kontakt</Link></li>
        </ul>
      </div>
    </div>
    <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mt-12 pt-8 border-t border-border text-sm text-t3">
      <p>© 2024 AI Agent Control. Alle rettigheder forbeholdes.</p>
      <div className="flex gap-6">
        <Link to="/privacy" className="hover:text-[#e05f40] transition-colors">Privatliv</Link>
        <Link to="/terms" className="hover:text-[#e05f40] transition-colors">Betingelser</Link>
        <Link to="/security" className="hover:text-[#e05f40] transition-colors">Sikkerhed</Link>
      </div>
    </div>
  </footer>
)

// Navigation
const Navigation = () => {
  const [scrolled, setScrolled] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const navLinks = [
    { name: 'Features', href: '/features' },
    { name: 'Pricing', href: '/pricing' },
    { name: 'Documentation', href: '/docs' },
    { name: 'API', href: '/api' },
  ]

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
      scrolled ? 'bg-[#0a0b10]/90 backdrop-blur-xl border-b border-border' : 'border-b border-transparent'
    }`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#e05f40]">
              <Zap size={20} className="text-white" />
            </div>
            <span className="font-bold text-t1 text-lg">AI Agent Control</span>
          </Link>
          
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <Link
                key={link.name}
                to={link.href}
                className="text-sm text-t2 hover:text-[#e05f40] transition-colors"
              >
                {link.name}
              </Link>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-4">
            <Link
              to="/login"
              className="text-sm text-t2 hover:text-[#e05f40] transition-colors"
            >
              Log ind
            </Link>
            <Link
              to="/login"
              className="px-4 py-2 text-sm font-medium bg-[#e05f40] hover:bg-[#d14f30] text-white rounded-lg transition-all"
            >
              Opret konto
            </Link>
          </div>

          <button
            className="md:hidden p-2"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="md:hidden bg-[#0a0b10] border-b border-border"
        >
          <div className="px-4 py-4 space-y-3">
            {navLinks.map((link) => (
              <Link
                key={link.name}
                to={link.href}
                className="block text-sm text-t2 hover:text-[#e05f40] py-2"
                onClick={() => setMobileMenuOpen(false)}
              >
                {link.name}
              </Link>
            ))}
            <div className="pt-4 border-t border-border space-y-3">
              <Link
                to="/login"
                className="block text-sm text-t2 hover:text-[#e05f40] py-2"
                onClick={() => setMobileMenuOpen(false)}
              >
                Log ind
              </Link>
              <Link
                to="/login"
                className="block px-4 py-2 text-sm font-medium bg-[#e05f40] hover:bg-[#d14f30] text-white rounded-lg text-center"
                onClick={() => setMobileMenuOpen(false)}
              >
                Opret konto
              </Link>
            </div>
          </div>
        </motion.div>
      )}
    </nav>
  )
}

// Code Import: BookOpen
const BookOpen = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
  </svg>
)

// Main Landing Page Component
export default function LandingPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-bg text-t1">
      <Navigation />
      
      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-4 sm:px-6 lg:px-8 overflow-hidden">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-20 left-1/4 w-96 h-96 bg-[#e05f40]/10 rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-1/4 w-96 h-96 bg-[#4a80c8]/10 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-7xl mx-auto">
          <div className="text-center">
            <HeroLogo />
            <HeroTitle />
            <HeroSubtitle />
            <HeroCTA />
          </div>

          {/* Visual Elements */}
          <div className="mt-16 relative">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="relative mx-auto max-w-4xl"
            >
              <div className="absolute -inset-1 bg-gradient-to-r from-[#e05f40]/20 to-[#4a80c8]/20 rounded-2xl blur-2xl" />
              <div className="relative bg-[#0d0f17] border border-border rounded-2xl p-8">
                <div className="flex items-center gap-2 mb-6">
                  <div className="flex gap-2">
                    <div className="h-3 w-3 rounded-full bg-red-500" />
                    <div className="h-3 w-3 rounded-full bg-yellow-500" />
                    <div className="h-3 w-3 rounded-full bg-green-500" />
                  </div>
                  <span className="text-sm text-t3">Dashboard Preview</span>
                </div>
                <div className="space-y-4">
                  <div className="h-8 bg-[#111318] rounded-lg animate-pulse" />
                  <div className="flex gap-4">
                    <div className="w-1/3 h-32 bg-[#111318] rounded-lg animate-pulse" />
                    <div className="w-2/3 h-32 bg-[#111318] rounded-lg animate-pulse" />
                  </div>
                  <div className="h-24 bg-[#111318] rounded-lg animate-pulse" />
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <FeaturesGrid />

      {/* Stats Section */}
      <StatsSection />

      {/* Testimonials Section */}
      <TestimonialsSection />

      {/* Code Preview Section */}
      <div className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-t1">Simpelt at integrere</h2>
            <p className="text-xl text-t2 mt-4">Start med at styre dine AI-agters i få minutter</p>
          </div>
          <CodePreview />
        </div>
      </div>

      {/* CTA Section */}
      <CTASection />

      {/* Footer */}
      <Footer />
    </div>
  )
}
