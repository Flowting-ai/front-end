'use client'

import React from 'react'
import { PinIcon } from '@strange-huge/icons'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ContextRailPersona {
  name:       string
  handle:     string
  avatarUrl?: string
}

export interface ContextRailPin {
  id:      string
  title:   string
  source?: string
}

export interface ContextRailConnector {
  name:   string
  status: 'connected' | 'failed' | 'pending'
}

export interface ContextRailData {
  persona?:    ContextRailPersona
  pins?:       ContextRailPin[]
  connectors?: ContextRailConnector[]
}

export interface ContextRailProps {
  data: ContextRailData
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const FALLBACK_AVATARS = [
  '/persona-avatars/0656f3b794e38cb70243c01880ae7e8c.jpg',
  '/persona-avatars/610d02a62c92aabef208323fb3eb963b.jpg',
  '/persona-avatars/81fd248d2aea38920976f7d6420f90ca.jpg',
]

function getFallbackAvatar(seed: string): string {
  let hash = 0
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  return FALLBACK_AVATARS[hash % FALLBACK_AVATARS.length]
}

function SectionDivider() {
  return <div style={{ height: 1, backgroundColor: 'var(--neutral-100)', flexShrink: 0 }} />
}

function SectionHeader({ label, count }: { label: string; count?: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '12px 16px 6px' }}>
      <span style={{
        fontFamily: 'var(--font-body)',
        fontSize:   'var(--font-size-caption)',
        fontWeight: 'var(--font-weight-medium)',
        lineHeight: 'var(--line-height-caption)',
        color:      'var(--neutral-400)',
      }}>
        {label}
      </span>
      {count !== undefined && (
        <span style={{
          fontFamily:      'var(--font-body)',
          fontSize:        'var(--font-size-caption)',
          lineHeight:      'var(--line-height-caption)',
          color:           'var(--neutral-300)',
        }}>
          {count}
        </span>
      )}
    </div>
  )
}

function ConnectorLogo({ name, status }: { name: string; status: ContextRailConnector['status'] }) {
  const dotColor =
    status === 'connected' ? 'var(--color-tag-Green-text, #1e8a3c)' :
    status === 'failed'    ? 'var(--color-tag-Red-text, #c0392b)'   :
                             'var(--neutral-300)'
  return (
    <span style={{ position: 'relative', display: 'inline-flex', flexShrink: 0, lineHeight: 0 }}>
      {/* Connector logo placeholder — replace with ConnectorIcon once @strange-huge/icons/connectors is available */}
      <span style={{
        width:           16,
        height:          16,
        borderRadius:    3,
        backgroundColor: 'var(--neutral-200)',
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'center',
        fontFamily:      'var(--font-body)',
        fontSize:        9,
        fontWeight:      600,
        color:           'var(--neutral-600)',
        userSelect:      'none',
        textTransform:   'uppercase',
      }}>
        {name.charAt(0)}
      </span>
      <span style={{
        position:        'absolute',
        bottom:          -2,
        right:           -2,
        width:           6,
        height:          6,
        borderRadius:    '50%',
        backgroundColor: dotColor,
        border:          '1.5px solid var(--neutral-50)',
        flexShrink:      0,
        display:         'inline-block',
      }} />
    </span>
  )
}

// ── Rail header ───────────────────────────────────────────────────────────────

function RailHeader() {
  return (
    <div style={{
      display:         'flex',
      alignItems:      'center',
      padding:         '16px 16px 12px',
      flexShrink:      0,
    }}>
      <span style={{
        fontFamily: 'var(--font-body)',
        fontSize:   'var(--font-size-body)',
        fontWeight: 'var(--font-weight-medium)',
        lineHeight: 'var(--line-height-body)',
        color:      'var(--neutral-600)',
      }}>
        Context
      </span>
    </div>
  )
}

// ── ContextRail ───────────────────────────────────────────────────────────────

export function ContextRail({ data }: ContextRailProps) {
  const { persona, pins, connectors } = data
  const hasPins       = pins && pins.length > 0
  const hasConnectors = connectors && connectors.length > 0
  const isEmpty       = !persona && !hasPins && !hasConnectors

  const railStyle: React.CSSProperties = {
    width:           '100%',
    height:          '100%',
    backgroundColor: 'var(--neutral-50)',
    display:         'flex',
    flexDirection:   'column',
  }

  if (isEmpty) {
    return (
      <div style={railStyle}>
        <RailHeader />
        <div style={{ flex: '1 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <p style={{
            margin:     0,
            fontFamily: 'var(--font-body)',
            fontSize:   'var(--font-size-caption)',
            lineHeight: 'var(--line-height-caption)',
            color:      'var(--neutral-300)',
            textAlign:  'center',
          }}>
            Context will appear here during an active loop.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div style={railStyle}>
      <RailHeader />
      <div style={{
        flex:                '1 0 0',
        minHeight:           0,
        overflowY:           'auto',
        overscrollBehaviorY: 'contain',
        display:             'flex',
        flexDirection:       'column',
      }} className="kaya-scrollbar">

      {/* ── Persona section ── */}
      {persona && (
        <>
          <SectionHeader label="Persona" />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 16px 14px' }}>
            <div style={{
              width:        40,
              height:       40,
              borderRadius: 10,
              overflow:     'hidden',
              flexShrink:   0,
            }}>
              <img
                src={persona.avatarUrl ?? getFallbackAvatar(persona.name)}
                alt=""
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
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
                {persona.name}
              </span>
              <span style={{
                fontFamily: 'var(--font-code)',
                fontSize:   'var(--font-size-code)',
                lineHeight: 'var(--line-height-code)',
                color:      'var(--neutral-400)',
              }}>
                @{persona.handle}
              </span>
            </div>
          </div>
        </>
      )}

      {/* ── Pins section ── */}
      {hasPins && (
        <>
          {persona && <SectionDivider />}
          <SectionHeader label="In context" count={pins!.length} />
          <div style={{ display: 'flex', flexDirection: 'column', padding: '2px 0 14px' }}>
            {pins!.map((pin, i) => (
              <div
                key={pin.id}
                style={{
                  display:     'flex',
                  alignItems:  'flex-start',
                  gap:         10,
                  padding:     '7px 16px',
                  borderTop:   i > 0 ? '1px solid var(--neutral-100)' : 'none',
                }}
              >
                <span style={{ flexShrink: 0, lineHeight: 0, marginTop: 3 }}>
                  <PinIcon size={12} color="var(--neutral-400)" />
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
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
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Connectors section ── */}
      {hasConnectors && (
        <>
          {(persona || hasPins) && <SectionDivider />}
          <SectionHeader label="Connectors" />
          <div style={{ display: 'flex', flexDirection: 'column', padding: '2px 0 14px' }}>
            {connectors!.map((c, i) => (
              <div
                key={c.name}
                style={{
                  display:     'flex',
                  alignItems:  'center',
                  gap:         10,
                  padding:     '7px 16px',
                  borderTop:   i > 0 ? '1px solid var(--neutral-100)' : 'none',
                }}
              >
                <ConnectorLogo name={c.name} status={c.status} />
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
                  fontFamily:    'var(--font-body)',
                  fontSize:      'var(--font-size-caption)',
                  lineHeight:    'var(--line-height-caption)',
                  color:         c.status === 'failed' ? 'var(--color-tag-Red-text, #c0392b)' : 'var(--neutral-400)',
                  textTransform: 'capitalize',
                  flexShrink:    0,
                }}>
                  {c.status}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      </div>
    </div>
  )
}

ContextRail.displayName = 'ContextRail'
