'use client'

import React from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, m } from 'framer-motion'
import { AlertCircleIcon, CancelOneIcon } from '@strange-huge/icons'
import { useMounted } from '@/hooks/use-mounted'
import { Button } from '@/components/Button'
import { IconButton } from '@/components/IconButton'

// Shared by every project-delete entry point (the All Projects grid/list and
// the single project page's own "Delete" menu item) so a destructive action
// this permanent — a project's chats are gone for good, even for
// Workspace/Shared projects whose *project* row gets a 30-day Trash window —
// always shows the same confirmation first, never fires straight from a
// single click anywhere in the app.

export interface DeleteProjectModalProps {
  open:        boolean
  projectName: string
  chatCount:   number
  loading?:    boolean
  onConfirm:   () => void
  onClose:     () => void
}

export function DeleteProjectModal({ open, projectName, chatCount, loading = false, onConfirm, onClose }: DeleteProjectModalProps) {
  const mounted = useMounted()
  if (!mounted) return null

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <m.div
            key="delete-project-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
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
                <IconButton variant="ghost" size="xs" icon={<CancelOneIcon />} aria-label="Close" onClick={onClose} />
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
                  {`"${projectName}"${chatCount > 0 ? ` contains ${chatCount} ${chatCount === 1 ? 'chat' : 'chats'}. Deleting this project will permanently remove all its chats.` : ' will be permanently deleted.'} This action cannot be undone.`}
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
                <Button variant="ghost" onClick={onClose} disabled={loading}>Cancel</Button>
                <Button variant="danger" onClick={onConfirm} loading={loading}>Delete</Button>
              </div>
            </m.div>
          </div>
        </>
      )}
    </AnimatePresence>,
    document.body
  )
}

export default DeleteProjectModal
