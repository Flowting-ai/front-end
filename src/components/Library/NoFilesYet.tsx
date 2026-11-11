'use client'

import React from 'react'
import { AiIdeaIcon, BubbleChatIcon, ShareOneIcon } from '@strange-huge/icons'
import { MESSAGES } from '@/lib/library/messages'
import { CHAT_ROUTE } from '@/lib/routes'
import { FormatGlyph } from './FormatGlyph'
import { LinkButton } from './LinkButton'
import styles from './NoFilesYet.module.css'

// How files end up in the Library — shown so an empty Library explains itself.
const WAYS = [
  { icon: <BubbleChatIcon size={16} />, title: MESSAGES.noFilesWayAttachTitle, text: MESSAGES.noFilesWayAttachText },
  { icon: <AiIdeaIcon size={16} />, title: MESSAGES.noFilesWayCreatedTitle, text: MESSAGES.noFilesWayCreatedText },
  { icon: <ShareOneIcon size={16} />, title: MESSAGES.noFilesWaySharedTitle, text: MESSAGES.noFilesWaySharedText },
] as const

/** The Library before anything is in it: a small fan of file types, what the Library is for, a way to start, and how files get here. */
export function NoFilesYet() {
  return (
    <div role="status" className={styles.wrap}>
      <div className={styles.fan} aria-hidden="true">
        <span className={`${styles.card} ${styles.left}`}><FormatGlyph format="sheet" size="lg" /></span>
        <span className={`${styles.card} ${styles.right}`}><FormatGlyph format="image" size="lg" /></span>
        <span className={`${styles.card} ${styles.middle}`}><FormatGlyph format="pdf" size="lg" /></span>
      </div>

      <p className={styles.title}>{MESSAGES.noFilesYetTitle}</p>
      <p className={styles.text}>{MESSAGES.noFilesYetText}</p>

      <div className={styles.actions}>
        <LinkButton href={CHAT_ROUTE}>
          <BubbleChatIcon size={14} />
          {MESSAGES.newChat}
        </LinkButton>
      </div>

      <ul className={styles.ways}>
        {WAYS.map((way) => (
          <li key={way.title} className={styles.way}>
            <span className={styles.wayIcon} aria-hidden="true">{way.icon}</span>
            <span className={styles.wayTitle}>{way.title}</span>
            <span className={styles.wayText}>{way.text}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
