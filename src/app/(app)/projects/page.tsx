'use client'

import React, { Suspense, useEffect, useRef, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter, useSearchParams } from 'next/navigation'
import { AnimatePresence, m } from 'framer-motion'
import { SearchOneIcon, PlusSignIcon, ArrowDownOneIcon, CancelOneIcon, AlertCircleIcon, UserIcon, BubbleChatAddIcon, MoreVerticalIcon } from '@strange-huge/icons'
import { toast } from 'sonner'
import { useProjects } from '@/context/projects-context'
import { ProjectCard } from '@/components/ProjectCard'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/Button'
import { IconButton } from '@/components/IconButton'
import { Dropdown } from '@/components/Dropdown'
import Tabs from '@/components/Tabs'
import { Tooltip } from '@/components/Tooltip'
import { EditProjectModal } from '@/components/EditProjectModal'
import { useMounted } from '@/hooks/use-mounted'
import type { Project } from '@/context/projects-context'
import { useOrg } from '@/context/org-context'
import type { OrgMember } from '@/types/teams'
import { PROJECT_ROUTE, PROJECTS_NEW_ROUTE } from '@/lib/routes'

type SortKey = 'recent' | 'alphabetical' | 'active'
type ScopeFilter = 'all' | 'personal' | 'team'
type ViewMode = 'grid' | 'list'

// ── Gradient palette — seeded by team name, matching TeamChip/TeamSwitcherRow/
// TeamSwitcherDropdown/ProjectCard exactly, so a project's avatar is the same
// colour everywhere else it appears.

const TEAM_GRADIENTS = [
  'linear-gradient(135deg, #4FACDE 0%, #2D8BBF 100%)',  // teal-blue
  'linear-gradient(135deg, #9B6FE0 0%, #7B4FC0 100%)',  // purple
  'linear-gradient(135deg, #F59542 0%, #D4742A 100%)',  // orange
  'linear-gradient(135deg, #4CAF78 0%, #2D8F58 100%)',  // green
  'linear-gradient(135deg, #E06060 0%, #B83C3C 100%)',  // red-brown
  'linear-gradient(135deg, #60A8E0 0%, #3C80C0 100%)',  // blue
]

function getGradient(seed: string): string {
  let h = 0
  for (let i = 0; i < seed.length; i++) {
    h = ((h << 5) - h) + seed.charCodeAt(i)
    h |= 0
  }
  return TEAM_GRADIENTS[Math.abs(h) % TEAM_GRADIENTS.length]!
}

// ── Grid/List toggle — same Tabs+glyph pattern as ConnectorViewToggle
// (org/connectors, settings/connectors) for visual/interaction consistency. ──

function GridViewGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="2" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3" />
      <rect x="9" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3" />
      <rect x="2" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3" />
      <rect x="9" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  )
}

function ListViewGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="2" y="3"    width="12" height="2.2" rx="1.1" fill="currentColor" />
      <rect x="2" y="6.9"  width="12" height="2.2" rx="1.1" fill="currentColor" />
      <rect x="2" y="10.8" width="12" height="2.2" rx="1.1" fill="currentColor" />
    </svg>
  )
}

function ProjectViewToggle({ value, onChange }: { value: ViewMode; onChange: (v: ViewMode) => void }) {
  return (
    <Tabs value={value} onValueChange={v => onChange(v as ViewMode)}>
      <Tabs.List size="small" collapse pillTopInset={0.5} pillBottomInset={1}>
        <Tooltip content="Grid view" side="top">
          <Tabs.Trigger value="grid" icon={<GridViewGlyph />}>Grid</Tabs.Trigger>
        </Tooltip>
        <Tooltip content="List view" side="top">
          <Tabs.Trigger value="list" icon={<ListViewGlyph />}>List</Tabs.Trigger>
        </Tooltip>
      </Tabs.List>
    </Tabs>
  )
}

// ── Compact list-view row ────────────────────────────────────────────────────

function ProjectListRow({
  project, teamName, ownerName, memberCount, updatedAt, onClick, onEdit, onArchive, onDelete,
}: {
  project:      Project
  teamName?:    string
  ownerName?:   string
  memberCount:  number
  updatedAt:    string
  onClick:      () => void
  onEdit?:      () => void
  onArchive?:   () => void
  onDelete?:    () => void
}) {
  const [hovered,  setHovered]  = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const hasActions = Boolean(onEdit || onArchive || onDelete)
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

      {/* Stats */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0, color: 'var(--neutral-400)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <UserIcon size={14} />
          <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, lineHeight: '16px', color: 'var(--neutral-500)' }}>{memberCount}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <BubbleChatAddIcon size={14} />
          <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, lineHeight: '16px', color: 'var(--neutral-500)' }}>{project.chatCount}</span>
        </div>
      </div>

      {/* ⋮ menu - fades in on hover/focus */}
      {hasActions && (
        <div
          style={{ opacity: showMenu ? 1 : 0, transition: 'opacity 120ms ease', flexShrink: 0 }}
          onClick={(e) => e.stopPropagation()}
        >
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
              <Dropdown.Section fluid>
                <Dropdown.Item label="Edit"    onClick={() => { setMenuOpen(false); onEdit?.() }}    fluid />
                <Dropdown.Item label="Archive" onClick={() => { setMenuOpen(false); onArchive?.() }} disabled fluid />
              </Dropdown.Section>
              <Dropdown.Section divider fluid>
                <Dropdown.Item label="Delete"  variant="danger" onClick={() => { setMenuOpen(false); onDelete?.() }} fluid />
              </Dropdown.Section>
            </Dropdown>
          </Dropdown.Float>
        </div>
      )}
    </div>
  )
}

function sortProjects(projects: Project[], key: SortKey): Project[] {
  const copy = [...projects]
  if (key === 'alphabetical') return copy.sort((a, b) => a.name.localeCompare(b.name))
  if (key === 'active')       return copy.sort((a, b) => b.chatCount - a.chatCount)
  return copy.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
}

// A team project's member count is its team's roster (everyone who can reach
// it); a personal project's is just its owner — there's no separate
// per-project membership list distinct from team membership.
function projectMemberCount(project: Project, members: OrgMember[]): number {
  if (!project.teamId) return 1
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
  const { push }                                                              = useRouter()
  const searchParams                                                          = useSearchParams()
  const { projects, loading, updateProject, deleteProject, loadProjectChats } = useProjects()
  const { orgId, teams, members }                                             = useOrg()
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
  const [sort,           setSort]           = useState<SortKey>('recent')
  const [sortOpen,       setSortOpen]       = useState(false)
  // Seeded from ?scope= (e.g. the sidebar's "Personal projects" link lands
  // here with scope=personal pre-applied) — read once at mount, not reactive
  // to later URL changes, same as the rest of this page's local filter state.
  const [scopeFilter,    setScopeFilter]    = useState<ScopeFilter>(() =>
    searchParams.get('scope') === 'personal' ? 'personal' : 'all'
  )
  const [selectedTeamIds, setSelectedTeamIds] = useState<Set<string>>(() => new Set())
  const [filterOpen,     setFilterOpen]     = useState(false)
  const [editTarget,     setEditTarget]     = useState<Project | null>(null)
  const [deleteTarget,   setDeleteTarget]   = useState<Project | null>(null)
  const [isDeleting,     setIsDeleting]     = useState(false)

  // Archived teams aren't "existing" teams anymore — exclude them from the
  // filter's per-team checklist (same convention as /projects/new's own
  // team picker).
  const filterableTeams = useMemo(() => teams.filter(t => !t.archived), [teams])

  function toggleTeam(teamId: string) {
    setSelectedTeamIds(prev => {
      const next = new Set(prev)
      next.has(teamId) ? next.delete(teamId) : next.add(teamId)
      return next
    })
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

  // Explicit filter instead of implicit team-scoping — "All" shows everything
  // (personal + every team merged), "Personal"/"Team" narrow to just one kind.
  // Team projects are never auto-hidden just because a different team is active
  // elsewhere in the app. Checking one or more teams additionally narrows the
  // team-project portion down to just those teams (no checkboxes checked =
  // no extra narrowing, i.e. every team).
  // Standing personal/team split — independent of the scope filter below, so
  // the heading badges always summarize the whole list at a glance.
  const personalCount = useMemo(() => projects.filter(p => p.teamId === null).length, [projects])
  const teamCount      = useMemo(() => projects.filter(p => p.teamId !== null).length, [projects])

  const scopedProjects = useMemo(() => {
    return projects.filter(p => {
      if (p.teamId === null) return scopeFilter !== 'team'
      if (scopeFilter === 'personal') return false
      return selectedTeamIds.size === 0 || selectedTeamIds.has(p.teamId)
    })
  }, [projects, scopeFilter, selectedTeamIds])

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

  const filterLabels: Record<ScopeFilter, string> = {
    all:      'All',
    personal: 'Personal',
    team:     'Team',
  }

  // Trigger/badge text — reflects the specific teams checked, when any are,
  // otherwise falls back to the coarse All/Personal/Team label.
  const selectedTeamNames = teams.filter(t => selectedTeamIds.has(t.id)).map(t => t.name)
  const filterDisplayLabel = scopeFilter !== 'personal' && selectedTeamNames.length > 0
    ? selectedTeamNames.length === 1 ? selectedTeamNames[0] : `${selectedTeamNames.length} Teams`
    : filterLabels[scopeFilter]

  const emptyLabel = scopeFilter === 'personal'
    ? 'No personal projects yet. Create your first one to get started.'
    : scopeFilter === 'team'
      ? 'No team projects yet.'
      : 'No projects yet. Create your first one to get started.'

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
                    <Badge label={`${teamCount} Team ${teamCount === 1 ? 'Project' : 'Projects'}`} color="Neutral" />
                  </>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
              {/* New Project */}
              <Button variant="default" leftIcon={<PlusSignIcon animated />} onClick={() => push(newProjectHref)}>
                New Project
              </Button>
            </div>
          </div>
        </div>

        {/* Search + filter row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%' }}>
          {/* Search */}
          <div
            style={{
              display:         'flex',
              alignItems:      'center',
              gap:             '6px',
              padding:         '7px 10px',
              borderRadius:    '10px',
              background:      'var(--neutral-white)',
              boxShadow:       '0px 1px 1.5px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-100)',
              flex:            '0 1 320px',
              minWidth:        0,
              boxSizing:       'border-box',
            }}
          >
            <SearchOneIcon style={{ width: 16, height: 16, color: '#6a625d', flexShrink: 0 }} />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search Projects..."
              style={{
                flex:        '1 0 0',
                minWidth:    0,
                border:      'none',
                outline:     'none',
                background:  'transparent',
                fontFamily:  'var(--font-body)',
                fontWeight:  'var(--font-weight-regular)',
                fontSize:    '14px',
                lineHeight:  '22px',
                color:       '#1a1714',
              }}
            />
            {query && (
              <IconButton
                variant="ghost"
                size="sm"
                aria-label="Clear search"
                icon={<CancelOneIcon size={14} />}
                onClick={() => setQuery('')}
              />
            )}
          </div>

          {/* Filter / view / sort controls — to the right of the search bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0, marginLeft: 'auto' }}>
            {/* Grid/List view toggle */}
            <ProjectViewToggle value={viewMode} onChange={setViewMode} />

            {/* Filter dropdown — All / Personal / Team, only meaningful for org members */}
            {orgId && (
              <Dropdown.Float
                open={filterOpen}
                onOpenChange={setFilterOpen}
                placement="bottom-end"
                trigger={
                  <Button variant="outline" rightIcon={<ArrowDownOneIcon animated />}>
                    {filterDisplayLabel}
                  </Button>
                }
              >
                {/* Popover's own scroll cap wraps ALL children in one shared
                    scroll area by default — disable it here so only the
                    inner Teams list (its own overflow below) ever scrolls,
                    never the All/Personal/Team rows above it. */}
                <Dropdown maxHeight={false}>
                  <Dropdown.Section>
                    {(['all', 'personal', 'team'] as ScopeFilter[]).map((k) => (
                      <Dropdown.Item
                        key={k}
                        label={filterLabels[k]}
                        selected={scopeFilter === k}
                        onClick={() => { setScopeFilter(k); setFilterOpen(false) }}
                        fluid
                      />
                    ))}
                  </Dropdown.Section>
                  {/* Per-team narrowing — only meaningful alongside All/Team,
                      multi-select so it stays open while toggling. */}
                  {scopeFilter !== 'personal' && filterableTeams.length > 0 && (
                    <Dropdown.Section divider label="Teams">
                      <div
                        className="kaya-scrollbar"
                        style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 362, overflowY: 'auto', padding: 3 }}
                      >
                        {filterableTeams.map(team => (
                          <Dropdown.Item
                            key={team.id}
                            label={team.name}
                            showCheckbox
                            checkboxChecked={selectedTeamIds.has(team.id)}
                            onCheckboxChange={() => toggleTeam(team.id)}
                            fluid
                          />
                        ))}
                      </div>
                    </Dropdown.Section>
                  )}
                </Dropdown>
              </Dropdown.Float>
            )}

            {/* Sort dropdown */}
            <Dropdown.Float
              open={sortOpen}
              onOpenChange={setSortOpen}
              placement="bottom-end"
              trigger={
                <Button variant="outline" rightIcon={<ArrowDownOneIcon animated />}>
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
                teamName={project.teamId ? teams.find(t => t.id === project.teamId)?.name : undefined}
                ownerName={members.find(m => m.id === project.ownerUserId)?.name}
                memberCount={projectMemberCount(project, members)}
                updatedAt={formatUpdated(project.updatedAt)}
                onClick={() => push(PROJECT_ROUTE(project.id))}
                onEdit={project.canEdit ? () => setEditTarget(project) : undefined}
                onArchive={project.canEdit ? () => {/* archive flow - backlog */} : undefined}
                onDelete={project.canEdit ? () => handleDelete(project) : undefined}
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
                teamName={project.teamId ? teams.find(t => t.id === project.teamId)?.name : undefined}
                ownerName={members.find(m => m.id === project.ownerUserId)?.name}
                memberCount={projectMemberCount(project, members)}
                updatedAt={formatUpdated(project.updatedAt)}
                chatCount={project.chatCount}
                onClick={() => push(PROJECT_ROUTE(project.id))}
                onEdit={project.canEdit ? () => setEditTarget(project) : undefined}
                onArchive={project.canEdit ? () => {/* archive flow - backlog */} : undefined}
                onDelete={project.canEdit ? () => handleDelete(project) : undefined}
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
