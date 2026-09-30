// Default-value constants for Pinboard, split out of index.tsx.
// Keeping non-component value exports out of a file that also exports a
// React component is what Fast Refresh needs to safely hot-reload the
// component on edit — a file mixing the two (as index.tsx used to) forces a
// full remount instead. Types are still fine to colocate (they're erased at
// compile time and don't affect Fast Refresh), but every `const` export below
// used to live in index.tsx itself.
import type { PinboardExpandedFolder } from '@/components/PinboardExpanded'

// ── Types ─────────────────────────────────────────────────────────────────────

/**
 * Item in the Pinboard view-filter dropdown (Figma 3139:36399).
 * Selecting a view tells the consumer which pins to display - the Pinboard
 * itself does not filter; it just owns the dropdown UI + selected-id state
 * and emits `onViewChange` so the consumer can swap `pins`.
 */
export interface PinboardView {
  /** Stable identifier - used for selected-state matching. */
  id:    string
  /** Row label (also shown on the trigger when this view is active). */
  label: string
}

/** Single row in the Sort dropdown (Figma 3442:23366). */
export interface PinboardSortOption {
  id:    string
  label: string
}

// ── Defaults ──────────────────────────────────────────────────────────────────

/**
 * Default view set: All pins, Current chat pins. Append
 * user folders to this list when constructing the consumer's `views` prop.
 */
export const DEFAULT_PINBOARD_VIEWS: PinboardView[] = [
  { id: 'all',          label: 'All pins'          },
  { id: 'current-chat', label: 'Current chat' },
]

/**
 * Default personal-folder set for the view-filter dropdown's "Your folders"
 * section. Empty by default — the consumer supplies real folders fetched from
 * the API. The section auto-hides when the array is empty.
 */
export const DEFAULT_PINBOARD_PERSONAL_FOLDERS: PinboardExpandedFolder[] = []

/**
 * Default project-folder set. Empty by default — the consumer derives these
 * from the user's projects. The section auto-hides when the array is empty.
 */
export const DEFAULT_PINBOARD_PROJECT_FOLDERS: PinboardExpandedFolder[] = []

export const DEFAULT_PINBOARD_SORT_OPTIONS: PinboardSortOption[] = [
  { id: 'newest',               label: 'Newest'   },
  { id: 'oldest',               label: 'Oldest'   },
  { id: 'most-used',            label: 'Most used' },
  { id: 'alphabetical',         label: 'A to Z'   },
  { id: 'reverse-alphabetical', label: 'Z to A'   },
]
