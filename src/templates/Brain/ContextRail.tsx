'use client'

import React from 'react'
import { PinIcon, CancelOneIcon } from '@strange-huge/icons'
import { IconButton } from '@/components/IconButton'
import { Tooltip } from '@/components/Tooltip'
import type { Connector } from '@/lib/connector'
import { getPersonaFallbackAvatar } from '@/lib/persona-template-avatars'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ContextRailPersona {
  id?:        string
  name:       string
  handle:     string
  avatarUrl?: string
}

function PersonaAvatar({ persona }: { persona: ContextRailPersona }) {
  const [imageFailed, setImageFailed] = React.useState(false)
  const src = persona.avatarUrl && !imageFailed
    ? persona.avatarUrl
    : getPersonaFallbackAvatar(persona.id || persona.name)

  return (
    // eslint-disable-next-line @next/next/no-img-element -- remote URL needs an onError fallback
    <img
      src={src}
      alt=""
      onError={() => setImageFailed(true)}
      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
    />
  )
}

export interface ContextRailPin {
  id:      string
  title:   string
  source?: string
  /** true = used by the current/latest turn; false/undefined = seen earlier this thread but not now. */
  active?: boolean
}

/** The shared Connector identity plus rail-specific usage state.
 *  active: true = used by the current/latest turn; false/undefined = seen
 *  earlier this thread but not now. */
export type ContextRailConnector = Connector & { active?: boolean }

export interface ContextRailFile {
  name:  string
  meta?: string
  /** true = used by the current/latest turn; false/undefined = seen earlier this thread but not now. */
  active?: boolean
}

export interface ContextRailData {
  persona?:    ContextRailPersona
  pins?:       ContextRailPin[]
  files?:      ContextRailFile[]
  connectors?: ContextRailConnector[]
}

export interface ContextRailProps {
  data:      ContextRailData
  onClose?: () => void
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function SectionDivider() {
  return <div style={{ height: 1, backgroundColor: 'var(--neutral-100)', flexShrink: 0 }} />
}

// Sub-grouping within a category (Pins/Files/Connectors): "Active" (green dot —
// used by the current/latest turn) vs "Previously used" (seen earlier this
// thread but not part of the current context). Only rendered when there's
// something in that group, so a fresh conversation with no history shows no
// extra chrome at all.
function UsageSubHeader({ active }: { active: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 16px 2px' }}>
      {active && (
        <span aria-hidden style={{
          width:           6,
          height:          6,
          borderRadius:    '50%',
          backgroundColor: 'var(--color-tag-Green-text, #1e8a3c)',
          flexShrink:      0,
        }} />
      )}
      <span style={{
        fontFamily: 'var(--font-body)',
        fontSize:   11,
        fontWeight: 'var(--font-weight-medium)',
        lineHeight: '16px',
        letterSpacing: '0.02em',
        textTransform: 'uppercase',
        color:      'var(--neutral-300)',
      }}>
        {active ? 'Active' : 'Previously used'}
      </span>
    </div>
  )
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

function ConnectorLogo({ connector: c }: { connector: ContextRailConnector }) {
  const dotColor =
    c.status === 'connected' ? 'var(--color-tag-Green-text, #1e8a3c)' :
    c.status === 'failed'    ? 'var(--color-tag-Red-text, #c0392b)'   :
                               'var(--neutral-300)'

  return (
    <span style={{ position: 'relative', display: 'inline-flex', flexShrink: 0, lineHeight: 0 }}>
      {c.logo ? (
        // eslint-disable-next-line @next/next/no-img-element -- brand asset (local or provider URL), variable path prevents next/image static analysis
        <img
          src={c.logo}
          alt={c.name}
          width={16}
          height={16}
          style={{ objectFit: 'contain', display: 'block' }}
        />
      ) : (
        <span style={{
          width:           16,
          height:          16,
          borderRadius:    3,
          backgroundColor: 'var(--neutral-200)',
          display:         'flex',
          alignItems:      'center',
          justifyContent:  'center',
          fontFamily:      'var(--font-body)',
          fontSize:        12,
          fontWeight:      600,
          color:           'var(--neutral-600)',
          userSelect:      'none',
          textTransform:   'uppercase',
        }}>
          {c.name.charAt(0)}
        </span>
      )}
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

// ── Row components (shared between the Active / Previously used groups) ──────

function PinRow({ pin, index, dimmed }: { pin: ContextRailPin; index: number; dimmed?: boolean }) {
  return (
    <div
      style={{
        display:    'flex',
        alignItems: 'flex-start',
        gap:        10,
        padding:    '7px 16px',
        borderTop:  index > 0 ? '1px solid var(--neutral-100)' : 'none',
        cursor:     dimmed ? 'default' : 'grab',
        opacity:    dimmed ? 0.6 : 1,
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
  )
}

function FileRow({ file, index, dimmed }: { file: ContextRailFile; index: number; dimmed?: boolean }) {
  return (
    <div
      style={{
        display:       'flex',
        flexDirection: 'column',
        gap:           2,
        padding:       '7px 16px',
        borderTop:     index > 0 ? '1px solid var(--neutral-100)' : 'none',
        minWidth:      0,
        opacity:       dimmed ? 0.6 : 1,
      }}
    >
      <span style={{
        fontFamily:   'var(--font-body)',
        fontSize:     'var(--font-size-body)',
        lineHeight:   'var(--line-height-body)',
        color:        'var(--neutral-700)',
        overflow:     'hidden',
        textOverflow: 'ellipsis',
        whiteSpace:   'nowrap',
      }}>
        {file.name}
      </span>
      {file.meta && (
        <span style={{
          fontFamily: 'var(--font-body)',
          fontSize:   'var(--font-size-caption)',
          lineHeight: 'var(--line-height-caption)',
          color:      'var(--neutral-400)',
        }}>
          {file.meta}
        </span>
      )}
    </div>
  )
}

function ConnectorRow({ connector: c, index, dimmed }: { connector: ContextRailConnector; index: number; dimmed?: boolean }) {
  return (
    <div
      style={{
        display:    'flex',
        alignItems: 'center',
        gap:        10,
        padding:    '7px 16px',
        borderTop:  index > 0 ? '1px solid var(--neutral-100)' : 'none',
        opacity:    dimmed ? 0.6 : 1,
      }}
    >
      <ConnectorLogo connector={c} />
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
  )
}

// ── Rail header ───────────────────────────────────────────────────────────────

function RailHeader({ onClose }: { onClose?: () => void }) {
  return (
    <div style={{
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'space-between',
      padding:        '16px 8px 12px 16px',
      flexShrink:     0,
    }}>
      <span style={{
        fontFamily: 'var(--font-title)',
        fontSize:   'var(--font-size-heading)',
        fontWeight: 'var(--font-weight-regular)',
        lineHeight: 'var(--line-height-heading)',
        color:      'var(--neutral-700)',
      }}>
        Context
      </span>
      <Tooltip content="Close">
        <IconButton
          variant="ghost"
          size="sm"
          icon={<CancelOneIcon size={20} />}
          aria-label="Close context panel"
          onClick={onClose}
        />
      </Tooltip>
    </div>
  )
}

// ── ContextRail ───────────────────────────────────────────────────────────────

export function ContextRail({ data, onClose }: ContextRailProps) {
  const { persona, pins, files, connectors } = data
  const hasPins       = pins && pins.length > 0
  const hasFiles      = files && files.length > 0
  const hasConnectors = connectors && connectors.length > 0
  const isEmpty       = !persona && !hasPins && !hasFiles && !hasConnectors

  // Split each category into "Active" (used by the current/latest turn) and
  // "Previously used" (seen earlier this thread but not part of it now).
  const activePins        = pins?.filter((p) => p.active !== false) ?? []
  const previousPins       = pins?.filter((p) => p.active === false) ?? []
  const activeFiles        = files?.filter((f) => f.active !== false) ?? []
  const previousFiles       = files?.filter((f) => f.active === false) ?? []
  const activeConnectors   = connectors?.filter((c) => c.active !== false) ?? []
  const previousConnectors = connectors?.filter((c) => c.active === false) ?? []

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
        <RailHeader onClose={onClose} />
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
      <RailHeader onClose={onClose} />
      <div style={{
        flex:                '1 0 0',
        minHeight:           0,
        overflowY:           'auto',
        overscrollBehaviorY: 'contain',
        scrollbarGutter:      'stable',
        display:             'flex',
        flexDirection:       'column',
      }} className="kaya-scrollbar">

      {/* ── Persona section ── */}
      {persona && (
        <>
          <SectionHeader label="Agent" />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 16px 14px' }}>
            <div style={{
              position:        'relative',
              width:           40,
              height:          40,
              borderRadius:    10,
              overflow:        'hidden',
              flexShrink:      0,
              backgroundColor: 'var(--neutral-100)',
              display:         'flex',
              alignItems:      'center',
              justifyContent:  'center',
            }}>
              <PersonaAvatar key={`${persona.id ?? persona.name}:${persona.avatarUrl ?? ''}`} persona={persona} />
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
              {persona.handle && (
              <span style={{
                fontFamily: 'var(--font-code)',
                fontSize:   'var(--font-size-code)',
                lineHeight: 'var(--line-height-code)',
                color:      'var(--neutral-400)',
              }}>
                @{persona.handle}
              </span>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── Pins section ── */}
      {hasPins && (
        <>
          {persona && <SectionDivider />}
          <SectionHeader label="In context" count={pins!.length} />
          {previousPins.length > 0 && activePins.length > 0 && <UsageSubHeader active />}
          <div style={{ display: 'flex', flexDirection: 'column', padding: '2px 0 14px' }}>
            {activePins.map((pin, i) => <PinRow key={pin.id} pin={pin} index={i} />)}
          </div>
          {previousPins.length > 0 && (
            <>
              <UsageSubHeader active={false} />
              <div style={{ display: 'flex', flexDirection: 'column', padding: '2px 0 14px' }}>
                {previousPins.map((pin, i) => <PinRow key={pin.id} pin={pin} index={i} dimmed />)}
              </div>
            </>
          )}
        </>
      )}

      {/* ── Files section ── */}
      {hasFiles && (
        <>
          {(persona || hasPins) && <SectionDivider />}
          <SectionHeader label="Files" count={files!.length} />
          {previousFiles.length > 0 && activeFiles.length > 0 && <UsageSubHeader active />}
          <div style={{ display: 'flex', flexDirection: 'column', padding: '2px 0 14px' }}>
            {activeFiles.map((file, i) => <FileRow key={`${file.name}-${i}`} file={file} index={i} />)}
          </div>
          {previousFiles.length > 0 && (
            <>
              <UsageSubHeader active={false} />
              <div style={{ display: 'flex', flexDirection: 'column', padding: '2px 0 14px' }}>
                {previousFiles.map((file, i) => <FileRow key={`${file.name}-${i}`} file={file} index={i} dimmed />)}
              </div>
            </>
          )}
        </>
      )}

      {/* ── Connectors section ── */}
      {hasConnectors && (
        <>
          {(persona || hasPins || hasFiles) && <SectionDivider />}
          <SectionHeader label="Connectors" />
          {previousConnectors.length > 0 && activeConnectors.length > 0 && <UsageSubHeader active />}
          <div style={{ display: 'flex', flexDirection: 'column', padding: '2px 0 14px' }}>
            {activeConnectors.map((c, i) => <ConnectorRow key={c.slug || c.name} connector={c} index={i} />)}
          </div>
          {previousConnectors.length > 0 && (
            <>
              <UsageSubHeader active={false} />
              <div style={{ display: 'flex', flexDirection: 'column', padding: '2px 0 14px' }}>
                {previousConnectors.map((c, i) => <ConnectorRow key={c.slug || c.name} connector={c} index={i} dimmed />)}
              </div>
            </>
          )}
        </>
      )}

      </div>
    </div>
  )
}

ContextRail.displayName = 'ContextRail'
