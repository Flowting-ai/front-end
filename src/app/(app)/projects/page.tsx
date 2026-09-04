'use client'

import React, { Suspense, useEffect, useRef, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter, useSearchParams } from 'next/navigation'
import { AnimatePresence, m } from 'framer-motion'
import { SearchOneIcon, PlusSignIcon, ArrowDownOneIcon, CancelOneIcon, CancelCircleIcon, AlertCircleIcon, UserIcon, BubbleChatAddIcon, MoreVerticalIcon } from '@strange-huge/icons'
import { toast } from 'sonner'
import { useProjects } from '@/context/projects-context'
import { ProjectCard } from '@/components/ProjectCard'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/Button'
import { IconButton } from '@/components/IconButton'
import { InputField } from '@/components/InputField'
import { Dropdown } from '@/components/Dropdown'
import { Tooltip } from '@/components/Tooltip'
import Tabs from '@/components/Tabs'
import { EditProjectModal } from '@/components/EditProjectModal'
import { LeaveProjectModal } from '@/components/LeaveProjectModal'
import { ProjectTrashModal } from '@/components/ProjectTrashModal'
import { useMounted } from '@/hooks/use-mounted'
import type { Project } from '@/context/projects-context'
import { useOrg } from '@/context/org-context'
import { useAuth } from '@/context/auth-context'
import type { OrgMember } from '@/types/teams'
import type { ProjectVisibility } from '@/lib/api/projects'
import { PROJECT_ROUTE, PROJECTS_NEW_ROUTE, PROJECTS_ROUTE } from '@/lib/routes'
import { getGradient } from '@/lib/team-gradients'

type SortKey = 'recent' | 'alphabetical' | 'active'
// Same 3 values as ProjectVisibility — the list's scope tab is keyed directly
// off a project's real visibility now, not the old binary teamId===null check.
type ScopeFilter = ProjectVisibility
const SCOPE_VALUES: readonly ScopeFilter[] = ['personal', 'workspace', 'shared']
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
      <Dropdown size="md">
        <Dropdown.Section fluid>
          <Dropdown.Item
            label="Grid"
            icon={<GridViewGlyph />}
            selected={value === 'grid'}
            onClick={() => { onChange('grid'); setOpen(false) }}
            fluid
          />
          <Dropdown.Item
            label="List"
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

// ── Compact list-view row ────────────────────────────────────────────────────

function ProjectListRow({
  project, teamName, ownerName, memberCount, updatedAt, onClick, onEdit, onDelete, onLeave,
}: {
  project:      Project
  teamName?:    string
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
  const scopeLabel = teamName ?? 'Personal'

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
      {/* Scope avatar */}
      <span
        aria-hidden
        style={{
          display:         'inline-flex',
          alignItems:      'center',
          justifyContent:  'center',
          width:           'calc(var(--line-height-body) + var(--line-height-caption))',
          height:          'calc(var(--line-height-body) + var(--line-height-caption))',
          borderRadius:    '3px',
          background:      getGradient(scopeLabel),
          flexShrink:      0,
          fontFamily:      'var(--font-title)',
          fontWeight:      500,
          fontSize:        '16px',
          color:           'var(--neutral-white)',
          lineHeight:      1,
          boxShadow:       'inset 0px 4px 4px rgba(0,0,0,0.25), inset 0px -1px 0.4px rgba(18,60,95,0.65)',
          userSelect:      'none',
        }}
      >
        {scopeLabel.charAt(0).toUpperCase()}
      </span>

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
          {scopeLabel}{ownerName ? ` · Created by ${ownerName}` : ''} · {updatedAt}
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
              <Dropdown size="md">
                {onEdit && (
                  <Dropdown.Section fluid>
                    <Dropdown.Item label="Edit" onClick={() => { setMenuOpen(false); onEdit() }} fluid />
                  </Dropdown.Section>
                )}
                {onLeave && (
                  <Dropdown.Section divider={!!onEdit} fluid>
                    <Dropdown.Item label="Leave project" onClick={() => { setMenuOpen(false); onLeave() }} fluid />
                  </Dropdown.Section>
                )}
                {onDelete && (
                  <Dropdown.Section divider fluid>
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
  if (key === 'alphabetical') return copy.sort((a, b) => a.name.localeCompare(b.name))
  if (key === 'active')       return copy.sort((a, b) => b.chatCount - a.chatCount)
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
  const { orgId, members, currentUserRole }                                   = useOrg()
  const { user }                                                              = useAuth()
  const mounted                                                               = useMounted()
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
  const [trashOpen,      setTrashOpen]      = useState(false)

  // Personal projects have no membership to leave (backend 400s) — only
  // workspace/shared projects get the "Leave project" menu item, for both
  // the owner (triggers successor/archive/convert) and any collaborator.
  function canLeaveProject(project: Project): boolean {
    return project.visibility !== 'personal'
  }

  // refreshProjects() itself has no built-in error handling (unlike the
  // bootstrap effect that originally owned this logic) — callers must catch.
  // A failure here just means the list looks stale until the next reload;
  // the leave/restore action itself already succeeded and already toasted.
  function handleRefreshProjects() {
    refreshProjects().catch(err => toast.error('Failed to refresh projects', { description: err instanceof Error ? err.message : undefined }))
  }

  // Org owners/admins can delete a colleague's shared project even though
  // they don't own it — see the matching note in projects-context.tsx's
  // deleteProject guardrail, which is the actual enforcement point.
  function canDeleteProject(project: Project): boolean {
    return project.canEdit || (currentUserRole === 'admin' && !!orgId && project.teamId === orgId)
  }

  async function handleDelete(project: Project) {
    if (project.chatCount > 0) {
      setDeleteTarget(project)
      return
    }
    try {
      await deleteProject(project.id)
      toast.success(`"${project.name}" deleted`)
    } catch {
      // error toast shown by context
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return
    setIsDeleting(true)
    try {
      await deleteProject(deleteTarget.id)
      const chatWord = deleteTarget.chatCount === 1 ? 'chat' : 'chats'
      toast.success(`"${deleteTarget.name}" and ${deleteTarget.chatCount} ${chatWord} deleted`)
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
    recent:       'Recent',
    alphabetical: 'Alphabetical',
    active:       'Most active',
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
              {/* Trash — workspace/shared projects deleted within the last 30
                  days; personal projects hard-delete instantly and never
                  show up here (see ProjectTrashModal). */}
              <Button variant="secondary" onClick={() => setTrashOpen(true)}>
                Trash
              </Button>
              {/* New Project */}
              <Button variant="default" leftIcon={<PlusSignIcon animated />} onClick={() => push(newProjectHref)}>
                New Project
              </Button>
            </div>
          </div>
        </div>

        {/* Search + filter row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%' }}>
          {/* Personal / Workspace / Shared scope — big tabs, anchored to the
              left. Workspace and Shared both require an org (matches the
              backend's own visibility rules), so the whole bar stays hidden
              for individual users, same as before. */}
          {orgId && (
            <Tabs value={scopeFilter} onValueChange={v => handleScopeChange(v as ScopeFilter)}>
              <Tabs.List pillTopInset={0.5} pillBottomInset={1}>
                <Tabs.Trigger value="personal">Personal</Tabs.Trigger>
                <Tabs.Trigger value="workspace">Workspace</Tabs.Trigger>
                <Tabs.Trigger value="shared">Shared</Tabs.Trigger>
              </Tabs.List>
            </Tabs>
          )}

          {/* Search + view + sort — grouped to the right */}
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
              <Dropdown>
                <Dropdown.Section>
                  {(['recent', 'alphabetical', 'active'] as SortKey[]).map((k) => (
                    <Dropdown.Item
                      key={k}
                      label={sortLabels[k]}
                      selected={sort === k}
                      onClick={() => { setSort(k); setSortOpen(false) }}
                      fluid
                    />
                  ))}
                </Dropdown.Section>
              </Dropdown>
            </Dropdown.Float>
          </div>
        </div>

        {/* Project grid */}
        {loading ? (
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
                onEdit={project.canEdit ? () => setEditTarget(project) : undefined}
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
                ownerName={members.find(m => m.id === project.ownerUserId)?.name}
                memberCount={projectMemberCount(project, members)}
                updatedAt={formatUpdated(project.updatedAt)}
                chatCount={project.chatCount}
                onClick={() => push(PROJECT_ROUTE(project.id))}
                onEdit={project.canEdit ? () => setEditTarget(project) : undefined}
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

      {/* Delete confirmation modal */}
      {mounted && createPortal(
        <AnimatePresence>
          {deleteTarget && (
            <>
              {/* Backdrop */}
              <m.div
                key="delete-project-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                onClick={() => setDeleteTarget(null)}
                style={{
                  position:        'fixed',
                  inset:           0,
                  zIndex:          10000,
                  backgroundColor: 'rgba(0,0,0,0.28)',
                  backdropFilter:  'blur(2px)',
                }}
              />

              {/* Centering wrapper */}
              <div
                style={{
                  position:       'fixed',
                  inset:          0,
                  zIndex:         10001,
                  display:        'flex',
                  alignItems:     'center',
                  justifyContent: 'center',
                  pointerEvents:  'none',
                }}
              >
                <m.div
                  key="delete-project-modal"
                  role="dialog"
                  aria-modal="true"
                  aria-label="Delete project"
                  initial={{ opacity: 0, scale: 0.96, y: 8 }}
                  animate={{ opacity: 1, scale: 1,    y: 0 }}
                  exit={{    opacity: 0, scale: 0.96, y: 8 }}
                  transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    pointerEvents:   'auto',
                    backgroundColor: 'var(--neutral-white)',
                    borderRadius:    16,
                    boxShadow:       '0px 8px 32px 0px rgba(82,75,71,0.18), 0px 0px 0px 1px var(--neutral-100)',
                    width:           480,
                    maxWidth:        'calc(100vw - 32px)',
                    display:         'flex',
                    flexDirection:   'column',
                    overflow:        'hidden',
                  }}
                >
                  {/* Header */}
                  <div
                    style={{
                      display:        'flex',
                      alignItems:     'center',
                      justifyContent: 'space-between',
                      padding:        '20px 20px 16px',
                      borderBottom:   '1px solid var(--neutral-100)',
                      flexShrink:     0,
                    }}
                  >
                    <p
                      style={{
                        fontFamily: 'var(--font-body)',
                        fontWeight: 600,
                        fontSize:   'var(--font-size-body-lg)',
                        lineHeight: 'var(--line-height-body-lg)',
                        color:      'var(--neutral-900)',
                        margin:     0,
                      }}
                    >
                      Delete project?
                    </p>
                    <IconButton variant="ghost" size="xs" icon={<CancelOneIcon />} aria-label="Close" onClick={() => setDeleteTarget(null)} />
                  </div>

                  {/* Body */}
                  <div
                    style={{
                      padding:       '20px',
                      display:       'flex',
                      flexDirection: 'column',
                      gap:           '12px',
                      flexShrink:    0,
                    }}
                  >
                    {/* Warning tag */}
                    <div
                      style={{
                        display:         'inline-flex',
                        alignSelf:       'flex-start',
                        alignItems:      'center',
                        gap:             5,
                        padding:         '3px 8px 3px 6px',
                        borderRadius:    6,
                        backgroundColor: 'var(--red-400-10)',
                        boxShadow:       '0px 0px 0px 1px rgba(238,48,48,0.22)',
                      }}
                    >
                      <AlertCircleIcon size={13} color="var(--red-500)" />
                      <span
                        style={{
                          fontFamily: 'var(--font-body)',
                          fontWeight: 600,
                          fontSize:   '11px',
                          lineHeight: '16px',
                          color:      'var(--red-600)',
                          letterSpacing: '0.02em',
                          textTransform: 'uppercase',
                        }}
                      >
                        Warning
                      </span>
                    </div>

                    <p
                      style={{
                        fontFamily: 'var(--font-body)',
                        fontWeight: 'var(--font-weight-regular)',
                        fontSize:   'var(--font-size-body)',
                        lineHeight: 'var(--line-height-body)',
                        color:      'var(--neutral-700)',
                        margin:     0,
                      }}
                    >
                      {`"${deleteTarget.name}" contains ${deleteTarget.chatCount} ${deleteTarget.chatCount === 1 ? 'chat' : 'chats'}. Deleting this project will permanently remove all its chats. This action cannot be undone.`}
                    </p>
                  </div>

                  {/* Footer */}
                  <div
                    style={{
                      display:        'flex',
                      justifyContent: 'flex-end',
                      alignItems:     'center',
                      gap:            8,
                      padding:        '12px 16px 16px',
                      borderTop:      '1px solid var(--neutral-100)',
                      flexShrink:     0,
                    }}
                  >
                    <Button variant="ghost" onClick={() => setDeleteTarget(null)} disabled={isDeleting}>Cancel</Button>
                    <Button variant="danger" onClick={handleDeleteConfirm} loading={isDeleting}>Delete</Button>
                  </div>
                </m.div>
              </div>
            </>
          )}
        </AnimatePresence>,
        document.body
      )}

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

      {trashOpen && user?.auth0Id && (
        <ProjectTrashModal
          currentUserId={user.auth0Id}
          onClose={() => setTrashOpen(false)}
          onRestored={handleRefreshProjects}
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
