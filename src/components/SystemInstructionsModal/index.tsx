'use client'

import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { PenOneIcon, CancelOneIcon } from '@strange-huge/icons'
import { IconButton } from '@/components/IconButton'
import { Button } from '@/components/Button'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SystemInstructionsModalProps {
  open:          boolean
  projectName?:  string
  value:         string
  onSave:        (text: string) => void
  onClose:       () => void
  maxLength?:    number
}

// ── Component ─────────────────────────────────────────────────────────────────

export function SystemInstructionsModal({
  open,
  projectName,
  value,
  onSave,
  onClose,
  maxLength = 2000,
}: SystemInstructionsModalProps) {
  const [draft,   setDraft]   = useState(value)
  const [mounted, setMounted] = useState(false)
  const prevOpenRef = useRef(false)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (open && !prevOpenRef.current) {
      setDraft(value)
    }
    prevOpenRef.current = open
  }, [open, value])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  function handleSave() {
    onSave(draft.trim())
    onClose()
  }

  if (!mounted) return null

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="sys-instructions-backdrop"
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
            key="sys-instructions-modal"
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1,    y: 0 }}
            exit={{    opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: 'spring', stiffness: 400, damping: 32, mass: 0.8 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              background:    'var(--neutral-white)',
              borderRadius:  '20px',
              boxShadow:     '0px 8px 32px 0px rgba(26,23,20,0.24), 0px 0px 0px 1px rgba(59,54,50,0.12)',
              width:         '560px',
              maxWidth:      'calc(100vw - 32px)',
              minHeight:     '580px',
              maxHeight:     'calc(100vh - 64px)',
              display:       'flex',
              flexDirection: 'column',
              overflow:      'hidden',
            }}
          >
            {/* ── Header ── */}
            <div
              style={{
                display:     'flex',
                alignItems:  'center',
                gap:         '12px',
                padding:     '20px 20px 16px',
                flexShrink:  0,
              }}
            >
              {/* Icon badge */}
              <div
                style={{
                  display:        'flex',
                  alignItems:     'center',
                  justifyContent: 'center',
                  width:          '36px',
                  height:         '36px',
                  borderRadius:   '10px',
                  background:     'var(--neutral-50)',
                  boxShadow:      '0px 1px 1.5px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-100)',
                  flexShrink:     0,
                }}
              >
                <PenOneIcon size={18} animated />
              </div>

              {/* Title + subtitle */}
              <div style={{ flex: '1 0 0', minWidth: 0 }}>
                <p
                  style={{
                    fontFamily:   'var(--font-title)',
                    fontWeight:   'var(--font-weight-regular)',
                    fontSize:     '24px',
                    lineHeight:   '32px',
                    color:        '#1a1714',
                    margin:       0,
                    overflow:     'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace:   'nowrap',
                  }}
                >
                  System Instructions
                </p>
                {projectName && (
                  <p
                    style={{
                      fontFamily:  'var(--font-body)',
                      fontWeight:  'var(--font-weight-regular)',
                      fontSize:    '12px',
                      lineHeight:  '18px',
                      color:       '#a39b95',
                      margin:      0,
                      overflow:    'hidden',
                      textOverflow:'ellipsis',
                      whiteSpace:  'nowrap',
                    }}
                  >
                    {projectName}
                  </p>
                )}
              </div>

              <IconButton variant="ghost" size="xs" icon={<CancelOneIcon />} aria-label="Close" onClick={onClose} />
            </div>

            {/* Divider */}
            <div style={{ height: '1px', background: 'var(--neutral-100)', flexShrink: 0 }} />

            {/* ── Body ── */}
            <div
              className="kaya-scrollbar"
              style={{
                display:       'flex',
                flexDirection: 'column',
                gap:           '14px',
                padding:       '20px',
                flex:          '1 1 0',
                minHeight:     0,
                overflowY:     'auto',
              }}
            >
              <p
                style={{
                  fontFamily:  'var(--font-body)',
                  fontWeight:  'var(--font-weight-regular)',
                  fontSize:    '13px',
                  lineHeight:  '20px',
                  color:       '#857a72',
                  margin:      0,
                }}
              >
                Set context for every chat in this project.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: '1 1 0', minHeight: 0 }}>
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value.slice(0, maxLength))}
                  maxLength={maxLength}
                  placeholder="e.g. Always respond in British English. Format all code in TypeScript. Be concise and avoid filler phrases..."
                  autoFocus
                  style={{
                    fontFamily:   'var(--font-body)',
                    fontWeight:   'var(--font-weight-regular)',
                    fontSize:     '14px',
                    lineHeight:   '22px',
                    color:        '#1a1714',
                    background:   'var(--neutral-50)',
                    border:       '1px solid var(--neutral-200)',
                    borderRadius: '12px',
                    boxShadow:    '0px 1px 1.5px 0px rgba(82,75,71,0.08)',
                    outline:      'none',
                    resize:       'none',
                    width:        '100%',
                    minHeight:    '220px',
                    flex:         '1 1 0',
                    padding:      '12px 14px',
                    boxSizing:    'border-box',
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.boxShadow   = '0px 0px 0px 3px rgba(74,131,191,0.25), 0px 1px 1.5px 0px rgba(82,75,71,0.12)'
                    e.currentTarget.style.borderColor = 'var(--blue-400)'
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.boxShadow   = '0px 1px 1.5px 0px rgba(82,75,71,0.08)'
                    e.currentTarget.style.borderColor = 'var(--neutral-200)'
                  }}
                />
                <p
                  style={{
                    fontFamily:  'var(--font-body)',
                    fontWeight:  'var(--font-weight-regular)',
                    fontSize:    '11px',
                    lineHeight:  '16px',
                    color:       '#a39b95',
                    margin:      0,
                    textAlign:   'right',
                  }}
                >
                  {draft.length} / {maxLength}
                </p>
              </div>
            </div>

            {/* Divider */}
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
              <Button variant="default" onClick={handleSave}>Save instructions</Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  )
}

export default SystemInstructionsModal
