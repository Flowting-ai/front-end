import { useSyncExternalStore } from 'react'
import { AVATAR_CHOICES, type AvatarChoice } from '@/components/PersonaCard/AnimatedPersonaAvatar'

// Which animated avatar an agent uses. The backend only stores an uploaded image for an
// agent, not an avatar style, so the pick is kept in this browser (localStorage, by agent
// repo id) and read by every surface that draws the agent's avatar. It does not follow the
// user to another device until the backend has somewhere to keep it.

const PREFIX = 'souvenir:avatar-choice:'
const EVENT = 'souvenir:avatar-choice'
const VALID = new Set<string>(AVATAR_CHOICES.map(choice => choice.id))

export function getStoredAvatarChoice(repoId: string | null | undefined): AvatarChoice | null {
  if (!repoId || typeof window === 'undefined') return null
  try {
    const value = window.localStorage.getItem(PREFIX + repoId)
    return value && VALID.has(value) ? (value as AvatarChoice) : null
  } catch { return null }
}

export function setStoredAvatarChoice(repoId: string, choice: AvatarChoice): void {
  if (typeof window === 'undefined') return
  try { window.localStorage.setItem(PREFIX + repoId, choice) } catch { /* private mode: the pick just won't persist */ }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: repoId }))
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange)
  window.addEventListener('storage', onChange)
  return () => { window.removeEventListener(EVENT, onChange); window.removeEventListener('storage', onChange) }
}

/** The agent's picked avatar, or null when it has none (callers fall back to the name-based default). */
export function useStoredAvatarChoice(repoId: string | null | undefined): AvatarChoice | null {
  return useSyncExternalStore(
    subscribe,
    () => getStoredAvatarChoice(repoId),
    () => null,
  )
}
