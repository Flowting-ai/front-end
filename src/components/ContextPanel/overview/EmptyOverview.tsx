'use client'

import React from 'react'
import { BubbleChatIcon, CheckmarkCircleTwoIcon, FileTwoIcon, FolderLibraryIcon, LinkSixIcon, StarIcon, UserAiIcon } from '@strange-huge/icons'
import styles from './EmptyOverview.module.css'

// The six things the overview tracks, each with its own hue, placed evenly around the orbit.
const TRACKED = [
  { label: 'To-dos',     Icon: CheckmarkCircleTwoIcon, color: 'var(--green-500)' },
  { label: 'Agents',     Icon: UserAiIcon,             color: 'var(--blue-500)' },
  { label: 'Connectors', Icon: LinkSixIcon,            color: 'var(--purple-500, #8b5cf6)' },
  { label: 'Sources',    Icon: FolderLibraryIcon,      color: 'var(--orange-500, #f59e0b)' },
  { label: 'Outputs',    Icon: FileTwoIcon,            color: 'var(--red-500)' },
  { label: 'Skills',     Icon: StarIcon,               color: 'var(--yellow-500, #eab308)' },
] as const

/** The Context tab for a chat that hasn't started: what will gather here, orbiting the chat. */
export function EmptyOverview() {
  return (
    <div className={styles.wrap}>
      <div className={styles.stage} aria-hidden>
        <span className={`${styles.ring} ${styles.ringOuter}`} />
        <span className={`${styles.ring} ${styles.ringInner}`} />
        <div className={styles.orbit}>
          {TRACKED.map(({ label, Icon, color }, i) => (
            <span key={label} className={styles.slot} style={{ '--a': `${i * 60}deg` } as React.CSSProperties}>
              <span className={styles.chip} style={{ '--chip-color': color, '--d': `${i * -0.6}s` } as React.CSSProperties}>
                <Icon size={16} />
              </span>
            </span>
          ))}
        </div>
        <span className={styles.core}><BubbleChatIcon size={22} /></span>
      </div>
      <p className={styles.title}>Nothing here yet</p>
      <p className={styles.text}>Send a message and this fills in as Souvenir works.</p>
      <ul className={styles.legend}>
        {TRACKED.map(({ label, Icon, color }, i) => (
          <li key={label} className={styles.item} style={{ '--chip-color': color, '--d': `${120 + i * 60}ms` } as React.CSSProperties}>
            <span className={styles.dot} aria-hidden><Icon size={14} /></span>
            {label}
          </li>
        ))}
      </ul>
    </div>
  )
}
