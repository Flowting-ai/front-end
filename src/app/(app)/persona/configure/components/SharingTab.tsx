'use client'

import React, { useState } from 'react'
import { Switch } from '@/components/Switch'
import { Button } from '@/components/Button'
import { CancelOneIcon, ArrowUpRightOneIcon } from '@strange-huge/icons'

// ── Types ─────────────────────────────────────────────────────────────────────

type Visibility = 'private' | 'team' | 'community'

export interface SharingTabProps {
  hasTeamsPlan?: boolean
}

// ── Team plan badge ────────────────────────────────────────────────────────────

function TeamPlanBadge() {
  return (
    <div
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        padding: 2,
        borderRadius: 6,
        boxShadow: '0px 1px 1.5px 0px rgba(2,15,24,0.2), 0px 0px 0px 1px rgba(13,110,178,0.5)',
        flexShrink: 0,
      }}
    >
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: '#cadcf1',
          borderRadius: 6,
          pointerEvents: 'none',
        }}
      />
      <span
        style={{
          position: 'relative',
          fontFamily: 'var(--font-body)',
          fontWeight: 500,
          fontSize: 12,
          lineHeight: '16px',
          color: '#135487',
          whiteSpace: 'nowrap',
          padding: '0 2px',
        }}
      >
        Team plan
      </span>
      <div
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 4,
          borderRadius: 8,
        }}
      >
        <ArrowUpRightOneIcon size={20} color="#135487" />
      </div>
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 'inherit',
          boxShadow:
            'inset 0px 1px 0px 0px rgba(231,244,253,0.7), inset 0px -1px 0px 0px rgba(13,110,178,0.1)',
          pointerEvents: 'none',
        }}
      />
    </div>
  )
}

// ── Visibility option row ──────────────────────────────────────────────────────

function VisibilityRow({
  label,
  description,
  selected,
  locked,
  badge,
  onClick,
}: {
  label: string
  description: string
  selected: boolean
  locked?: boolean
  badge?: React.ReactNode
  onClick: () => void
}) {
  return (
    <button
      onClick={locked ? undefined : onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        padding: '14px 16px',
        borderRadius: 12,
        border: 'none',
        cursor: locked ? 'default' : 'pointer',
        textAlign: 'left',
        backgroundColor: selected ? 'var(--neutral-50)' : locked ? 'var(--neutral-50)' : 'white',
        boxShadow: selected
          ? '0px 2px 2.8px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-800)'
          : locked
          ? '0px 0px 0px 1px var(--neutral-200)'
          : '0px 0px 0px 1px white',
        transition: 'box-shadow 150ms, background-color 150ms',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span
          style={{
            fontFamily: 'var(--font-body)',
            fontWeight: 500,
            fontSize: 14,
            lineHeight: '22px',
            color: locked ? 'var(--neutral-400)' : 'var(--neutral-800)',
          }}
        >
          {label}
        </span>
        <span
          style={{
            fontFamily: 'var(--font-body)',
            fontWeight: 500,
            fontSize: 12,
            lineHeight: '16px',
            color: locked ? 'var(--neutral-500)' : 'var(--neutral-600)',
            whiteSpace: 'nowrap',
          }}
        >
          {description}
        </span>
      </div>
      {badge}
    </button>
  )
}

// ── Token usage progress bar ───────────────────────────────────────────────────

function UsageBar({ percent }: { percent: number }) {
  const clamped = Math.max(0, Math.min(100, percent))
  return (
    <div
      style={{
        position: 'relative',
        height: 4,
        backgroundColor: 'white',
        borderRadius: 2,
        width: '100%',
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          height: '100%',
          width: `${clamped}%`,
          backgroundColor: '#0d6eb2',
          borderRadius: 2,
          // eslint-disable-next-line react-doctor/no-layout-transition-inline -- progress bar width is dynamic state
          transition: 'width 300ms ease',
        }}
      />
      <div
        aria-hidden
        style={{
          position: 'absolute',
          left: `${clamped}%`,
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: 10,
          height: 10,
          borderRadius: '50%',
          backgroundColor: '#0d6eb2',
          border: '1.5px solid white',
          boxShadow: '0px 0px 0px 1px rgba(13,110,178,0.5)',
        }}
      />
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function SharingTab({ hasTeamsPlan = false }: SharingTabProps) {
  const [visibility, setVisibility] = useState<Visibility>('private')
  const [superLinkEnabled, setSuperLinkEnabled] = useState(false)
  const [linkGenerated, setLinkGenerated] = useState(false)
  const [tokenLimit, setTokenLimit] = useState(10000)

  const tokensUsed = 1400
  const usagePercent = Math.min(100, Math.round((tokensUsed / tokenLimit) * 100))
  const generatedUrl = 'souvenir.app/p/legal-advisor-a8b2c3'

  function handleSuperLinkToggle(enabled: boolean) {
    setSuperLinkEnabled(enabled)
    if (!enabled) setLinkGenerated(false)
  }

  function handleCopy() {
    navigator.clipboard.writeText(`https://${generatedUrl}`).catch(() => {})
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, width: '100%' }}>

      {/* ── Heading ─────────────────────────────────────────────────────────── */}
      <h1
        style={{
          fontFamily: 'var(--font-title)',
          fontWeight: 400,
          fontSize: 24,
          lineHeight: '32px',
          color: '#1a1916',
          margin: 0,
        }}
      >
        Sharing Configuration
      </h1>

      {/* ── Visibility ──────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <span
          style={{
            fontFamily: 'var(--font-body)',
            fontWeight: 500,
            fontSize: 14,
            lineHeight: 1.5,
            letterSpacing: '0.07px',
            color: '#0a0a0a',
          }}
        >
          Visibility
        </span>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <VisibilityRow
            label="Private"
            description="Only you can use this persona"
            selected={visibility === 'private'}
            onClick={() => setVisibility('private')}
          />
          <VisibilityRow
            label="Team"
            description="Everyone in your workspace can use it."
            selected={visibility === 'team'}
            locked
            badge={<TeamPlanBadge />}
            onClick={() => {}}
          />
          <VisibilityRow
            label="Community"
            description="Listed publicly anyone can find and import this persona."
            selected={visibility === 'community'}
            locked
            onClick={() => {}}
          />
        </div>
      </div>

      {/* ── Divider ─────────────────────────────────────────────────────────── */}
      <div style={{ height: 1, width: '100%', backgroundColor: 'rgba(59,54,50,0.15)' }} />

      {/* ── Super Link ──────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* Toggle header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span
              style={{
                fontFamily: 'var(--font-body)',
                fontWeight: 500,
                fontSize: 14,
                lineHeight: 1.5,
                letterSpacing: '0.07px',
                color: '#0a0a0a',
              }}
            >
              Super Link
            </span>
            <span
              style={{
                fontFamily: 'var(--font-body)',
                fontWeight: 500,
                fontSize: 12,
                lineHeight: '16px',
                color: '#6a625d',
                maxWidth: 560,
              }}
            >
              Generate a shareable URL anyone can chat without a Souvenir account. You cover the token cost.
            </span>
          </div>
          <Switch checked={superLinkEnabled} onCheckedChange={handleSuperLinkToggle} />
        </div>

        {/* URL bar - visible when super link is enabled */}
        {superLinkEnabled && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* URL input row */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: 'white',
                border: '1px solid var(--neutral-200)',
                borderRadius: 10,
                padding: '8px 7px',
                height: 46,
              }}
            >
              {/* URL text */}
              <div style={{ flex: '1 0 0', minWidth: 0, overflow: 'hidden', paddingLeft: 8 }}>
                <span
                  style={{
                    display: 'block',
                    fontFamily: 'var(--font-body)',
                    fontWeight: 500,
                    fontSize: 14,
                    lineHeight: '22px',
                    color: linkGenerated ? 'var(--neutral-800)' : 'var(--neutral-200)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {generatedUrl}
                </span>
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                {linkGenerated ? (
                  <>
                    {/* Revoke link */}
                    <button
                      onClick={() => setLinkGenerated(false)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 2,
                        padding: '5px 8px',
                        borderRadius: 8,
                        border: 'none',
                        cursor: 'pointer',
                        backgroundColor: 'transparent',
                        fontFamily: 'var(--font-body)',
                        fontWeight: 500,
                        fontSize: 14,
                        lineHeight: '22px',
                        color: '#ee3030',
                      }}
                    >
                      <CancelOneIcon size={16} color="#ee3030" />
                      Revoke link
                    </button>

                    {/* Copy */}
                    <Button variant="secondary" size="sm" onClick={handleCopy}>
                      Copy
                    </Button>
                  </>
                ) : (
                  <Button variant="default" size="sm" onClick={() => setLinkGenerated(true)}>
                    Generate link
                  </Button>
                )}
              </div>
            </div>

            {/* Token usage - visible after link is generated */}
            {linkGenerated && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'var(--font-body)',
                      fontWeight: 400,
                      fontSize: 14,
                      lineHeight: '22px',
                      color: 'var(--neutral-700)',
                    }}
                  >
                    {usagePercent}% used · {tokensUsed.toLocaleString()} / {tokenLimit.toLocaleString()} tokens
                  </span>
                  <div
                    style={{
                      backgroundColor: 'white',
                      border: '1px solid var(--neutral-200)',
                      borderRadius: 8,
                      padding: 7,
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    <input
                      type="number"
                      value={tokenLimit}
                      onChange={e => setTokenLimit(Math.max(1, parseInt(e.target.value) || 1))}
                      style={{
                        width: 96,
                        border: 'none',
                        // eslint-disable-next-line react-doctor/no-outline-none -- browser outline suppressed; :focus-visible handled by container or global styles
                        outline: 'none',
                        backgroundColor: 'transparent',
                        fontFamily: 'var(--font-body)',
                        fontWeight: 400,
                        fontSize: 12,
                        lineHeight: 'normal',
                        color: '#3b3632',
                      }}
                    />
                  </div>
                </div>

                <UsageBar percent={usagePercent} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
