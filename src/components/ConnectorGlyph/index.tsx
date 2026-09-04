'use client'

import React from 'react'

// The backend's catalog logo_url is the single source of connector imagery —
// it covers the whole ~150-slug live catalog, so nothing is bundled locally
// and no icon package is consulted. When a catalog entry carries no logo_url
// (today: the native-MCP seed rows), a deterministic letter tile stands in.

export interface ConnectorGlyphProps {
  /** Connector slug, e.g. "notion", "google-drive". */
  slug: string
  /** Display name, used for the letter-tile fallback and alt text. */
  name?: string
  /**
   * The catalog entry's backend logo_url — required, so a caller can't
   * silently fall through to the letter tile by forgetting to fetch it.
   * Pass null when the entry genuinely has none.
   */
  logoUrl: string | null
  size?: number
  className?: string
  style?: React.CSSProperties
}

function hueFromSlug(slug: string): number {
  return [...slug].reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360
}

export function ConnectorGlyph({ slug, name, logoUrl, size = 24, className, style }: ConnectorGlyphProps) {
  const id = slug.trim().toLowerCase()
  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- provider-hosted image at a runtime URL
      <img
        src={logoUrl}
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
