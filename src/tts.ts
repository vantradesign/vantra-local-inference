import type { KokoroTTS, GenerateOptions } from 'kokoro-js'
import type { TTSConfig, ModelProgress } from './types.js'
import { InferenceError } from './types.js'
import { normalizeProgress } from './progress.js'

const DEFAULT_VOICE = 'af_heart'
const DEFAULT_RATE = 1.0

/**
 * Wrapper around kokoro-js providing a simplified interface for
 * local text-to-speech. Dynamically imports kokoro-js so the
 * package tree-shakes when TTS is not needed.
 */
export class LocalTTS {
  private readonly voice: string
  private readonly rate: number
  private readonly onProgress?: (progress: ModelProgress) => void

  private tts: KokoroTTS | null = null
  private audioContext: AudioContext | null = null
  private sourceNode: AudioBufferSourceNode | null = null
  private isPaused = false
  private pauseTime = 0
  private startOffset = 0
  private currentBuffer: AudioBuffer | null = null

  constructor(config?: TTSConfig) {
    this.voice = config?.voice ?? DEFAULT_VOICE
    this.rate = config?.rate ?? DEFAULT_RATE
    this.onProgress = config?.onProgress
  }

  /**
   * Initialize the TTS engine: download and load the model.
   */
  async init(): Promise<void> {
    try {
      const { KokoroTTS } = await import('kokoro-js')

      this.tts = await KokoroTTS.from_pretrained(
        'onnx-community/Kokoro-82M-v1.0-ONNX',
        {
          dtype: 'q8',
          device: 'webgpu',
          progress_callback: (progress: { status: string; loaded?: number; total?: number }) => {
            if (!this.onProgress) return
            if (progress.status === 'progress') {
              this.onProgress(
                normalizeProgress('download', progress.loaded ?? 0, progress.total ?? 0),
              )
            }
          },
        },
      )
    } catch (error) {
      throw new InferenceError(
        'tts-init-failed',
        `Failed to initialize TTS: ${error instanceof Error ? error.message : String(error)}`,
        error,
      )
    }
  }

  /**
   * Synthesize and play speech for the given text.
   */
  async speak(text: string): Promise<void> {
    if (!this.tts) {
      throw new InferenceError(
        'tts-speak-failed',
        'TTS not initialized. Call init() first.',
      )
    }

    this.stop()

    try {
      const result = await this.tts.generate(text, {
        voice: this.voice as GenerateOptions['voice'],
        speed: this.rate,
      })

      this.audioContext = new AudioContext()
      const wavBuffer = result.toWav()

      this.currentBuffer = await this.audioContext.decodeAudioData(wavBuffer)
      this.startOffset = 0
      this.isPaused = false
      this.playFromOffset(this.startOffset)
    } catch (error) {
      if (error instanceof InferenceError) throw error

      throw new InferenceError(
        'tts-speak-failed',
        `TTS synthesis failed: ${error instanceof Error ? error.message : String(error)}`,
        error,
      )
    }
  }

  /** Pause playback. */
  pause(): void {
    if (!this.audioContext || !this.sourceNode || this.isPaused) return

    this.isPaused = true
    this.pauseTime = this.audioContext.currentTime
    this.sourceNode.stop()
    this.sourceNode = null
    this.startOffset += this.pauseTime - (this.startOffset > 0 ? 0 : 0)
  }

  /** Resume playback from where it was paused. */
  resume(): void {
    if (!this.isPaused || !this.currentBuffer || !this.audioContext) return

    this.isPaused = false
    this.playFromOffset(this.startOffset)
  }

  /** Stop playback entirely. */
  stop(): void {
    if (this.sourceNode) {
      try {
        this.sourceNode.stop()
      } catch {
        // Already stopped — safe to ignore
      }
      this.sourceNode = null
    }
    this.isPaused = false
    this.pauseTime = 0
    this.startOffset = 0
    this.currentBuffer = null
  }

  /** Release the TTS engine and audio context. */
  async destroy(): Promise<void> {
    this.stop()
    if (this.audioContext) {
      await this.audioContext.close()
      this.audioContext = null
    }
    this.tts = null
  }

  /**
   * Check whether the Kokoro TTS model is cached.
   */
  static async isCached(): Promise<boolean> {
    if (typeof caches === 'undefined') return false

    try {
      const cache = await caches.open('kokoro-tts')
      const keys = await cache.keys()
      return keys.length > 0
    } catch {
      return false
    }
  }

  private playFromOffset(offset: number): void {
    if (!this.audioContext || !this.currentBuffer) return

    this.sourceNode = this.audioContext.createBufferSource()
    this.sourceNode.buffer = this.currentBuffer
    this.sourceNode.connect(this.audioContext.destination)
    this.sourceNode.start(0, offset)
  }
}
