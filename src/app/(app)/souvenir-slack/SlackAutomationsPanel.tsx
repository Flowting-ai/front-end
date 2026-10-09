'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ArrowDownOneIcon } from '@strange-huge/icons'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/Button'
import { ConfirmModal } from '@/components/ConfirmModal'
import {
  deleteAutomation,
  getAutomation,
  runAutomationNow,
  runSummary,
  updateAutomation,
  type AutomationRun,
} from '@/lib/api/automations'
import { listSlackChannelAutomations, type SlackChannelAutomation } from '@/lib/api/slack'
import { SCHEDULES_ROUTE } from '@/lib/routes'
import styles from './slack-config.module.css'

const RECENT_RUNS = 3

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
  const [expanded, setExpanded] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<SlackChannelAutomation | null>(null)

  useEffect(() => {
    listSlackChannelAutomations(orgId)
      .then(setAutomations)
      .catch(err => toast.error(err instanceof Error ? err.message : 'Failed to load channel automations'))
  }, [orgId])

  if (automations === null) return <div className={`kaya-skeleton ${styles.skeleton}`} />

  const shown = channelId ? automations.filter(a => a.channelId === channelId) : automations

  function setStatus(id: string, status: string) {
    setAutomations(prev => prev?.map(a => a.id === id ? { ...a, status } : a) ?? prev)
  }

  async function confirmDelete() {
    if (!pendingDelete) return
    await deleteAutomation(pendingDelete.id)
    setAutomations(prev => prev?.filter(a => a.id !== pendingDelete.id) ?? prev)
    toast.success('Automation deleted')
  }

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
            <AutomationRow
              key={automation.id}
              automation={automation}
              channelLabel={channelId ? null : `#${channelNames[automation.channelId] ?? automation.channelId}`}
              open={expanded === automation.id}
              onToggle={() => setExpanded(expanded === automation.id ? null : automation.id)}
              onStatus={status => setStatus(automation.id, status)}
              onDelete={() => setPendingDelete(automation)}
            />
          ))}
        </div>
      )}
      {pendingDelete && (
        <ConfirmModal
          title="Delete automation?"
          description={`"${pendingDelete.name}" stops watching the channel. Its run history is kept.`}
          confirmLabel="Delete"
          onConfirm={confirmDelete}
          onClose={() => setPendingDelete(null)}
        />
      )}
    </section>
  )
}

function AutomationRow({
  automation,
  channelLabel,
  open,
  onToggle,
  onStatus,
  onDelete,
}: {
  automation: SlackChannelAutomation
  channelLabel: string | null
  open: boolean
  onToggle: () => void
  onStatus: (status: string) => void
  onDelete: () => void
}) {
  const [runs, setRuns] = useState<AutomationRun[] | null>(null)
  const [busy, setBusy] = useState<'pause' | 'run' | null>(null)
  const { push } = useRouter()
  const active = automation.status === 'active'

  useEffect(() => {
    if (!open || !automation.owned || runs !== null) return
    getAutomation(automation.id)
      .then(detail => setRuns((detail.runs ?? []).slice(0, RECENT_RUNS)))
      .catch(() => setRuns([]))
  }, [open, automation.id, automation.owned, runs])

  async function togglePause() {
    setBusy('pause')
    try {
      const detail = await updateAutomation(automation.id, { is_active: !active })
      onStatus(detail.is_active ? 'active' : 'paused')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : active ? 'Failed to pause' : 'Failed to resume')
    } finally {
      setBusy(null)
    }
  }

  async function runNow() {
    setBusy('run')
    try {
      await runAutomationNow(automation.id)
      toast.success('Automation triggered', { description: 'It will start shortly.' })
      setRuns(null)
    } catch {
      toast.error('Failed to run automation')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className={styles.automation}>
      <div className={styles.listRow}>
        <button type="button" className={styles.automationToggle} aria-expanded={open} onClick={onToggle}>
          <ArrowDownOneIcon
            size={14}
            className={`${styles.automationChevron} ${open ? styles.automationChevronOpen : ''}`}
          />
          <div style={{ minWidth: 0 }}>
            <div className={styles.listPrimary}>{automation.name}</div>
            <div className={styles.listSecondary}>
              {channelLabel ? `${channelLabel} · ` : ''}
              {automation.summary}
            </div>
          </div>
        </button>
        <Badge label={automation.status} color={active ? 'Green' : 'Neutral'} />
      </div>
      {open && (
        <div className={styles.automationDetail}>
          <p className={styles.automationSummary}>{automation.summary}</p>
          <p className={styles.automationMeta}>
            Created {new Date(automation.createdAt).toLocaleDateString()}
            {automation.owned ? '' : ' · Only the person who set this up can change it.'}
          </p>
          {automation.owned && (
            <>
              {runs === null ? null : runs.length === 0 ? (
                <p className={styles.automationMeta}>No runs yet.</p>
              ) : (
                <ul className={styles.automationRuns}>
                  {runs.map(run => (
                    <li key={run.id} className={styles.automationRun}>
                      <span className={styles.automationRunStatus}>{run.status}</span>
                      <span className={styles.automationRunText}>{runSummary(run)}</span>
                    </li>
                  ))}
                </ul>
              )}
              <div className={styles.automationActions}>
                <Button variant="outline" size="sm" loading={busy === 'pause'} disabled={busy !== null} onClick={togglePause}>
                  {active ? 'Pause' : 'Resume'}
                </Button>
                <Button variant="outline" size="sm" loading={busy === 'run'} disabled={busy !== null} onClick={runNow}>
                  Run now
                </Button>
                <Button variant="ghost" size="sm" onClick={() => push(`${SCHEDULES_ROUTE}/${automation.id}`)}>
                  Open in Schedules
                </Button>
                <Button variant="danger" size="sm" disabled={busy !== null} onClick={onDelete}>
                  Delete
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
