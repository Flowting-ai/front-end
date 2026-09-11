'use client'

import React, { Suspense, useEffect, useRef, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AnimatePresence, m } from 'framer-motion'
import { SearchOneIcon, PlusSignIcon, ArrowDownOneIcon, CancelCircleIcon, UserIcon, BubbleChatAddIcon, MoreVerticalIcon } from '@strange-huge/icons'
import { toast } from 'sonner'
import { useProjects } from '@/context/projects-context'
import { ProjectCard, VISIBILITY_LABEL, VISIBILITY_COLOR } from '@/components/ProjectCard'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/Button'
import { IconButton } from '@/components/IconButton'
import { InputField } from '@/components/InputField'
import { Dropdown } from '@/components/Dropdown'
import { Tooltip } from '@/components/Tooltip'
import { EditProjectModal } from '@/components/EditProjectModal'
import { LeaveProjectModal } from '@/components/LeaveProjectModal'
import { DeleteProjectModal } from '@/components/DeleteProjectModal'
import { ProjectTrashList } from '@/components/ProjectTrashModal/ProjectTrashList'
import type { Project } from '@/context/projects-context'
import { useOrg } from '@/context/org-context'
import { useAuth } from '@/context/auth-context'
import type { OrgMember } from '@/types/teams'
import type { ProjectVisibility } from '@/lib/api/projects'
import { PROJECT_ROUTE, PROJECTS_NEW_ROUTE, PROJECTS_ROUTE } from '@/lib/routes'

type SortKey = 'recent' | 'az' | 'za' | 'active'
// Same 3 values as ProjectVisibility, plus a 4th 'trash' tab that isn't a
// real visibility — it lists soft-deleted Workspace/Shared projects instead
// of filtering `projects` by visibility (see the render below).
type ScopeFilter = ProjectVisibility | 'trash'
const SCOPE_VALUES: readonly ScopeFilter[] = ['personal', 'workspace', 'shared', 'trash']
// Same label/color mapping ProjectCard/ProjectListRow already use for a
// project's own visibility Badge (VISIBILITY_LABEL/VISIBILITY_COLOR) — the
// filter reuses those directly and only adds the one extra 'trash' entry.
const SCOPE_LABEL: Record<ScopeFilter, string> = { ...VISIBILITY_LABEL, trash: 'Recently Deleted' }
// Same wording as the visibility picker on the New Project page (projects/new/page.tsx).
const SCOPE_DESCRIPTION: Record<ScopeFilter, string> = {
  personal:  'Just you.',
  workspace: 'Everyone in the workspace.',
  shared:    'You choose who to invite.',
  trash:     'Projects deleted in the last 30 days.',
}
// Legacy '?scope=team' links (bookmarks, the sidebar, anywhere else that
// hasn't been updated) map to 'workspace' — the closest equivalent now that
// Team is gone from the backend (see docs v1.5/sharing-model-v2-gap-audit.md's
// Cross-cutting Teams note).
function parseScope(raw: string | null): ScopeFilter {
  if (raw === 'team') return 'workspace'
  return (SCOPE_VALUES as readonly string[]).includes(raw ?? '') ? (raw as ScopeFilter) : 'personal'
}
type ViewMode = 'grid' | 'list'

// Gradient palette seeded by team name — shared with TeamChip/TeamSwitcherRow/
// TeamSwitcherDropdown/ProjectCard/etc via src/lib/team-gradients.ts, so a
// project's avatar is the same colour everywhere else it appears.

// ── Grid/List toggle — single secondary button + Dropdown, same "view filter"
// pattern as Pinboard's own view switcher (in-place label swap included). ──

const VIEW_LABELS: Record<ViewMode, string> = { grid: 'Grid', list: 'List' }
const VIEW_DESCRIPTION: Record<ViewMode, string> = {
  grid: 'Show projects as cards.',
  list: 'Show projects in a compact list.',
}

// Both accept `size` — DropdownMenuItem clones its `icon` prop with a fixed
// size (20) to fill the row's icon slot; without accepting it these stayed a
// hardcoded 16×16 inside that 20×20 slot, sitting off-center from the label.
function GridViewGlyph({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <rect x="2" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3" />
      <rect x="9" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3" />
      <rect x="2" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3" />
      <rect x="9" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  )
}

function ListViewGlyph({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <rect x="2" y="3"    width="12" height="2.2" rx="1.1" fill="currentColor" />
      <rect x="2" y="6.9"  width="12" height="2.2" rx="1.1" fill="currentColor" />
      <rect x="2" y="10.8" width="12" height="2.2" rx="1.1" fill="currentColor" />
    </svg>
  )
}

function ProjectViewToggle({ value, onChange }: { value: ViewMode; onChange: (v: ViewMode) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <Dropdown.Float
      open={open}
      onOpenChange={setOpen}
      placement="bottom-end"
      trigger={
        <Button variant="secondary" size="sm" rightIcon={<ArrowDownOneIcon size={16} />}>
          {/* In-place text swap — same pattern as Pinboard's view-filter trigger. */}
          <AnimatePresence mode="popLayout" initial={false}>
            <m.span
              key={value}
              initial={{ scale: 0.75, opacity: 0, filter: 'blur(4px)' }}
              animate={{ scale: 1,    opacity: 1, filter: 'blur(0px)' }}
              exit={{    scale: 0.75, opacity: 0, filter: 'blur(4px)' }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              style={{ display: 'block', transformOrigin: 'left center' }}
            >
              {VIEW_LABELS[value]}
            </m.span>
          </AnimatePresence>
        </Button>
      }
    >
      <Dropdown size="md" maxHeight={false}>
        <Dropdown.Section fluid>
          <Dropdown.Item
            label="Grid"
            subLabel={VIEW_DESCRIPTION.grid}
            icon={<GridViewGlyph />}
            selected={value === 'grid'}
            onClick={() => { onChange('grid'); setOpen(false) }}
            fluid
          />
          <Dropdown.Item
            label="List"
            subLabel={VIEW_DESCRIPTION.list}
            icon={<ListViewGlyph />}
            selected={value === 'list'}
            onClick={() => { onChange('list'); setOpen(false) }}
            fluid
          />
        </Dropdown.Section>
      </Dropdown>
    </Dropdown.Float>
  )
}

// ── Scope filter — Personal/Workspace/Shared/Recently Deleted as a Dropdown.Float
// instead of a Tabs bar, composed the same way AccountMenu wires its own
// Dropdown.Float + Dropdown.Section + Dropdown.Item (see AccountMenu/index.tsx).
// Trigger shows plain text (not a colored Badge/tag) — same convention as
// ProjectViewToggle's own Grid/List trigger just below. ──

function ScopeFilterDropdown({ value, onChange }: { value: ScopeFilter; onChange: (v: ScopeFilter) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <Dropdown.Float
      open={open}
      onOpenChange={setOpen}
      placement="bottom-start"
      trigger={
        <Button variant="secondary" size="sm" rightIcon={<ArrowDownOneIcon size={16} />}>
          {/* In-place text swap — same transition ProjectViewToggle's own
              trigger label uses. */}
          <AnimatePresence mode="popLayout" initial={false}>
            <m.span
              key={value}
              initial={{ scale: 0.75, opacity: 0, filter: 'blur(4px)' }}
              animate={{ scale: 1,    opacity: 1, filter: 'blur(0px)' }}
              exit={{    scale: 0.75, opacity: 0, filter: 'blur(4px)' }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              style={{ display: 'block', transformOrigin: 'left center' }}
            >
              {SCOPE_LABEL[value]}
            </m.span>
          </AnimatePresence>
        </Button>
      }
    >
      <Dropdown size="md" maxHeight={false}>
        <Dropdown.Section fluid>
          {SCOPE_VALUES.map(v => (
            <Dropdown.Item
              key={v}
              label={SCOPE_LABEL[v]}
              subLabel={SCOPE_DESCRIPTION[v]}
              selected={value === v}
              onClick={() => { onChange(v); setOpen(false) }}
              fluid
            />
          ))}
        </Dropdown.Section>
      </Dropdown>
    </Dropdown.Float>
  )
}

// ── Compact list-view row ────────────────────────────────────────────────────

function ProjectListRow({
  project, ownerName, memberCount, updatedAt, onClick, onEdit, onDelete, onLeave,
}: {
  project:      Project
  ownerName?:   string
  memberCount:  number
  updatedAt:    string
  onClick:      () => void
  onEdit?:      () => void
  onDelete?:    () => void
  onLeave?:     () => void
}) {
  const [hovered,  setHovered]  = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const hasActions = Boolean(onEdit || onDelete || onLeave)
  const showMenu   = hovered || menuOpen

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick() }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display:         'flex',
        alignItems:      'center',
        gap:             12,
        padding:         '10px 16px',
        borderRadius:    12,
        backgroundColor: hovered || menuOpen ? 'var(--neutral-50)' : 'var(--neutral-white)',
        boxShadow:       '0px 1px 1.5px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-100)',
        cursor:          'pointer',
        transition:      'background-color 120ms ease',
        width:           '100%',
        boxSizing:       'border-box',
      }}
    >
      {/* Visibility badge */}
      <Badge color={VISIBILITY_COLOR[project.visibility]} label={VISIBILITY_LABEL[project.visibility]} />

      {/* Title + meta */}
      <div style={{ flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span
          style={{
            fontFamily:   'var(--font-body)',
            fontWeight:   'var(--font-weight-medium)',
            fontSize:     14,
            lineHeight:   '20px',
            color:        'var(--neutral-900)',
            overflow:     'hidden',
            textOverflow: 'ellipsis',
            whiteSpace:   'nowrap',
          }}
        >
          {project.name}
        </span>
        <span
          style={{
            fontFamily:   'var(--font-body)',
            fontWeight:   400,
            fontSize:     11,
            lineHeight:   '16px',
            color:        'var(--neutral-500)',
            overflow:     'hidden',
            textOverflow: 'ellipsis',
            whiteSpace:   'nowrap',
          }}
        >
          {ownerName ? `Created by ${ownerName} · ` : ''}{updatedAt}
        </span>
      </div>

      {/* Stats — each count gets a fixed-width slot (not just min-width) so a
          1-, 2-, or 3-digit number never nudges either icon's position;
          tabular-nums keeps the digits themselves a constant width too. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0, color: 'var(--neutral-400)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <UserIcon size={18} />
          <span style={{ width: 22, fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: '20px', color: 'var(--neutral-500)', fontVariantNumeric: 'tabular-nums' }}>{memberCount}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <BubbleChatAddIcon size={18} />
          <span style={{ width: 22, fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: '20px', color: 'var(--neutral-500)', fontVariantNumeric: 'tabular-nums' }}>{project.chatCount}</span>
        </div>
      </div>

      {/* ⋮ menu slot - fixed 24×24 footprint always reserved (even when this
          row has no actions) so Stats' icons land at the same horizontal
          position on every row, regardless of hasActions. */}
      <div
        style={{ width: 24, height: 24, flexShrink: 0 }}
        onClick={hasActions ? (e) => e.stopPropagation() : undefined}
      >
        {hasActions && (
          <div style={{ opacity: showMenu ? 1 : 0, transition: 'opacity 120ms ease' }}>
            <Dropdown.Float
              open={menuOpen}
              onOpenChange={setMenuOpen}
              placement="bottom-end"
              trigger={
                <IconButton
                  variant="ghost"
                  size="xs"
                  icon={<MoreVerticalIcon size={16} triggered={showMenu} />}
                  aria-label="Project options"
                />
              }
            >
              <Dropdown size="md" maxHeight={false}>
                {onEdit && (
                  <Dropdown.Section fluid>
                    <Dropdown.Item label="Edit" onClick={() => { setMenuOpen(false); onEdit() }} fluid />
                  </Dropdown.Section>
                )}
                {onLeave && (
                  <Dropdown.Section fluid>
                    <Dropdown.Item label="Leave project" onClick={() => { setMenuOpen(false); onLeave() }} fluid />
                  </Dropdown.Section>
                )}
                {onDelete && (
                  <Dropdown.Section fluid>
                    <Dropdown.Item label="Delete" variant="danger" onClick={() => { setMenuOpen(false); onDelete() }} fluid />
                  </Dropdown.Section>
                )}
              </Dropdown>
            </Dropdown.Float>
          </div>
        )}
      </div>
    </div>
  )
}

function sortProjects(projects: Project[], key: SortKey): Project[] {
  const copy = [...projects]
  if (key === 'az')     return copy.sort((a, b) => a.name.localeCompare(b.name))
  if (key === 'za')     return copy.sort((a, b) => b.name.localeCompare(a.name))
  if (key === 'active') return copy.sort((a, b) => b.chatCount - a.chatCount)
  return copy.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
}

// A workspace/shared project's member count is its team's roster (everyone
// who can reach it); a personal project's is just its owner — there's no
// separate per-project membership list distinct from team membership.
// Gated on visibility, not teamId — an org member's own Personal project
// also carries the org's teamId, but has no roster of its own.
function projectMemberCount(project: Project, members: OrgMember[]): number {
  if (project.visibility === 'personal' || !project.teamId) return 1
  const count = members.filter(m => m.teamMemberships.some(tm => tm.teamId === project.teamId)).length
  return count || 1
}

function formatUpdated(iso: string) {
  const d    = new Date(iso)
  const now  = new Date()
  const diff = (now.getTime() - d.getTime()) / 1000
  if (diff < 60)         return 'Updated just now'
  if (diff < 3600)       return `Updated ${Math.floor(diff / 60)}m ago`
  if (diff < 86400)      return `Updated ${Math.floor(diff / 3600)}h ago`
  const days  = Math.floor(diff / 86400)
  if (diff < 86400 * 7)  return `Updated ${days} ${days === 1 ? 'day' : 'days'} ago`
  const weeks = Math.floor(diff / 86400 / 7)
  if (diff < 86400 * 30) return `Updated ${weeks} ${weeks === 1 ? 'week' : 'weeks'} ago`
  return 'Updated last month'
}

// ── Page ───────────────────────────────────────────────────────────────────────

function ProjectsPageInner() {
  const { push, replace }                                                     = useRouter()
  const searchParams                                                          = useSearchParams()
  const { projects, loading, updateProject, deleteProject, loadProjectChats, refreshProjects } = useProjects()
  const { orgId, members }                                                    = useOrg()
  const { user }                                                              = useAuth()
  const syncedRef = useRef(false)
  // Always plain — this page's own "New Project" button should default to
  // Private regardless of which team happens to be active in the workspace
  // switcher elsewhere. Only the team-scoped "New project" entry points
  // (inside a specific team's project list) pass ?teamId= to pre-select it.
  const newProjectHref = PROJECTS_NEW_ROUTE

  // Sync accurate chat counts once after the project list finishes loading.
  // Runs only on this page — not on every app boot — so the API is only hit
  // when the user actually views the projects listing.
  useEffect(() => {
    if (loading || projects.length === 0 || syncedRef.current) return
    syncedRef.current = true
    Promise.allSettled(projects.map(p => loadProjectChats(p.id)))
  }, [loading, projects, loadProjectChats])
  const [viewMode,       setViewMode]       = useState<ViewMode>('grid')
  const [query,          setQuery]          = useState('')
  const [searchOpen,     setSearchOpen]     = useState(false)
  const [sort,           setSort]           = useState<SortKey>('recent')
  const [sortOpen,       setSortOpen]       = useState(false)
  // Seeded from ?scope= (e.g. the sidebar's "Personal projects" link lands
  // here with scope=personal pre-applied). handleScopeChange below writes back
  // to ?scope= on every tab switch so the URL stays in sync, and the effect
  // further down re-syncs this state whenever the URL's ?scope= changes out
  // from under it (e.g. browser Back/Forward), so the visible tab never
  // drifts from the address bar.
  const [scopeFilter,    setScopeFilter]    = useState<ScopeFilter>(() => parseScope(searchParams.get('scope')))
  // Re-sync the tab any time the URL's ?scope= changes — including via
  // popstate (Back/Forward), not just the initial mount.
  useEffect(() => {
    const urlScope = parseScope(searchParams.get('scope'))
    setScopeFilter(prev => (prev === urlScope ? prev : urlScope))
  }, [searchParams])
  // Keep the URL's ?scope= in sync with the tab so the current scope survives
  // a reload/back-nav and links to this page can point at a specific tab.
  // replace (not push) — switching tabs shouldn't pile up history entries.
  function handleScopeChange(next: ScopeFilter) {
    setScopeFilter(next)
    const params = new URLSearchParams(searchParams.toString())
    params.set('scope', next)
    replace(`${PROJECTS_ROUTE}?${params.toString()}`, { scroll: false })
  }

  const [editTarget,     setEditTarget]     = useState<Project | null>(null)
  const [deleteTarget,   setDeleteTarget]   = useState<Project | null>(null)
  const [isDeleting,     setIsDeleting]     = useState(false)
  const [leaveTarget,    setLeaveTarget]    = useState<Project | null>(null)

  // Personal projects have no membership to leave (backend 400s). The owner
  // leaving would trigger the backend's real successor/archive/convert
  // logic, but there's no "transfer ownership" flow to pair with it yet, so
  // this stays frontend-only for now: only a non-owner collaborator on a
  // workspace/shared project can leave.
  function canLeaveProject(project: Project): boolean {
    return project.visibility !== 'personal' && !project.canEdit
  }

  // refreshProjects() itself has no built-in error handling (unlike the
  // bootstrap effect that originally owned this logic) — callers must catch.
  // A failure here just means the list looks stale until the next reload;
  // the leave/restore action itself already succeeded and already toasted.
  function handleRefreshProjects() {
    refreshProjects().catch(err => toast.error('Failed to refresh projects', { description: err instanceof Error ? err.message : undefined }))
  }

  // Editing content (title/description/tags) is broader than ownership — the
  // backend's update() uses requireWritable, which also passes for any
  // workspace member on a Workspace project (project.py). `project.canEdit`
  // itself stays ownership-only (it also gates Delete/leave's owner branch),
  // so this is a separate flag. NOT yet correct for a non-owner collaborator
  // on a Shared project — that needs the project's member list, which isn't
  // fetched eagerly here.
  function canEditProjectContent(project: Project): boolean {
    return project.canEdit || (project.visibility === 'workspace' && !!orgId && project.teamId === orgId)
  }

  // Owner-only — matches the backend exactly (requireDelete === requireOwned,
  // project.py). This used to also allow any org admin, but the backend
  // dropped that bypass; the stale client-side copy let a non-owner admin
  // click Delete only to have it 404 (invisibly, until deleteProjectApi's
  // own missing-response.ok bug was fixed — see projects.ts).
  function canDeleteProject(project: Project): boolean {
    return project.canEdit
  }

  // Every delete entry point confirms first — permanently deleting a
  // project's chats is never a single-click action anywhere in the app.
  function handleDelete(project: Project) {
    setDeleteTarget(project)
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return
    setIsDeleting(true)
    try {
      await deleteProject(deleteTarget.id)
      if (deleteTarget.chatCount > 0) {
        const chatWord = deleteTarget.chatCount === 1 ? 'chat' : 'chats'
        toast.success(`"${deleteTarget.name}" and ${deleteTarget.chatCount} ${chatWord} deleted`)
      } else {
        toast.success(`"${deleteTarget.name}" deleted`)
      }
      setDeleteTarget(null)
    } catch {
      // error toast shown by context
    } finally {
      setIsDeleting(false)
    }
  }

  // Standing 3-way split — independent of the scope tab below, so the
  // heading badges always summarize the whole list at a glance. Keyed off a
  // project's real visibility now, not the old teamId===null proxy.
  const personalCount  = useMemo(() => projects.filter(p => p.visibility === 'personal').length, [projects])
  const workspaceCount = useMemo(() => projects.filter(p => p.visibility === 'workspace').length, [projects])
  const sharedCount    = useMemo(() => projects.filter(p => p.visibility === 'shared').length, [projects])

  const scopedProjects = useMemo(() => {
    return projects.filter(p => p.visibility === scopeFilter)
  }, [projects, scopeFilter])

  // Split into two memos: sort doesn't re-run when query changes, filter doesn't
  // re-run when sort order changes.
  const sorted = useMemo(() => sortProjects(scopedProjects, sort), [scopedProjects, sort])

  const filtered = useMemo(() => {
    if (!query.trim()) return sorted
    const q = query.toLowerCase()
    return sorted.filter((p) => p.name.toLowerCase().includes(q))
  }, [sorted, query])

  const sortLabels: Record<SortKey, string> = {
    recent: 'Recent',
    az:     'A to Z',
    za:     'Z to A',
    active: 'Most active',
  }

  const sortDescriptions: Record<SortKey, string> = {
    recent: 'Most recently updated first.',
    az:     'Sort by name, A to Z.',
    za:     'Sort by name, Z to A.',
    active: 'Most chats first.',
  }

  const emptyLabel = scopeFilter === 'personal'
    ? 'No personal projects yet. Create your first one to get started.'
    : scopeFilter === 'workspace'
      ? 'No workspace projects yet.'
      : 'No shared projects yet.'

  return (
    <div
      className="kaya-scrollbar"
      style={{
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'center',
        width:          '100%',
        height:         '100%',
        overflowY:      'auto',
        overflowX:      'hidden',
        paddingTop:     35,
        paddingBottom:  40,
        boxSizing:      'border-box',
      }}
    >
      {/* Horizontal padding lives here, not on the scrolling element above —
          keeps the scrollbar flush with the container's edge. */}
      <div style={{ width: '100%', maxWidth: '884px', padding: '0 24px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '24px' }}>

        {/* Heading row */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0, flex: '1 1 0' }}>
              <h1
                style={{
                  fontFamily:  'var(--font-title)',
                  fontWeight:  'var(--font-weight-regular)',
                  fontSize:    '24px',
                  lineHeight:  '32px',
                  color:       '#1a1916',
                  margin:      0,
                }}
              >
                Projects
              </h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', alignSelf: 'flex-start' }}>
                <Badge label={`${personalCount} Personal ${personalCount === 1 ? 'Project' : 'Projects'}`} color="Neutral" />
                {orgId && (
                  <>
                    <span style={{ color: 'var(--neutral-300)', fontSize: 12 }}>|</span>
                    <Badge label={`${workspaceCount} Workspace ${workspaceCount === 1 ? 'Project' : 'Projects'}`} color="Neutral" />
                    <span style={{ color: 'var(--neutral-300)', fontSize: 12 }}>|</span>
                    <Badge label={`${sharedCount} Shared ${sharedCount === 1 ? 'Project' : 'Projects'}`} color="Neutral" />
                  </>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
              {/* New Project — hidden on the Recently Deleted tab, which has no create action */}
              {scopeFilter !== 'trash' && (
                <Button variant="default" leftIcon={<PlusSignIcon animated />} onClick={() => push(newProjectHref)}>
                  New Project
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Search + filter row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%' }}>
          {/* Personal / Workspace / Shared / Recently Deleted scope — anchored
              to the left. Workspace and Shared both require an org (matches
              the backend's own visibility rules), so the whole filter stays
              hidden for individual users, same as before. */}
          {orgId && (
            <ScopeFilterDropdown value={scopeFilter} onChange={handleScopeChange} />
          )}

          {/* Search + view + sort — grouped to the right; none of these apply
              to the Recently Deleted tab (nothing to search/sort/switch grid-list for). */}
          {scopeFilter !== 'trash' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0, marginLeft: 'auto' }}>
            {/* Search — same collapse-to-icon pattern as PinboardHeader's own
                search: ghost IconButton expands into an InputField in place. */}
            <Tooltip content="Search" disabled={searchOpen}>
              <div style={{ display: 'flex', alignItems: 'center', flex: searchOpen ? '1 0 0' : undefined, minWidth: 0, maxWidth: searchOpen ? 320 : undefined }}>
                <AnimatePresence initial={false} mode="popLayout">
                  {!searchOpen ? (
                    <m.span
                      key="search-btn"
                      layout
                      initial={{ opacity: 0, y: 4, filter: 'blur(4px)' }}
                      animate={{ opacity: 1, y: 0, filter: 'blur(0px)', transition: { type: 'spring', duration: 0.3, bounce: 0 } }}
                      exit={{ opacity: 0, scale: 0.25, filter: 'blur(4px)', transition: { type: 'spring', duration: 0.2, bounce: 0 } }}
                      style={{ display: 'inline-flex', flexShrink: 0 }}
                    >
                      <IconButton
                        variant="ghost"
                        size="sm"
                        icon={<SearchOneIcon size={20} />}
                        aria-label="Search projects"
                        onClick={() => setSearchOpen(true)}
                      />
                    </m.span>
                  ) : (
                    <m.div
                      key="search-input"
                      initial={{ opacity: 0, scale: 0.95, filter: 'blur(4px)' }}
                      animate={{ opacity: 1, scale: 1, filter: 'blur(0px)', transition: { type: 'spring', duration: 0.3, bounce: 0 } }}
                      exit={{ opacity: 0, scale: 0.95, filter: 'blur(4px)', transition: { duration: 0.15, ease: 'easeIn' } }}
                      style={{ flex: '1 0 0', minWidth: 0 }}
                    >
                      <InputField
                        label="Search projects"
                        showLabel={false}
                        leftIcon={<SearchOneIcon size={16} />}
                        rightIcon={
                          <span
                            role="button"
                            tabIndex={0}
                            aria-label="Close search"
                            onClick={() => { setSearchOpen(false); setQuery('') }}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { setSearchOpen(false); setQuery('') } }}
                            className="kds-icon-in-field"
                            style={{ display: 'inline-flex', cursor: 'pointer', lineHeight: 0 }}
                          >
                            <CancelCircleIcon size={16} />
                          </span>
                        }
                        placeholder="Search projects…"
                        value={query}
                        onChange={setQuery}
                        fluid
                        // eslint-disable-next-line jsx-a11y/no-autofocus -- focus moves into search on user-triggered open
                        autoFocus
                        aria-label="Search projects"
                      />
                    </m.div>
                  )}
                </AnimatePresence>
              </div>
            </Tooltip>

            {/* Grid/List view toggle */}
            <ProjectViewToggle value={viewMode} onChange={setViewMode} />

            {/* Sort dropdown */}
            <Dropdown.Float
              open={sortOpen}
              onOpenChange={setSortOpen}
              placement="bottom-end"
              trigger={
                <Button variant="secondary" size="sm" rightIcon={<ArrowDownOneIcon size={16} animated />}>
                  {sortLabels[sort]}
                </Button>
              }
            >
              <Dropdown maxHeight={false}>
                <Dropdown.Section>
                  {(['recent', 'az', 'za', 'active'] as SortKey[]).map((k) => (
                    <Dropdown.Item
                      key={k}
                      label={sortLabels[k]}
                      subLabel={sortDescriptions[k]}
                      selected={sort === k}
                      onClick={() => { setSort(k); setSortOpen(false) }}
                      fluid
                    />
                  ))}
                </Dropdown.Section>
              </Dropdown>
            </Dropdown.Float>
          </div>
          )}
        </div>

        {/* Recently Deleted tab — lists soft-deleted Workspace/Shared projects instead
            of filtering `projects` by visibility (personal projects hard-
            delete instantly and never show up here). */}
        {scopeFilter === 'trash' ? (
          user?.auth0Id && <ProjectTrashList currentUserId={user.auth0Id} onRestored={handleRefreshProjects} />
        ) : loading ? (
          <div
            style={{
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
              padding:        '64px 24px',
            }}
          >
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize:   '14px',
                color:      '#857a72',
              }}
            >
              Loading projects…
            </p>
          </div>
        ) : filtered.length === 0 ? (
          query.trim() ? (
            <p
              style={{
                fontFamily: 'var(--font-title)',
                fontWeight: 'var(--font-weight-regular)',
                fontSize:   '24px',
                lineHeight: '32px',
                color:      '#857a72',
                textAlign:  'center',
                margin:     '40px 0',
              }}
            >
              No projects matching &ldquo;{query}&rdquo;
            </p>
          ) : (
            <div
              style={{
                display:        'flex',
                flexDirection:  'column',
                alignItems:     'center',
                gap:            '16px',
                padding:        '64px 24px',
                borderRadius:   '16px',
                border:         '1px dashed var(--neutral-300)',
                background:     'var(--neutral-50)',
              }}
            >
              <p
                style={{
                  fontFamily:  'var(--font-title)',
                  fontWeight:  'var(--font-weight-regular)',
                  fontSize:    '24px',
                  lineHeight:  '32px',
                  color:       '#857a72',
                  textAlign:   'center',
                  margin:      0,
                }}
              >
                {emptyLabel}
              </p>
              <Button variant="default" leftIcon={<PlusSignIcon animated />} onClick={() => push(newProjectHref)}>
                New Project
              </Button>
            </div>
          )
        ) : viewMode === 'list' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
            {filtered.map((project) => (
              <ProjectListRow
                key={project.id}
                project={project}
                ownerName={members.find(m => m.id === project.ownerUserId)?.name}
                memberCount={projectMemberCount(project, members)}
                updatedAt={formatUpdated(project.updatedAt)}
                onClick={() => push(PROJECT_ROUTE(project.id))}
                onEdit={canEditProjectContent(project) ? () => setEditTarget(project) : undefined}
                onDelete={canDeleteProject(project) ? () => handleDelete(project) : undefined}
                onLeave={canLeaveProject(project) ? () => setLeaveTarget(project) : undefined}
              />
            ))}
          </div>
        ) : (
          <div
            style={{
              display:               'grid',
              gridTemplateColumns:   'repeat(2, 1fr)',
              gap:                   '24px',
              width:                 '100%',
            }}
          >
            {filtered.map((project) => (
              <ProjectCard
                key={project.id}
                title={project.name}
                description={project.description}
                tags={project.tags}
                visibility={project.visibility}
                ownerName={members.find(m => m.id === project.ownerUserId)?.name}
                memberCount={projectMemberCount(project, members)}
                updatedAt={formatUpdated(project.updatedAt)}
                chatCount={project.chatCount}
                onClick={() => push(PROJECT_ROUTE(project.id))}
                onEdit={canEditProjectContent(project) ? () => setEditTarget(project) : undefined}
                onDelete={canDeleteProject(project) ? () => handleDelete(project) : undefined}
                onLeave={canLeaveProject(project) ? () => setLeaveTarget(project) : undefined}
              />
            ))}
          </div>
        )}
      </div>

      {/* Edit modal */}
      <EditProjectModal
        open={!!editTarget}
        name={editTarget?.name ?? ''}
        description={editTarget?.description ?? ''}
        tags={editTarget?.tags ?? []}
        onSave={(name, description, tags) => {
          if (editTarget) updateProject(editTarget.id, { name, description, tags })
        }}
        onClose={() => setEditTarget(null)}
      />

      {/* Delete confirmation modal — every delete entry point routes through
          this, never a direct call to deleteProject(). */}
      <DeleteProjectModal
        open={!!deleteTarget}
        projectName={deleteTarget?.name ?? ''}
        chatCount={deleteTarget?.chatCount ?? 0}
        loading={isDeleting}
        onConfirm={handleDeleteConfirm}
        onClose={() => setDeleteTarget(null)}
      />

      {leaveTarget && user?.auth0Id && (
        <LeaveProjectModal
          projectId={leaveTarget.id}
          isOwner={leaveTarget.canEdit}
          currentUserId={user.auth0Id}
          onClose={() => setLeaveTarget(null)}
          // leaveProjectApi already changed server state (member removed, or
          // ownership/visibility changed) — refreshProjects() just re-fetches
          // to reflect that. Must NOT call deleteProject here — that hits the
          // real DELETE endpoint, an entirely different (and destructive)
          // action from leaving.
          onLeft={handleRefreshProjects}
        />
      )}
    </div>
  )
}

export default function ProjectsPage() {
  return (
    <Suspense fallback={null}>
      <ProjectsPageInner />
    </Suspense>
  )
}
