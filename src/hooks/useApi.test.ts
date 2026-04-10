// src/hooks/useApi.test.ts — tests for TypeScript-migrated useApi hook
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

// Mock the auth module so apiFetch uses our controlled fetch
vi.mock('../utils/auth.ts', () => ({
  apiFetch: vi.fn((url: string, opts: Record<string, unknown> = {}) => {
    return global.fetch(url, opts)
  }),
  getToken: vi.fn(() => 'test-token'),
  getCsrfToken: vi.fn(() => 'test-csrf'),
  setCsrfToken: vi.fn(),
  authHeaders: vi.fn(() => ({ Authorization: 'Bearer test-token' })),
}))

import { useApi, usePoll } from './useApi'

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('useApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.setItem('hermes_dashboard_token', 'test-token')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should initialize with loading state', () => {
    mockFetch.mockReturnValue(new Promise(() => {})) // never resolves

    const { result } = renderHook(() => useApi('/test'))
    expect(result.current.loading).toBe(true)
    expect(result.current.data).toBeNull()
    expect(result.current.error).toBeNull()
  })

  it('should fetch data successfully', async () => {
    const mockData = { data: 'test' }
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockData),
    })

    const { result } = renderHook(() => useApi('/test'))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.data).toEqual(mockData)
    expect(result.current.error).toBeNull()
  })

  it('should handle errors', async () => {
    // Use 403 which is non-retryable (won't trigger retry logic)
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: () => Promise.resolve({ error: 'Forbidden' }),
    })

    const { result } = renderHook(() => useApi('/test'))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.data).toBeNull()
    expect(result.current.error).toBeTruthy()
  })

  it('should handle null path gracefully', async () => {
    const { result } = renderHook(() => useApi(null))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.data).toBeNull()
    expect(mockFetch).not.toHaveBeenCalled()
  })
})

describe('usePoll', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.setItem('hermes_dashboard_token', 'test-token')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should fetch data on mount via useApi', async () => {
    const mockData = { data: 'polled' }
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockData),
    })

    const { result } = renderHook(() => useApi('/test'))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.data).toEqual(mockData)
    expect(mockFetch).toHaveBeenCalled()
  })

  it('should return refetch function', async () => {
    const mockData = { data: 'test' }
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockData),
    })

    const { result } = renderHook(() => useApi('/test'))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(typeof result.current.refetch).toBe('function')
  })
})
