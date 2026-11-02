'use client'

import React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { AlertCircleIcon, CancelOneIcon } from '@strange-huge/icons'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Button, IconButton } from '@/components/ui/button'

// Shared by every project-delete entry point (the All Projects grid/list and
// the single project page's own "Delete" menu item) so a destructive action
// always shows the same confirmation first, never fires straight from a
// single click anywhere in the app. What the delete does depends on the type
// (back-end project.py delete/restore): a Personal project and its chats are
// hard-deleted; a Workspace/Shared project and its chats go to Recently
// Deleted for 30 days and can be restored. Files are removed either way.

export interface DeleteProjectModalProps {
  open:        boolean
  projectName: string
  chatCount:   number
  /** Workspace/Shared projects are soft-deleted and restorable for 30 days. */
  restorable?: boolean
  loading?:    boolean
  onConfirm:   () => void
  onClose:     () => void
}

function deleteMessage(projectName: string, chatCount: number, restorable: boolean): string {
  const chats = chatCount > 0 ? ` and its ${chatCount} ${chatCount === 1 ? 'chat' : 'chats'}` : ''
  return restorable
    ? `"${projectName}"${chats} will move to Recently Deleted, where the owner can restore ${chatCount > 0 ? 'them' : 'it'} for 30 days. Its files are removed now.`
    : `"${projectName}"${chats} will be permanently deleted. This action cannot be undone.`
}

export function DeleteProjectModal({ open, projectName, chatCount, restorable = false, loading = false, onConfirm, onClose }: DeleteProjectModalProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next && !loading) onClose() }}>
      <DialogContent
        hideClose
        role="alertdialog"
        aria-modal="true"
        onEscapeKeyDown={(e) => { if (loading) e.preventDefault() }}
        onInteractOutside={(e) => { if (loading) e.preventDefault() }}
        style={{
          background:      'var(--modal-bg)',
          boxShadow:       '0px 8px 32px 0px rgba(82,75,71,0.18), 0px 0px 0px 1px var(--neutral-100)',
          width:           480,
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
          <DialogPrimitive.Title asChild>
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
          </DialogPrimitive.Title>
          <IconButton variant="ghost" size="xs" icon={<CancelOneIcon />} aria-label="Close" onClick={onClose} disabled={loading} />
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

          <DialogPrimitive.Description asChild>
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
            {deleteMessage(projectName, chatCount, restorable)}
          </p>
          </DialogPrimitive.Description>
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
          <Button variant="ghost" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button variant="danger" onClick={onConfirm} loading={loading}>Delete</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default DeleteProjectModal
