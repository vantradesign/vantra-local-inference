import type { ModelProgress } from './types.js'

/**
 * Normalize a raw progress report into a `ModelProgress` value.
 * Clamps `percentage` to [0, 100] and ensures `loaded` never exceeds `total`.
 */
export function normalizeProgress(
  phase: ModelProgress['phase'],
  loaded: number,
  total: number,
): ModelProgress {
  const safeTotal = Math.max(total, 0)
  const safeLoaded = Math.max(0, Math.min(loaded, safeTotal))
  const percentage =
    safeTotal === 0 ? 0 : Math.min(100, Math.round((safeLoaded / safeTotal) * 100))

  return { phase, loaded: safeLoaded, total: safeTotal, percentage }
}
