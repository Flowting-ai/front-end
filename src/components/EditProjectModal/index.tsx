'use client'

import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { CancelOneIcon } from '@strange-huge/icons'
import { IconButton } from '@/components/IconButton'
import { Button } from '@/components/Button'
import type { ProjectTag } from '@/context/projects-context'

// ── Shared input style ────────────────────────────────────────────────────────

const INPUT_BASE: React.CSSProperties = {
  fontFamily:   'var(--font-body)',
  fontWeight:   'var(--font-weight-regular)',
  fontSize:     '14px',
  lineHeight:   '22px',
  color:        '#1a1714',
  background:   'var(--neutral-white)',
  border:       '1px solid var(--neutral-200)',
  borderRadius: '10px',
  boxShadow:    '0px 1px 1.5px 0px rgba(82,75,71,0.12)',
  outline:      'none',
  width:        '100%',
  padding:      '9px 12px',
  boxSizing:    'border-box',
}

const LABEL_STYLE: React.CSSProperties = {
  fontFamily: 'var(--font-body)',
  fontWeight: 'var(--font-weight-medium)',
  fontSize:   '14px',
  lineHeight: '22px',
  color:      'var(--neutral-700)',
  display:    'block',
  margin:     0,
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface EditProjectModalProps {
  open:        boolean
  name:        string
  description: string
  tags?:       ProjectTag[]
  onSave:      (name: string, description: string, tags: ProjectTag[]) => void
  onClose:     () => void
}

// ── Component ─────────────────────────────────────────────────────────────────

export function EditProjectModal({
  open, name, description, tags = [], onSave, onClose,
}: EditProjectModalProps) {
  const [draftName, setDraftName] = useState(name)
  const [draftDesc, setDraftDesc] = useState(description)
  const [mounted,   setMounted]   = useState(false)
  const prevOpenRef = useRef(false)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (open && !prevOpenRef.current) {
      setDraftName(name)
      setDraftDesc(description)
    }
    prevOpenRef.current = open
  }, [open, name, description])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  function handleSave() {
    if (!draftName.trim()) return
    onSave(draftName.trim(), draftDesc.trim(), tags)
    onClose()
  }

  function focusInput(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) {
    e.currentTarget.style.boxShadow   = '0px 0px 0px 3px rgba(74,131,191,0.25), 0px 1px 1.5px 0px rgba(82,75,71,0.12)'
    e.currentTarget.style.borderColor = 'var(--blue-400)'
  }
  function blurInput(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) {
    e.currentTarget.style.boxShadow   = '0px 1px 1.5px 0px rgba(82,75,71,0.12)'
    e.currentTarget.style.borderColor = 'var(--neutral-200)'
  }

  if (!mounted) return null

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="edit-project-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
          style={{
            position:        'fixed',
            inset:           0,
            zIndex:          9999,
            display:         'flex',
            alignItems:      'center',
            justifyContent:  'center',
            backgroundColor: 'rgba(26,23,20,0.4)',
            backdropFilter:  'blur(2px)',
          }}
        >
          <motion.div
            key="edit-project-modal"
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1,    y: 0 }}
            exit={{    opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: 'spring', stiffness: 400, damping: 32, mass: 0.8 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              background:    'var(--neutral-white)',
              borderRadius:  '20px',
              boxShadow:     '0px 8px 32px 0px rgba(26,23,20,0.24), 0px 0px 0px 1px rgba(59,54,50,0.12)',
              width:         '480px',
              maxWidth:      'calc(100vw - 32px)',
              display:       'flex',
              flexDirection: 'column',
              overflow:      'hidden',
            }}
          >
            {/* ── Header ── */}
            <div
              style={{
                display:        'flex',
                alignItems:     'center',
                justifyContent: 'space-between',
                padding:        '20px 20px 16px',
                flexShrink:     0,
              }}
            >
              <p
                style={{
                  fontFamily: 'var(--font-title)',
                  fontWeight: 'var(--font-weight-regular)',
                  fontSize:   '24px',
                  lineHeight: '32px',
                  color:      '#1a1714',
                  margin:     0,
                }}
              >
                Edit
              </p>
              <IconButton variant="ghost" size="xs" icon={<CancelOneIcon />} aria-label="Close" onClick={onClose} />
            </div>

            <div style={{ height: '1px', background: 'var(--neutral-100)', flexShrink: 0 }} />

            {/* ── Body ── */}
            <div
              style={{
                display:       'flex',
                flexDirection: 'column',
                gap:           '20px',
                padding:       '24px 20px',
                flexShrink:    0,
              }}
            >
              {/* Name */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={LABEL_STYLE}>Name</label>
                <input
                  type="text"
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  placeholder="Name your project"
                  style={INPUT_BASE}
                  onFocus={focusInput}
                  onBlur={blurInput}
                  autoFocus
                />
              </div>

              {/* Description */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={LABEL_STYLE}>Description</label>
                <textarea
                  value={draftDesc}
                  onChange={(e) => setDraftDesc(e.target.value)}
                  placeholder="e.g. All discovery and design work for the V2 redesign"
                  rows={4}
                  style={{ ...INPUT_BASE, resize: 'none', lineHeight: '22px' }}
                  onFocus={focusInput}
                  onBlur={blurInput}
                />
              </div>
            </div>

            <div style={{ height: '1px', background: 'var(--neutral-100)', flexShrink: 0 }} />

            {/* ── Footer ── */}
            <div
              style={{
                display:        'flex',
                justifyContent: 'flex-end',
                alignItems:     'center',
                gap:            '8px',
                padding:        '16px 20px',
                flexShrink:     0,
              }}
            >
              <Button variant="ghost" onClick={onClose}>Cancel</Button>
              <Button variant="default" onClick={handleSave} disabled={!draftName.trim()}>
                Save changes
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  )
}

export default EditProjectModal
