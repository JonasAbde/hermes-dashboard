// api/routes/lib/lib.test.ts — tests for TypeScript-migrated lib modules
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock dependencies
let callCount = 0
vi.mock('crypto', () => ({
  randomBytes: vi.fn((size) => {
    callCount += 1
    return Buffer.alloc(size).fill(String(callCount % 256))
  }),
}))

vi.mock('fs', () => ({
  readFileSync: vi.fn(() => ''),
  writeFileSync: vi.fn(),
  existsSync: vi.fn(() => false),
  mkdirSync: vi.fn(),
}))

vi.mock('child_process', () => ({
  exec: vi.fn(),
  execSync: vi.fn(() => ''),
}))

vi.mock('better-sqlite3', () => {
  function MockDB() {
    return {
      prepare: vi.fn(() => ({
        all: vi.fn(() => []),
      })),
    }
  }
  return { default: MockDB, __esModule: true }
})

describe('auth.ts', () => {
  it('should export required functions', async () => {
    const { authMiddleware, generateCsrfToken, getCsrfToken, removeCsrfToken, rotateCsrfToken, csrfMiddleware } = await import('./auth.ts')
    expect(typeof authMiddleware).toBe('function')
    expect(typeof generateCsrfToken).toBe('function')
    expect(typeof getCsrfToken).toBe('function')
    expect(typeof removeCsrfToken).toBe('function')
    expect(typeof rotateCsrfToken).toBe('function')
    expect(typeof csrfMiddleware).toBe('function')
  })

  it('should generate CSRF tokens', async () => {
    const { generateCsrfToken, getCsrfToken } = await import('./auth.ts')
    const token = generateCsrfToken('test-session')
    expect(token).toBeTruthy()
    expect(typeof token).toBe('string')
    expect(getCsrfToken('test-session')).toBe(token)
  })

  it('should rotate CSRF tokens', async () => {
    const { generateCsrfToken, rotateCsrfToken } = await import('./auth.ts')
    const initialToken = generateCsrfToken('test-session')
    const newToken = rotateCsrfToken('test-session')
    expect(newToken).toBeTruthy()
    expect(typeof newToken).toBe('string')
    expect(newToken).not.toBe(initialToken)
  })

  it('should remove CSRF tokens', async () => {
    const { generateCsrfToken, getCsrfToken, removeCsrfToken } = await import('./auth.ts')
    generateCsrfToken('test-session')
    removeCsrfToken('test-session')
    expect(getCsrfToken('test-session')).toBeNull()
  })
})

describe('rateLimit.ts', () => {
  it('should export rate limit policies', async () => {
    const { standardRateLimit, strictRateLimit, lenientRateLimit, authRateLimit, isTrustedIp } = await import('./rateLimit.ts')
    expect(standardRateLimit).toBeTruthy()
    expect(strictRateLimit).toBeTruthy()
    expect(lenientRateLimit).toBeTruthy()
    expect(authRateLimit).toBeTruthy()
    expect(typeof isTrustedIp).toBe('function')
  })
})

describe('database.ts', () => {
  it('should export database functions', async () => {
    const { HERMES_DB, getSessions, pyQuery } = await import('./database.ts')
    expect(HERMES_DB).toBeTruthy()
    expect(typeof getSessions).toBe('function')
    expect(typeof pyQuery).toBe('function')
  })

  it('should validate query commands', async () => {
    const { pyQuery } = await import('./database.ts')
    await expect(pyQuery('invalid-command')).rejects.toThrow()
  })
})

describe('config.ts', () => {
  it('should export config functions', async () => {
    const {
      setEnvVar,
      setYamlKey,
      readDashboardProfile,
      writeDashboardProfile,
      readRecommendationState,
      writeRecommendationState,
      RHYTHM_CONFIGS,
    } = await import('./config.ts')
    expect(typeof setEnvVar).toBe('function')
    expect(typeof setYamlKey).toBe('function')
    expect(typeof readDashboardProfile).toBe('function')
    expect(typeof writeDashboardProfile).toBe('function')
    expect(typeof readRecommendationState).toBe('function')
    expect(typeof writeRecommendationState).toBe('function')
    expect(RHYTHM_CONFIGS).toBeTruthy()
  })

  it('should have rhythm configs', async () => {
    const { RHYTHM_CONFIGS } = await import('./config.ts')
    expect(RHYTHM_CONFIGS.hibernation).toBeTruthy()
    expect(RHYTHM_CONFIGS.steady).toBeTruthy()
    expect(RHYTHM_CONFIGS.deep_focus).toBeTruthy()
    expect(RHYTHM_CONFIGS.high_burst).toBeTruthy()
  })
})

describe('services.ts', () => {
  it('should export service functions', async () => {
    const {
      hermesCmd,
      readPidFile,
      kill0,
      getProcessInfo,
      getServiceStatus,
      controlGatewayService,
      getMcpConfigEntries,
    } = await import('./services.ts')
    expect(typeof hermesCmd).toBe('function')
    expect(typeof readPidFile).toBe('function')
    expect(typeof kill0).toBe('function')
    expect(typeof getProcessInfo).toBe('function')
    expect(typeof getServiceStatus).toBe('function')
    expect(typeof controlGatewayService).toBe('function')
    expect(typeof getMcpConfigEntries).toBe('function')
  })

  it('should handle invalid PID', async () => {
    const { getProcessInfo } = await import('./services.ts')
    const result = getProcessInfo(0)
    expect(result).toBeNull()
  })

  it('should handle kill0 for non-existent process', async () => {
    const { kill0 } = await import('./services.ts')
    const result = kill0(999999)
    expect(result).toBe(false)
  })
})
