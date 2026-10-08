'use client'

import { Tooltip } from '@/components/Tooltip'
import React, { useState } from 'react'
import { ArrowDownOneIcon, FolderOneIcon, PlusSignIcon, TickTwoIcon } from '@strange-huge/icons'
import { Dropdown } from '@/components/Dropdown'
import { useProjects } from '@/context/projects-context'
import { useOrg } from '@/context/org-context'
import { EditProjectModal } from '@/components/EditProjectModal'
import { PROJECT_VISIBILITY_OPTIONS } from '@/lib/api/projects'
import { ConnectAppMenu } from './ConnectAppMenu'
import styles from './ChatHome.module.css'

export function ChatHomeActions({
  projectId, onProjectChange,
}: {
  projectId: string | null
  onProjectChange: (id: string | null) => void
}) {
  const { projects, loading, createProject } = useProjects()
  const { orgId } = useOrg()
  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const selected = projects.find(project => project.id === projectId)
  const editable = projects.filter(project => project.canEdit)

  function select(id: string | null) {
    onProjectChange(id)
    setOpen(false)
  }

  return (
    <div className={styles.contextBar}>
      <Dropdown.Float
        open={open}
        onOpenChange={setOpen}
        placement="bottom-start"
        trigger={
          <Tooltip content={selected?.name} disabled={!selected?.name} maxWidth={280}><button type="button" className={styles.contextAction} aria-label={selected ? `Project: ${selected.name}` : 'Work in a project'}>
            <FolderOneIcon size={16} />
            <span className={styles.actionLabel}>{selected?.name ?? 'Work in a project'}</span>
            <ArrowDownOneIcon size={12} />
          </button></Tooltip>
        }
      >
        <Dropdown size="sm" style={{ width: 'min(300px, calc(100vw - 48px))' }} maxHeight="min(320px, calc(100dvh - 120px))">
          <Dropdown.Section label="Add this chat to a project" fluid>
            <Dropdown.Item label="No project" selected={!projectId} onClick={() => select(null)} fluid />
            {loading ? (
              <Dropdown.Item label="Loading projects…" disabled fluid />
            ) : editable.length > 0 ? editable.map(project => (
              <Dropdown.Item
                key={project.id}
                label={project.name}
                icon={<FolderOneIcon />}
                rightIcon={project.id === projectId ? <TickTwoIcon /> : undefined}
                selected={project.id === projectId}
                onClick={() => select(project.id)}
                fluid
              />
            )) : <Dropdown.Item label="No editable projects yet" disabled fluid />}
          </Dropdown.Section>
          <Dropdown.Section divider fluid>
            <button type="button" className={styles.createProject} onClick={() => { setOpen(false); setCreating(true) }}>
              <PlusSignIcon size={16} /> Create project
            </button>
          </Dropdown.Section>
        </Dropdown>
      </Dropdown.Float>
      <ConnectAppMenu />

      {/* New project without leaving the chat; the new project is selected for this chat. */}
      <EditProjectModal
        open={creating}
        mode="create"
        name=""
        description=""
        visibility="personal"
        visibilityOptions={orgId ? PROJECT_VISIBILITY_OPTIONS : []}
        onSave={async (name, description, tags, visibility) => {
          const project = await createProject(name, description, undefined, visibility, tags)
          onProjectChange(project.id)
        }}
        onClose={() => setCreating(false)}
      />
    </div>
  )
}
