import type { LibraryFile } from '@/lib/library/file'

/**
 * The next picked list after a click on `file`. Decided from `current` (the updater's state), never the
 * render closure, so two quick toggles in one frame cannot add the same file twice. With `max`, a new
 * pick past the limit is ignored; unpicking always works.
 */
export function togglePick(current: LibraryFile[], file: LibraryFile, single = false, max?: number): LibraryFile[] {
  const has = current.some((entry) => entry.id === file.id)
  if (single) return has ? [] : [file]
  if (has) return current.filter((entry) => entry.id !== file.id)
  if (max !== undefined && current.length >= max) return current
  return [...current, file]
}
