'use client'

import Image from 'next/image'
import { CalendarFoldIcon, MessagePreviewOneIcon, SettingsOneIcon, UserIcon } from '@strange-huge/icons'
import { Button } from '@/components/Button'
import { SouvenirLogo } from '@/components/SouvenirLogo'
import styles from './slack-config.module.css'

const BENEFITS = [
  {
    icon: <MessagePreviewOneIcon size={18} />,
    title: 'Works where your team talks',
    copy: 'Mention Souvenir in a channel to get answers and get things done without leaving Slack.',
  },
  {
    icon: <CalendarFoldIcon size={18} />,
    title: 'Updates on a schedule',
    copy: 'Send summaries, notifications and AI-written updates to the channels that need them.',
  },
  {
    icon: <SettingsOneIcon size={18} />,
    title: 'You stay in control',
    copy: 'Choose which projects, connectors and channels Souvenir can use.',
  },
]

/** Shown to admins until a Slack workspace is connected. */
export function SlackNotConnected({ onConnect }: { onConnect: () => void }) {
  return (
    <section className={styles.emptyHero} aria-labelledby="slack-empty-title">
      <div className={styles.emptyPair} aria-hidden>
        <span className={styles.emptyTile}>
          <Image src="/icons/slack.svg" alt="" width={28} height={28} />
        </span>
        <span className={styles.emptyLink} />
        <span className={styles.emptyTile}>
          <SouvenirLogo size={28} />
        </span>
      </div>

      <div className={styles.emptyHeading}>
        <h2 id="slack-empty-title" className={styles.emptyHeroTitle}>Bring Souvenir into Slack</h2>
        <p className={styles.emptyHeroCopy}>
          Connect your workspace to choose what Souvenir can access and how it behaves in each channel.
        </p>
      </div>

      <div className={styles.emptyBenefits}>
        {BENEFITS.map(item => (
          <div key={item.title} className={styles.emptyBenefit}>
            <span className={styles.emptyBenefitIcon}>{item.icon}</span>
            <p className={styles.emptyBenefitTitle}>{item.title}</p>
            <p className={styles.emptyBenefitCopy}>{item.copy}</p>
          </div>
        ))}
      </div>

      <div className={styles.emptyActions}>
        <Button
          variant="default"
          size="md"
          onClick={onConnect}
          leftIcon={<Image src="/icons/slack.svg" alt="" width={16} height={16} />}
        >
          Connect Slack workspace
        </Button>
        <p className={styles.emptyNote}>Slack will ask you to approve access before anything is connected.</p>
      </div>
    </section>
  )
}

/** Shown to members: they can see the page but not manage it. */
export function SlackAdminOnly() {
  return (
    <section className={styles.emptyHero} aria-labelledby="slack-admin-title">
      <span className={styles.emptyTile} aria-hidden>
        <UserIcon size={24} />
      </span>
      <div className={styles.emptyHeading}>
        <h2 id="slack-admin-title" className={styles.emptyHeroTitle}>Slack is managed by admins</h2>
        <p className={styles.emptyHeroCopy}>
          Only workspace owners and admins can connect Slack or change how Souvenir behaves in it. Ask an admin if you need something changed.
        </p>
      </div>
    </section>
  )
}
