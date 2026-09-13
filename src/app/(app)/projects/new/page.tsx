'use client'

import React, { Suspense, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { AnimatePresence, m } from 'framer-motion'
import { ArrowLeftOneIcon, ArrowDownOneIcon, InformationCircleIcon, CancelOneIcon } from '@strange-huge/icons'
import { useProjects, TAG_COLORS, type ProjectTag } from '@/context/projects-context'
import { useOrg } from '@/context/org-context'
import { InputField } from '@/components/InputField'
import { Button } from '@/components/Button'
import { IconButton } from '@/components/IconButton'
import { Tooltip } from '@/components/Tooltip'
import { Dropdown } from '@/components/Dropdown'
import { Badge } from '@/components/Badge'
import { ChipInput } from '@/components/ChipInput'
import type { ProjectVisibility } from '@/lib/api/projects'
import { PROJECT_ROUTE, PROJECTS_ROUTE } from '@/lib/routes'

const MAX_TAGS = 5

const VISIBILITY_OPTIONS: { value: ProjectVisibility; label: string; description: string }[] = [
  { value: 'personal',  label: 'Personal',  description: 'Just you.' },
  { value: 'workspace', label: 'Workspace', description: 'Everyone in the workspace.' },
  { value: 'shared',    label: 'Shared',    description: 'You choose who to invite.' },
]

function NewProjectPageInner() {
  const { push }                     = useRouter()
  const { createProject } = useProjects()
  const { orgId }                    = useOrg()
  const [name,        setName]       = useState('')
  const [description, setDescription] = useState('')
  const [visibility,  setVisibility]  = useState<ProjectVisibility>('personal')
  const [tags,        setTags]       = useState<ProjectTag[]>([])
  const [tagInput,    setTagInput]   = useState('')
  const [loading,     setLoading]    = useState(false)
  const [visibilityOpen, setVisibilityOpen] = useState(false)

  // Workspace/Shared require an org — backend 400s otherwise (Project.create()).
  const visibilityOptions = orgId ? VISIBILITY_OPTIONS : VISIBILITY_OPTIONS.filter(o => o.value === 'personal')

  // Same commit/remove/max-5 logic as EditProjectModal's own tag editor, so a
  // tag's color/id stay stable whether it was added here or after creation.
  function commitTag() {
    const label = tagInput.trim()
    if (!label || tags.length >= MAX_TAGS || tags.some(t => t.label.toLowerCase() === label.toLowerCase())) return
    const color = TAG_COLORS[tags.length % TAG_COLORS.length]
    setTags(prev => [...prev, { id: label, label, color }])
    setTagInput('')
  }

  function removeTag(id: string) {
    setTags(prev => prev.filter(t => t.id !== id))
  }

  async function handleCreate() {
    if (!name.trim()) return
    setLoading(true)
    try {
      const project = await createProject(name.trim(), description.trim(), undefined, visibility, tags)
      push(PROJECT_ROUTE(project.id))
    } catch (err) {
      toast.error('Failed to create project', { description: err instanceof Error ? err.message : undefined })
      setLoading(false)
    }
  }

  return (
    <div
      className="kaya-scrollbar"
      style={{
        position:      'relative',
        display:       'flex',
        flexDirection: 'column',
        alignItems:    'center',
        width:         '100%',
        height:        '100%',
        overflowY:     'auto',
        paddingTop:    80,
        paddingBottom: 40,
        boxSizing:     'border-box',
      }}
    >
      {/* Back button - anchored top-left, matches /project/[id]'s back button */}
      <button
        onClick={() => push(PROJECTS_ROUTE)}
        style={{
          position:     'absolute',
          top:          6,
          left:         8,
          zIndex:       10,
          display:      'flex',
          alignItems:   'center',
          background:   'transparent',
          border:       'none',
          cursor:       'pointer',
          padding:      '4px',
          borderRadius: '10px',
          flexShrink:   0,
        }}
        aria-label="Back to Projects"
      >
        <ArrowLeftOneIcon style={{ width: 20, height: 20, color: '#524b47' }} />
      </button>

      {/* Horizontal padding lives here, not on the scrolling element above —
          keeps the scrollbar flush with the container's edge. */}
      <div
        style={{
          width:         '100%',
          maxWidth:      '608px',
          padding:       '0 24px',
          boxSizing:     'border-box',
          display:       'flex',
          flexDirection: 'column',
          gap:           '32px',
        }}
      >
        {/* Heading */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
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
            What&apos;s this project about?
          </h1>
        </div>

        {/* Form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label
              htmlFor="new-project-name"
              style={{
                fontFamily:  'var(--font-body)',
                fontWeight:  'var(--font-weight-medium)',
                fontSize:    '14px',
                lineHeight:  '22px',
                color:       '#524b47',
              }}
            >
              What are we working on
            </label>
            <InputField
              id="new-project-name"
              placeholder="Name your project"
              value={name}
              onChange={setName}
              fluid
              autoFocus
            />
          </div>

          {visibilityOptions.length > 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <label
                  style={{
                    fontFamily:  'var(--font-body)',
                    fontWeight:  'var(--font-weight-medium)',
                    fontSize:    '14px',
                    lineHeight:  '22px',
                    color:       '#524b47',
                  }}
                >
                  Who can see this
                </label>
                <Tooltip content="You can't change this once the project is created.">
                  <IconButton
                    variant="ghost"
                    size="sm"
                    icon={<InformationCircleIcon size={16} />}
                    aria-label="About project visibility"
                  />
                </Tooltip>
              </div>
              <Dropdown.Float
                open={visibilityOpen}
                onOpenChange={setVisibilityOpen}
                placement="bottom-start"
                trigger={
                  <Button variant="secondary" fluid rightIcon={<ArrowDownOneIcon size={16} />}>
                    <span style={{ flex: '1 0 0', textAlign: 'center' }}>
                      {visibilityOptions.find(o => o.value === visibility)?.label}
                    </span>
                  </Button>
                }
              >
                <Dropdown size="md" maxHeight={false}>
                  <Dropdown.Section fluid>
                    {visibilityOptions.map(opt => (
                      <Dropdown.Item
                        key={opt.value}
                        label={opt.label}
                        subLabel={opt.description}
                        selected={visibility === opt.value}
                        onClick={() => { setVisibility(opt.value); setVisibilityOpen(false) }}
                        fluid
                      />
                    ))}
                  </Dropdown.Section>
                </Dropdown>
              </Dropdown.Float>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label
              htmlFor="new-project-desc"
              style={{
                fontFamily:  'var(--font-body)',
                fontWeight:  'var(--font-weight-medium)',
                fontSize:    '14px',
                lineHeight:  '22px',
                color:       '#524b47',
              }}
            >
              What are we trying to achieve
            </label>
            <textarea
              id="new-project-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. We're redesigning onboarding to improve activation. All related research and chats go here."
              rows={5}
              style={{
                fontFamily:   'var(--font-body)',
                fontWeight:   'var(--font-weight-regular)',
                fontSize:     '14px',
                lineHeight:   '22px',
                color:        '#1a1714',
                background:   'var(--neutral-white)',
                border:       '1px solid var(--neutral-300)',
                borderRadius: '10px',
                boxShadow:    '0px 1px 1.5px 0px rgba(82,75,71,0.12)',
                outline:      'none',
                resize:       'none',
                width:        '100%',
                padding:      '10px 12px',
                boxSizing:    'border-box',
              }}
              onFocus={(e) => {
                Object.assign(e.currentTarget.style, {
                  boxShadow:   '0px 0px 0px 3px rgba(74,131,191,0.25), 0px 1px 1.5px 0px rgba(82,75,71,0.12)',
                  borderColor: 'var(--blue-400)',
                })
              }}
              onBlur={(e) => {
                Object.assign(e.currentTarget.style, {
                  boxShadow:   '0px 1px 1.5px 0px rgba(82,75,71,0.12)',
                  borderColor: 'var(--neutral-300)',
                })
              }}
            />
            <p
              style={{
                fontFamily:  'var(--font-body)',
                fontWeight:  'var(--font-weight-regular)',
                fontSize: '12px',
                lineHeight:  '16px',
                color:       '#857a72',
                margin:      0,
              }}
            >
              This becomes part of your project context.
            </p>
          </div>

          {/* Tags — same chip add/remove/max-5 pattern as EditProjectModal's
              tag editor, so a project's tags look and behave identically
              whether they were set here or added later. */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontFamily: 'var(--font-body)', fontWeight: 'var(--font-weight-medium)', fontSize: '14px', lineHeight: '22px', color: '#524b47' }}>
              Tags
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
              <AnimatePresence initial={false}>
                {tags.map((tag) => (
                  <m.div
                    key={tag.id}
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.85 }}
                    transition={{ duration: 0.12 }}
                    style={{ display: 'flex', alignItems: 'center', gap: '2px' }}
                  >
                    <Badge label={tag.label} color={tag.color} />
                    <button
                      type="button"
                      onClick={() => removeTag(tag.id)}
                      aria-label={`Remove tag ${tag.label}`}
                      style={{
                        display:        'flex',
                        alignItems:     'center',
                        justifyContent: 'center',
                        width:          16,
                        height:         16,
                        borderRadius:   '50%',
                        border:         'none',
                        background:     'transparent',
                        cursor:         'pointer',
                        padding:        0,
                        color:          'var(--neutral-500)',
                      }}
                    >
                      <CancelOneIcon style={{ width: 10, height: 10 }} />
                    </button>
                  </m.div>
                ))}
              </AnimatePresence>
              {tags.length < MAX_TAGS && (
                <ChipInput
                  placeholder="Add tag…"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); commitTag() }
                  }}
                  aria-label="New tag"
                />
              )}
            </div>
            <p style={{ fontFamily: 'var(--font-body)', fontWeight: 'var(--font-weight-regular)', fontSize: '12px', lineHeight: '16px', color: '#857a72', margin: 0 }}>
              {tags.length >= MAX_TAGS ? `Maximum of ${MAX_TAGS} tags reached` : 'Press Enter to add a tag'}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
          <Button variant="ghost" onClick={() => push(PROJECTS_ROUTE)}>
            Cancel
          </Button>
          <Button
            variant="default"
            onClick={handleCreate}
            disabled={!name.trim() || loading}
            loading={loading}
          >
            Create project
          </Button>
        </div>
      </div>
    </div>
  )
}

export default function NewProjectPage() {
  return (
    <Suspense fallback={null}>
      <NewProjectPageInner />
    </Suspense>
  )
}
