import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { LocalLLMEngine } from '../src/engine.js'
import { InferenceError } from '../src/types.js'

const mockUnload = vi.fn().mockResolvedValue(undefined)
const mockCreate = vi.fn()
const mockCompletionsCreate = vi.fn()

vi.mock('@mlc-ai/web-llm', () => ({
  CreateMLCEngine: (...args: unknown[]) => mockCreate(...args),
}))

function enableWebGPU() {
  Object.defineProperty(globalThis, 'navigator', {
    value: { gpu: {} },
    writable: true,
    configurable: true,
  })
}

function disableWebGPU() {
  Object.defineProperty(globalThis, 'navigator', {
    value: {},
    writable: true,
    configurable: true,
  })
}

function makeMockEngine() {
  return {
    chat: {
      completions: { create: mockCompletionsCreate },
    },
    unload: mockUnload,
  }
}

describe('LocalLLMEngine', () => {
  const originalNavigator = globalThis.navigator

  beforeEach(() => {
    mockCreate.mockReset()
    mockUnload.mockReset().mockResolvedValue(undefined)
    mockCompletionsCreate.mockReset()
  })

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
      disableWebGPU()
      const engine = new LocalLLMEngine()
      await expect(engine.init()).rejects.toThrow(InferenceError)
      await expect(engine.init()).rejects.toMatchObject({
        code: 'webgpu-unavailable',
      })
    })

    it('initializes successfully with WebGPU available', async () => {
      enableWebGPU()
      mockCreate.mockResolvedValue(makeMockEngine())

      const engine = new LocalLLMEngine()
      await engine.init()

      expect(mockCreate).toHaveBeenCalledOnce()
    })

    it('calls onProgress during initialization', async () => {
      enableWebGPU()
      const onProgress = vi.fn()

      mockCreate.mockImplementation((_model: string, opts: { initProgressCallback: (r: { progress: number }) => void }) => {
        opts.initProgressCallback({ progress: 0.5 })
        return Promise.resolve(makeMockEngine())
      })

      const engine = new LocalLLMEngine({ onProgress })
      await engine.init()

      expect(onProgress).toHaveBeenCalledWith(
        expect.objectContaining({ phase: 'download', percentage: 50 }),
      )
    })

    it('does not call onProgress when callback is not set', async () => {
      enableWebGPU()

      mockCreate.mockImplementation((_model: string, opts: { initProgressCallback: (r: { progress: number }) => void }) => {
        opts.initProgressCallback({ progress: 0.5 })
        return Promise.resolve(makeMockEngine())
      })

      const engine = new LocalLLMEngine()
      await engine.init()
    })

    it('throws model-load-failed on generic errors', async () => {
      enableWebGPU()
      mockCreate.mockRejectedValue(new Error('Network error'))

      const engine = new LocalLLMEngine()
      await expect(engine.init()).rejects.toMatchObject({
        code: 'model-load-failed',
      })
    })

    it('throws out-of-memory when OOM detected', async () => {
      enableWebGPU()
      mockCreate.mockRejectedValue(new Error('out of memory'))

      const engine = new LocalLLMEngine()
      await expect(engine.init()).rejects.toMatchObject({
        code: 'out-of-memory',
      })
    })

    it('detects OOM via "allocation failed"', async () => {
      enableWebGPU()
      mockCreate.mockRejectedValue(new Error('allocation failed'))

      const engine = new LocalLLMEngine()
      await expect(engine.init()).rejects.toMatchObject({
        code: 'out-of-memory',
      })
    })

    it('re-throws InferenceError as-is', async () => {
      enableWebGPU()
      const original = new InferenceError('webgpu-unavailable', 'test')
      mockCreate.mockRejectedValue(original)

      const engine = new LocalLLMEngine()
      await expect(engine.init()).rejects.toBe(original)
    })

    it('handles non-Error throw values', async () => {
      enableWebGPU()
      mockCreate.mockRejectedValue('string error')

      const engine = new LocalLLMEngine()
      await expect(engine.init()).rejects.toMatchObject({
        code: 'model-load-failed',
      })
    })
  })

  describe('generate', () => {
    it('throws when engine is not initialized', async () => {
      const engine = new LocalLLMEngine()
      const gen = engine.generate('test')
      await expect(gen.next()).rejects.toMatchObject({ code: 'inference-failed' })
    })

    it('yields tokens from stream', async () => {
      enableWebGPU()
      mockCreate.mockResolvedValue(makeMockEngine())

      const chunks = [
        { choices: [{ delta: { content: 'Hello' } }] },
        { choices: [{ delta: { content: ' world' } }] },
      ]

      async function* fakeStream() {
        for (const chunk of chunks) yield chunk
      }

      mockCompletionsCreate.mockResolvedValue(fakeStream())

      const engine = new LocalLLMEngine()
      await engine.init()

      const tokens: string[] = []
      for await (const token of engine.generate('test')) {
        tokens.push(token)
      }
      expect(tokens).toEqual(['Hello', ' world'])
    })

    it('includes system prompt when provided', async () => {
      enableWebGPU()
      mockCreate.mockResolvedValue(makeMockEngine())

      async function* empty() { /* nothing */ }
      mockCompletionsCreate.mockResolvedValue(empty())

      const engine = new LocalLLMEngine()
      await engine.init()

      for await (const _t of engine.generate('hello', 'You are helpful')) {
        void _t
      }

      expect(mockCompletionsCreate).toHaveBeenCalledWith({
        messages: [
          { role: 'system', content: 'You are helpful' },
          { role: 'user', content: 'hello' },
        ],
        stream: true,
      })
    })

    it('skips chunks with no content', async () => {
      enableWebGPU()
      mockCreate.mockResolvedValue(makeMockEngine())

      const chunks = [
        { choices: [{ delta: {} }] },
        { choices: [{ delta: { content: 'ok' } }] },
        { choices: [] },
      ]

      async function* fakeStream() {
        for (const chunk of chunks) yield chunk
      }

      mockCompletionsCreate.mockResolvedValue(fakeStream())

      const engine = new LocalLLMEngine()
      await engine.init()

      const tokens: string[] = []
      for await (const token of engine.generate('test')) {
        tokens.push(token)
      }
      expect(tokens).toEqual(['ok'])
    })

    it('stops when aborted', async () => {
      enableWebGPU()
      mockCreate.mockResolvedValue(makeMockEngine())

      async function* slowStream() {
        yield { choices: [{ delta: { content: 'first' } }] }
        yield { choices: [{ delta: { content: 'second' } }] }
      }

      mockCompletionsCreate.mockResolvedValue(slowStream())

      const engine = new LocalLLMEngine()
      await engine.init()

      const tokens: string[] = []
      for await (const token of engine.generate('test')) {
        tokens.push(token)
        engine.abort()
      }
      expect(tokens).toEqual(['first'])
    })

    it('throws inference-failed when stream errors', async () => {
      enableWebGPU()
      mockCreate.mockResolvedValue(makeMockEngine())

      async function* failingStream() {
        yield { choices: [{ delta: { content: 'ok' } }] }
        throw new Error('stream broke')
      }

      mockCompletionsCreate.mockResolvedValue(failingStream())

      const engine = new LocalLLMEngine()
      await engine.init()

      const tokens: string[] = []
      await expect(async () => {
        for await (const token of engine.generate('test')) {
          tokens.push(token)
        }
      }).rejects.toMatchObject({ code: 'inference-failed' })
    })

    it('silently returns when stream errors after abort', async () => {
      enableWebGPU()
      mockCreate.mockResolvedValue(makeMockEngine())

      let rejectCreate!: (err: Error) => void
      mockCompletionsCreate.mockImplementation(
        () => new Promise((_resolve, reject) => { rejectCreate = reject }),
      )

      const engine = new LocalLLMEngine()
      await engine.init()

      const gen = engine.generate('test')
      const promise = gen.next()
      // Let generator body run up to the await
      await new Promise((r) => setTimeout(r, 10))
      // Abort first, then reject the create call
      engine.abort()
      rejectCreate(new Error('aborted'))
      const result = await promise
      expect(result.done).toBe(true)
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

    it('unloads the engine when initialized', async () => {
      enableWebGPU()
      mockCreate.mockResolvedValue(makeMockEngine())

      const engine = new LocalLLMEngine()
      await engine.init()
      await engine.destroy()

      expect(mockUnload).toHaveBeenCalledOnce()
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
      const mockCache = { keys: vi.fn().mockResolvedValue([]) }
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
