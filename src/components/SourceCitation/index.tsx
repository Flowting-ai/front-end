'use client'

import React, { useState, useEffect } from 'react'
import * as HoverCardPrimitive from '@radix-ui/react-hover-card'
import { motion, AnimatePresence } from 'framer-motion'
import { springs } from '@/lib/springs'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface SourceItem {
  /** Unique ID — used as React key */
  id:          string | number
  /** Page or document title */
  title:       string
  /** Full URL — omit if source has no public link */
  url?:        string
  /** ConnectorIcon id: 'notion' | 'gmail' | 'linear' | 'figma' | 'slack' | etc. */
  connector?:  string
  /** Verbatim passage the AI relied on to generate this sentence */
  quote?:      string
  /** Secondary metadata line: "Page 14", "Sent by Kai · 2 days ago", etc. */
  meta?:       string
}

export interface SourceCitationProps {
  /** 1-based citation number shown in the inline chip */
  index:   number
  /** Source this citation references */
  source:  SourceItem
  /** Called when the user clicks "Open" in the card */
  onOpen?: (source: SourceItem) => void
  className?: string
}

export interface SourceListProps {
  /** Ordered list of sources — index derived from position (1-based) */
  sources:  SourceItem[]
  className?: string
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function getDomain(url: string): string {
  try { return new URL(url).hostname.replace('www.', '') }
  catch { return url }
}

// ── ConnectorLogoBox ───────────────────────────────────────────────────────────
// 24×24 box: favicon from URL via Google S2, falls back to first-letter.

function ConnectorLogoBox({ connector: _connector, title, url }: { connector?: string; title: string; url?: string }) {
  const [imgError, setImgError] = useState(false)

  const domain = url ? getDomain(url) : null
  const faviconSrc = domain && !imgError
    ? `https://www.google.com/s2/favicons?domain=${domain}&sz=32`
    : null

  const boxStyle: React.CSSProperties = {
    width:           24,
    height:          24,
    borderRadius:    4,
    flexShrink:      0,
    display:         'flex',
    alignItems:      'center',
    justifyContent:  'center',
    overflow:        'hidden',
    backgroundColor: 'var(--neutral-100)',
    border:          '1px solid var(--neutral-200)',
  }

  if (faviconSrc) {
    return (
      <div style={boxStyle}>
        <img
          src={faviconSrc}
          alt=""
          width={16}
          height={16}
          style={{ display: 'block', objectFit: 'contain' }}
          onError={() => setImgError(true)}
        />
      </div>
    )
  }

  return (
    <div style={boxStyle}>
      <span style={{
        fontFamily:    'var(--font-body)',
        fontSize:      '10px',
        lineHeight:    1,
        fontWeight:    'var(--font-weight-medium)' as React.CSSProperties['fontWeight'],
        color:         'var(--neutral-500)',
        textTransform: 'uppercase',
      }}>
        {title.charAt(0)}
      </span>
    </div>
  )
}

// ── Divider ────────────────────────────────────────────────────────────────────

function Divider() {
  return <div style={{ height: 1, backgroundColor: 'var(--neutral-200)', margin: '0 -14px' }} />
}

// ── SourceCardContent ──────────────────────────────────────────────────────────

interface SourceCardContentProps {
  index:   number
  source:  SourceItem
  onOpen?: (source: SourceItem) => void
}

function SourceCardContent({ index, source, onOpen }: SourceCardContentProps) {
  const { title, url, connector, quote, meta } = source
  const domain    = url ? getDomain(url) : null
  const subtitle  = meta || domain
  const hasQuote  = !!quote
  const hasOpen   = !!url

  return (
    <div
      style={{
        width:           '272px',
        borderRadius:    '12px',
        backgroundColor: 'var(--neutral-50)',
        boxShadow:       'var(--shadow-popover)',
        padding:         '12px 14px',
        display:         'flex',
        flexDirection:   'column',
        gap:             '10px',
        isolation:       'isolate',
      }}
    >
      {/* ── Header: logo + title + subtitle ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
        <ConnectorLogoBox connector={connector} title={title} url={url} />

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
          <span
            style={{
              fontFamily:   'var(--font-body)',
              fontWeight:   'var(--font-weight-medium)',
              fontSize:     'var(--font-size-body)',
              lineHeight:   'var(--line-height-body)',
              color:        'var(--neutral-900)',
              overflow:     'hidden',
              textOverflow: 'ellipsis',
              whiteSpace:   'nowrap',
            }}
          >
            {title}
          </span>
          {subtitle && (
            <span
              style={{
                fontFamily:   'var(--font-body)',
                fontSize:     'var(--font-size-caption)',
                lineHeight:   'var(--line-height-caption)',
                color:        'var(--neutral-400)',
                overflow:     'hidden',
                textOverflow: 'ellipsis',
                whiteSpace:   'nowrap',
              }}
            >
              {subtitle}
            </span>
          )}
        </div>

        {/* Citation index — top-right */}
        <span
          aria-hidden
          style={{
            display:         'inline-flex',
            alignItems:      'center',
            justifyContent:  'center',
            width:           '16px',
            height:          '16px',
            borderRadius:    '999px',
            backgroundColor: 'var(--neutral-200)',
            flexShrink:      0,
            fontFamily:      'var(--font-body)',
            fontWeight:      'var(--font-weight-medium)',
            fontSize:        '10px',
            lineHeight:      1,
            color:           'var(--neutral-500)',
            marginTop:       '2px',
          }}
        >
          {index}
        </span>
      </div>

      {/* ── Middle content: quote if available, otherwise URL path ── */}
      {(hasQuote || url) && (
        <>
          <Divider />
          {hasQuote ? (
            <p
              style={{
                margin:            0,
                fontFamily:        'var(--font-body)',
                fontSize:          'var(--font-size-caption)',
                lineHeight:        'var(--line-height-caption)',
                color:             'var(--neutral-600)',
                display:           '-webkit-box',
                WebkitLineClamp:   3,
                WebkitBoxOrient:   'vertical',
                overflow:          'hidden',
                fontStyle:         'italic',
                paddingLeft:       '10px',
                borderLeft:        '2px solid var(--neutral-200)',
              }}
            >
              {quote}
            </p>
          ) : (
            <p
              style={{
                margin:       0,
                fontFamily:   'var(--font-body)',
                fontSize:     'var(--font-size-caption)',
                lineHeight:   'var(--line-height-caption)',
                color:        'var(--neutral-400)',
                overflow:     'hidden',
                textOverflow: 'ellipsis',
                whiteSpace:   'nowrap',
              }}
            >
              {url}
            </p>
          )}
        </>
      )}

      {/* ── Open footer ── */}
      {hasOpen && (
        <>
          <Divider />
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={() => onOpen?.(source)}
              style={{
                background:  'none',
                border:      'none',
                padding:     '0',
                cursor:      'pointer',
                fontFamily:  'var(--font-body)',
                fontWeight:  'var(--font-weight-medium)',
                fontSize:    'var(--font-size-caption)',
                lineHeight:  'var(--line-height-caption)',
                color:       'var(--neutral-500)',
              }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--neutral-900)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--neutral-500)')}
            >
              Open
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// ── SourceCitation ─────────────────────────────────────────────────────────────

export const SourceCitation = React.forwardRef<HTMLButtonElement, SourceCitationProps>(
  function SourceCitation({ index, source, onOpen, className }, ref) {
    const [open,    setOpen]    = useState(false)
    const [mounted, setMounted] = useState(false)

    useEffect(() => { if (open) setMounted(true) }, [open])

    return (
      <HoverCardPrimitive.Root
        open={open}
        onOpenChange={setOpen}
        openDelay={250}
        closeDelay={120}
      >
        <HoverCardPrimitive.Trigger asChild>
          <button
            ref={ref}
            className={className}
            aria-label={`Source ${index}: ${source.title}`}
            style={{
              display:         'inline-flex',
              alignItems:      'center',
              justifyContent:  'center',
              verticalAlign:   'text-bottom',
              width:           '18px',
              height:          '18px',
              borderRadius:    '999px',
              backgroundColor: 'var(--neutral-200)',
              cursor:          'pointer',
              border:          'none',
              marginLeft:      '2px',
              fontFamily:      'var(--font-body)',
              fontWeight:      'var(--font-weight-medium)',
              fontSize:        '10px',
              lineHeight:      1,
              color:           'var(--neutral-600)',
              flexShrink:      0,
              outline:         'none',
              transition:      'background-color 0.1s ease',
            }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--neutral-300)')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'var(--neutral-200)')}
          >
            {index}
          </button>
        </HoverCardPrimitive.Trigger>

        {mounted && (
          <HoverCardPrimitive.Portal forceMount>
            <HoverCardPrimitive.Content
              side="top"
              sideOffset={6}
              align="start"
              forceMount
              className="z-9999"
              style={{ outline: 'none' }}
            >
              <AnimatePresence>
                {open && (
                  <motion.div
                    key="source-card"
                    initial={{ opacity: 0, y: 4, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0,  scale: 1    }}
                    exit={{    opacity: 0, y: 4,  scale: 0.97 }}
                    transition={springs.fast}
                    style={{ transformOrigin: 'bottom left' }}
                    onAnimationComplete={() => { if (!open) setMounted(false) }}
                  >
                    <SourceCardContent index={index} source={source} onOpen={onOpen} />
                  </motion.div>
                )}
              </AnimatePresence>
            </HoverCardPrimitive.Content>
          </HoverCardPrimitive.Portal>
        )}
      </HoverCardPrimitive.Root>
    )
  },
)

SourceCitation.displayName = 'SourceCitation'

// ── SourceCard ─────────────────────────────────────────────────────────────────
// Compact card used inside the horizontal SourceList row.
// Styled after the secondary Button variant — same bg, shadow, and hover overlay.

function SourceCard({ source }: { source: SourceItem; index: number }) {
  const [imgError, setImgError] = useState(false)
  const [hovered,  setHovered]  = useState(false)

  const domain     = source.url ? getDomain(source.url) : null
  const faviconSrc = domain && !imgError
    ? `https://www.google.com/s2/favicons?domain=${domain}&sz=32`
    : null

  const cardStyle: React.CSSProperties = {
    display:         'flex',
    flexDirection:   'row',
    alignItems:      'center',
    gap:             '8px',
    // secondary Button sm: py-[5px] px-[8px]
    padding:         '5px 8px',
    borderRadius:    '8px',
    backgroundColor: 'var(--button-secondary-bg)',
    boxShadow:       hovered
      ? 'var(--shadow-button-secondary-outer-hover)'
      : 'var(--shadow-button-secondary-outer)',
    width:           '200px',
    flexShrink:      0,
    transition:      'box-shadow 150ms',
    textDecoration:  'none',
    cursor:          source.url ? 'pointer' : 'default',
    position:        'relative',
    overflow:        'hidden',
  }

  const content = (
    <>
      {/* Hover bg overlay — mirrors secondary Button's inner hover div */}
      <div aria-hidden style={{
        position:        'absolute',
        inset:           0,
        borderRadius:    'inherit',
        backgroundColor: hovered ? 'var(--button-secondary-bg-hover)' : 'transparent',
        transition:      'background-color 200ms',
        pointerEvents:   'none',
      }} />

      {/* Inner shadow — secondary button 3D depth effect */}
      <div aria-hidden style={{
        position:      'absolute',
        inset:         0,
        borderRadius:  'inherit',
        boxShadow:     hovered
          ? 'var(--shadow-button-secondary-inner-hover)'
          : 'var(--shadow-button-secondary-inner)',
        transition:    'box-shadow 150ms',
        pointerEvents: 'none',
      }} />

      {/* Favicon on left */}
      <div style={{
        width:           30,
        height:          30,
        borderRadius:    6,
        backgroundColor: 'var(--neutral-100)',
        border:          '1px solid var(--neutral-200)',
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'center',
        overflow:        'hidden',
        flexShrink:      0,
        alignSelf:       'center',
        position:        'relative',
        zIndex:          1,
      }}>
        {faviconSrc ? (
          <img
            src={faviconSrc}
            alt=""
            width={20}
            height={20}
            style={{ display: 'block', objectFit: 'contain' }}
            onError={() => setImgError(true)}
          />
        ) : (
          <span style={{
            fontFamily:    'var(--font-body)',
            fontSize:      '9px',
            lineHeight:    1,
            color:         'var(--neutral-500)',
            textTransform: 'uppercase',
          }}>
            {source.title.charAt(0)}
          </span>
        )}
      </div>

      {/* Link data on right: title + domain */}
      <div style={{
        display:       'flex',
        flexDirection: 'column',
        gap:           '1px',
        minWidth:      0,
        flex:          1,
        position:      'relative',
        zIndex:        1,
      }}>
        <span style={{
          fontFamily:   'var(--font-body)',
          fontWeight:   'var(--font-weight-medium)' as React.CSSProperties['fontWeight'],
          fontSize:     'var(--font-size-body)',
          lineHeight:   'var(--line-height-body)',
          color:        'var(--button-secondary-text)',
          overflow:     'hidden',
          textOverflow: 'ellipsis',
          whiteSpace:   'nowrap',
          display:      'block',
        }}>
          {source.title}
        </span>

        {domain && (
          <span style={{
            fontFamily:   'var(--font-body)',
            fontSize:     'var(--font-size-caption)',
            lineHeight:   'var(--line-height-caption)',
            color:        'var(--neutral-400)',
            overflow:     'hidden',
            textOverflow: 'ellipsis',
            whiteSpace:   'nowrap',
            display:      'block',
          }}>
            {domain}
          </span>
        )}
      </div>
    </>
  )

  if (source.url) {
    return (
      <a
        href={source.url}
        target="_blank"
        rel="noopener noreferrer"
        style={cardStyle}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {content}
      </a>
    )
  }

  return (
    <div
      style={cardStyle}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {content}
    </div>
  )
}

// ── SourceList ─────────────────────────────────────────────────────────────────
// Horizontal scrollable row of source cards.

export const SourceList = React.forwardRef<HTMLDivElement, SourceListProps>(
  function SourceList({ sources, className }, ref) {
    if (sources.length === 0) return null

    return (
      <div
        ref={ref}
        className={className}
        style={{
          paddingTop: '10px',
          borderTop:  '1px solid var(--neutral-200)',
          marginTop:  '12px',
        }}
      >
        <div
          className="kaya-scrollbar"
          role="list"
          aria-label="Sources"
          style={{
            display:       'flex',
            flexDirection: 'row',
            gap:           '8px',
            overflowX:     'auto',
            padding:       '3px',
            paddingBottom: '5px',
          }}
        >
          {sources.map((source, i) => (
            <div key={source.id} role="listitem" style={{ flexShrink: 0 }}>
              <SourceCard source={source} index={i + 1} />
            </div>
          ))}
        </div>
      </div>
    )
  },
)

SourceList.displayName = 'SourceList'
