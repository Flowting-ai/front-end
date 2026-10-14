'use client'

import React, { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { AgentsPanelContent } from '@/components/AgentsPanel'
import { BlockErrorBoundary } from '@/components/chat/BlockErrorBoundary'
import { ProjectFilesPanel } from '@/components/ProjectFilesPanel'
import { ProjectInstructionsPanel } from '@/components/ProjectInstructionsPanel'
import { ProjectMembersPanel } from '@/components/ProjectMembersPanel'
import { usePinboard } from '@/context/pinboard-context'
import { useProjectPanel } from '@/context/project-panel-context'
import { useProjectActions, type Project } from '@/context/projects-context'

export type ProjectPanelKind = 'files' | 'agents' | 'members'

const PROJECT_STORAGE_BYTES = 100 * 1024 * 1024

/**
 * Which side panel is open (Instructions & Files, Agents or Members) and what it shows. The panel
 * renders in AppLayout's shared slot, as a flex sibling like Pinboard, not inside this page's
 * border; this hook hands it the content and clears the slot on close and unmount. Only one panel
 * (or Pinboard) is open at a time. Instructions & Files starts open.
 */
export function useProjectPanels({ project, canEdit, canManageMembers, onOpenInstructions, onAddMember }: {
  project: Project | undefined
  canEdit: boolean
  canManageMembers: boolean
  /** Stable callbacks (state setters), so the slot effect does not re-run every render. */
  onOpenInstructions: () => void
  onAddMember: () => void
}) {
  const [open, setOpen] = useState<ProjectPanelKind | null>('files')
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const { panel: sharedPanel, setPanel } = useProjectPanel()
  const { isOpen: pinboardOpen, toggle: togglePinboard, close: closePinboard } = usePinboard()
  const { uploadFiles, removeFile } = useProjectActions()

  // AgentsPanelContent closes itself through the shared slot (it has no onClose). Follow a real
  // external close (slot went open → null), not the first open, where the slot is still null for a
  // moment before the effect below fills it.
  const wasSlotOpen = useRef(false)
  useEffect(() => {
    const wasOpen = wasSlotOpen.current
    wasSlotOpen.current = sharedPanel !== null
    if (open === 'agents' && wasOpen && sharedPanel === null) setOpen(null)
  }, [sharedPanel, open])

  useEffect(() => {
    if (!project || !open) { setPanel(null); return }
    const close = () => setOpen(null)
    if (open === 'files') {
      setPanel({
        title: 'Instructions & Files',
        onClose: close,
        content: (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <p style={{ fontFamily: 'var(--font-body)', fontWeight: 'var(--font-weight-regular)', fontSize: 12, lineHeight: '16px', color: 'var(--neutral-500)', margin: '-6px 0 0' }}>
              Instructions are included as part of the context for every chat in this project.
            </p>
            <BlockErrorBoundary label="instructions">
              <ProjectInstructionsPanel value={project.instructions} editable={canEdit} onOpenEditor={canEdit ? onOpenInstructions : undefined} />
            </BlockErrorBoundary>
            <BlockErrorBoundary label="files">
              <ProjectFilesPanel
                files={project.files}
                pendingFiles={pendingFiles}
                usedBytes={project.files.reduce((s, f) => s + f.sizeBytes, 0)}
                totalBytes={PROJECT_STORAGE_BYTES}
                onUpload={canEdit ? async (fileList) => {
                  const files = Array.from(fileList)
                  setPendingFiles(files)
                  try {
                    await uploadFiles(project.id, files)
                    toast.success(files.length === 1 ? 'File uploaded' : `${files.length} files uploaded`)
                  } catch {
                    // the projects context already showed the error
                  } finally {
                    setPendingFiles([])
                  }
                } : undefined}
                onRemove={canEdit ? (fileId) => removeFile(project.id, fileId) : undefined}
              />
            </BlockErrorBoundary>
          </div>
        ),
      })
    } else if (open === 'agents') {
      // The same panel /chat uses; a pick arrives as AGENT_SELECT_EVENT (use-project-composer.ts).
      setPanel({ title: 'Agents', onClose: close, content: <AgentsPanelContent inProject />, sidePadding: 8 })
    } else {
      setPanel({
        title: 'Members',
        onClose: close,
        content: (
          <BlockErrorBoundary label="member list">
            <ProjectMembersPanel projectId={project.id} ownerUserId={project.ownerUserId} canManage={canManageMembers} onAddMember={onAddMember} />
          </BlockErrorBoundary>
        ),
        sidePadding: 8,
      })
    }
  }, [project, open, pendingFiles, canEdit, canManageMembers, onOpenInstructions, onAddMember, setPanel, uploadFiles, removeFile])

  useEffect(() => () => setPanel(null), [setPanel])

  /** Opens one panel (closing Pinboard and the others), or closes it if it is already open. */
  const toggle = (kind: ProjectPanelKind) => {
    if (open !== kind) closePinboard()
    setOpen(open === kind ? null : kind)
  }
  /** Opens one panel if it is not already open. */
  const show = (kind: ProjectPanelKind) => { if (open !== kind) { closePinboard(); setOpen(kind) } }
  const togglePins = () => {
    if (!pinboardOpen) setOpen(null)
    togglePinboard()
  }

  return { open, toggle, show, pinboardOpen, togglePins }
}

export type ProjectPanels = ReturnType<typeof useProjectPanels>
