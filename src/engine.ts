import type { MLCEngine } from '@mlc-ai/web-llm'
import type { EngineConfig, GenerateOptions, ModelProgress } from './types.js'
import { InferenceError } from './types.js'
import { isWebGPUAvailable } from './webgpu.js'
import { normalizeProgress } from './progress.js'

const DEFAULT_MODEL = 'Llama-3.2-1B-Instruct-q4f32_1-MLC'
const WEBLLM_CACHE_NAME = 'webllm/model'

/**
 * Wrapper around WebLLM's `MLCEngine` providing a simplified,
 * cancel-safe interface for local LLM inference.
 *
 * WebLLM is imported dynamically so the package tree-shakes
 * when only WebGPU detection is needed.
 */
export class LocalLLMEngine {
  private readonly model: string
  private readonly onProgress?: (progress: ModelProgress) => void
  private engine: MLCEngine | null = null
  private abortController: AbortController | null = null

  constructor(config?: EngineConfig) {
    this.model = config?.model ?? DEFAULT_MODEL
    this.onProgress = config?.onProgress
  }

  /**
   * Initialize the engine: check WebGPU, load the model.
   * Reports progress via the `onProgress` callback.
   */
  async init(): Promise<void> {
    if (!isWebGPUAvailable()) {
      throw new InferenceError(
        'webgpu-unavailable',
        'WebGPU is not available in this browser.',
      )
    }

    try {
      const { CreateMLCEngine } = await import('@mlc-ai/web-llm')

      this.engine = await CreateMLCEngine(this.model, {
        initProgressCallback: (report) => {
          if (!this.onProgress) return
          const progress = normalizeProgress(
            'download',
            report.progress ?? 0,
            1,
          )
          this.onProgress(progress)
        },
      })
    } catch (error) {
      if (error instanceof InferenceError) throw error

      const message = error instanceof Error ? error.message : String(error)
      const isOOM =
        message.includes('out of memory') ||
        message.includes('OOM') ||
        message.includes('allocation failed')

      throw new InferenceError(
        isOOM ? 'out-of-memory' : 'model-load-failed',
        `Failed to load model "${this.model}": ${message}`,
        error,
      )
    }
  }

  /**
   * Generate a response as an async stream of token strings.
   */
  async *generate(
    prompt: string,
    systemPrompt?: string,
    options?: GenerateOptions,
  ): AsyncGenerator<string> {
    if (!this.engine) {
      throw new InferenceError(
        'inference-failed',
        'Engine not initialized. Call init() first.',
      )
    }

    this.abortController = new AbortController()

    const messages: Array<{ role: 'system' | 'user'; content: string }> = []
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt })
    }
    messages.push({ role: 'user', content: prompt })

    try {
      const stream = await this.engine.chat.completions.create({
        messages,
        stream: true,
        ...(options?.maxTokens != null && { max_tokens: options.maxTokens }),
        ...(options?.temperature != null && { temperature: options.temperature }),
      })

      for await (const chunk of stream) {
        if (this.abortController.signal.aborted) break

        const delta = chunk.choices[0]?.delta?.content
        if (delta) yield delta
      }
    } catch (error) {
      if (this.abortController.signal.aborted) return

      throw new InferenceError(
        'inference-failed',
        `Inference failed: ${error instanceof Error ? error.message : String(error)}`,
        error,
      )
    } finally {
      this.abortController = null
    }
  }

  /** Cancel an in-flight generation. */
  abort(): void {
    this.abortController?.abort()
  }

  /** Release the engine and free GPU resources. */
  async destroy(): Promise<void> {
    this.abort()
    if (this.engine) {
      await this.engine.unload()
      this.engine = null
    }
  }

  /**
   * Check whether a model is already cached in the browser.
   * Uses the Cache API name that WebLLM stores models under.
   */
  static async isCached(model?: string): Promise<boolean> {
    const modelId = model ?? DEFAULT_MODEL
    if (typeof caches === 'undefined') return false

    try {
      const cache = await caches.open(WEBLLM_CACHE_NAME)
      const keys = await cache.keys()
      return keys.some((req) => req.url.includes(modelId))
    } catch {
      return false
    }
  }
}
