'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { InformationCircleIcon, FolderOneIcon } from '@strange-huge/icons'
import { cn } from '@/lib/utils'

// ── Shadows ───────────────────────────────────────────────────────────────────

const SHADOW_MODAL        = '0px 8px 32px 0px rgba(82,75,71,0.18), 0px 0px 0px 1px var(--neutral-100)'
const SHADOW_ROW_SELECTED = '0px 0px 0px 1.5px var(--blue-400)'
const SHADOW_ROW_HOVER    = '0px 0px 0px 1px rgba(59,54,50,0.14)'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Project {
  id:           string
  name:         string
  description?: string
}

export interface MoveToProjectModalProps {
  open:       boolean
  onClose:    () => void
  /** Called with the selected project id when user confirms */
  onConfirm:  (projectId: string) => void
  projects?:  Project[]
  /** How many chats are being moved — shown in the header + warning copy */
  chatCount?: number
  className?: string
}

// ── ProjectRow ────────────────────────────────────────────────────────────────

interface ProjectRowProps {
  project:  Project
  selected: boolean
  onSelect: () => void
}

function ProjectRow({ project, selected, onSelect }: ProjectRowProps) {
  const [hovered, setHovered] = useState(false)

  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display:         'flex',
        alignItems:      'center',
        gap:             10,
        padding:         '10px 12px',
        borderRadius:    10,
        border:          'none',
        width:           '100%',
        textAlign:       'left',
        backgroundColor: selected || hovered ? 'var(--neutral-50)' : 'transparent',
        boxShadow:       selected ? SHADOW_ROW_SELECTED : hovered ? SHADOW_ROW_HOVER : 'none',
        cursor:          'pointer',
        transition:      'background-color 120ms, box-shadow 120ms',
      }}
    >
      {/* Folder icon container */}
      <div style={{
        display:         'inline-flex',
        alignItems:      'center',
        justifyContent:  'center',
        width:           32,
        height:          32,
        borderRadius:    8,
        backgroundColor: selected ? 'rgba(59,134,246,0.10)' : 'var(--neutral-100)',
        flexShrink:      0,
        transition:      'background-color 120ms',
      }}>
        <FolderOneIcon size={16} color={selected ? 'var(--blue-400)' : 'var(--neutral-500)'} />
      </div>

      {/* Text */}
      <div style={{ flex: '1 1 0', minWidth: 0 }}>
        <p style={{
          margin:       0,
          fontFamily:   'var(--font-body)',
          fontSize:     'var(--font-size-body)',
          fontWeight:   500,
          lineHeight:   'var(--line-height-body)',
          color:        selected ? 'var(--blue-400)' : 'var(--neutral-800)',
          overflow:     'hidden',
          textOverflow: 'ellipsis',
          whiteSpace:   'nowrap',
          transition:   'color 120ms',
        }}>
          {project.name}
        </p>
        {project.description && (
          <p style={{
            margin:       '2px 0 0',
            fontFamily:   'var(--font-body)',
            fontSize:     'var(--font-size-caption)',
            fontWeight:   400,
            lineHeight:   'var(--line-height-caption)',
            color:        'var(--neutral-400)',
            overflow:     'hidden',
            textOverflow: 'ellipsis',
            whiteSpace:   'nowrap',
          }}>
            {project.description}
          </p>
        )}
      </div>

      {/* Radio dot */}
      <div style={{
        width:           18,
        height:          18,
        borderRadius:    '50%',
        boxShadow:       selected ? 'none' : '0px 0px 0px 1.5px rgba(59,54,50,0.28)',
        backgroundColor: selected ? 'var(--blue-400)' : 'transparent',
        flexShrink:      0,
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'center',
        transition:      'background-color 150ms, box-shadow 150ms',
      }}>
        {selected && (
          <div style={{
            width:           7,
            height:          7,
            borderRadius:    '50%',
            backgroundColor: 'var(--neutral-white)',
          }} />
        )}
      </div>
    </button>
  )
}

// ── ModalButton ───────────────────────────────────────────────────────────────

interface ModalButtonProps {
  children:  React.ReactNode
  variant?:  'ghost' | 'primary'
  disabled?: boolean
  onClick?:  () => void
}

function ModalButton({ children, variant = 'ghost', disabled = false, onClick }: ModalButtonProps) {
  const [hovered, setHovered] = useState(false)
  const isPrimary = variant === 'primary'

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      onMouseEnter={() => !disabled && setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display:         'inline-flex',
        alignItems:      'center',
        justifyContent:  'center',
        padding:         '8px 16px',
        borderRadius:    10,
        border:          'none',
        backgroundColor: isPrimary
          ? disabled ? 'var(--neutral-200)' : hovered ? 'var(--neutral-900)' : 'var(--neutral-800)'
          : hovered ? 'var(--neutral-100)' : 'transparent',
        boxShadow: isPrimary && !disabled
          ? '0px 1px 2px 0px rgba(82,75,71,0.16), 0px 0px 0px 1px rgba(59,54,50,0.12)'
          : 'none',
        fontFamily:  'var(--font-body)',
        fontSize:    'var(--font-size-body)',
        fontWeight:  500,
        lineHeight:  'var(--line-height-body)',
        color:       isPrimary
          ? disabled ? 'var(--neutral-400)' : 'var(--neutral-white)'
          : 'var(--neutral-600)',
        cursor:      disabled ? 'not-allowed' : 'pointer',
        transition:  'background-color 120ms, box-shadow 120ms',
        whiteSpace:  'nowrap',
        flexShrink:  0,
      }}
    >
      {children}
    </button>
  )
}

// ── MoveToProjectModal ────────────────────────────────────────────────────────

export function MoveToProjectModal({
  open,
  onClose,
  onConfirm,
  projects  = [],
  chatCount = 1,
  className,
}: MoveToProjectModalProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [mounted,    setMounted]    = useState(false)

  useEffect(() => { setMounted(true) }, [])

  const handleConfirm = () => {
    if (!selectedId) return
    onConfirm(selectedId)
    setSelectedId(null)
  }

  const handleClose = () => {
    setSelectedId(null)
    onClose()
  }

  const chatLabel = chatCount === 1 ? '1 chat' : `${chatCount} chats`
  const noun      = chatCount === 1 ? 'this chat' : 'these chats'

  if (!mounted) return null

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop — rendered in root stacking context via portal */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={handleClose}
            style={{
              position:        'fixed',
              inset:           0,
              backgroundColor: 'rgba(0,0,0,0.28)',
              backdropFilter:  'blur(2px)',
              zIndex:          9998,
            }}
          />

          {/* Centering wrapper — flexbox avoids transform conflict with framer-motion */}
          <div
            style={{
              position:       'fixed',
              inset:          0,
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
              zIndex:         9999,
              pointerEvents:  'none',
            }}
          >
          {/* Card — framer-motion owns transform; wrapper handles centering */}
          <motion.div
            key="modal"
            role="dialog"
            aria-modal="true"
            aria-label={`Move ${chatLabel} to project`}
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className={cn(className)}
            style={{
              pointerEvents:   'auto',
              width:           480,
              maxWidth:        'calc(100vw - 32px)',
              borderRadius:    16,
              backgroundColor: 'var(--neutral-white)',
              boxShadow:       SHADOW_MODAL,
              overflow:        'hidden',
            }}
          >

            {/* ── Header ─────────────────────────────────────────────────── */}
            <div style={{
              padding:      '20px 20px 16px',
              borderBottom: '1px solid var(--neutral-100)',
            }}>
              <p style={{
                margin:     0,
                fontFamily: 'var(--font-body)',
                fontSize:   'var(--font-size-body-lg)',
                fontWeight: 600,
                lineHeight: 'var(--line-height-body-lg)',
                color:      'var(--neutral-900)',
              }}>
                Move to project
              </p>
              <p style={{
                margin:     '3px 0 0',
                fontFamily: 'var(--font-body)',
                fontSize:   'var(--font-size-caption)',
                fontWeight: 400,
                lineHeight: 'var(--line-height-caption)',
                color:      'var(--neutral-400)',
              }}>
                Moving {chatLabel}
              </p>
            </div>

            {/* ── Context warning — read before picking ──────────────────── */}
            <div style={{
              margin:          '16px 16px 0',
              padding:         '12px 14px',
              borderRadius:    10,
              backgroundColor: 'rgba(251,145,58,0.07)',
              boxShadow:       '0px 0px 0px 1px rgba(251,145,58,0.22)',
              display:         'flex',
              gap:             10,
              alignItems:      'flex-start',
            }}>
              <div aria-hidden style={{ flexShrink: 0, marginTop: 2 }}>
                <InformationCircleIcon size={16} color="rgba(172,80,10,0.85)" />
              </div>
              <div>
                <p style={{
                  margin:     0,
                  fontFamily: 'var(--font-body)',
                  fontSize:   'var(--font-size-body)',
                  fontWeight: 600,
                  lineHeight: 'var(--line-height-body)',
                  color:      'rgba(140,65,10,1)',
                }}>
                  {noun.charAt(0).toUpperCase() + noun.slice(1)} will know everything the project knows
                </p>
                <p style={{
                  margin:     '5px 0 0',
                  fontFamily: 'var(--font-body)',
                  fontSize:   'var(--font-size-caption)',
                  fontWeight: 400,
                  lineHeight: 'var(--line-height-caption)',
                  color:      'rgba(140,65,10,0.78)',
                }}>
                  All of the project's instructions, uploaded files, and context will be
                  automatically available inside {noun} once moved. The AI will use that
                  knowledge in every reply.
                </p>
              </div>
            </div>

            {/* ── Project list ───────────────────────────────────────────── */}
            <div
              role="radiogroup"
              aria-label="Select a project"
              style={{
                padding:       '12px 16px',
                display:       'flex',
                flexDirection: 'column',
                gap:           4,
                maxHeight:     272,
                overflowY:     'auto',
              }}
            >
              {projects.length === 0 ? (
                <p style={{
                  margin:     '20px 0',
                  textAlign:  'center',
                  fontFamily: 'var(--font-body)',
                  fontSize:   'var(--font-size-body)',
                  color:      'var(--neutral-400)',
                }}>
                  No projects yet
                </p>
              ) : (
                projects.map((project) => (
                  <ProjectRow
                    key={project.id}
                    project={project}
                    selected={selectedId === project.id}
                    onSelect={() => setSelectedId(project.id)}
                  />
                ))
              )}
            </div>

            {/* ── Footer ─────────────────────────────────────────────────── */}
            <div style={{
              display:        'flex',
              justifyContent: 'flex-end',
              alignItems:     'center',
              gap:            8,
              padding:        '12px 16px 16px',
              borderTop:      '1px solid var(--neutral-100)',
            }}>
              <ModalButton variant="ghost" onClick={handleClose}>
                Cancel
              </ModalButton>
              <ModalButton variant="primary" disabled={!selectedId} onClick={handleConfirm}>
                Move to project
              </ModalButton>
            </div>

          </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  )
}

export default MoveToProjectModal
