'use client'

import React, { useState } from 'react'

// ── Attribute section headers ─────────────────────────────────────────────────
// Shared style for the label above each editable field across all 5 configure
// tabs (Model, System Instruction, Avatar, Visibility, ...) — one clear,
// slightly-larger treatment instead of each section rolling its own weight/size.

export const ATTRIBUTE_HEADER_STYLE: React.CSSProperties = {
  fontFamily:    'var(--font-body)',
  fontWeight:    'var(--font-weight-semibold)',
  fontSize:      15,
  lineHeight:    '20px',
  letterSpacing: '-0.01em',
  color:         'var(--neutral-900)',
}

// ── Table-of-contents rail — middle-left, per-attribute change indicator ──────
// Each dot lights up the moment its field is touched this session (cleared on
// save, not on revert) and clicking a row scrolls to that field's section via
// the same [data-help-id] anchors the help spotlight already uses. Row shell
// (shadow tokens, hover pattern, radius) mirrors ModelSelectItem so this rail
// reads as the same design-system row, not a bespoke one-off.

export interface AttributeTocItem {
  id:     string
  label:  string
  anchor: string
}

export function scrollToConfigureSection(anchor: string) {
  if (typeof document === 'undefined') return
  document.querySelector(`[data-help-id="${anchor}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
}

const TOC_ROW_SHADOW_ACTIVE =
  '0px 1px 1.5px 0px var(--neutral-700-12), 0px 0px 0px 1px var(--neutral-300-40)'
const TOC_ROW_SHADOW_INNER =
  'inset 0px 1px 0px 0px var(--neutral-50-61), inset 0px -1px 0px 0px var(--neutral-600-05)'

function AttributeTocRow({
  label,
  touched,
  onClick,
}: {
  label:   string
  touched: boolean
  onClick: () => void
}) {
  const [isHovered, setIsHovered] = useState(false)

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        position:        'relative',
        display:         'flex',
        alignItems:      'center',
        gap:             8,
        padding:         '6px',
        minHeight:       36,
        borderRadius:    10,
        overflow:        'hidden',
        backgroundColor: isHovered ? 'var(--model-select-item-bg-active)' : 'transparent',
        boxShadow:       isHovered ? TOC_ROW_SHADOW_ACTIVE : 'none',
        cursor:          'pointer',
        userSelect:      'none',
        transition:      'background-color 150ms, box-shadow 150ms',
      }}
    >
      <span
        aria-hidden
        style={{
          width:           6,
          height:          6,
          flexShrink:      0,
          marginLeft:      2,
          borderRadius:    '50%',
          backgroundColor: touched ? '#F97316' : '#D1D5DB',
          boxShadow:       `0 0 0 1px ${touched ? '#C2600F' : '#9CA3AF'}`,
        }}
      />
      <span
        style={{
          flex:         '1 0 0',
          minWidth:     0,
          fontFamily:   'var(--font-body)',
          fontWeight:   'var(--font-weight-medium)',
          fontSize:     '14px',
          lineHeight:   '22px',
          color:        'var(--model-select-item-text)',
          overflow:     'hidden',
          textOverflow: 'ellipsis',
          whiteSpace:   'nowrap',
        }}
      >
        {label}
      </span>
      {isHovered && (
        <div
          aria-hidden
          style={{
            position:      'absolute',
            inset:         0,
            borderRadius:  'inherit',
            pointerEvents: 'none',
            boxShadow:     TOC_ROW_SHADOW_INNER,
          }}
        />
      )}
    </div>
  )
}

export function AttributeTocRail({
  items,
  touchedFields,
}: {
  items:         AttributeTocItem[]
  touchedFields: Set<string>
}) {
  return (
    <div
      style={{
        position:  'absolute',
        left:      24,
        top:       '50%',
        transform: 'translateY(-50%)',
        zIndex:    10,
        width:     184,
      }}
    >
      {/* Same 3-layer composition as FloatingMenu: outer shadow on the card,
         a white background layer, then an inner shadow overlay on top. */}
      <div
        aria-label="Section navigation"
        style={{
          position:      'relative',
          display:       'flex',
          flexDirection: 'column',
          gap:           4,
          padding:       6,
          borderRadius:  12,
          overflow:      'clip',
          boxShadow:     'var(--shadow-floating-menu-outer)',
        }}
      >
        <div aria-hidden style={{ position: 'absolute', inset: 0, backgroundColor: 'var(--neutral-white)', pointerEvents: 'none' }} />

        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {items.map(item => (
            <AttributeTocRow
              key={item.id}
              label={item.label}
              touched={touchedFields.has(item.id)}
              onClick={() => scrollToConfigureSection(item.anchor)}
            />
          ))}
        </div>

        <div aria-hidden style={{ position: 'absolute', inset: 0, borderRadius: 'inherit', boxShadow: 'var(--shadow-floating-menu-inner)', pointerEvents: 'none' }} />
      </div>
    </div>
  )
}
