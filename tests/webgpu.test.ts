import { describe, it, expect, vi, afterEach } from 'vitest'
import { isWebGPUAvailable, getGPUCapabilities, estimateVRAM } from '../src/webgpu.js'

describe('isWebGPUAvailable', () => {
  const originalNavigator = globalThis.navigator

  afterEach(() => {
    Object.defineProperty(globalThis, 'navigator', {
      value: originalNavigator,
      writable: true,
      configurable: true,
    })
  })

  it('returns false when navigator is undefined', () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: undefined,
      writable: true,
      configurable: true,
    })
    expect(isWebGPUAvailable()).toBe(false)
  })

  it('returns false when navigator.gpu is undefined', () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: {},
      writable: true,
      configurable: true,
    })
    expect(isWebGPUAvailable()).toBe(false)
  })

  it('returns true when navigator.gpu exists', () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: { gpu: {} },
      writable: true,
      configurable: true,
    })
    expect(isWebGPUAvailable()).toBe(true)
  })
})

describe('estimateVRAM', () => {
  const MB = 1024 * 1024

  it('returns "low" for < 256 MB', () => {
    expect(estimateVRAM(128 * MB)).toBe('low')
    expect(estimateVRAM(0)).toBe('low')
    expect(estimateVRAM(255 * MB)).toBe('low')
  })

  it('returns "medium" for 256 MB – 1 GB', () => {
    expect(estimateVRAM(256 * MB)).toBe('medium')
    expect(estimateVRAM(512 * MB)).toBe('medium')
    expect(estimateVRAM(1024 * MB)).toBe('medium')
  })

  it('returns "high" for > 1 GB', () => {
    expect(estimateVRAM(1025 * MB)).toBe('high')
    expect(estimateVRAM(4096 * MB)).toBe('high')
  })
})

describe('getGPUCapabilities', () => {
  const originalNavigator = globalThis.navigator

  afterEach(() => {
    Object.defineProperty(globalThis, 'navigator', {
      value: originalNavigator,
      writable: true,
      configurable: true,
    })
  })

  it('returns null when WebGPU is unavailable', async () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: {},
      writable: true,
      configurable: true,
    })
    expect(await getGPUCapabilities()).toBeNull()
  })

  it('returns null when adapter request fails', async () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: {
        gpu: {
          requestAdapter: vi.fn().mockResolvedValue(null),
        },
      },
      writable: true,
      configurable: true,
    })
    expect(await getGPUCapabilities()).toBeNull()
  })

  it('returns null when requestAdapter throws', async () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: {
        gpu: {
          requestAdapter: vi.fn().mockRejectedValue(new Error('GPU error')),
        },
      },
      writable: true,
      configurable: true,
    })
    expect(await getGPUCapabilities()).toBeNull()
  })

  it('returns capabilities from a successful adapter', async () => {
    const MB = 1024 * 1024
    const mockAdapter = {
      info: { device: 'Test GPU', description: 'Test Description' },
      limits: {
        maxBufferSize: 512 * MB,
        maxComputeInvocationsPerWorkgroup: 256,
      },
    }

    Object.defineProperty(globalThis, 'navigator', {
      value: {
        gpu: {
          requestAdapter: vi.fn().mockResolvedValue(mockAdapter),
        },
      },
      writable: true,
      configurable: true,
    })

    const caps = await getGPUCapabilities()
    expect(caps).toEqual({
      adapter: 'Test GPU',
      maxBufferSize: 512 * MB,
      maxComputeWorkgroupSize: 256,
      estimatedVRAM: 'medium',
    })
  })

  it('falls back to description when device is missing', async () => {
    const MB = 1024 * 1024
    const mockAdapter = {
      info: { device: '', description: 'Fallback Description' },
      limits: {
        maxBufferSize: 2048 * MB,
        maxComputeInvocationsPerWorkgroup: 512,
      },
    }

    Object.defineProperty(globalThis, 'navigator', {
      value: {
        gpu: {
          requestAdapter: vi.fn().mockResolvedValue(mockAdapter),
        },
      },
      writable: true,
      configurable: true,
    })

    const caps = await getGPUCapabilities()
    expect(caps).not.toBeNull()
    expect(caps!.adapter).toBe('Fallback Description')
    expect(caps!.estimatedVRAM).toBe('high')
  })

  it('uses "unknown" when both device and description are empty', async () => {
    const MB = 1024 * 1024
    const mockAdapter = {
      info: { device: '', description: '' },
      limits: {
        maxBufferSize: 64 * MB,
        maxComputeInvocationsPerWorkgroup: 128,
      },
    }

    Object.defineProperty(globalThis, 'navigator', {
      value: {
        gpu: {
          requestAdapter: vi.fn().mockResolvedValue(mockAdapter),
        },
      },
      writable: true,
      configurable: true,
    })

    const caps = await getGPUCapabilities()
    expect(caps).not.toBeNull()
    expect(caps!.adapter).toBe('unknown')
    expect(caps!.estimatedVRAM).toBe('low')
  })
})
