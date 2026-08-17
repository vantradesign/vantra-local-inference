/** Capability tier derived from adapter limits. */
export type VRAMEstimate = 'low' | 'medium' | 'high'

/** WebGPU adapter capabilities relevant to model loading decisions. */
export interface GPUCapabilities {
  adapter: string
  maxBufferSize: number
  maxComputeWorkgroupSize: number
  estimatedVRAM: VRAMEstimate
}

/** Progress report for model downloads and initialization. */
export interface ModelProgress {
  phase: 'download' | 'initialize'
  loaded: number
  total: number
  percentage: number
}

/** Structured error codes for inference failures. */
export type InferenceErrorCode =
  | 'webgpu-unavailable'
  | 'model-download-failed'
  | 'model-load-failed'
  | 'inference-failed'
  | 'out-of-memory'
  | 'tts-init-failed'
  | 'tts-speak-failed'

/** Structured error thrown by inference operations. */
export class InferenceError extends Error {
  readonly code: InferenceErrorCode
  override readonly cause: unknown

  constructor(code: InferenceErrorCode, message: string, cause?: unknown) {
    super(message)
    this.name = 'InferenceError'
    this.code = code
    this.cause = cause
  }
}

/** Configuration for the LLM engine. */
export interface EngineConfig {
  model?: string
  onProgress?: (progress: ModelProgress) => void
}

/** Configuration for TTS. */
export interface TTSConfig {
  voice?: string
  rate?: number
  onProgress?: (progress: ModelProgress) => void
}
