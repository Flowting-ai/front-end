'use client'

import React, { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { SearchOneIcon } from '@strange-huge/icons'
import { useProjects } from '@/context/projects-context'
import { ProjectCard } from '@/components/ProjectCard'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/Button'
import { Dropdown } from '@/components/Dropdown'
import { EditProjectModal } from '@/components/EditProjectModal'
import type { Project } from '@/context/projects-context'

// ── Template cards ─────────────────────────────────────────────────────────────

const TEMPLATES = [
  { name: 'Product Design Sprint',  subtitle: 'Design · Discovery' },
  { name: 'Research Repository',    subtitle: 'Research · Synthesis' },
  { name: 'Engineering Planning',   subtitle: 'Engineering · Roadmap' },
]

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
  const router                                    = useRouter()
  const { projects, updateProject, deleteProject } = useProjects()
  const [query,      setQuery]                    = useState('')
  const [sort,       setSort]                     = useState<SortKey>('recent')
  const [sortOpen,   setSortOpen]                 = useState(false)
  const [editTarget, setEditTarget]               = useState<Project | null>(null)

  const filtered = useMemo(() => {
    const sorted = sortProjects(projects, sort)
    if (!query.trim()) return sorted
    const q = query.toLowerCase()
    return sorted.filter((p) => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q))
  }, [projects, query, sort])

  const sortLabels: Record<SortKey, string> = {
    recent:       'Recent',
    alphabetical: 'Alphabetical',
    active:       'Most active',
  }

  return (
    <div
      style={{
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'center',
        width:          '100%',
        height:         '100%',
        overflowY:      'auto',
        padding:        '35px 24px 40px',
        boxSizing:      'border-box',
      }}
    >
      <div style={{ width: '100%', maxWidth: '836px', display: 'flex', flexDirection: 'column', gap: '24px' }}>

        {/* Heading row */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
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
              <Badge label={`${projects.length} Projects`} color="Neutral" />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {/* Sort dropdown */}
              <Dropdown.Float
                open={sortOpen}
                onOpenChange={setSortOpen}
                placement="bottom-end"
                trigger={
                  <Button variant="outline" rightIcon={<span style={{ fontSize: 10 }}>▾</span>}>
                    {sortLabels[sort]}
                  </Button>
                }
              >
                <Dropdown size="sm">
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
              <Button variant="default" onClick={() => router.push('/projects/new')}>
                + New Project
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

        {/* Templates section (hidden when searching) */}
        {!query.trim() && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <p
              style={{
                fontFamily:  'var(--font-body)',
                fontWeight:  'var(--font-weight-medium)',
                fontSize:    '16px',
                lineHeight:  '22px',
                color:       '#6a625d',
                margin:      0,
              }}
            >
              Start from a template
            </p>
            <div style={{ display: 'flex', alignItems: 'stretch', gap: '24px' }}>
              {TEMPLATES.map((t) => (
                <button
                  key={t.name}
                  onClick={() => router.push('/projects/new')}
                  style={{
                    flex:          '1 1 0',
                    display:       'flex',
                    flexDirection: 'column',
                    gap:           '4px',
                    alignItems:    'flex-start',
                    padding:       '12px 12px 16px',
                    borderRadius:  '16px',
                    background:    'var(--neutral-50)',
                    border:        '1px dashed var(--neutral-300)',
                    boxShadow:     '0px 2px 2.8px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-100)',
                    cursor:        'pointer',
                    textAlign:     'left',
                    transition:    'background-color 120ms ease',
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--neutral-100)' }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--neutral-50)' }}
                >
                  <p
                    style={{
                      fontFamily:   'var(--font-body)',
                      fontWeight:   'var(--font-weight-regular)',
                      fontSize:     '16px',
                      lineHeight:   '22px',
                      color:        'var(--neutral-900)',
                      overflow:     'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace:   'nowrap',
                      maxWidth:     '100%',
                      margin:       0,
                    }}
                  >
                    {t.name}
                  </p>
                  <p
                    style={{
                      fontFamily:   'var(--font-code)',
                      fontWeight:   'var(--font-weight-regular)',
                      fontSize:     '13px',
                      lineHeight:   '16px',
                      color:        'var(--neutral-500)',
                      overflow:     'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace:   'nowrap',
                      maxWidth:     '100%',
                      margin:       0,
                    }}
                  >
                    {t.subtitle}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Project grid */}
        {filtered.length === 0 ? (
          query.trim() ? (
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontWeight: 'var(--font-weight-regular)',
                fontSize:   '14px',
                lineHeight: '22px',
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
                  fontFamily:  'var(--font-body)',
                  fontWeight:  'var(--font-weight-regular)',
                  fontSize:    '16px',
                  lineHeight:  '22px',
                  color:       '#857a72',
                  textAlign:   'center',
                  margin:      0,
                }}
              >
                No projects yet. Create your first one to get started.
              </p>
              <Button variant="default" onClick={() => router.push('/projects/new')}>
                + New Project
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
                onClick={() => router.push(`/project/${project.id}`)}
                onEdit={() => setEditTarget(project)}
                onArchive={() => {/* archive flow — backlog */}}
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
        onSave={(name, description) => {
          if (editTarget) updateProject(editTarget.id, { name, description })
        }}
        onClose={() => setEditTarget(null)}
      />
    </div>
  )
}
