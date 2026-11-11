'use client'

import React, { useState, useCallback, useEffect, useRef } from 'react'
import { m, AnimatePresence } from 'framer-motion'
import { MoreVerticalIcon, PenOneIcon, ShareOneIcon, CopyOneIcon, StopCircleIcon, ArrowRightTwoIcon, InformationCircleIcon } from '@strange-huge/icons'
import { IconButton } from '@/components/ui/button'
import { Dropdown, DROPDOWN_SCALE_PRESET } from '@/components/Dropdown'

export interface AgentCardMenuProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Keeps the menu clickable over the model-unavailable scrim. */
  modelUnavailable: boolean
  paused: boolean
  pausePending: boolean
  onMenuDetails?: () => void
  onMenuEdit?: () => void
  onEdit?: () => void
  onMenuShare?: () => void
  onLink?: () => void
  onMenuPauseToggle?: () => void
  onMenuDuplicate?: () => void
  onMenuDelete?: () => void
}

export function AgentCardMenu({
  open, onOpenChange, modelUnavailable, paused, pausePending,
  onMenuDetails, onMenuEdit, onEdit, onMenuShare, onLink, onMenuPauseToggle, onMenuDuplicate, onMenuDelete,
}: AgentCardMenuProps) {
  const [dropUp, setDropUp] = useState(false)
  const menuTriggerRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking anywhere outside the card.
  useEffect(() => {
    if (!open) return
    const close = () => onOpenChange(false)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [open, onOpenChange])

  const handleMenuToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    if (!open) {
      const el = menuTriggerRef.current
      if (el) {
        const rect = el.getBoundingClientRect()
        setDropUp(window.innerHeight - rect.bottom < 200)
      }
    }
    onOpenChange(!open)
  }, [open, onOpenChange])

  return (
    <div
      ref={menuTriggerRef}
      className="agent-card-chip"
      data-open={open || undefined}
      style={{
        position:      'absolute',
        top:           12,
        right:         12,
        zIndex:        3,
        ...(modelUnavailable ? { pointerEvents: 'auto' as const } : null),
      }}
      onMouseDown={e => e.stopPropagation()}
      onClick={e => e.stopPropagation()}
    >
      <IconButton
        variant="ghost"
        size="xs"
        aria-label="More options"
        aria-expanded={open}
        icon={
          <m.span animate={{ rotate: open ? 90 : 0 }} transition={{ duration: 0.2, ease: 'easeOut' }} style={{ display: 'inline-flex' }}>
            <MoreVerticalIcon />
          </m.span>
        }
        onClick={handleMenuToggle}
      />

      {/* Dropdown menu */}
      <AnimatePresence>
        {open && (
          <>
            {/* Click-outside backdrop */}
            <div
              style={{
                position: 'fixed',
                inset:    0,
                zIndex:   10,
              }}
              onMouseDown={() => onOpenChange(false)}
            />
            <m.div
              {...DROPDOWN_SCALE_PRESET}
              initial={{ ...DROPDOWN_SCALE_PRESET.initial, transformOrigin: dropUp ? 'bottom center' : 'top center' }}
              animate={{ ...DROPDOWN_SCALE_PRESET.animate, transformOrigin: dropUp ? 'bottom center' : 'top center' }}
              style={{
                position: 'absolute',
                ...(dropUp ? { bottom: 28, top: 'auto' } : { top: 28 }),
                right:    0,
                zIndex:   20,
              }}
            >
              <Dropdown size="sm" maxHeight={false}>
                <Dropdown.Section fluid>
                  {onMenuDetails && (
                    <Dropdown.Item
                      label="Details"
                      icon={<InformationCircleIcon />}
                      fluid
                      onClick={() => { onOpenChange(false); onMenuDetails() }}
                    />
                  )}
                  {(onMenuEdit ?? onEdit) && (
                    <Dropdown.Item
                      label="Edit"
                      icon={<PenOneIcon />}
                      fluid
                      onClick={() => { onOpenChange(false); (onMenuEdit ?? onEdit)?.() }}
                    />
                  )}
                  {(onMenuShare ?? onLink) && (
                    <Dropdown.Item
                      label="Share"
                      icon={<ShareOneIcon />}
                      fluid
                      onClick={() => { onOpenChange(false); (onMenuShare ?? onLink)?.() }}
                    />
                  )}
                  {onMenuPauseToggle && (
                    <Dropdown.Item
                      label={paused ? 'Resume' : 'Pause'}
                      icon={paused ? <ArrowRightTwoIcon /> : <StopCircleIcon />}
                      fluid
                      loading={pausePending}
                      onClick={() => { onOpenChange(false); onMenuPauseToggle() }}
                    />
                  )}
                </Dropdown.Section>
                {onMenuDuplicate && (
                  <Dropdown.Section fluid divider>
                    <Dropdown.Item
                      label="Copy & Edit"
                      icon={<CopyOneIcon />}
                      fluid
                      onClick={() => { onOpenChange(false); onMenuDuplicate() }}
                    />
                  </Dropdown.Section>
                )}
                {onMenuDelete && (
                  <Dropdown.Section fluid divider>
                    <Dropdown.Item
                      label="Delete"
                      variant="danger"
                      fluid
                      onClick={() => { onOpenChange(false); onMenuDelete() }}
                    />
                  </Dropdown.Section>
                )}
              </Dropdown>
            </m.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
