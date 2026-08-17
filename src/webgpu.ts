import type { GPUCapabilities, VRAMEstimate } from './types.js'

/**
 * Synchronous check for WebGPU API availability.
 * Does not request an adapter — only tests for the presence of `navigator.gpu`.
 */
export function isWebGPUAvailable(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.gpu !== 'undefined'
  )
}

/**
 * Heuristic VRAM estimate based on `maxBufferSize`.
 *
 * - **low:** < 256 MB — integrated GPUs, older mobile
 * - **medium:** 256 MB – 1 GB — mid-range discrete, modern integrated
 * - **high:** > 1 GB — discrete desktop GPUs
 */
export function estimateVRAM(maxBufferSize: number): VRAMEstimate {
  const MB = 1024 * 1024
  if (maxBufferSize < 256 * MB) return 'low'
  if (maxBufferSize <= 1024 * MB) return 'medium'
  return 'high'
}

/**
 * Request a WebGPU adapter and extract capability limits.
 * Returns `null` when WebGPU is unavailable or the adapter request fails.
 */
export async function getGPUCapabilities(): Promise<GPUCapabilities | null> {
  if (!isWebGPUAvailable()) return null

  try {
    const adapter = await navigator.gpu.requestAdapter()
    if (!adapter) return null

    const info = adapter.info
    const adapterName = info?.device
      || info?.description
      || 'unknown'

    const maxBufferSize = adapter.limits.maxBufferSize
    const maxComputeWorkgroupSize =
      adapter.limits.maxComputeInvocationsPerWorkgroup

    return {
      adapter: adapterName,
      maxBufferSize,
      maxComputeWorkgroupSize,
      estimatedVRAM: estimateVRAM(maxBufferSize),
    }
  } catch {
    return null
  }
}
