'use client'

import React, { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CancelOneIcon } from '@strange-huge/icons'
import { IconButton } from '@/components/IconButton'
import { InputField } from '@/components/InputField'
import { Button } from '@/components/Button'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface EditProjectModalProps {
  open:         boolean
  name:         string
  description:  string
  onSave:       (name: string, description: string) => void
  onClose:      () => void
}

// ── Component ──────────────────────────────────────────────────────────────────

export function EditProjectModal({ open, name, description, onSave, onClose }: EditProjectModalProps) {
  const [draftName, setDraftName]   = useState(name)
  const [draftDesc, setDraftDesc]   = useState(description)

  useEffect(() => {
    if (open) {
      setDraftName(name)
      setDraftDesc(description)
    }
  }, [open, name, description])

  function handleSave() {
    if (!draftName.trim()) return
    onSave(draftName.trim(), draftDesc.trim())
    onClose()
  }

  function handleBackdropClick(e: React.MouseEvent) {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={handleBackdropClick}
          style={{
            position:        'fixed',
            inset:           0,
            zIndex:          50,
            display:         'flex',
            alignItems:      'center',
            justifyContent:  'center',
            backgroundColor: 'rgba(26,23,20,0.4)',
          }}
        >
          <motion.div
            key="modal"
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: 'spring', stiffness: 400, damping: 32, mass: 0.8 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              background:   'var(--neutral-white)',
              borderRadius: '20px',
              boxShadow:    '0px 8px 32px 0px rgba(26,23,20,0.24), 0px 0px 0px 1px rgba(59,54,50,0.12)',
              width:        '420px',
              maxWidth:     'calc(100vw - 32px)',
              display:      'flex',
              flexDirection:'column',
              gap:          '20px',
              padding:      '20px',
            }}
          >
            {/* Modal header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <p
                style={{
                  fontFamily:  'var(--font-body)',
                  fontWeight:  'var(--font-weight-medium)',
                  fontSize:    '16px',
                  lineHeight:  'var(--line-height-body)',
                  color:       '#1a1714',
                  margin:      0,
                }}
              >
                Edit
              </p>
              <IconButton
                variant="ghost"
                size="xs"
                icon={<CancelOneIcon />}
                aria-label="Close"
                onClick={onClose}
              />
            </div>

            {/* Form */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <InputField
                label="Name*"
                value={draftName}
                onChange={setDraftName}
                placeholder="Name your project"
                fluid
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
                  Description*
                </label>
                <textarea
                  value={draftDesc}
                  onChange={(e) => setDraftDesc(e.target.value)}
                  placeholder="e.g. All discovery and design work for the V2 redesign"
                  rows={4}
                  style={{
                    fontFamily:      'var(--font-body)',
                    fontWeight:      'var(--font-weight-regular)',
                    fontSize:        '14px',
                    lineHeight:      '22px',
                    color:           '#1a1714',
                    background:      'var(--neutral-white)',
                    border:          '1px solid var(--neutral-300)',
                    borderRadius:    '10px',
                    boxShadow:       '0px 1px 1.5px 0px rgba(82,75,71,0.12)',
                    outline:         'none',
                    resize:          'none',
                    width:           '100%',
                    padding:         '10px 12px',
                    boxSizing:       'border-box',
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.boxShadow = '0px 0px 0px 3px rgba(74,131,191,0.25), 0px 1px 1.5px 0px rgba(82,75,71,0.12)'
                    e.currentTarget.style.borderColor = 'var(--blue-400)'
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.boxShadow = '0px 1px 1.5px 0px rgba(82,75,71,0.12)'
                    e.currentTarget.style.borderColor = 'var(--neutral-300)'
                  }}
                />
              </div>
            </div>

            {/* Footer */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <Button variant="ghost" onClick={onClose}>Cancel</Button>
              <Button
                variant="default"
                onClick={handleSave}
                disabled={!draftName.trim()}
              >
                Save changes
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default EditProjectModal
