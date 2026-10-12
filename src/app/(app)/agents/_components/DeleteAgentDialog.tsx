'use client'

import React, { useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, m } from 'framer-motion'
import { CancelOneIcon, AlertCircleIcon } from '@strange-huge/icons'
import { useMounted } from '@/hooks/use-mounted'
import { Button, IconButton } from '@/components/ui/button'
import { type Persona } from '@/lib/api/personas'

export function DeleteAgentDialog({
  target,
  onClose,
  onConfirm,
}: {
  /** The agent awaiting confirmation; null keeps the dialog closed. */
  target: Persona | null
  onClose: () => void
  /** Performs the delete; the dialog closes once it resolves. */
  onConfirm: (persona: Persona) => Promise<void>
}) {
  const mounted = useMounted()
  const [isDeleting, setIsDeleting] = useState(false)

  return mounted
    ? createPortal(
      <AnimatePresence>
        {target && (
          <>
            {/* Backdrop */}
            <m.div
              key="delete-agent-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={() => onClose()}
              style={{
                position:        'fixed',
                inset:           0,
                zIndex:          10000,
                backgroundColor: 'color-mix(in srgb, var(--static-black) 28%, transparent)',
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
                key="delete-agent-modal"
                role="dialog"
                aria-modal="true"
                aria-label="Delete agent"
                initial={{ opacity: 0, scale: 0.96, y: 8 }}
                animate={{ opacity: 1, scale: 1,    y: 0 }}
                exit={{    opacity: 0, scale: 0.96, y: 8 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                onClick={(e) => e.stopPropagation()}
                style={{
                  pointerEvents:   'auto',
                  backgroundColor: 'var(--modal-bg)',
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
                      fontFamily: 'var(--font-title)',
                      fontWeight: 400,
                      fontSize:   '24px',
                      lineHeight: '32px',
                      color:      'var(--neutral-900)',
                      margin:     0,
                    }}
                  >
                    Delete agent?
                  </p>
                  <IconButton variant="ghost" size="xs" icon={<CancelOneIcon />} aria-label="Close" onClick={() => onClose()} disabled={isDeleting} />
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
                        fontFamily:    'var(--font-body)',
                        fontWeight:    600,
                        fontSize:      '11px',
                        lineHeight:    '16px',
                        color:         'var(--red-600)',
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
                    <><strong>&ldquo;{target.name}&rdquo;</strong> will be permanently deleted. This action cannot be undone.</>
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
                  <Button variant="ghost" onClick={() => onClose()} disabled={isDeleting}>Cancel</Button>
                  <Button
                    variant="danger"
                    loading={isDeleting}
                    onClick={async () => {
            setIsDeleting(true)
            try {
              await onConfirm(target)
              onClose()
            } finally {
              setIsDeleting(false)
            }
          }}
                  >
                    Delete
                  </Button>
                </div>
              </m.div>
            </div>
          </>
        )}
      </AnimatePresence>,
      document.body
    )
    : null
}
