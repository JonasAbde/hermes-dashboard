/**
 * AvatarShowcasePage — Visual playground for HermesCharacter
 * 
 * Displays all character states and animations for testing.
 * Route: /avatar-showcase
 */

import React, { useState } from 'react'
import { HermesCharacter, HermesMascot, HermesCharacterStatusBadge } from '../components/avatar/HermesCharacter'

const VARIANTS = ['default', 'idle', 'thinking', 'active', 'success', 'warning', 'error', 'offline']
const SIZES = [
  { key: 'micro', label: 'Micro (16px)', value: 16 },
  { key: 'small', label: 'Small (32px)', value: 32 },
  { key: 'medium', label: 'Medium (64px)', value: 64 },
  { key: 'large', label: 'Large (128px)', value: 128 },
  { key: 'xl', label: 'XL (256px)', value: 256 },
]

export default function AvatarShowcasePage() {
  const [selectedSize, setSelectedSize] = useState('large')
  const [showPulse, setShowPulse] = useState(true)
  const [showStatusDot, setShowStatusDot] = useState(true)
  const [enableBlink, setEnableBlink] = useState(true)

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-t1 mb-2">Hermes Character</h1>
        <p className="text-t2">Living AI avatar med CSS-drevne animationer</p>
      </div>

      {/* Controls */}
      <div className="bg-surface border border-border rounded-xl p-6 mb-10">
        <h2 className="text-sm font-semibold text-t2 uppercase tracking-wide mb-4">Indstillinger</h2>
        <div className="flex flex-wrap gap-6">
          {/* Size selector */}
          <div>
            <label className="text-xs text-t3 uppercase mb-2 block">Størrelse</label>
            <select 
              value={selectedSize}
              onChange={(e) => setSelectedSize(e.target.value)}
              className="bg-surface2 border border-border rounded-lg px-3 py-2 text-t1 text-sm min-w-[150px]"
            >
              {SIZES.map(s => (
                <option key={s.key} value={s.key}>{s.label}</option>
              ))}
            </select>
          </div>

          {/* Toggles */}
          <div className="flex gap-6 items-end">
            <label className="flex items-center gap-2 cursor-pointer">
              <input 
                type="checkbox" 
                checked={showPulse}
                onChange={(e) => setShowPulse(e.target.checked)}
                className="rounded border-border bg-surface2"
              />
              <span className="text-sm text-t2">Pulse ring</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input 
                type="checkbox" 
                checked={showStatusDot}
                onChange={(e) => setShowStatusDot(e.target.checked)}
                className="rounded border-border bg-surface2"
              />
              <span className="text-sm text-t2">Status dot</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input 
                type="checkbox" 
                checked={enableBlink}
                onChange={(e) => setEnableBlink(e.target.checked)}
                className="rounded border-border bg-surface2"
              />
              <span className="text-sm text-t2">Blink (idle)</span>
            </label>
          </div>
        </div>
      </div>

      {/* All States Grid */}
      <div className="mb-12">
        <h2 className="text-lg font-semibold text-t1 mb-6">Alle Tilstande</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {VARIANTS.map(variant => (
            <div 
              key={variant}
              className="bg-surface border border-border rounded-xl p-6 flex flex-col items-center gap-4 hover:border-rust/30 transition-colors"
            >
              <HermesCharacter 
                variant={variant}
                size={selectedSize}
                pulse={showPulse}
                statusDot={showStatusDot}
                blink={enableBlink}
              />
              <div className="text-center">
                <div className="text-sm font-medium text-t1 capitalize">{variant}</div>
                <HermesCharacterStatusBadge variant={variant} className="mt-2" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Size Comparison */}
      <div className="mb-12">
        <h2 className="text-lg font-semibold text-t1 mb-6">Størrelses Sammenligning</h2>
        <div className="bg-surface border border-border rounded-xl p-8">
          <div className="flex items-end justify-center gap-8 flex-wrap">
            {SIZES.map(({ key, label, value }) => (
              <div key={key} className="flex flex-col items-center gap-3">
                <HermesCharacter 
                  variant="active"
                  size={key}
                  pulse
                  statusDot
                />
                <span className="text-xs text-t3">{value}px</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Hero Mascot */}
      <div className="mb-12">
        <h2 className="text-lg font-semibold text-t1 mb-6">Hero Mascot</h2>
        <div className="bg-surface border border-border rounded-xl p-12 flex flex-col items-center">
          <HermesMascot variant="active" />
          <p className="text-t2 mt-6 text-center max-w-md">
            Den store mascot visning — perfekt til onboarding, brand sider, og "om" sektioner.
          </p>
        </div>
      </div>

      {/* Animation Details */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-surface border border-border rounded-xl p-6">
          <h3 className="font-semibold text-t1 mb-4">Idle Animation</h3>
          <ul className="text-sm text-t2 space-y-2">
            <li className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green"></span>
              Åndedræt (subtil skalering)
            </li>
            <li className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green"></span>
              Tilfældig blink (2-6 sek intervaller)
            </li>
            <li className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green"></span>
              Mild hover effekt
            </li>
          </ul>
        </div>

        <div className="bg-surface border border-border rounded-xl p-6">
          <h3 className="font-semibold text-t1 mb-4">Thinking Animation</h3>
          <ul className="text-sm text-t2 space-y-2">
            <li className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue"></span>
              Øjne kigger op
            </li>
            <li className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue"></span>
              Tænkebobler (prikker der svæver op)
            </li>
            <li className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue"></span>
              Mund former "o"-shape
            </li>
          </ul>
        </div>

        <div className="bg-surface border border-border rounded-xl p-6">
          <h3 className="font-semibold text-t1 mb-4">Active Animation</h3>
          <ul className="text-sm text-t2 space-y-2">
            <li className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green"></span>
              Energisk puls (hurtigere)
            </li>
            <li className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green"></span>
              Data streams (opadgående linjer)
            </li>
            <li className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green"></span>
              Spinning inner ring
            </li>
          </ul>
        </div>

        <div className="bg-surface border border-border rounded-xl p-6">
          <h3 className="font-semibold text-t1 mb-4">Error/Offline</h3>
          <ul className="text-sm text-t2 space-y-2">
            <li className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-rust"></span>
              Error: Trist mund (frown)
            </li>
            <li className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-rust"></span>
              Offline: "Zzz" sove-indikator
            </li>
            <li className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-rust"></span>
              Dæmpede farver
            </li>
          </ul>
        </div>
      </div>
    </div>
  )
}
