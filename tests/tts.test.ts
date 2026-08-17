import { describe, it, expect, vi, afterEach } from 'vitest'
import { LocalTTS } from '../src/tts.js'
import { InferenceError } from '../src/types.js'

// Mock the dynamic import of kokoro-js
vi.mock('kokoro-js', () => ({
  KokoroTTS: {
    from_pretrained: vi.fn(),
  },
}))

describe('LocalTTS', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('constructor', () => {
    it('creates a TTS instance with defaults', () => {
      const tts = new LocalTTS()
      expect(tts).toBeInstanceOf(LocalTTS)
    })

    it('accepts custom config', () => {
      const tts = new LocalTTS({ voice: 'custom_voice', rate: 1.5 })
      expect(tts).toBeInstanceOf(LocalTTS)
    })
  })

  describe('speak', () => {
    it('throws when TTS is not initialized', async () => {
      const tts = new LocalTTS()
      await expect(tts.speak('hello')).rejects.toThrow(InferenceError)
      await expect(tts.speak('hello')).rejects.toMatchObject({
        code: 'tts-speak-failed',
      })
    })
  })

  describe('pause / resume / stop', () => {
    it('does not throw when called before init', () => {
      const tts = new LocalTTS()
      expect(() => tts.pause()).not.toThrow()
      expect(() => tts.resume()).not.toThrow()
      expect(() => tts.stop()).not.toThrow()
    })
  })

  describe('destroy', () => {
    it('does not throw when TTS is not initialized', async () => {
      const tts = new LocalTTS()
      await expect(tts.destroy()).resolves.toBeUndefined()
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
      expect(await LocalTTS.isCached()).toBe(false)
    })

    it('returns false when cache is empty', async () => {
      const mockCache = {
        keys: vi.fn().mockResolvedValue([]),
      }
      Object.defineProperty(globalThis, 'caches', {
        value: { open: vi.fn().mockResolvedValue(mockCache) },
        writable: true,
        configurable: true,
      })

      expect(await LocalTTS.isCached()).toBe(false)
    })

    it('returns true when cache has entries', async () => {
      const mockCache = {
        keys: vi.fn().mockResolvedValue([{ url: 'https://example.com/model.onnx' }]),
      }
      Object.defineProperty(globalThis, 'caches', {
        value: { open: vi.fn().mockResolvedValue(mockCache) },
        writable: true,
        configurable: true,
      })

      expect(await LocalTTS.isCached()).toBe(true)
    })

    it('returns false when cache throws', async () => {
      Object.defineProperty(globalThis, 'caches', {
        value: { open: vi.fn().mockRejectedValue(new Error('fail')) },
        writable: true,
        configurable: true,
      })

      expect(await LocalTTS.isCached()).toBe(false)
    })
  })
})
