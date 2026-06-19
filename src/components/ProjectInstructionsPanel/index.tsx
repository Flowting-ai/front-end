'use client'

import React, { useState } from 'react'
import { toast } from 'sonner'
import { PlusSignIcon, PenOneIcon } from '@strange-huge/icons'
import { IconButton } from '@/components/IconButton'
import { Button } from '@/components/Button'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ProjectInstructionsPanelProps {
  value:         string
  /** May return a Promise – the panel tracks loading state if so. */
  onSave?:       (text: string) => void | Promise<void>
  maxLength?:    number
  onOpenEditor?: () => void
}

// ── Component ──────────────────────────────────────────────────────────────────

export function ProjectInstructionsPanel({ value, onSave, maxLength = 2000, onOpenEditor, ref }: ProjectInstructionsPanelProps & { ref?: React.Ref<HTMLDivElement> }) {
    const [editing, setEditing] = useState(false)
    const [draft,   setDraft]   = useState(value)
    const [saving,  setSaving]  = useState(false)
    const isEmpty = !value.trim()

    function handleEdit() {
      if (!onSave) return
      if (onOpenEditor) {
        onOpenEditor()
        return
      }
      setDraft(value)
      setEditing(true)
    }

    async function handleSave() {
      setSaving(true)
      try {
        await onSave?.(draft.trim())
        setEditing(false)
        toast.success('Instructions saved')
      } catch {
        // errors already toasted by the context
      } finally {
        setSaving(false)
      }
    }

    function handleCancel() {
      setDraft(value)
      setEditing(false)
    }

    return (
      <div
        ref={ref}
        style={{
          display:       'flex',
          flexDirection: 'column',
          gap:           '12px',
          padding:       '12px 12px 16px',
          borderRadius:  '16px',
          background:    'var(--neutral-50)',
          border:        '1px dashed var(--neutral-300)',
          boxShadow:     '0px 2px 2.8px 0px rgba(82,75,71,0.12)',
          width:         '100%',
          boxSizing:     'border-box',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontWeight: 'var(--font-weight-regular)',
              fontSize:   '16px',
              lineHeight: 'var(--line-height-body)',
              color:      '#000',
              margin:     0,
            }}
          >
            Instructions
          </p>
          {!editing && onSave && (
            <IconButton
              variant="ghost"
              size="xs"
              icon={isEmpty ? <PlusSignIcon /> : <PenOneIcon animated />}
              aria-label={isEmpty ? 'Add instructions' : 'Edit instructions'}
              onClick={handleEdit}
            />
          )}
        </div>

        {/* Body */}
        {editing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value.slice(0, maxLength))}
              maxLength={maxLength}
              placeholder="Add instructions to steer this project towards the right direction..."
              disabled={saving}
              style={{
                fontFamily: 'var(--font-body)',
                fontWeight: 'var(--font-weight-regular)',
                fontSize:   '14px',
                lineHeight: '22px',
                color:      '#1a1714',
                background: 'transparent',
                border:     'none',
                outline:    'none',
                resize:     'none',
                width:      '100%',
                minHeight:  '120px',
                padding:    0,
                boxSizing:  'border-box',
                opacity:    saving ? 0.5 : 1,
                transition: 'opacity 150ms',
              }}
              autoFocus
            />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span
                style={{
                  fontFamily: 'var(--font-body)',
                  fontWeight: 'var(--font-weight-regular)',
                  fontSize: '12px',
                  lineHeight: '16px',
                  color:      '#a39b95',
                }}
              >
                {draft.length} / {maxLength}
              </span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCancel}
                  disabled={saving}
                >
                  Cancel
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => { void handleSave() }}
                  disabled={saving}
                >
                  {saving ? 'Saving…' : 'Save'}
                </Button>
              </div>
            </div>
          </div>
        ) : isEmpty ? (
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontWeight: 'var(--font-weight-regular)',
              fontSize: '12px',
              lineHeight: '16px',
              color:      '#857a72',
              margin:     0,
            }}
          >
            Add instructions to steer this project towards the right direction…
          </p>
        ) : (
          <div
            {...(value.length >= 400 ? { className: 'kaya-scrollbar' } : {})}
            style={{
              overflowY:           value.length >= 400 ? 'auto'    : 'visible',
              maxHeight:           value.length >= 400 ? '240px'   : 'none',
              overscrollBehaviorY: 'contain',
            }}
          >
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontWeight: 'var(--font-weight-regular)',
                fontSize:   '14px',
                lineHeight: '22px',
                color:      '#1a1714',
                margin:     0,
                whiteSpace: 'pre-wrap',
                wordBreak:  'break-word',
              }}
            >
              {value}
            </p>
          </div>
        )}
      </div>
    )
}

ProjectInstructionsPanel.displayName = 'ProjectInstructionsPanel'
export default ProjectInstructionsPanel
