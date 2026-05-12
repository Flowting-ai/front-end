'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useProjects } from '@/context/projects-context'
import { InputField } from '@/components/InputField'
import { Button } from '@/components/Button'
import { Badge } from '@/components/Badge'

export default function NewProjectPage() {
  const router                            = useRouter()
  const { projects, createProject }       = useProjects()
  const [name,         setName]           = useState('')
  const [description,  setDescription]   = useState('')
  const [loading,      setLoading]        = useState(false)

  async function handleCreate() {
    if (!name.trim()) return
    setLoading(true)
    const project = createProject(name.trim(), description.trim())
    router.push(`/project/${project.id}`)
  }

  return (
    <div
      style={{
        display:       'flex',
        flexDirection: 'column',
        alignItems:    'center',
        width:         '100%',
        height:        '100%',
        overflowY:     'auto',
        padding:       '80px 24px 40px',
        boxSizing:     'border-box',
      }}
    >
      <div
        style={{
          width:         '100%',
          maxWidth:      '560px',
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
          <Badge label={`${projects.length} Projects`} color="Neutral" />
        </div>

        {/* Form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <InputField
            label="What are we working on"
            placeholder="Name your project"
            value={name}
            onChange={setName}
            fluid
            autoFocus
          />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label
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
                e.currentTarget.style.boxShadow   = '0px 0px 0px 3px rgba(74,131,191,0.25), 0px 1px 1.5px 0px rgba(82,75,71,0.12)'
                e.currentTarget.style.borderColor = 'var(--blue-400)'
              }}
              onBlur={(e) => {
                e.currentTarget.style.boxShadow   = '0px 1px 1.5px 0px rgba(82,75,71,0.12)'
                e.currentTarget.style.borderColor = 'var(--neutral-300)'
              }}
            />
            <p
              style={{
                fontFamily:  'var(--font-body)',
                fontWeight:  'var(--font-weight-regular)',
                fontSize:    '11px',
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
          <Button variant="ghost" onClick={() => router.back()}>
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
