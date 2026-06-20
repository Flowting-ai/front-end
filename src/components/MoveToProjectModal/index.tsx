'use client'

import React, { useState, useRef } from 'react'
import { useMounted } from '@/hooks/use-mounted'
import { createPortal } from 'react-dom'
import { m, AnimatePresence } from 'framer-motion'
import { FolderOneIcon, CancelOneIcon, InformationCircleIcon } from '@strange-huge/icons'
import { cn } from '@/lib/utils'
import { Button }     from '@/components/Button'
import { IconButton } from '@/components/IconButton'

// ── Shadows ───────────────────────────────────────────────────────────────────

const SHADOW_MODAL        = '0px 8px 32px 0px rgba(82,75,71,0.18), 0px 0px 0px 1px var(--neutral-100)'
const SHADOW_ROW_SELECTED = '0px 0px 0px 1.5px var(--blue-400)'
const SHADOW_ROW_HOVER    = '0px 0px 0px 1px rgba(59,54,50,0.14)'

const EMPTY_PROJECTS: Project[] = []

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
  const buttonRef = useRef<HTMLButtonElement>(null)

  const applyHoverStyle = () => {
    if (!buttonRef.current) return
    buttonRef.current.style.backgroundColor = selected ? 'var(--neutral-50)' : 'rgba(237,225,215,0.6)'
    buttonRef.current.style.boxShadow = selected ? SHADOW_ROW_SELECTED : SHADOW_ROW_HOVER
  }
  const clearHoverStyle = () => {
    if (!buttonRef.current) return
    buttonRef.current.style.backgroundColor = selected ? 'var(--neutral-50)' : 'transparent'
    buttonRef.current.style.boxShadow = selected ? SHADOW_ROW_SELECTED : 'none'
  }

  return (
    <button
      ref={buttonRef}
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      onMouseEnter={applyHoverStyle}
      onMouseLeave={clearHoverStyle}
      style={{
        display:         'flex',
        alignItems:      'center',
        gap:             10,
        padding:         '10px 12px',
        borderRadius:    10,
        border:          'none',
        width:           '100%',
        textAlign:       'left',
        backgroundColor: selected ? 'var(--neutral-50)' : 'transparent',
        boxShadow:       selected ? SHADOW_ROW_SELECTED : 'none',
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
        <FolderOneIcon size={16} color={selected ? 'var(--blue-400)' : 'var(--neutral-500)'} variant="static" />
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

// ── MoveToProjectModal ────────────────────────────────────────────────────────

export function MoveToProjectModal({
  open,
  onClose,
  onConfirm,
  projects  = EMPTY_PROJECTS,
  chatCount = 1,
  className,
}: MoveToProjectModalProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [atTop,      setAtTop]      = useState(true)
  const [atBottom,   setAtBottom]   = useState(false)
  const mounted = useMounted()

  const handleConfirm = () => {
    if (!selectedId) return
    onConfirm(selectedId)
    setSelectedId(null)
  }

  const handleClose = () => {
    setSelectedId(null)
    onClose()
  }

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget
    setAtTop(el.scrollTop < 8)
    setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 8)
  }

  const chatLabel = chatCount === 1 ? '1 chat' : `${chatCount} chats`
  const noun      = chatCount === 1 ? 'this chat' : 'these chats'

  if (!mounted) return null

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop — rendered in root stacking context via portal */}
          <m.div
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
              zIndex:          20,
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
              zIndex:         21,
              pointerEvents:  'none',
            }}
          >
          {/* Card — framer-motion owns transform; wrapper handles centering */}
          <m.div
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
              position:     'relative',
            }}>
              <p style={{
                margin:     0,
                fontFamily: 'var(--font-title)',
                fontSize:   '1.5rem',
                fontWeight: 400,
                lineHeight: '2rem',
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
              <div style={{ position: 'absolute', top: 14, right: 14 }}>
                <IconButton
                  variant="ghost"
                  size="sm"
                  aria-label="Close"
                  icon={<CancelOneIcon size={16} />}
                  onClick={handleClose}
                />
              </div>
            </div>

            {/* ── Context card — ModelFeaturedCard default (unselected) style ── */}
            <div style={{
              margin:          '16px 16px 0',
              borderRadius:    12,
              position:        'relative',
              overflow:        'hidden',
              backgroundColor: '#FFFFFF',
              boxShadow:       'var(--shadow-model-featured-default-outer)',
            }}>
              {/* Inner depth shadow */}
              <div aria-hidden style={{
                position:      'absolute',
                inset:         0,
                borderRadius:  'inherit',
                boxShadow:     'var(--shadow-model-featured-default-inner)',
                pointerEvents: 'none',
              }} />

              {/* Content */}
              <div style={{
                position:      'relative',
                padding:       '12px 14px',
                display:       'flex',
                flexDirection: 'column',
                gap:           4,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <InformationCircleIcon animated size={16} color="var(--neutral-500)" />
                  <p style={{
                    margin:     0,
                    fontFamily: 'var(--font-body)',
                    fontWeight: 500,
                    fontSize:   '15px',
                    lineHeight: '20px',
                    color:      'var(--neutral-700)',
                  }}>
                    {noun.charAt(0).toUpperCase() + noun.slice(1)} will know everything the project knows
                  </p>
                </div>
                <p style={{
                  margin:     0,
                  fontFamily: 'var(--font-body)',
                  fontWeight: 400,
                  fontSize:   'var(--font-size-caption)',
                  lineHeight: 'var(--line-height-caption)',
                  color:      'var(--neutral-600)',
                }}>
                  All of the project's instructions, uploaded files, and context will be
                  automatically available inside {noun} once moved. The AI will use that
                  knowledge in every reply.
                </p>
              </div>
            </div>

            {/* ── Project list ───────────────────────────────────────────── */}
            <div style={{ position: 'relative', padding: '12px 16px 0' }}>
              <div
                role="radiogroup"
                aria-label="Select a project"
                className="kaya-scrollbar"
                onScroll={handleScroll}
                style={{
                  display:             'flex',
                  flexDirection:       'column',
                  gap:                 4,
                  maxHeight:           240,
                  overflowY:           'auto',
                  overscrollBehaviorY: 'contain',
                  padding:             3,
                  paddingBottom:       12,
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

              {/* Top blur edge */}
              {[
                { height: 32, blur: 2 },
                { height: 20, blur: 4 },
                { height: 12, blur: 6 },
              ].map(({ height, blur }) => (
                <div key={blur} aria-hidden style={{
                  position:            'absolute',
                  top: 12, left: 16, right: 16,
                  height:              `${height}px`,
                  backdropFilter:      `blur(${blur}px)`,
                  WebkitBackdropFilter:`blur(${blur}px)`,
                  maskImage:           'linear-gradient(to bottom, black 0%, transparent 100%)',
                  WebkitMaskImage:     'linear-gradient(to bottom, black 0%, transparent 100%)',
                  pointerEvents:       'none',
                  zIndex:              10,
                  opacity:             atTop ? 0 : 1,
                  transition:          'opacity 150ms ease',
                }} />
              ))}
              <div aria-hidden style={{
                position:      'absolute',
                top: 12, left: 16, right: 16,
                height:        '32px',
                background:    'linear-gradient(to bottom, var(--neutral-white) 0%, transparent 100%)',
                pointerEvents: 'none',
                zIndex:        11,
                opacity:       atTop ? 0 : 1,
                transition:    'opacity 150ms ease',
              }} />

              {/* Bottom blur edge */}
              {[
                { height: 32, blur: 2 },
                { height: 20, blur: 4 },
                { height: 12, blur: 6 },
              ].map(({ height, blur }) => (
                <div key={blur} aria-hidden style={{
                  position:            'absolute',
                  bottom: 0, left: 16, right: 16,
                  height:              `${height}px`,
                  backdropFilter:      `blur(${blur}px)`,
                  WebkitBackdropFilter:`blur(${blur}px)`,
                  maskImage:           'linear-gradient(to top, black 0%, transparent 100%)',
                  WebkitMaskImage:     'linear-gradient(to top, black 0%, transparent 100%)',
                  pointerEvents:       'none',
                  zIndex:              10,
                  opacity:             atBottom ? 0 : 1,
                  transition:          'opacity 150ms ease',
                }} />
              ))}
              <div aria-hidden style={{
                position:      'absolute',
                bottom: 0, left: 16, right: 16,
                height:        '32px',
                background:    'linear-gradient(to top, var(--neutral-white) 0%, transparent 100%)',
                pointerEvents: 'none',
                zIndex:        11,
                opacity:       atBottom ? 0 : 1,
                transition:    'opacity 150ms ease',
              }} />
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
              <Button variant="ghost" onClick={handleClose}>
                Cancel
              </Button>
              <Button variant="default" disabled={!selectedId} onClick={handleConfirm}>
                Move to project
              </Button>
            </div>

          </m.div>
          </div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  )
}

export default MoveToProjectModal
