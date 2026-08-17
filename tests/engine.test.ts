import { describe, it, expect, vi, afterEach } from 'vitest'
import { LocalLLMEngine } from '../src/engine.js'
import { InferenceError } from '../src/types.js'

// Mock the dynamic import of @mlc-ai/web-llm
vi.mock('@mlc-ai/web-llm', () => ({
  CreateMLCEngine: vi.fn(),
}))

describe('LocalLLMEngine', () => {
  const originalNavigator = globalThis.navigator

  afterEach(() => {
    Object.defineProperty(globalThis, 'navigator', {
      value: originalNavigator,
      writable: true,
      configurable: true,
    })
    vi.restoreAllMocks()
  })

  describe('constructor', () => {
    it('creates an engine with default model', () => {
      const engine = new LocalLLMEngine()
      expect(engine).toBeInstanceOf(LocalLLMEngine)
    })

    it('accepts custom model', () => {
      const engine = new LocalLLMEngine({ model: 'custom-model' })
      expect(engine).toBeInstanceOf(LocalLLMEngine)
    })
  })

  describe('init', () => {
    it('throws webgpu-unavailable when WebGPU is missing', async () => {
      Object.defineProperty(globalThis, 'navigator', {
        value: {},
        writable: true,
        configurable: true,
      })

      const engine = new LocalLLMEngine()
      await expect(engine.init()).rejects.toThrow(InferenceError)
      await expect(engine.init()).rejects.toMatchObject({
        code: 'webgpu-unavailable',
      })
    })
  })

  describe('generate', () => {
    it('throws when engine is not initialized', async () => {
      const engine = new LocalLLMEngine()
      const generator = engine.generate('test prompt')

      await expect(generator.next()).rejects.toThrow(InferenceError)
      await expect(
        (async () => {
          const gen = engine.generate('test')
          await gen.next()
        })(),
      ).rejects.toMatchObject({ code: 'inference-failed' })
    })
  })

  describe('abort', () => {
    it('does not throw when called before init', () => {
      const engine = new LocalLLMEngine()
      expect(() => engine.abort()).not.toThrow()
    })
  })

  describe('destroy', () => {
    it('does not throw when engine is not initialized', async () => {
      const engine = new LocalLLMEngine()
      await expect(engine.destroy()).resolves.toBeUndefined()
    })
  })

  describe('isCached', () => {
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
      expect(await LocalLLMEngine.isCached()).toBe(false)
    })

    it('returns false when no matching entries exist', async () => {
      const mockCache = {
        keys: vi.fn().mockResolvedValue([]),
      }
      Object.defineProperty(globalThis, 'caches', {
        value: { open: vi.fn().mockResolvedValue(mockCache) },
        writable: true,
        configurable: true,
      })

      expect(await LocalLLMEngine.isCached()).toBe(false)
    })

    it('returns true when model entries exist', async () => {
      const mockCache = {
        keys: vi.fn().mockResolvedValue([
          { url: 'https://cdn.example.com/Llama-3.2-1B-Instruct-q4f32_1-MLC/model.wasm' },
        ]),
      }
      Object.defineProperty(globalThis, 'caches', {
        value: { open: vi.fn().mockResolvedValue(mockCache) },
        writable: true,
        configurable: true,
      })

      expect(await LocalLLMEngine.isCached()).toBe(true)
    })

    it('checks for a specific model', async () => {
      const mockCache = {
        keys: vi.fn().mockResolvedValue([
          { url: 'https://cdn.example.com/custom-model/weights.bin' },
        ]),
      }
      Object.defineProperty(globalThis, 'caches', {
        value: { open: vi.fn().mockResolvedValue(mockCache) },
        writable: true,
        configurable: true,
      })

      expect(await LocalLLMEngine.isCached('custom-model')).toBe(true)
      expect(await LocalLLMEngine.isCached('other-model')).toBe(false)
    })

    it('returns false when cache throws', async () => {
      Object.defineProperty(globalThis, 'caches', {
        value: { open: vi.fn().mockRejectedValue(new Error('quota')) },
        writable: true,
        configurable: true,
      })

      expect(await LocalLLMEngine.isCached()).toBe(false)
    })
  })
})
