import '@testing-library/jest-dom'
import React from 'react'
import { vi } from 'vitest'

window.HTMLElement.prototype.scrollIntoView = function() {};

// Mock fetch globally for tests
globalThis.fetch = vi.fn(() =>
  Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve({}),
  })
)

// Mock localStorage
const storage = {}
globalThis.localStorage = {
  getItem: (key) => storage[key] ?? null,
  setItem: (key, value) => { storage[key] = String(value) },
  removeItem: (key) => { delete storage[key] },
  clear: () => Object.keys(storage).forEach(k => delete storage[k]),
}

// Mock matchMedia
globalThis.matchMedia = vi.fn().mockImplementation(query => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: vi.fn(),
  removeListener: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
}))

// Mock ResizeObserver
globalThis.ResizeObserver = class ResizeObserver {
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
  constructor() {}
}
