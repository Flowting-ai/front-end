import { VISIBILITY_LABEL } from '@/components/ProjectCard'
import type { ProjectVisibility } from '@/lib/api/projects'

// ── Sort ─────────────────────────────────────────────────────────────────────

export type SortKey = 'recent' | 'az' | 'za' | 'active'
export const SORT_VALUES: readonly SortKey[] = ['recent', 'az', 'za', 'active']

export function parseSort(raw: string | null): SortKey {
  return (SORT_VALUES as readonly string[]).includes(raw ?? '') ? (raw as SortKey) : 'recent'
}

export const SORT_LABELS: Record<SortKey, string> = {
  recent: 'Recent',
  az:     'A to Z',
  za:     'Z to A',
  active: 'Most active',
}

export const SORT_DESCRIPTIONS: Record<SortKey, string> = {
  recent: 'Most recently updated first.',
  az:     'Sort by name, A to Z.',
  za:     'Sort by name, Z to A.',
  active: 'Most chats first.',
}

// ── Scope ────────────────────────────────────────────────────────────────────

// 'all' isn't a real visibility either — it skips the visibility filter
// entirely (see scopedProjects in projects/page.tsx) — plus the 3
// ProjectVisibility values, plus a 'trash' tab that isn't a real visibility —
// it lists soft-deleted Workspace/Shared projects instead of filtering
// `projects` by visibility (see that page's render).
export type ScopeFilter = 'all' | ProjectVisibility | 'trash'
export const SCOPE_VALUES: readonly ScopeFilter[] = ['all', 'personal', 'workspace', 'shared', 'trash']

// Same label mapping ProjectCard/ProjectListRow already use for a project's
// own visibility Badge (VISIBILITY_LABEL) — the filter reuses it directly and
// only adds the 'all' and 'trash' entries.
export const SCOPE_LABEL: Record<ScopeFilter, string> = { all: 'All Projects', ...VISIBILITY_LABEL, trash: 'Recently Deleted' }

// Same wording as the visibility picker on the New Project page (projects/new/page.tsx).
export const SCOPE_DESCRIPTION: Record<ScopeFilter, string> = {
  all:       'Everything you can see.',
  personal:  'Just you.',
  workspace: 'Everyone in the workspace.',
  shared:    'You choose who to invite.',
  trash:     'Projects deleted in the last 30 days.',
}

// Legacy '?scope=team' links (bookmarks, the sidebar, anywhere else that
// hasn't been updated) map to 'workspace' — the closest equivalent now that
// Team is gone from the backend (see docs v1.5/sharing-model-v2-gap-audit.md's
// Cross-cutting Teams note).
export function parseScope(raw: string | null): ScopeFilter {
  if (raw === 'team') return 'workspace'
  return (SCOPE_VALUES as readonly string[]).includes(raw ?? '') ? (raw as ScopeFilter) : 'personal'
}

// ── View mode ────────────────────────────────────────────────────────────────

export type ViewMode = 'grid' | 'list'

export function parseViewMode(raw: string | null): ViewMode {
  return raw === 'list' ? 'list' : 'grid'
}

export const VIEW_LABELS: Record<ViewMode, string> = { grid: 'Grid', list: 'List' }
export const VIEW_DESCRIPTION: Record<ViewMode, string> = {
  grid: 'Show projects as cards.',
  list: 'Show projects in a compact list.',
}
