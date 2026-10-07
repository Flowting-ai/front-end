import { useSyncExternalStore } from 'react'

// Platform detection for keyboard-shortcut labels (⌘ on Apple platforms,
// Ctrl everywhere else). Browser-only: on the server there is no navigator,
// so `isApplePlatform()` reports false there — render labels through
// `useModKeyLabel()`, never by calling `modKeyLabel()` during render, or the
// server and client markup disagree.

export type ModKeyLabel = '⌘' | 'Ctrl'

// What the server renders (and what hydration uses) before the real platform
// is known. ⌘ matches the labels this app shipped with; non-Apple clients
// swap to Ctrl right after hydration.
const SERVER_MOD_KEY_LABEL: ModKeyLabel = '⌘'

export function isApplePlatform(): boolean {
  if (typeof navigator === 'undefined') return false
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } }
  // `||` rather than `??`: UA-CH reports "" when it can't tell, which should
  // still fall back to the legacy navigator.platform.
  const platform = nav.userAgentData?.platform || nav.platform || ''
  // userAgentData: "macOS" / "iOS"; navigator.platform: "MacIntel" / "iPhone" / "iPad" / "iPod".
  return /^(mac|iphone|ipad|ipod|ios)/i.test(platform)
}

export function modKeyLabel(): ModKeyLabel {
  return isApplePlatform() ? '⌘' : 'Ctrl'
}

// The platform never changes for the life of the page — nothing to subscribe to.
const subscribe = () => () => {}

/** Hydration-safe modifier-key label: the server snapshot on the server and
 *  during hydration, then the real platform's label. */
export function useModKeyLabel(): ModKeyLabel {
  return useSyncExternalStore(subscribe, modKeyLabel, () => SERVER_MOD_KEY_LABEL)
}
