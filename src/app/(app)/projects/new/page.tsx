'use client'

import React, { Suspense, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { ArrowDownOneIcon } from '@strange-huge/icons'
import { useProjects } from '@/context/projects-context'
import { InputField } from '@/components/InputField'
import { Button } from '@/components/Button'
import { Badge } from '@/components/Badge'
import { Dropdown } from '@/components/Dropdown'
import { useOrg } from '@/context/org-context'
import { PROJECT_ROUTE } from '@/lib/routes'

function NewProjectPageInner() {
  const { push, back }                    = useRouter()
  const searchParams                      = useSearchParams()
  const { projects, createProject }       = useProjects()
  const { orgId, teams } = useOrg()
  const [name,         setName]           = useState('')
  const [description,  setDescription]   = useState('')
  const [loading,      setLoading]        = useState(false)
  const [teamId,       setTeamId]         = useState('')
  const [teamMenuOpen, setTeamMenuOpen]   = useState(false)
  const editableTeams = useMemo(() => teams.filter(team => !team.archived && team.canEdit), [teams])
  const canCreateTeamProject = Boolean(orgId && editableTeams.length > 0)
  const requestedTeamId = searchParams.get('teamId') ?? ''

  useEffect(() => {
    if (!canCreateTeamProject) {
      setTeamId('')
      return
    }
    if (requestedTeamId && editableTeams.some(team => team.id === requestedTeamId)) {
      setTeamId(requestedTeamId)
      return
    }
    if (requestedTeamId && !editableTeams.some(team => team.id === requestedTeamId)) {
      setTeamId('')
    }
  }, [canCreateTeamProject, editableTeams, requestedTeamId])

  async function handleCreate() {
    if (!name.trim()) return
    setLoading(true)
    try {
      const project = await createProject(name.trim(), description.trim(), teamId || undefined)
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
          <div style={{ alignSelf: 'flex-start' }}>
            <Badge label={`${projects.length} Projects`} color="Neutral" />
          </div>
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

          {canCreateTeamProject && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label htmlFor="new-project-team" style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, lineHeight: '22px', color: '#524b47' }}>
                Access
              </label>
              <Dropdown.Float
                open={teamMenuOpen}
                onOpenChange={setTeamMenuOpen}
                placement="bottom-start"
                trigger={
                  <Button id="new-project-team" variant="outline" fluid rightIcon={<ArrowDownOneIcon animated />}>
                    {teamId ? `Team: ${editableTeams.find(team => team.id === teamId)?.name ?? ''}` : 'Private project'}
                  </Button>
                }
              >
                <Dropdown>
                  <Dropdown.Section>
                    <Dropdown.Item
                      label="Private project"
                      selected={teamId === ''}
                      onClick={() => { setTeamId(''); setTeamMenuOpen(false) }}
                      fluid
                    />
                    {editableTeams.map(team => (
                      <Dropdown.Item
                        key={team.id}
                        label={`Team: ${team.name}`}
                        selected={teamId === team.id}
                        onClick={() => { setTeamId(team.id); setTeamMenuOpen(false) }}
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
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
          <Button variant="ghost" onClick={() => back()}>
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
