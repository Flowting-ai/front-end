'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/Badge'
import { listSlackChannelAutomations, type SlackChannelAutomation } from '@/lib/api/slack'
import styles from './slack-config.module.css'

export function SlackAutomationsPanel({
  orgId,
  channelId,
  channelNames,
}: {
  orgId: string
  channelId?: string
  channelNames: Record<string, string>
}) {
  const [automations, setAutomations] = useState<SlackChannelAutomation[] | null>(null)

  useEffect(() => {
    listSlackChannelAutomations(orgId)
      .then(setAutomations)
      .catch(err => toast.error(err instanceof Error ? err.message : 'Failed to load channel automations'))
  }, [orgId])

  if (automations === null) return <div className={`kaya-skeleton ${styles.skeleton}`} />

  const shown = channelId ? automations.filter(a => a.channelId === channelId) : automations

  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <div className={styles.sectionCopy}>
          <h3 className={styles.sectionTitle}>Automations</h3>
          <p className={styles.sectionDescription}>
            Recurring jobs Souvenir is watching in {channelId ? 'this channel' : 'your Slack workspace'}.
          </p>
        </div>
      </div>
      {shown.length === 0 ? (
        <p className={styles.empty}>No automations yet. Ask Souvenir in a channel to watch something for you.</p>
      ) : (
        <div className={styles.list}>
          {shown.map(automation => (
            <div key={automation.id} className={styles.listRow}>
              <div style={{ minWidth: 0 }}>
                <div className={styles.listPrimary}>{automation.name}</div>
                <div className={styles.listSecondary}>
                  {channelId ? '' : `#${channelNames[automation.channelId] ?? automation.channelId} · `}
                  {automation.summary}
                </div>
              </div>
              <Badge label={automation.status} color={automation.status === 'active' ? 'Green' : 'Neutral'} />
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
