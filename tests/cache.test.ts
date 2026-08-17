import { describe, it, expect, vi, afterEach } from 'vitest'
import { isCacheAPIAvailable, hasCacheEntry, deleteCache } from '../src/cache.js'

describe('isCacheAPIAvailable', () => {
  const originalCaches = globalThis.caches

  afterEach(() => {
    Object.defineProperty(globalThis, 'caches', {
      value: originalCaches,
      writable: true,
      configurable: true,
    })
  })

  it('returns false when caches is undefined', () => {
    Object.defineProperty(globalThis, 'caches', {
      value: undefined,
      writable: true,
      configurable: true,
    })
    expect(isCacheAPIAvailable()).toBe(false)
  })

  it('returns true when caches is defined', () => {
    Object.defineProperty(globalThis, 'caches', {
      value: {},
      writable: true,
      configurable: true,
    })
    expect(isCacheAPIAvailable()).toBe(true)
  })
})

describe('hasCacheEntry', () => {
  const originalCaches = globalThis.caches

  afterEach(() => {
    Object.defineProperty(globalThis, 'caches', {
      value: originalCaches,
      writable: true,
      configurable: true,
    })
  })

  it('returns false when Cache API is unavailable', async () => {
    Object.defineProperty(globalThis, 'caches', {
      value: undefined,
      writable: true,
      configurable: true,
    })
    expect(await hasCacheEntry('test', 'https://example.com')).toBe(false)
  })

  it('returns true when entry exists', async () => {
    const mockCache = {
      match: vi.fn().mockResolvedValue(new Response()),
    }
    Object.defineProperty(globalThis, 'caches', {
      value: { open: vi.fn().mockResolvedValue(mockCache) },
      writable: true,
      configurable: true,
    })

    expect(await hasCacheEntry('test', 'https://example.com')).toBe(true)
    expect(mockCache.match).toHaveBeenCalledWith('https://example.com')
  })

  it('returns false when entry does not exist', async () => {
    const mockCache = {
      match: vi.fn().mockResolvedValue(undefined),
    }
    Object.defineProperty(globalThis, 'caches', {
      value: { open: vi.fn().mockResolvedValue(mockCache) },
      writable: true,
      configurable: true,
    })

    expect(await hasCacheEntry('test', 'https://example.com')).toBe(false)
  })

  it('returns false when caches.open throws', async () => {
    Object.defineProperty(globalThis, 'caches', {
      value: { open: vi.fn().mockRejectedValue(new Error('quota')) },
      writable: true,
      configurable: true,
    })

    expect(await hasCacheEntry('test', 'https://example.com')).toBe(false)
  })
})

describe('deleteCache', () => {
  const originalCaches = globalThis.caches

  afterEach(() => {
    Object.defineProperty(globalThis, 'caches', {
      value: originalCaches,
      writable: true,
      configurable: true,
    })
  })

  it('returns false when Cache API is unavailable', async () => {
    Object.defineProperty(globalThis, 'caches', {
      value: undefined,
      writable: true,
      configurable: true,
    })
    expect(await deleteCache('test')).toBe(false)
  })

  it('returns true when cache is deleted', async () => {
    Object.defineProperty(globalThis, 'caches', {
      value: { delete: vi.fn().mockResolvedValue(true) },
      writable: true,
      configurable: true,
    })
    expect(await deleteCache('test')).toBe(true)
  })

  it('returns false when cache did not exist', async () => {
    Object.defineProperty(globalThis, 'caches', {
      value: { delete: vi.fn().mockResolvedValue(false) },
      writable: true,
      configurable: true,
    })
    expect(await deleteCache('test')).toBe(false)
  })

  it('returns false when delete throws', async () => {
    Object.defineProperty(globalThis, 'caches', {
      value: { delete: vi.fn().mockRejectedValue(new Error('fail')) },
      writable: true,
      configurable: true,
    })
    expect(await deleteCache('test')).toBe(false)
  })
})
