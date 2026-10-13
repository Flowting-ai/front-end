'use client'

import React from 'react'
import { CourtHouseIcon } from '@strange-huge/icons'
import type { LibraryFileRow, Person } from '@/lib/library/schemas'
import { accessAvatars, accessTip, personName } from '@/lib/library/access'
import { sanitizeDisplayText } from '@/lib/library/format'
import { Tooltip } from '@/components/Tooltip'

// Soft diagonal gradient (light top-left to the full tint bottom-right), as in the library prototype.
const tintGradient = (colour: string) =>
  `linear-gradient(135deg, color-mix(in srgb, ${colour} 45%, white), color-mix(in srgb, ${colour} 88%, black))`
const HAIRLINE = "inset 0 0 0 0.5px rgba(0, 0, 0, 0.08)"

const TINTS = ['Blue', 'Green', 'Purple', 'Yellow', 'Brown'] as const

function tintFor(id: string): (typeof TINTS)[number] {
  let hash = 0
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) >>> 0
  return TINTS[hash % TINTS.length]
}

function initialOf(name: string): string {
  const clean = sanitizeDisplayText(name)
  return clean ? Array.from(clean)[0].toUpperCase() : '?'
}

/** A person as a soft tinted circle: their photo when they have one, otherwise their initial. */
export function PersonAvatar({ person, size = 24, ring = false }: { person: Person; size?: number; ring?: boolean }) {
  const tint = tintFor(person.id)
  return (
    <span
      aria-hidden="true"
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden',
        width: size, height: size, borderRadius: '50%',
        background: tintGradient(`var(--color-tag-${tint}-bg)`), color: `var(--color-tag-${tint}-text)`,
        fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: Math.round(size * 0.45), lineHeight: 1,
        boxShadow: ring ? `${HAIRLINE}, 0 0 0 2px var(--card-bg)` : HAIRLINE,
      }}
    >
      {person.avatarUrl ? (
        // The URL is the person's own uploaded photo; it is only ever set as an <img> source.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={person.avatarUrl} alt="" width={size} height={size} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        initialOf(person.name)
      )}
    </span>
  )
}

/** The whole workspace: a lilac circle with a building. */
export function WorkspaceAvatar({ size = 24 }: { size?: number }) {
  return (
    <span
      aria-hidden="true"
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, width: size, height: size, borderRadius: '50%',
        background: tintGradient('var(--color-tag-Purple-bg)'), color: 'var(--color-tag-Purple-text)', boxShadow: `${HAIRLINE}, 0 0 0 2px var(--card-bg)`,
      }}
    >
      <CourtHouseIcon size={Math.round(size * 0.58)} />
    </span>
  )
}

/**
 * Who can open a file, for the Access column: the owner alone, two avatars, the owner and a "+N",
 * or only a building for the whole workspace. The tooltip says it in words, so it is not colour alone.
 */
export function AccessAvatars({ file, viewerId }: { file: Pick<LibraryFileRow, 'owner' | 'accessSummary'>; viewerId: string | undefined }) {
  const { shown, extra, everyone } = accessAvatars(file)
  const tip = accessTip(file, viewerId)
  return (
    <Tooltip content={tip}>
      <span role="img" aria-label={tip} style={{ display: 'inline-flex', alignItems: 'center' }}>
        {shown.map((person, index) => (
          <span key={person.id} style={{ marginLeft: index === 0 ? 0 : -6, display: 'inline-flex' }}>
            <PersonAvatar person={person} ring />
          </span>
        ))}
        {everyone && <WorkspaceAvatar />}
        {extra > 0 && (
          <span
            aria-hidden="true"
            style={{
              marginLeft: -6, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 24, height: 24, padding: '0 5px',
              borderRadius: 12, background: tintGradient('var(--neutral-100)'), color: 'var(--neutral-700)', boxShadow: `${HAIRLINE}, 0 0 0 2px var(--card-bg)`,
              fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 11, boxSizing: 'border-box',
            }}
          >
            +{extra}
          </span>
        )}
      </span>
    </Tooltip>
  )
}

/** "You" or the person's sanitised name, as text. */
export function PersonLabel({ person, viewerId }: { person: Person; viewerId: string | undefined }) {
  return <>{personName(person, viewerId)}</>
}
