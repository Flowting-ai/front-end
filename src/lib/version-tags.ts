/**
 * Lightweight localStorage store for persona version change tags.
 * Tags are client-only metadata (not persisted to the backend).
 *
 * Storage key: "persona_version_tags"
 * Shape: { [versionId: string]: string[] }
 */

const STORAGE_KEY = 'persona_version_tags'

function readAll(): Record<string, string[]> {
  if (typeof window === 'undefined') return {}
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Record<string, string[]>
  } catch { return {} }
}

export function getVersionTags(versionId: string): string[] {
  return readAll()[versionId] ?? []
}

export function setVersionTags(versionId: string, tags: string[]): void {
  if (typeof window === 'undefined') return
  try {
    const all = readAll()
    if (tags.length === 0) {
      delete all[versionId]
    } else {
      all[versionId] = tags
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
  } catch { /* ignore quota errors */ }
}

export function getAllVersionTags(): Record<string, string[]> {
  return readAll()
}
