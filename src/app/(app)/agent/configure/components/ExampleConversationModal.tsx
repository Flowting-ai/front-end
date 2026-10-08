'use client'

import { useState } from 'react'
import { AnimatePresence, m } from 'framer-motion'
import { CancelOneIcon } from '@strange-huge/icons'

type Props = {
  open: boolean
  onClose: () => void
  onAdd: (userSays: string, personaReplies: string) => void
}

export default function ExampleConversationModal({ open, onClose, onAdd }: Props) {
  const [userSays, setUserSays] = useState('')
  const [personaReplies, setPersonaReplies] = useState('')

  const canSubmit = personaReplies.trim().length > 0

  const handleAdd = () => {
    if (!canSubmit) return
    onAdd(userSays.trim(), personaReplies.trim())
    setUserSays('')
    setPersonaReplies('')
    onClose()
  }

  const handleClose = () => {
    setUserSays('')
    setPersonaReplies('')
    onClose()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') handleClose()
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <m.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={handleClose}
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'var(--overlay-bg)',
              zIndex: 20,
            }}
          />

          {/* Modal card */}
          <m.div
            key="modal"
            role="dialog"
            aria-modal="true"
            aria-label="Add example conversation"
            onKeyDown={handleKeyDown}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28, mass: 0.8 }}
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              x: '-50%',
              y: '-50%',
              zIndex: 21,
              width: '100%',
              maxWidth: 540,
              backgroundColor: 'var(--modal-bg)',
              borderRadius: 18,
              padding: 12,
              boxShadow:
                '0px 12px 16px -4px var(--neutral-500-12), 0px 2px 2.8px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-100)',
            }}
          >
            {/* Header row */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 12,
              }}
            >
              <p
                style={{
                  fontFamily: 'var(--font-body)',
                  fontWeight: 500,
                  fontSize: 16,
                  lineHeight: '22px',
                  color: 'var(--legacy-1a1916)',
                  margin: 0,
                }}
              >
                Example conversations ( optional )
              </p>
              <button
                onClick={handleClose}
                aria-label="Close modal"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 3,
                  borderRadius: 6,
                  border: 'none',
                  backgroundColor: 'transparent',
                  cursor: 'pointer',
                }}
              >
                <CancelOneIcon size={18} color="var(--neutral-700)" />
              </button>
            </div>

            {/* Form body */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                {/* User says */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <p
                    style={{
                      fontFamily: 'var(--font-body)',
                      fontWeight: 400,
                      fontSize: 14,
                      lineHeight: '22px',
                      color: 'var(--red-400)',
                      margin: 0,
                    }}
                  >
                    User says:
                  </p>
                  <div
                    style={{
                      backgroundColor: 'var(--field-surface)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 2,
                      padding: '7px 10px',
                      borderRadius: 10,
                      boxShadow: '0px 1px 1.5px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px #F5F5F5',
                    }}
                  >
                    <input
                      type="text"
                      value={userSays}
                      onChange={(e) => setUserSays(e.target.value)}
                      placeholder="e.g. I need help reviewing the redesign"
                      aria-label="User says"
                      style={{
                        flex: 1,
                        fontFamily: 'var(--font-body)',
                        fontSize: 14,
                        lineHeight: '22px',
                        color: 'var(--neutral-800)',
                        backgroundColor: 'transparent',
                        outline: 'none',
                        border: 'none',
                      }}
                    />
                  </div>
                </div>

                {/* Persona replies */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, height: 129 }}>
                  <p
                    style={{
                      fontFamily: 'var(--font-body)',
                      fontWeight: 400,
                      fontSize: 14,
                      lineHeight: '22px',
                      margin: 0,
                      flexShrink: 0,
                    }}
                  >
                    <span style={{ color: 'var(--neutral-700)' }}>Agent replies</span>
                    <span style={{ color: 'var(--yellow-500)' }}>*</span>
                  </p>
                  <div
                    style={{
                      backgroundColor: 'var(--field-surface)',
                      display: 'flex',
                      flex: '1 0 0',
                      minHeight: 0,
                      padding: '7px 10px',
                      borderRadius: 10,
                      boxShadow: '0px 1px 1.5px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px #F5F5F5',
                      overflow: 'hidden',
                    }}
                  >
                    <textarea
                      value={personaReplies}
                      onChange={(e) => setPersonaReplies(e.target.value)}
                      placeholder="e.g. All discovery and design work for the V2 redesign"
                      aria-label="Agent replies"
                      style={{
                        flex: 1,
                        width: '100%',
                        height: '100%',
                        fontFamily: 'var(--font-body)',
                        fontSize: 14,
                        lineHeight: '22px',
                        color: 'var(--neutral-800)',
                        backgroundColor: 'transparent',
                        outline: 'none',
                        border: 'none',
                        resize: 'none',
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Add button */}
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  onClick={handleAdd}
                  disabled={!canSubmit}
                  style={{
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '6px 10px 8px',
                    borderRadius: 10,
                    border: 'none',
                    cursor: canSubmit ? 'pointer' : 'default',
                    boxShadow:
                      '0px 0px 0px 1px black, 0px 1.091px 1.091px 0px rgba(59,54,50,0.1), 0px 1.455px 3.127px 0px rgba(59,54,50,0.4)',
                    overflow: 'hidden',
                    opacity: canSubmit ? 1 : 0.55,
                    transition: 'opacity 150ms',
                  }}
                >
                  {/* Gradient fill */}
                  <div
                    aria-hidden
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background: 'linear-gradient(180deg, var(--neutral-700) 0%, var(--neutral-900) 100%)',
                      pointerEvents: 'none',
                    }}
                  />
                  {/* Inner edge shadows */}
                  <div
                    aria-hidden
                    style={{
                      position: 'absolute',
                      inset: 0,
                      borderRadius: 'inherit',
                      boxShadow:
                        'inset 0px 1px 0.364px 0px var(--neutral-50-30), inset 0px -2.182px 0.364px 0px #120c08, inset 0px -2.545px 4px -2.182px var(--neutral-50-50)',
                      pointerEvents: 'none',
                    }}
                  />
                  <span
                    style={{
                      position: 'relative',
                      fontFamily: 'var(--font-body)',
                      fontWeight: 500,
                      fontSize: 14,
                      lineHeight: '22px',
                      color: 'var(--static-white)',
                      whiteSpace: 'nowrap',
                      textShadow:
                        '0px -0.727px 0.364px color-mix(in srgb, var(--static-black) 25%, transparent), 0px 0.364px 0.364px var(--neutral-white-25)',
                    }}
                  >
                    Add example conversation
                  </span>
                </button>
              </div>
            </div>
          </m.div>
        </>
      )}
    </AnimatePresence>
  )
}
