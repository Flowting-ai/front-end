'use client'

import React from 'react'
import { CancelOneIcon } from '@strange-huge/icons'
import { Button } from '@/components/Button'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RepublishModalProps {
  personaName: string
  /** Whether a Super Link is currently active for this persona */
  superLinkActive?: boolean
  superLinkUrl?: string
  onClose: () => void
  /** Called when user clicks Done — parent should navigate to /personas */
  onDone: () => void
}

// ── Yellow badge ──────────────────────────────────────────────────────────────

function YellowBadge({ label }: { label: string }) {
  return (
    <div
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 2,
        borderRadius: 6,
        flexShrink: 0,
        boxShadow:
          '0px 1px 1.5px 0px rgba(20,16,5,0.2), 0px 0px 0px 1px rgba(143,116,39,0.5)',
      }}
    >
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: 'var(--yellow-100, #e9dfc9)',
          borderRadius: 6,
          pointerEvents: 'none',
        }}
      />
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 'inherit',
          boxShadow:
            'inset 0px 1px 0px 0px rgba(250,246,235,0.7), inset 0px -1px 0px 0px rgba(143,116,39,0.1)',
          pointerEvents: 'none',
        }}
      />
      <span
        style={{
          position: 'relative',
          fontFamily: 'var(--font-body)',
          fontWeight: 500,
          fontSize: 11,
          lineHeight: '16px',
          color: 'var(--yellow-700, #6d5921)',
          whiteSpace: 'nowrap',
          padding: '0 2px',
        }}
      >
        {label}
      </span>
    </div>
  )
}

// ── Version timestamp ─────────────────────────────────────────────────────────

function buildVersionLabel() {
  const now = new Date()
  const month = now.toLocaleString('en-US', { month: 'short' })
  const day = now.getDate()
  const hour = now.getHours() % 12 || 12
  const min = String(now.getMinutes()).padStart(2, '0')
  const ampm = now.getHours() >= 12 ? 'PM' : 'AM'
  return `Version 1 · ${month} ${day}, ${hour}:${min} ${ampm}`
}

// ── Copy-link button row ──────────────────────────────────────────────────────

function UrlRow({ url }: { url: string }) {
  function handleCopy() {
    navigator.clipboard.writeText(`https://${url}`).catch(() => {})
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'white',
        border: '1px solid #d1c6bd',
        borderRadius: 10,
        padding: '8px 7px',
        height: 46,
      }}
    >
      <div style={{ flex: '1 0 0', minWidth: 0, overflow: 'hidden', paddingLeft: 8 }}>
        <span
          style={{
            display: 'block',
            fontFamily: 'var(--font-body)',
            fontWeight: 500,
            fontSize: 14,
            lineHeight: '22px',
            color: 'var(--neutral-800)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {url}
        </span>
      </div>
      <div style={{ flexShrink: 0 }}>
        <Button variant="secondary" size="sm" onClick={handleCopy}>
          Copy
        </Button>
      </div>
    </div>
  )
}

// ── Modal ─────────────────────────────────────────────────────────────────────

export default function RepublishModal({
  personaName,
  superLinkActive = false,
  superLinkUrl = 'souvenir.app/p/legal-advisor-a8b2c3',
  onClose,
  onDone,
}: RepublishModalProps) {
  const versionLabel = React.useMemo(buildVersionLabel, [])

  return (
    /* Full-screen backdrop */
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${personaName} updated`}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(18,12,8,0.5)',
        backdropFilter: 'blur(2px)',
        WebkitBackdropFilter: 'blur(2px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
      }}
    >
      {/* Modal card */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          backgroundColor: 'white',
          borderRadius: 18,
          boxShadow:
            '0px 12px 16px -4px rgba(130,122,116,0.12), 0px 2px 2.8px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-100)',
          padding: '16px 14px',
          width: 707,
          maxWidth: 'calc(100vw - 32px)',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', width: '100%' }}>
          <div style={{ display: 'flex', flex: '1 0 0', flexDirection: 'column', gap: 19, minWidth: 0 }}>
            {/* Title row */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {/* Persona thumbnail */}
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  flexShrink: 0,
                  overflow: 'hidden',
                  boxShadow: '0px 0px 0px 1px rgba(59,54,50,0.3)',
                }}
              >
                <img
                  src="/icons/persona-image.svg"
                  alt=""
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </div>
              <p
                style={{
                  fontFamily: 'var(--font-title)',
                  fontWeight: 400,
                  fontSize: 24,
                  lineHeight: '32px',
                  color: '#1a1916',
                  margin: 0,
                  whiteSpace: 'nowrap',
                }}
              >
                {personaName} updated
              </p>
            </div>

            {/* Sub-info */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9, width: '100%' }}>
              <p
                style={{
                  fontFamily: 'var(--font-body)',
                  fontWeight: 400,
                  fontSize: 14,
                  lineHeight: '22px',
                  color: 'var(--neutral-700)',
                  margin: 0,
                  whiteSpace: 'nowrap',
                }}
              >
                Your team will see the latest version right away.
              </p>
              <div style={{ display: 'flex', gap: 9, alignItems: 'center', flexWrap: 'wrap' }}>
                <span
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontWeight: 400,
                    fontSize: 14,
                    lineHeight: '22px',
                    color: 'var(--neutral-700)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {versionLabel}
                </span>
                <YellowBadge label="Instructions" />
                <YellowBadge label="Knowledge (2 files)" />
              </div>
            </div>
          </div>

          {/* Close button */}
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 3,
              borderRadius: 6,
              border: 'none',
              cursor: 'pointer',
              backgroundColor: 'transparent',
              flexShrink: 0,
            }}
          >
            <CancelOneIcon size={18} color="var(--neutral-700)" />
          </button>
        </div>

        {/* ── Super link section ──────────────────────────────────────────────── */}
        {superLinkActive && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              paddingTop: 12,
              borderTop: '1px solid rgba(59,54,50,0.08)',
              width: '100%',
            }}
          >
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontWeight: 500,
                fontSize: 14,
                lineHeight: '22px',
                color: 'var(--neutral-700)',
                margin: 0,
              }}
            >
              Super Link is still active
            </p>
            <UrlRow url={superLinkUrl} />
          </div>
        )}

        {/* ── Footer actions ──────────────────────────────────────────────────── */}
        <div
          style={{
            display: 'flex',
            gap: 6,
            alignItems: 'center',
            justifyContent: 'flex-end',
            paddingTop: superLinkActive ? 0 : 12,
            borderTop: superLinkActive ? 'none' : '1px solid rgba(59,54,50,0.08)',
          }}
        >
          <Button variant="outline" size="sm" onClick={onClose}>
            View in workspace
          </Button>
          <Button variant="default" size="sm" onClick={onDone}>
            Done
          </Button>
        </div>
      </div>
    </div>
  )
}
