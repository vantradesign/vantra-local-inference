import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { LocalTTS } from '../src/tts.js'
import { InferenceError } from '../src/types.js'

const mockFromPretrained = vi.fn()
const mockGenerate = vi.fn()

vi.mock('kokoro-js', () => ({
  KokoroTTS: {
    from_pretrained: (...args: unknown[]) => mockFromPretrained(...args),
  },
}))

function makeMockTTS() {
  return { generate: mockGenerate }
}

const mockSourceStop = vi.fn()
const mockSourceConnect = vi.fn()
const mockSourceStart = vi.fn()
const mockClose = vi.fn().mockResolvedValue(undefined)

function makeMockAudioContext() {
  return {
    currentTime: 5,
    destination: {},
    createBufferSource: vi.fn(() => ({
      buffer: null,
      stop: mockSourceStop,
      connect: mockSourceConnect,
      start: mockSourceStart,
    })),
    decodeAudioData: vi.fn().mockResolvedValue({ duration: 10 }),
    close: mockClose,
  }
}

describe('LocalTTS', () => {
  const OriginalAudioContext = globalThis.AudioContext

  beforeEach(() => {
    mockFromPretrained.mockReset()
    mockGenerate.mockReset()
    mockSourceStop.mockReset()
    mockSourceConnect.mockReset()
    mockSourceStart.mockReset()
    mockClose.mockReset().mockResolvedValue(undefined)

    globalThis.AudioContext = vi.fn(makeMockAudioContext) as unknown as typeof AudioContext
  })

  afterEach(() => {
    globalThis.AudioContext = OriginalAudioContext
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

  describe('init', () => {
    it('initializes successfully', async () => {
      mockFromPretrained.mockResolvedValue(makeMockTTS())

      const tts = new LocalTTS()
      await tts.init()

      expect(mockFromPretrained).toHaveBeenCalledOnce()
    })

    it('calls onProgress during init', async () => {
      const onProgress = vi.fn()

      mockFromPretrained.mockImplementation((_id: string, opts: { progress_callback: (p: { status: string; loaded: number; total: number }) => void }) => {
        opts.progress_callback({ status: 'progress', loaded: 50, total: 100 })
        opts.progress_callback({ status: 'done', loaded: 100, total: 100 })
        return Promise.resolve(makeMockTTS())
      })

      const tts = new LocalTTS({ onProgress })
      await tts.init()

      expect(onProgress).toHaveBeenCalledOnce()
      expect(onProgress).toHaveBeenCalledWith(
        expect.objectContaining({ phase: 'download', percentage: 50 }),
      )
    })

    it('skips onProgress when not set', async () => {
      mockFromPretrained.mockImplementation((_id: string, opts: { progress_callback: (p: { status: string; loaded: number; total: number }) => void }) => {
        opts.progress_callback({ status: 'progress', loaded: 50, total: 100 })
        return Promise.resolve(makeMockTTS())
      })

      const tts = new LocalTTS()
      await tts.init()
    })

    it('throws tts-init-failed on error', async () => {
      mockFromPretrained.mockRejectedValue(new Error('ONNX error'))

      const tts = new LocalTTS()
      await expect(tts.init()).rejects.toMatchObject({
        code: 'tts-init-failed',
      })
    })
  })

  describe('speak', () => {
    it('throws when TTS is not initialized', async () => {
      const tts = new LocalTTS()
      await expect(tts.speak('hello')).rejects.toMatchObject({
        code: 'tts-speak-failed',
      })
    })

    it('generates audio and plays it', async () => {
      mockFromPretrained.mockResolvedValue(makeMockTTS())
      mockGenerate.mockResolvedValue({
        toWav: () => new ArrayBuffer(100),
      })

      const tts = new LocalTTS()
      await tts.init()
      await tts.speak('Hello world')

      expect(mockGenerate).toHaveBeenCalledWith('Hello world', {
        voice: 'af_heart',
        speed: 1.0,
      })
      expect(mockSourceConnect).toHaveBeenCalled()
      expect(mockSourceStart).toHaveBeenCalled()
    })

    it('stops previous playback before speaking', async () => {
      mockFromPretrained.mockResolvedValue(makeMockTTS())
      mockGenerate.mockResolvedValue({
        toWav: () => new ArrayBuffer(100),
      })

      const tts = new LocalTTS()
      await tts.init()
      await tts.speak('First')
      await tts.speak('Second')

      expect(mockGenerate).toHaveBeenCalledTimes(2)
    })

    it('throws tts-speak-failed on generate error', async () => {
      mockFromPretrained.mockResolvedValue(makeMockTTS())
      mockGenerate.mockRejectedValue(new Error('synthesis failed'))

      const tts = new LocalTTS()
      await tts.init()
      await expect(tts.speak('hello')).rejects.toMatchObject({
        code: 'tts-speak-failed',
      })
    })

    it('re-throws InferenceError as-is', async () => {
      mockFromPretrained.mockResolvedValue(makeMockTTS())
      const original = new InferenceError('tts-speak-failed', 'custom')
      mockGenerate.mockRejectedValue(original)

      const tts = new LocalTTS()
      await tts.init()
      await expect(tts.speak('hello')).rejects.toBe(original)
    })
  })

  describe('pause / resume', () => {
    it('does not throw when called before init', () => {
      const tts = new LocalTTS()
      expect(() => tts.pause()).not.toThrow()
      expect(() => tts.resume()).not.toThrow()
    })

    it('pauses and resumes playback', async () => {
      mockFromPretrained.mockResolvedValue(makeMockTTS())
      mockGenerate.mockResolvedValue({
        toWav: () => new ArrayBuffer(100),
      })

      const tts = new LocalTTS()
      await tts.init()
      await tts.speak('test')

      tts.pause()
      expect(mockSourceStop).toHaveBeenCalled()

      tts.resume()
      expect(mockSourceStart).toHaveBeenCalledTimes(2)
    })

    it('does nothing when pausing while already paused', async () => {
      mockFromPretrained.mockResolvedValue(makeMockTTS())
      mockGenerate.mockResolvedValue({
        toWav: () => new ArrayBuffer(100),
      })

      const tts = new LocalTTS()
      await tts.init()
      await tts.speak('test')

      tts.pause()
      const callCount = mockSourceStop.mock.calls.length
      tts.pause()
      expect(mockSourceStop).toHaveBeenCalledTimes(callCount)
    })
  })

  describe('stop', () => {
    it('does not throw when called before init', () => {
      const tts = new LocalTTS()
      expect(() => tts.stop()).not.toThrow()
    })

    it('stops active playback', async () => {
      mockFromPretrained.mockResolvedValue(makeMockTTS())
      mockGenerate.mockResolvedValue({
        toWav: () => new ArrayBuffer(100),
      })

      const tts = new LocalTTS()
      await tts.init()
      await tts.speak('test')

      tts.stop()
      expect(mockSourceStop).toHaveBeenCalled()
    })

    it('handles sourceNode.stop() throwing', async () => {
      mockFromPretrained.mockResolvedValue(makeMockTTS())
      mockGenerate.mockResolvedValue({
        toWav: () => new ArrayBuffer(100),
      })

      const tts = new LocalTTS()
      await tts.init()
      await tts.speak('test')

      mockSourceStop.mockImplementation(() => {
        throw new Error('Already stopped')
      })

      expect(() => tts.stop()).not.toThrow()
    })
  })

  describe('destroy', () => {
    it('does not throw when TTS is not initialized', async () => {
      const tts = new LocalTTS()
      await expect(tts.destroy()).resolves.toBeUndefined()
    })

    it('closes audio context and clears state', async () => {
      mockFromPretrained.mockResolvedValue(makeMockTTS())
      mockGenerate.mockResolvedValue({
        toWav: () => new ArrayBuffer(100),
      })

      const tts = new LocalTTS()
      await tts.init()
      await tts.speak('test')
      await tts.destroy()

      expect(mockClose).toHaveBeenCalled()
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
      const mockCache = { keys: vi.fn().mockResolvedValue([]) }
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
