'use client'

import React, { Suspense, useEffect, useRef, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AnimatePresence, m } from 'framer-motion'
import { SearchOneIcon, PlusSignIcon, ArrowDownOneIcon, CancelCircleIcon } from '@strange-huge/icons'
import { toast } from 'sonner'
import { useProjects } from '@/context/projects-context'
import { ProjectCard } from '@/components/ProjectCard'
import { Badge } from '@/components/Badge'
import { Skeleton } from '@/components/Skeleton'
import { RESET_BUTTON_STYLE } from '@/lib/reset-button-style'
import { Button } from '@/components/Button'
import { IconButton } from '@/components/IconButton'
import { InputField } from '@/components/InputField'
import { Dropdown } from '@/components/Dropdown'
import { Tooltip } from '@/components/Tooltip'
import { EditProjectModal } from '@/components/EditProjectModal'
import { LeaveProjectModal } from '@/components/LeaveProjectModal'
import { DeleteProjectModal } from '@/components/DeleteProjectModal'
import { ProjectTrashList } from '@/components/ProjectTrashModal/ProjectTrashList'
import { ProjectViewToggle } from '@/components/ProjectViewToggle'
import { ScopeFilterDropdown } from '@/components/ScopeFilterDropdown'
import { ProjectListRow } from '@/components/ProjectListRow'
import type { Project } from '@/context/projects-context'
import { useOrg } from '@/context/org-context'
import { useAuth } from '@/context/auth-context'
import { PROJECT_VISIBILITY_OPTIONS } from '@/lib/api/projects'
import { PROJECT_ROUTE, PROJECTS_NEW_ROUTE, PROJECTS_ROUTE } from '@/lib/routes'
import {
  parseSort, parseScope, parseViewMode,
  SORT_LABELS, SORT_DESCRIPTIONS,
  type SortKey, type ScopeFilter, type ViewMode,
} from '@/lib/project-filters'
import { sortProjects, projectMemberCount, formatUpdated } from '@/lib/project-list-utils'

// Gradient palette seeded by team name — shared with TeamChip/TeamSwitcherRow/
// TeamSwitcherDropdown/ProjectCard/etc via src/lib/team-gradients.ts, so a
// project's avatar is the same colour everywhere else it appears.

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
  // Every filter below is seeded from its own URL param (e.g. the sidebar's
  // "Personal projects" link lands here with ?scope=personal pre-applied) and
  // written back to that param on every change via updateParam, so the full
  // filter set — scope, view, sort, search — survives a reload/back-nav and a
  // link to this page can point at an exact filtered view. The effect below
  // re-syncs all four any time the URL changes out from under them (e.g.
  // browser Back/Forward), so the visible filters never drift from the
  // address bar.
  const [viewMode,       setViewMode]       = useState<ViewMode>(() => parseViewMode(searchParams.get('view')))
  const [query,          setQuery]          = useState(() => searchParams.get('q') ?? '')
  const [searchOpen,     setSearchOpen]     = useState(() => !!searchParams.get('q'))
  const [sort,           setSort]           = useState<SortKey>(() => parseSort(searchParams.get('sort')))
  const [sortOpen,       setSortOpen]       = useState(false)
  const [scopeFilter,    setScopeFilter]    = useState<ScopeFilter>(() => parseScope(searchParams.get('scope')))
  // Re-syncs all four the moment the URL changes out from under them (e.g.
  // browser Back/Forward) by adjusting state during render against the new
  // searchParams reference (React's own sanctioned pattern for this) instead
  // of an effect, which would apply the same sync a whole extra frame later.
  const [searchParamsSynced, setSearchParamsSynced] = useState(searchParams)
  if (searchParams !== searchParamsSynced) {
    setSearchParamsSynced(searchParams)
    const urlScope = parseScope(searchParams.get('scope'))
    setScopeFilter(prev => (prev === urlScope ? prev : urlScope))
    const urlView = parseViewMode(searchParams.get('view'))
    setViewMode(prev => (prev === urlView ? prev : urlView))
    const urlSort = parseSort(searchParams.get('sort'))
    setSort(prev => (prev === urlSort ? prev : urlSort))
    const urlQuery = searchParams.get('q') ?? ''
    setQuery(prev => (prev === urlQuery ? prev : urlQuery))
    if (urlQuery) setSearchOpen(true)
  }
  // Shared writer — patches one param onto the current URL while preserving
  // the rest (e.g. changing ?sort= doesn't clobber ?scope=). replace (not
  // push) — switching a filter shouldn't pile up history entries. An empty
  // value removes the param instead of writing it out (keeps the URL clean
  // when the search box is cleared/closed).
  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value) params.set(key, value)
    else params.delete(key)
    replace(`${PROJECTS_ROUTE}?${params.toString()}`, { scroll: false })
  }
  function handleScopeChange(next: ScopeFilter) {
    setScopeFilter(next)
    updateParam('scope', next)
  }
  function handleViewModeChange(next: ViewMode) {
    setViewMode(next)
    updateParam('view', next)
  }
  function handleSortChange(next: SortKey) {
    setSort(next)
    updateParam('sort', next)
  }
  function handleQueryChange(next: string) {
    setQuery(next)
    updateParam('q', next)
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
    if (scopeFilter === 'all') return projects
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

  const emptyLabel = scopeFilter === 'all'
    ? 'No projects yet. Create your first one to get started.'
    : scopeFilter === 'personal'
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
                  color:       'var(--legacy-1a1916)',
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
                          <button
                            type="button"
                            aria-label="Close search"
                            onClick={() => { setSearchOpen(false); handleQueryChange('') }}
                            className="kds-icon-in-field"
                            style={{ ...RESET_BUTTON_STYLE, display: 'inline-flex', cursor: 'pointer', lineHeight: 0 }}
                          >
                            <CancelCircleIcon size={16} />
                          </button>
                        }
                        placeholder="Search projects…"
                        value={query}
                        onChange={handleQueryChange}
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
            <ProjectViewToggle value={viewMode} onChange={handleViewModeChange} />

            {/* Sort dropdown */}
            <Dropdown.Float
              open={sortOpen}
              onOpenChange={setSortOpen}
              placement="bottom-end"
              trigger={
                <Button variant="secondary" size="sm" rightIcon={<ArrowDownOneIcon size={16} animated />}>
                  {SORT_LABELS[sort]}
                </Button>
              }
            >
              <Dropdown maxHeight={false}>
                <Dropdown.Section>
                  {(['recent', 'az', 'za', 'active'] as SortKey[]).map((k) => (
                    <Dropdown.Item
                      key={k}
                      label={SORT_LABELS[k]}
                      subLabel={SORT_DESCRIPTIONS[k]}
                      selected={sort === k}
                      onClick={() => { handleSortChange(k); setSortOpen(false) }}
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
          // Sized to roughly match the real content each viewMode renders
          // once `loading` resolves (grid cards are a fixed 262px —
          // ProjectCard/index.tsx:82 — list rows ~64px) so the swap from
          // skeleton to real content doesn't shift the layout underneath it;
          // the previous single-line "Loading projects…" text reserved far
          // less space than either real layout, causing a real, measured
          // (not dev-mode-artifact) CLS hit.
          viewMode === 'list' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} height={64} radius={12} style={{ opacity: 1 - i * 0.15 }} />
              ))}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '24px', width: '100%' }}>
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} height={262} radius={12} style={{ opacity: 1 - i * 0.15 }} />
              ))}
            </div>
          )
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
        visibility={editTarget?.visibility ?? 'personal'}
        visibilityOptions={editTarget?.canEdit && orgId ? PROJECT_VISIBILITY_OPTIONS : []}
        onSave={(name, description, tags, visibility) => {
          if (!editTarget) return
          return updateProject(editTarget.id, { name, description, tags, visibility })
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
