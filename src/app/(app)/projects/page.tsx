'use client'

import React, { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { SearchOneIcon, PlusSignIcon, ArrowDownOneIcon } from '@strange-huge/icons'
import { useProjects } from '@/context/projects-context'
import { ProjectCard } from '@/components/ProjectCard'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/Button'
import { Dropdown } from '@/components/Dropdown'
import { EditProjectModal } from '@/components/EditProjectModal'
import type { Project } from '@/context/projects-context'

type SortKey = 'recent' | 'alphabetical' | 'active'

function sortProjects(projects: Project[], key: SortKey): Project[] {
  const copy = [...projects]
  if (key === 'alphabetical') return copy.sort((a, b) => a.name.localeCompare(b.name))
  if (key === 'active')       return copy.sort((a, b) => b.chatCount - a.chatCount)
  return copy.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
}

function formatUpdated(iso: string) {
  const d   = new Date(iso)
  const now = new Date()
  const diff = (now.getTime() - d.getTime()) / 1000
  if (diff < 60)              return 'Updated just now'
  if (diff < 3600)            return `Updated ${Math.floor(diff / 60)}m ago`
  if (diff < 86400)           return `Updated ${Math.floor(diff / 3600)}h ago`
  if (diff < 86400 * 7)       return `Updated ${Math.floor(diff / 86400)} days ago`
  if (diff < 86400 * 30)      return `Updated ${Math.floor(diff / 86400 / 7)} weeks ago`
  return `Updated Last month`
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function ProjectsPage() {
  const { push }                                  = useRouter()
  const { projects, loading, updateProject, deleteProject } = useProjects()
  const [query,      setQuery]                    = useState('')
  const [sort,       setSort]                     = useState<SortKey>('recent')
  const [sortOpen,   setSortOpen]                 = useState(false)
  const [editTarget, setEditTarget]               = useState<Project | null>(null)

  // Split into two memos: sort doesn't re-run when query changes, filter doesn't
  // re-run when sort order changes.
  const sorted = useMemo(() => sortProjects(projects, sort), [projects, sort])

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
        padding:        '35px 24px 40px',
        boxSizing:      'border-box',
      }}
    >
      <div style={{ width: '100%', maxWidth: '836px', display: 'flex', flexDirection: 'column', gap: '24px' }}>

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
              <div style={{ alignSelf: 'flex-start' }}>
                <Badge label={`${projects.length} ${projects.length === 1 ? 'Project' : 'Projects'}`} color="Neutral" />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
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

              {/* New Project */}
              <Button variant="default" leftIcon={<PlusSignIcon animated />} onClick={() => push('/projects/new')}>
                New Project
              </Button>
            </div>
          </div>
        </div>

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
            width:           '100%',
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
              border:      'none',
              // eslint-disable-next-line react-doctor/no-outline-none -- browser outline suppressed; :focus-visible handled by container or global styles
              outline:     'none',
              background:  'transparent',
              fontFamily:  'var(--font-body)',
              fontWeight:  'var(--font-weight-regular)',
              fontSize:    '14px',
              lineHeight:  '22px',
              color:       '#1a1714',
            }}
          />
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
                No projects yet. Create your first one to get started.
              </p>
              <Button variant="default" leftIcon={<PlusSignIcon animated />} onClick={() => push('/projects/new')}>
                New Project
              </Button>
            </div>
          )
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
                updatedAt={formatUpdated(project.updatedAt)}
                chatCount={project.chatCount}
                onClick={() => push(`/project/${project.id}`)}
                onEdit={() => setEditTarget(project)}
                onArchive={() => {/* archive flow - backlog */}}
                onDelete={() => deleteProject(project.id)}
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
    </div>
  )
}
