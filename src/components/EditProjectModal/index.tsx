'use client'

import React, { useEffect, useEffectEvent, useRef, useState } from 'react'
import { useMounted } from '@/hooks/use-mounted'
import { createPortal } from 'react-dom'
import { AnimatePresence, m } from 'framer-motion'
import { CancelOneIcon } from '@strange-huge/icons'
import { IconButton } from '@/components/IconButton'
import { Button } from '@/components/Button'
import { Badge, type BadgeColor } from '@/components/Badge'
import { ChipInput } from '@/components/ChipInput'
import type { ProjectTag } from '@/context/projects-context'

const TAG_COLORS: BadgeColor[] = ['Blue', 'Green', 'Yellow', 'Purple', 'Red', 'Brown']

const EMPTY_PROJECT_TAGS: ProjectTag[] = []

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
  open, name, description, tags = EMPTY_PROJECT_TAGS, onSave, onClose,
}: EditProjectModalProps) {
  const [draftName, setDraftName]   = useState(name)
  const [draftDesc, setDraftDesc]   = useState(description)
  const [draftTags, setDraftTags]   = useState<ProjectTag[]>(tags)
  const [tagInput,  setTagInput]    = useState('')
  const mounted = useMounted()
  const prevOpenRef = useRef(false)

  useEffect(() => {
    if (open && !prevOpenRef.current) {
      setDraftName(name)
      setDraftDesc(description)
      setDraftTags(tags)
      setTagInput('')
    }
    prevOpenRef.current = open
  }, [open, name, description, tags])

  function commitTag() {
    const label = tagInput.trim()
    if (!label || draftTags.some(t => t.label.toLowerCase() === label.toLowerCase())) return
    const color = TAG_COLORS[draftTags.length % TAG_COLORS.length]
    setDraftTags(prev => [...prev, { id: crypto.randomUUID(), label, color }])
    setTagInput('')
  }

  function removeTag(id: string) {
    setDraftTags(prev => prev.filter(t => t.id !== id))
  }

  const closeOnEscape = useEffectEvent(onClose)
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeOnEscape() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  function handleSave() {
    if (!draftName.trim()) return
    onSave(draftName.trim(), draftDesc.trim(), draftTags)
    onClose()
  }

  function focusInput(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) {
    Object.assign(e.currentTarget.style, {
      boxShadow:   '0px 0px 0px 3px rgba(74,131,191,0.25), 0px 1px 1.5px 0px rgba(82,75,71,0.12)',
      borderColor: 'var(--blue-400)',
    })
  }
  function blurInput(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) {
    Object.assign(e.currentTarget.style, {
      boxShadow:   '0px 1px 1.5px 0px rgba(82,75,71,0.12)',
      borderColor: 'var(--neutral-200)',
    })
  }

  if (!mounted) return null

  return createPortal(
    <AnimatePresence>
      {open && (
        <m.div
          key="edit-project-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
          style={{
            position:        'fixed',
            inset:           0,
            zIndex:          21,
            display:         'flex',
            alignItems:      'center',
            justifyContent:  'center',
            backgroundColor: 'rgba(26,23,20,0.4)',
            backdropFilter:  'blur(2px)',
          }}
        >
          <m.div
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
                <label htmlFor="edit-project-name" style={LABEL_STYLE}>Name</label>
                <input
                  id="edit-project-name"
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
                <label htmlFor="edit-project-desc" style={LABEL_STYLE}>Description</label>
                <textarea
                  id="edit-project-desc"
                  value={draftDesc}
                  onChange={(e) => setDraftDesc(e.target.value)}
                  placeholder="e.g. All discovery and design work for the V2 redesign"
                  rows={4}
                  style={{ ...INPUT_BASE, resize: 'none', lineHeight: '22px' }}
                  onFocus={focusInput}
                  onBlur={blurInput}
                />
              </div>

              {/* Tags */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={LABEL_STYLE}>Tags</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
                  <AnimatePresence initial={false}>
                    {draftTags.map((tag) => (
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
                  <ChipInput
                    placeholder="Add tag…"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { e.preventDefault(); commitTag() }
                    }}
                    aria-label="New tag"
                  />
                </div>
                <p
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontWeight: 'var(--font-weight-regular)',
                    fontSize:   '11px',
                    lineHeight: '16px',
                    color:      'var(--neutral-500)',
                    margin:     0,
                  }}
                >
                  Press Enter to add a tag
                </p>
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
          </m.div>
        </m.div>
      )}
    </AnimatePresence>,
    document.body
  )
}

export default EditProjectModal
