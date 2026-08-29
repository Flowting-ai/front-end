'use client'

import React from 'react'
import { ConnectorIcon as BrandConnectorIcon, CONNECTOR_COLOR, CONNECTOR_MONO } from '@strange-huge/icons/connectors'
import { toConnector } from '@/lib/connector'

// Hybrid icon strategy (docs v1.5/connectors-v1.5-migration-plan.md, Gap #9):
// @strange-huge/icons/connectors only covers ~18 curated brand ids, far short
// of the ~150-slug live catalog. Use it where it exists (exact match to the
// new Figma-sourced design), fall back to the existing backend-hosted/bundled
// logo chain (toConnector().logo) everywhere else, and only fall further back
// to a deterministic letter tile when neither has anything.

export interface ConnectorGlyphProps {
  /** Connector slug, e.g. "notion", "google-drive". */
  slug: string
  /** Display name, used for the letter-tile fallback and alt text. */
  name?: string
  /** Backend-provided logo/icon URL, if already resolved by the caller. */
  logoUrl?: string | null
  size?: number
  /** Force the monochrome (currentColor) variant when the brand icon package covers this id. */
  mono?: boolean
  className?: string
  style?: React.CSSProperties
}

function hueFromSlug(slug: string): number {
  return [...slug].reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360
}

export function ConnectorGlyph({ slug, name, logoUrl, size = 24, mono = false, className, style }: ConnectorGlyphProps) {
  const id = slug.trim().toLowerCase()
  const coverage = mono ? CONNECTOR_MONO : CONNECTOR_COLOR

  if (coverage[id]) {
    return (
      <BrandConnectorIcon
        id={id}
        size={size}
        mono={mono}
        className={className}
        style={style}
        alt={name ?? slug}
      />
    )
  }

  const resolvedLogo = logoUrl ?? toConnector({ slug, display_name: name }).logo
  if (resolvedLogo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- provider-hosted or bundled brand asset, runtime slug path
      <img
        src={resolvedLogo}
        alt={name ?? slug}
        width={size}
        height={size}
        className={className}
        style={{ display: 'block', objectFit: 'contain', flexShrink: 0, ...style }}
      />
    )
  }

  const letter = (name ?? slug).charAt(0).toUpperCase() || '?'
  const hue = hueFromSlug(id)
  return (
    <div
      aria-hidden={!name}
      role={name ? 'img' : undefined}
      aria-label={name}
      className={className}
      style={{
        width: size,
        height: size,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: Math.max(4, Math.round(size * 0.2)),
        backgroundColor: `hsl(${hue} 60% 90%)`,
        color: `hsl(${hue} 60% 35%)`,
        fontFamily: 'var(--font-body)',
        fontWeight: 700,
        fontSize: Math.round(size * 0.45),
        flexShrink: 0,
        userSelect: 'none',
        ...style,
      }}
    >
      {letter}
    </div>
  )
}

ConnectorGlyph.displayName = 'ConnectorGlyph'
export default ConnectorGlyph
