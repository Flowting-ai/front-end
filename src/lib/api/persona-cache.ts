export const PERSONAS_LIST_UPDATED_EVENT = 'persona:list-updated'

export const PERSONAS_CACHE_TTL = 30_000

const invalidationListeners = new Set<() => void>()

/** Register a cache to be cleared whenever personas change. Returns an unsubscribe. */
export function onPersonasInvalidated(listener: () => void): () => void {
  invalidationListeners.add(listener)
  return () => invalidationListeners.delete(listener)
}

/** Clear every persona-derived cache and tell subscribed components to refetch. */
export function bustPersonasCache(): void {
  for (const listener of invalidationListeners) listener()
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(PERSONAS_LIST_UPDATED_EVENT))
  }
}
