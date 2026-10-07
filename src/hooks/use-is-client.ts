import { useSyncExternalStore } from 'react'

const subscribe = () => () => {}

/**
 * False on the server and during hydration, true afterwards. Gate anything read from
 * browser-only storage (sessionStorage, localStorage) on it, so the first client render
 * matches the server's HTML.
 */
export function useIsClient(): boolean {
  return useSyncExternalStore(subscribe, () => true, () => false)
}
