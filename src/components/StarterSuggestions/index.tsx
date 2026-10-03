'use client'

import React from 'react'
import { ConnectorGlyph } from '@/components/ConnectorGlyph'
import type { CardApp, StarterCard } from '@/lib/api/recommendations'
import { RECOMMENDATION_ICONS } from '@/lib/recommendation-icons'
import styles from './StarterSuggestions.module.css'

// Starter cards from /recommendations. A card that runs against the person's
// connected apps leads with their logos; one that needs none falls back to the
// icon for its kind of work.

export function AppStack({ apps, size = 20 }: { apps: CardApp[]; size?: number }) {
  const tile = size + 4
  return (
    <span className={styles.stack} aria-label={apps.map(app => app.name).join(', ')} role="img">
      {apps.map(app => (
        <span key={app.slug} className={styles.stackItem} style={{ width: tile, height: tile }}>
          <ConnectorGlyph slug={app.slug} name={app.name} logoUrl={app.logoUrl} size={size} />
        </span>
      ))}
    </span>
  )
}

function Lead({ card, size }: { card: StarterCard; size: number }) {
  if (card.apps.length > 0) return <AppStack apps={card.apps} size={size} />
  const { Icon, color } = RECOMMENDATION_ICONS[card.icon]
  return <Icon size={size} color={color} />
}

/** One row per card — the chat home's suggestions under the composer. */
export function StarterList({ cards, onSelect }: { cards: StarterCard[]; onSelect: (card: StarterCard) => void }) {
  return (
    <ul className={styles.list}>
      {cards.map(card => (
        <li key={card.label}>
          <button type="button" className={styles.row} title={card.detail ?? undefined} onClick={() => onSelect(card)}>
            <span className={styles.lead}><Lead card={card} size={20} /></span>
            <span className={styles.rowLabel}>{card.label}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}

/** A tile per card with what it gets back — Brain's multi-step jobs. */
export function StarterTiles({ cards, onSelect }: { cards: StarterCard[]; onSelect: (card: StarterCard) => void }) {
  return (
    <div className={styles.tiles}>
      {cards.map(card => (
        <button key={card.label} type="button" className={styles.tile} onClick={() => onSelect(card)}>
          <span className={styles.tileTop}>
            <Lead card={card} size={22} />
            <span className={styles.try} aria-hidden>Try</span>
          </span>
          <span className={styles.tileText}>
            <span className={styles.tileLabel}>{card.label}</span>
            {card.detail && <span className={styles.tileDetail}>{card.detail}</span>}
          </span>
        </button>
      ))}
    </div>
  )
}
