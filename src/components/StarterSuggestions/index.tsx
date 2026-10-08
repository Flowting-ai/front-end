'use client'

import { Tooltip } from '@/components/Tooltip'
import React, { useState } from 'react'
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

function Lead({ card, size, active = false }: { card: StarterCard; size: number; active?: boolean }) {
  if (card.apps.length > 0) return <AppStack apps={card.apps} size={size} />
  const { Icon, color } = RECOMMENDATION_ICONS[card.icon]
  // `triggered` plays the icon's own animation while its row is hovered or focused.
  return <Icon size={size} color={color} triggered={active} />
}

/** One idea row: tracks hover/focus so its icon animates with the whole row, not just the icon. */
function StarterRow({ card, onSelect }: { card: StarterCard; onSelect: (card: StarterCard) => void }) {
  const [active, setActive] = useState(false)
  return (
    <Tooltip content={card.detail} disabled={!(card.detail)} maxWidth={280} side="right"><button
      type="button"
      className={styles.row}
      onClick={() => onSelect(card)}
      onMouseEnter={() => setActive(true)}
      onMouseLeave={() => setActive(false)}
      onFocus={() => setActive(true)}
      onBlur={() => setActive(false)}
    >
      <span className={styles.lead}><Lead card={card} size={20} active={active} /></span>
      <span className={styles.rowLabel}>{card.label}</span>
    </button></Tooltip>
  )
}

/** One row per card — the chat home's suggestions under the composer. */
export function StarterList({ cards, onSelect }: { cards: StarterCard[]; onSelect: (card: StarterCard) => void }) {
  return (
    <>
      <p className={styles.heading}>Ideas for you</p>
      <ul className={`${styles.list} ${styles.listSnug}`}>
        {cards.map(card => (
          <li key={card.label}>
            <StarterRow card={card} onSelect={onSelect} />
          </li>
        ))}
      </ul>
    </>
  )
}

/** Placeholder rows shown while the suggestions load (matches StarterList row for row). */
export function StarterListSkeleton({ count = 3 }: { count?: number }) {
  const widths = ['58%', '66%', '46%', '60%']
  return (
    <div aria-hidden>
      <p className={styles.heading}>Ideas for you</p>
      <ul className={styles.list}>
        {Array.from({ length: count }, (_, i) => (
          <li key={i} className={styles.skelRow}>
            <span className={`kaya-skeleton ${styles.skelLead}`} />
            <span className={`kaya-skeleton ${styles.skelBar}`} style={{ width: widths[i % widths.length] }} />
          </li>
        ))}
      </ul>
    </div>
  )
}

/** A tile per card with what it gets back — multi-step jobs. */
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
