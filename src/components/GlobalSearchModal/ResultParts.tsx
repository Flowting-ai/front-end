'use client'

// Presentational pieces of the search modal: colours and icons per result type,
// section header, result row, close button, keyboard hints.

import React from 'react'
import {
  CancelOneIcon,
  FolderOneIcon,
  PinIcon,
  UserAiIcon,
  MessagePreviewOneIcon,
  DashboardSquareOneIcon,
  BubbleChatIcon,
} from '@strange-huge/icons'
import { highlightTerms } from '@/lib/highlightMatch'
import type { SearchResultType, SearchResult } from './index'

// ── Shadows ───────────────────────────────────────────────────────────────────

export const SHADOW_MODAL   = '0px 8px 32px 0px rgba(82,75,71,0.18), 0px 0px 0px 1px var(--neutral-100)'
export const SHADOW_FOCUSED = '0px 0px 0px 1.5px var(--blue-400)'

// ── Color system — mirrors KDS tag palette (Chip, Badge) ─────────────────────
// Tokens live in aliases.css under `--color-tag-{Color}-{prop}`.

export const EMPTY_SEARCH_RESULTS: SearchResult[] = []

export const TYPE_ICON_BG: Record<SearchResultType, string> = {
  chat:          'var(--color-tag-Blue-bg)',
  'agent-chat':  'var(--color-tag-Green-bg-soft)',
  project:       'var(--color-tag-Purple-bg)',
  persona:       'var(--color-tag-Green-bg-soft)',
  pin:           'var(--color-tag-Yellow-bg)',
  page:          'var(--color-tag-Neutral-bg)',
}

export const TYPE_ICON_COLOR: Record<SearchResultType, string> = {
  chat:          'var(--color-tag-Blue-text)',
  'agent-chat':  'var(--color-tag-Green-text)',
  project:       'var(--color-tag-Purple-text)',
  persona:       'var(--color-tag-Green-text)',
  pin:           'var(--color-tag-Yellow-text)',
  page:          'var(--color-tag-Neutral-text)',
}

// ── Icon map by type ──────────────────────────────────────────────────────────

export const TYPE_ICON: Record<SearchResultType, React.ComponentType<{ size: number; color: string }>> = {
  chat:          MessagePreviewOneIcon,
  'agent-chat':  BubbleChatIcon,
  project:       FolderOneIcon,
  persona:       UserAiIcon,
  pin:           PinIcon,
  page:          DashboardSquareOneIcon,
}

export const TYPE_LABEL: Record<SearchResultType, string> = {
  chat:          'Chats',
  'agent-chat':  'Agent Chats',
  project:       'Projects',
  persona:       'Agents',
  pin:           'Pins',
  page:          'Pages',
}

// ── SectionHeader ─────────────────────────────────────────────────────────────

export function SectionHeader({ label }: { label: string }) {
  return (
    <p
      style={{
        margin:        '8px 16px 2px',
        fontFamily:    'var(--font-body)',
        fontSize:      'var(--font-size-caption)',
        fontWeight:    600,
        lineHeight:    'var(--line-height-caption)',
        color:         'var(--neutral-400)',
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
      }}
    >
      {label}
    </p>
  )
}

// ── ResultRow ─────────────────────────────────────────────────────────────────

interface ResultRowProps {
  result:  SearchResult
  focused: boolean
  query:   string
  onClick: () => void
  onHover: (id: string | null) => void
}

export function ResultRow({ result, focused, query, onClick, onHover }: ResultRowProps) {
  const Icon = TYPE_ICON[result.type]

  return (
    <button
      type="button"
      id={`search-result-${result.id}`}
      role="option"
      aria-selected={focused}
      aria-label={[
        // "Chat: Onboarding flow redesign, Today"
        // "Project: Souvenir V2, 18 components"
        `${TYPE_LABEL[result.type].slice(0, -1)}: ${result.title}`,
        result.meta      ?? result.subtitle,
      ].filter(Boolean).join(', ')}
      onClick={onClick}
      onMouseEnter={() => onHover(result.id)}
      onMouseLeave={() => onHover(null)}
      // Hover is CSS; only the keyboard-focused row is state.
      className={focused ? undefined : 'hover:bg-[var(--neutral-50)]'}
      style={{
        display:         'flex',
        alignItems:      'center',
        gap:             10,
        padding:         '8px 8px',
        margin:          '1px 8px',
        borderRadius:    10,
        border:          'none',
        width:           'calc(100% - 16px)',
        textAlign:       'left',
        ...(focused ? { backgroundColor: 'var(--neutral-100)' } : {}),
        boxShadow:       focused ? SHADOW_FOCUSED : 'none',
        cursor:          'pointer',
        outline:         'none',
        transition:      'background-color 100ms, box-shadow 100ms',
        flexShrink:      0,
      }}
    >
      {/* Colour-coded icon container */}
      <div
        style={{
          display:         'inline-flex',
          alignItems:      'center',
          justifyContent:  'center',
          width:           28,
          height:          28,
          borderRadius:    8,
          backgroundColor: TYPE_ICON_BG[result.type],
          flexShrink:      0,
        }}
      >
        <Icon size={14} color={TYPE_ICON_COLOR[result.type]} />
      </div>

      {/* Text */}
      <div style={{ flex: '1 1 0', minWidth: 0 }}>
        <p
          style={{
            margin:       0,
            fontFamily:   'var(--font-body)',
            fontSize:     'var(--font-size-body)',
            fontWeight:   500,
            lineHeight:   'var(--line-height-body)',
            color:        'var(--neutral-800)',
            overflow:     'hidden',
            textOverflow: 'ellipsis',
            whiteSpace:   'nowrap',
          }}
        >
          {highlightTerms(result.title, query)}
        </p>
        {result.subtitle && (
          <p
            style={{
              margin:       '2px 0 0',
              fontFamily:   'var(--font-body)',
              fontSize:     'var(--font-size-caption)',
              fontWeight:   400,
              lineHeight:   'var(--line-height-caption)',
              color:        'var(--neutral-400)',
              overflow:     'hidden',
              textOverflow: 'ellipsis',
              whiteSpace:   'nowrap',
            }}
          >
            {highlightTerms(result.subtitle, query)}
          </p>
        )}
      </div>

      {/* Meta (timestamp, count, etc.) */}
      {result.meta && (
        <span
          style={{
            fontFamily: 'var(--font-body)',
            fontSize:   'var(--font-size-caption)',
            fontWeight: 400,
            lineHeight: 'var(--line-height-caption)',
            color:      'var(--neutral-400)',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          {result.meta}
        </span>
      )}
    </button>
  )
}

// ── CloseModalButton ──────────────────────────────────────────────────────────

export function CloseModalButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label="Close search"
      onClick={onClick}
      className="bg-transparent hover:bg-[var(--neutral-100)]"
      style={{
        display:         'inline-flex',
        alignItems:      'center',
        justifyContent:  'center',
        width:           32,
        height:          32,
        borderRadius:    8,
        border:          'none',
        cursor:          'pointer',
        flexShrink:      0,
        transition:      'background-color 120ms',
      }}
    >
      <CancelOneIcon size={16} color="var(--neutral-500)" />
    </button>
  )
}

// ── KbdHint ───────────────────────────────────────────────────────────────────

export function KbdHint({ keys, label }: { keys: string[]; label: string }) {
  return (
    <span
      style={{
        display:    'inline-flex',
        alignItems: 'center',
        gap:        4,
        fontFamily: 'var(--font-body)',
        fontSize:   'var(--font-size-caption)',
        color:      'var(--neutral-400)',
      }}
    >
      {keys.map(k => (
        <kbd
          key={k}
          style={{
            display:         'inline-flex',
            alignItems:      'center',
            justifyContent:  'center',
            minWidth:        20,
            padding:         '1px 5px',
            borderRadius:    5,
            backgroundColor: 'var(--neutral-100)',
            boxShadow:       '0px 0px 0px 1px var(--neutral-200)',
            fontFamily:      'var(--font-code)',
            fontSize: 12,
            color:           'var(--neutral-600)',
          }}
        >
          {k}
        </kbd>
      ))}
      <span>{label}</span>
    </span>
  )
}

