'use client'

import React, { useState, useEffect } from 'react'
import { CheckmarkCircleTwoIcon, ArrowRightOneIcon } from '@strange-huge/icons'
import { Button } from '@/components/Button'

// ── Constants ─────────────────────────────────────────────────────────────────

const CARD_SHADOW = 'var(--shadow-card-default)'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ExternalOutputAction {
  /** "Sent" | "Created" | "Updated" | "Deleted" | "Posted" */
  verb:      string
  /** "email to kai@example.com" | "calendar event 'Q1 Sync'" */
  target:    string
  /** "Gmail" | "Notion" | "Calendar" | "Slack" */
  connector: string
  /** data:image/svg+xml,... from CONNECTOR_COLOR — consumer provides */
  logoSrc?:  string
  /** "Subject: Q1 Report · 3 attachments" */
  detail?:   string
  onView?:   () => void
}

export interface ExternalOutputCardProps {
  /** One or more actions Brain completed in the external world. */
  actions:      ExternalOutputAction[]
  /** "Just now" | "Today · 8:02 AM" */
  completedAt?: string
  /**
   * When provided, starts a 5-second countdown on mount.
   * User can click "Undo (Ns)" to invoke before it expires.
   * At 0 the button disappears (action confirmed).
   */
  onUndo?:      () => void
}

// ── ConnectorLogo ─────────────────────────────────────────────────────────────

function ConnectorLogo({ name, logoSrc }: { name: string; logoSrc?: string }) {
  if (logoSrc) {
    return (
      <div style={{
        width:           28,
        height:          28,
        borderRadius:    6,
        flexShrink:      0,
        overflow:        'hidden',
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'center',
        backgroundColor: 'var(--neutral-50)',
        border:          '1px solid var(--neutral-100)',
      }}>
        <img src={logoSrc} alt={name} width={20} height={20} style={{ objectFit: 'contain' }} />
      </div>
    )
  }
  return (
    <div style={{
      width:           28,
      height:          28,
      borderRadius:    6,
      flexShrink:      0,
      backgroundColor: 'var(--neutral-100)',
      border:          '1px solid var(--neutral-200)',
      display:         'flex',
      alignItems:      'center',
      justifyContent:  'center',
    }}>
      <span style={{
        fontFamily:    'var(--font-body)',
        fontSize:      'var(--font-size-caption)',
        fontWeight:    'var(--font-weight-semibold)',
        color:         'var(--neutral-500)',
        lineHeight:    1,
        textTransform: 'uppercase' as React.CSSProperties['textTransform'],
      }}>
        {name.charAt(0)}
      </span>
    </div>
  )
}

// ── ExternalOutputCard ────────────────────────────────────────────────────────

/**
 * Shows what Brain changed in the external world after completing an automation.
 * "Sent email to kai@example.com", "Created calendar event", etc.
 * Appears after ArtifactCard in the complete phase when the plan had external steps.
 */
export function ExternalOutputCard({ actions, completedAt, onUndo }: ExternalOutputCardProps) {
  const [countdown, setCountdown] = useState<number | null>(onUndo ? 5 : null)

  useEffect(() => {
    if (countdown === null || countdown <= 0) { if (countdown !== null) setCountdown(null); return }
    const id = setTimeout(() => setCountdown(c => (c !== null && c > 1 ? c - 1 : null)), 1000)
    return () => clearTimeout(id)
  }, [countdown])

  return (
    <div style={{
      backgroundColor: 'var(--neutral-white)',
      borderRadius:    12,
      boxShadow:       CARD_SHADOW,
      overflow:        'hidden',
    }}>

      {/* Header */}
      <div style={{
        display:      'flex',
        alignItems:   'center',
        gap:          8,
        padding:      '10px 14px',
        borderBottom: '1px solid var(--neutral-100)',
      }}>
        <CheckmarkCircleTwoIcon size={14} color="var(--color-tag-Green-text)" />
        <span style={{
          fontFamily: 'var(--font-body)',
          fontSize:   'var(--font-size-caption)',
          fontWeight: 'var(--font-weight-medium)',
          lineHeight: 'var(--line-height-caption)',
          color:      'var(--neutral-600)',
          flex:       '1 0 0',
        }}>
          Done in the world
        </span>
        {completedAt && (
          <span style={{
            fontFamily: 'var(--font-body)',
            fontSize:   'var(--font-size-caption)',
            lineHeight: 'var(--line-height-caption)',
            color:      'var(--neutral-300)',
            flexShrink: 0,
          }}>
            {completedAt}
          </span>
        )}
        {countdown !== null && countdown > 0 && (
          <Button variant="outline" size="sm" onClick={onUndo}>
            Undo ({countdown}s)
          </Button>
        )}
      </div>

      {/* Action rows */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {actions.map((action, i) => (
          <div
            key={i}
            style={{
              display:      'flex',
              alignItems:   'flex-start',
              gap:          10,
              padding:      '10px 14px',
              borderBottom: i < actions.length - 1 ? '1px solid var(--neutral-50)' : undefined,
            }}
          >
            {/* Logo */}
            <div style={{ paddingTop: 2, flexShrink: 0 }}>
              <ConnectorLogo name={action.connector} logoSrc={action.logoSrc} />
            </div>

            {/* Text */}
            <div style={{
              flex:          '1 0 0',
              minWidth:      0,
              display:       'flex',
              flexDirection: 'column',
              gap:           2,
            }}>
              <span style={{
                fontFamily: 'var(--font-body)',
                fontSize:   'var(--font-size-body)',
                lineHeight: 'var(--line-height-body)',
                color:      'var(--neutral-800)',
              }}>
                <span style={{ fontWeight: 'var(--font-weight-medium)' }}>{action.verb}</span>
                {' '}
                {action.target}
              </span>
              {action.detail && (
                <span style={{
                  fontFamily: 'var(--font-body)',
                  fontSize:   'var(--font-size-caption)',
                  lineHeight: 'var(--line-height-caption)',
                  color:      'var(--neutral-400)',
                }}>
                  {action.detail}
                </span>
              )}
            </div>

            {/* View link */}
            {action.onView && (
              <button
                type="button"
                className="brain-card-action"
                onClick={action.onView}
                style={{
                  display:    'flex',
                  alignItems: 'center',
                  gap:        3,
                  flexShrink: 0,
                  background: 'none',
                  border:     'none',
                  padding:    '2px 0',
                  cursor:     'pointer',
                  fontFamily: 'var(--font-body)',
                  fontSize:   'var(--font-size-caption)',
                  fontWeight: 'var(--font-weight-medium)',
                  lineHeight: 'var(--line-height-caption)',
                  color:      'var(--neutral-400)',
                  marginTop:  2,
                }}
              >
                View
                <ArrowRightOneIcon size={12} color="var(--neutral-400)" />
              </button>
            )}
          </div>
        ))}
      </div>

    </div>
  )
}

ExternalOutputCard.displayName = 'ExternalOutputCard'
