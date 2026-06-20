'use client'

import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CancelOneIcon,
  PenOneIcon,
  DeleteTwoIcon,
  PlusSignIcon,
  PinIcon,
  UserIcon,
} from '@strange-huge/icons'
import { ConnectorIcon } from './lib/ConnectorIcon'
import { Button } from '@/components/Button'
import { IconButton } from '@/components/IconButton'
import { springs } from '@/lib/springs'
import { getPersonaFallbackAvatar } from '@/lib/persona-template-avatars'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ProjectConfig {
  name:           string
  defaultPersona?: { id: string; name: string; handle: string; avatarUrl?: string }
  defaultPins?:    Array<{ id: string; title: string; source?: string }>
  connectors?:     Array<{ name: string; status: 'connected' | 'failed' | 'pending' }>
}

export interface ProjectConfigPanelProps extends ProjectConfig {
  onClose?:         () => void
  onSave?:          (config: ProjectConfig) => void
  onChoosePersona?: () => void
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontFamily: 'var(--font-body)',
      fontSize:   'var(--font-size-caption)',
      fontWeight: 'var(--font-weight-medium)',
      lineHeight: 'var(--line-height-caption)',
      color:      'var(--neutral-400)',
      padding:    '16px 0 6px',
    }}>
      {children}
    </div>
  )
}

function Divider() {
  return <div style={{ height: 1, backgroundColor: 'var(--neutral-100)', flexShrink: 0 }} />
}

// ── ConnectorStatusDot ─────────────────────────────────────────────────────────

function ConnectorStatusDot({ status }: { status: 'connected' | 'failed' | 'pending' }) {
  const color =
    status === 'connected' ? 'var(--color-tag-Green-text)' :
    status === 'failed'    ? 'var(--color-tag-Red-text)'   :
                             'var(--neutral-300)'
  return (
    <span style={{
      display:         'inline-block',
      width:           6,
      height:          6,
      borderRadius:    '50%',
      backgroundColor: color,
      flexShrink:      0,
    }} />
  )
}

// ── ProjectConfigPanel ─────────────────────────────────────────────────────────

export function ProjectConfigPanel({
  name:            initialName,
  defaultPersona,
  defaultPins,
  connectors,
  onClose,
  onSave,
  onChoosePersona,
}: ProjectConfigPanelProps) {
  const [editingName, setEditingName]     = React.useState(false)
  const [nameValue,   setNameValue]       = React.useState(initialName)
  const [pins,        setPins]            = React.useState(defaultPins ?? [])
  const nameInputRef                      = React.useRef<HTMLInputElement>(null)

  const handleSave = () => {
    onSave?.({
      name:           nameValue,
      defaultPersona,
      defaultPins:    pins,
      connectors,
    })
    onClose?.()
  }

  const handleNameEdit = () => {
    setEditingName(true)
    requestAnimationFrame(() => nameInputRef.current?.focus())
  }

  const handleNameBlur = () => {
    setEditingName(false)
    if (!nameValue.trim()) setNameValue(initialName)
  }

  const handleRemovePin = (id: string) => {
    setPins(prev => prev.filter(p => p.id !== id))
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 12 }}
      transition={springs.moderate}
      style={{
        position:        'absolute',
        inset:           0,
        backgroundColor: 'var(--neutral-50)',
        display:         'flex',
        flexDirection:   'column',
        zIndex:          10,
        overflow:        'hidden',
      }}
    >
      {/* ── Header ── */}
      <div style={{
        display:        'flex',
        alignItems:     'center',
        gap:            8,
        padding:        '16px 16px 12px',
        flexShrink:     0,
      }}>
        <span style={{
          flex:       '1 0 0',
          fontFamily: 'var(--font-body)',
          fontSize:   'var(--font-size-body)',
          fontWeight: 'var(--font-weight-medium)',
          lineHeight: 'var(--line-height-body)',
          color:      'var(--neutral-600)',
        }}>
          Project settings
        </span>
        {onClose && (
          <IconButton
            variant="ghost"
            size="xs"
            aria-label="Close"
            onClick={onClose}
            icon={<CancelOneIcon />}
          />
        )}
      </div>

      <Divider />

      {/* ── Scrollable body ── */}
      <div
        tabIndex={-1}
        className="kaya-scrollbar"
        style={{
          flex:                '1 0 0',
          minHeight:           0,
          overflowY:           'auto',
          overflowX:           'hidden',
          overscrollBehaviorY: 'contain',
          padding:             '0 16px',
          outline:             'none',
        }}
      >

        {/* Project name */}
        <SectionLabel>Name</SectionLabel>
        <div style={{
          display:      'flex',
          alignItems:   'center',
          gap:          8,
          padding:      '6px 0 14px',
        }}>
          {editingName ? (
            <input
              ref={nameInputRef}
              value={nameValue}
              onChange={e => setNameValue(e.target.value)}
              onBlur={handleNameBlur}
              onKeyDown={e => { if (e.key === 'Enter') nameInputRef.current?.blur() }}
              style={{
                flex:        '1 0 0',
                fontFamily:  'var(--font-body)',
                fontSize:    'var(--font-size-body)',
                lineHeight:  'var(--line-height-body)',
                color:       'var(--neutral-800)',
                background:  'var(--neutral-100)',
                border:      '1.5px solid var(--neutral-200)',
                borderRadius: 8,
                padding:     '5px 8px',
                outline:     'none',
              }}
            />
          ) : (
            <span style={{
              flex:         '1 0 0',
              fontFamily:   'var(--font-body)',
              fontSize:     'var(--font-size-body)',
              lineHeight:   'var(--line-height-body)',
              color:        'var(--neutral-800)',
              overflow:     'hidden',
              textOverflow: 'ellipsis',
              whiteSpace:   'nowrap',
            }}>
              {nameValue}
            </span>
          )}
          {!editingName && (
            <IconButton
              variant="ghost"
              size="xs"
              aria-label="Edit project name"
              onClick={handleNameEdit}
              icon={<PenOneIcon />}
            />
          )}
        </div>

        <Divider />

        {/* Default persona */}
        <SectionLabel>Default persona</SectionLabel>
        {defaultPersona ? (
          <div style={{
            display:    'flex',
            alignItems: 'center',
            gap:        10,
            padding:    '6px 0 14px',
          }}>
            <div style={{
              width:        32,
              height:       32,
              borderRadius: 8,
              overflow:     'hidden',
              flexShrink:   0,
            }}>
              <img
                src={defaultPersona.avatarUrl ?? getPersonaFallbackAvatar(defaultPersona.id)}
                alt=""
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0, flex: '1 0 0' }}>
              <span style={{
                fontFamily:   'var(--font-body)',
                fontSize:     'var(--font-size-body)',
                fontWeight:   'var(--font-weight-medium)',
                lineHeight:   'var(--line-height-body)',
                color:        'var(--neutral-800)',
                overflow:     'hidden',
                textOverflow: 'ellipsis',
                whiteSpace:   'nowrap',
              }}>
                {defaultPersona.name}
              </span>
              <span style={{
                fontFamily: 'var(--font-code)',
                fontSize:   'var(--font-size-code)',
                lineHeight: 'var(--line-height-code)',
                color:      'var(--neutral-400)',
              }}>
                @{defaultPersona.handle}
              </span>
            </div>
          </div>
        ) : (
          <div style={{ padding: '6px 0 14px' }}>
            <button
              type="button"
              onClick={onChoosePersona}
              disabled={!onChoosePersona}
              style={{
                display:      'inline-flex',
                alignItems:   'center',
                gap:          6,
                background:   'none',
                border:       '1.5px dashed var(--neutral-200)',
                borderRadius: 8,
                padding:      '6px 10px',
                cursor:       onChoosePersona ? 'pointer' : 'default',
                color:        'var(--neutral-400)',
                opacity:      onChoosePersona ? 1 : 0.5,
              }}
            >
              <UserIcon size={12} color="var(--neutral-400)" />
              <span style={{
                fontFamily: 'var(--font-body)',
                fontSize:   'var(--font-size-caption)',
                lineHeight: 'var(--line-height-caption)',
              }}>
                Choose persona
              </span>
            </button>
          </div>
        )}

        <Divider />

        {/* Default pins */}
        <SectionLabel>Pinned context</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', paddingBottom: 14 }}>
          {pins.map((pin, i) => (
            <div
              key={pin.id}
              style={{
                display:   'flex',
                alignItems: 'flex-start',
                gap:       8,
                padding:   '7px 0',
                borderTop: i > 0 ? '1px solid var(--neutral-100)' : 'none',
              }}
            >
              <span style={{ flexShrink: 0, lineHeight: 0, marginTop: 3 }}>
                <PinIcon size={12} color="var(--neutral-400)" />
              </span>
              <div style={{ flex: '1 0 0', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
                <span style={{
                  fontFamily:   'var(--font-body)',
                  fontSize:     'var(--font-size-body)',
                  lineHeight:   'var(--line-height-body)',
                  color:        'var(--neutral-700)',
                  overflow:     'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace:   'nowrap',
                }}>
                  {pin.title}
                </span>
                {pin.source && (
                  <span style={{
                    fontFamily: 'var(--font-body)',
                    fontSize:   'var(--font-size-caption)',
                    lineHeight: 'var(--line-height-caption)',
                    color:      'var(--neutral-400)',
                  }}>
                    {pin.source}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => handleRemovePin(pin.id)}
                aria-label={`Remove ${pin.title}`}
                style={{
                  display:        'inline-flex',
                  alignItems:     'center',
                  justifyContent: 'center',
                  width:          20,
                  height:         20,
                  background:     'none',
                  border:         'none',
                  borderRadius:   5,
                  cursor:         'pointer',
                  flexShrink:     0,
                  lineHeight:     0,
                  marginTop:      2,
                }}
              >
                <DeleteTwoIcon size={12} color="var(--neutral-300)" />
              </button>
            </div>
          ))}
          <button
            type="button"
            style={{
              display:      'inline-flex',
              alignItems:   'center',
              gap:          6,
              background:   'none',
              border:       '1.5px dashed var(--neutral-200)',
              borderRadius: 8,
              padding:      '6px 10px',
              cursor:       'pointer',
              color:        'var(--neutral-400)',
              marginTop:    pins.length > 0 ? 8 : 0,
            }}
          >
            <PlusSignIcon size={12} color="var(--neutral-400)" />
            <span style={{
              fontFamily: 'var(--font-body)',
              fontSize:   'var(--font-size-caption)',
              lineHeight: 'var(--line-height-caption)',
            }}>
              Add pin
            </span>
          </button>
        </div>

        {/* Connected tools */}
        {connectors && connectors.length > 0 && (
          <>
            <Divider />
            <SectionLabel>Connected tools</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', paddingBottom: 14 }}>
              {connectors.map((c, i) => (
                <div
                  key={c.name}
                  style={{
                    display:   'flex',
                    alignItems: 'center',
                    gap:       10,
                    padding:   '7px 0',
                    borderTop: i > 0 ? '1px solid var(--neutral-100)' : 'none',
                  }}
                >
                  <span style={{ position: 'relative', display: 'inline-flex', flexShrink: 0, lineHeight: 0 }}>
                    <ConnectorIcon id={c.name} size={16} style={{ borderRadius: 3 }} />
                    <ConnectorStatusDot status={c.status} />
                  </span>
                  <span style={{
                    flex:       '1 0 0',
                    fontFamily: 'var(--font-body)',
                    fontSize:   'var(--font-size-body)',
                    lineHeight: 'var(--line-height-body)',
                    color:      'var(--neutral-700)',
                  }}>
                    {c.name}
                  </span>
                  <span style={{
                    fontFamily: 'var(--font-body)',
                    fontSize:   'var(--font-size-caption)',
                    lineHeight: 'var(--line-height-caption)',
                    color:      c.status === 'failed' ? 'var(--color-tag-Red-text)' : 'var(--neutral-400)',
                    flexShrink: 0,
                  }}>
                    {c.status === 'connected' ? 'Active' : c.status === 'pending' ? 'Connecting' : 'Failed'}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Spacer */}
        <div style={{ height: 24 }} />
      </div>

      {/* ── Footer ── */}
      <Divider />
      <div style={{
        display:        'flex',
        justifyContent: 'flex-end',
        gap:            8,
        padding:        '12px 16px',
        flexShrink:     0,
      }}>
        {onClose && (
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
        )}
        <Button variant="default" size="sm" onClick={handleSave}>
          Save
        </Button>
      </div>
    </motion.div>
  )
}

ProjectConfigPanel.displayName = 'ProjectConfigPanel'
