/**
 * Check whether the Cache API is available in the current environment.
 */
export function isCacheAPIAvailable(): boolean {
  return typeof caches !== 'undefined'
}

/**
 * Check whether a specific cache entry exists.
 * Returns `false` when the Cache API is unavailable.
 */
export async function hasCacheEntry(
  cacheName: string,
  url: string,
): Promise<boolean> {
  if (!isCacheAPIAvailable()) return false

  try {
    const cache = await caches.open(cacheName)
    const match = await cache.match(url)
    return match !== undefined
  } catch {
    return false
  }
}

/**
 * Delete an entire cache bucket by name.
 * Returns `true` if the cache existed and was deleted, `false` otherwise.
 */
export async function deleteCache(cacheName: string): Promise<boolean> {
  if (!isCacheAPIAvailable()) return false

  try {
    return await caches.delete(cacheName)
  } catch {
    return false
  }
}
