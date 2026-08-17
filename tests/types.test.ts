import { describe, it, expect } from 'vitest'
import { InferenceError } from '../src/types.js'

describe('InferenceError', () => {
  it('sets name, code, message, and cause', () => {
    const cause = new Error('original')
    const err = new InferenceError('webgpu-unavailable', 'WebGPU missing', cause)

    expect(err).toBeInstanceOf(Error)
    expect(err).toBeInstanceOf(InferenceError)
    expect(err.name).toBe('InferenceError')
    expect(err.code).toBe('webgpu-unavailable')
    expect(err.message).toBe('WebGPU missing')
    expect(err.cause).toBe(cause)
  })

  it('works without a cause', () => {
    const err = new InferenceError('out-of-memory', 'OOM')
    expect(err.code).toBe('out-of-memory')
    expect(err.cause).toBeUndefined()
  })

  it('exposes all error codes as valid types', () => {
    const codes = [
      'webgpu-unavailable',
      'model-download-failed',
      'model-load-failed',
      'inference-failed',
      'out-of-memory',
      'tts-init-failed',
      'tts-speak-failed',
    ] as const

    for (const code of codes) {
      const err = new InferenceError(code, `test: ${code}`)
      expect(err.code).toBe(code)
    }
  })
})
