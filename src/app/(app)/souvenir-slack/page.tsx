'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { toast } from 'sonner'
import { CancelOneIcon, CheckmarkCircleTwoIcon } from '@strange-huge/icons'
import { useOrg } from '@/context/org-context'
import { Button } from '@/components/Button'
import { SettingsPageShell } from '@/components/SettingsPageShell'
import { SlackConnectModal } from '@/components/SlackConnectModal'
import { getOrgSlackStatus, removeOrgSlackInstallation } from '@/lib/api/slack'
import type { SlackStatus } from '@/lib/api/slack'
import { SlackWorkspaceConfig } from './SlackWorkspaceConfig'
import styles from './slack-config.module.css'

export default function SouvenirSlackPage() {
  const { orgId, orgReady, orgRole } = useOrg()

  const [statusLoading, setStatusLoading] = useState(true)
  const [status,        setStatus]        = useState<SlackStatus | null>(null)
  const [modalOpen,     setModalOpen]     = useState(false)

  const [removing,      setRemoving]      = useState(false)

  const isAdmin = orgRole === 'admin'
  const connected = status?.connected ?? false
  const teamName  = status?.workspaces[0]?.teamName ?? null

  const loadStatus = () => {
    if (!orgId) return
    setStatusLoading(true)
    getOrgSlackStatus(orgId)
      .then(s => {
        setStatus(s)
      })
      .catch(() => {
        setStatus({ connected: false, workspaces: [] })
      })
      .finally(() => setStatusLoading(false))
  }

  useEffect(() => {
    if (!orgReady || !orgId) return
    let cancelled = false
    getOrgSlackStatus(orgId)
      .then(s => {
        if (cancelled) return
        setStatus(s)
      })
      .catch(() => {
        if (cancelled) return
        setStatus({ connected: false, workspaces: [] })
      })
      .finally(() => {
        if (!cancelled) setStatusLoading(false)
      })
    return () => { cancelled = true }
  }, [orgId, orgReady, isAdmin])

  const handleRemoveSlack = async () => {
    if (!orgId || removing) return
    if (!window.confirm('Remove the Slack bot from this organization? It will be uninstalled from the workspace and all project channels stop working.')) return
    setRemoving(true)
    try {
      await removeOrgSlackInstallation(orgId)
      const nextStatus = await getOrgSlackStatus(orgId)
      if (nextStatus.connected) {
        throw new Error('Slack is still connected. Please try disconnecting again.')
      }
      setStatus(nextStatus)
      setModalOpen(false)
      toast.success('Slack removed from this organization')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove Slack')
    } finally {
      setRemoving(false)
    }
  }

  return (
    <SettingsPageShell
      title="Slack"
      description="Configure how Souvenir shows up in Slack, its connectors, and its channels."
      fluid
    >
      {!orgReady || statusLoading ? (
        <div className="kaya-skeleton" style={{ width: '100%', height: 320, borderRadius: 16 }} />
      ) : !isAdmin ? (
        <div className={styles.emptyState}>
          <p className={styles.emptyStateTitle}>
            Only workspace owners and admins can manage Slack.
          </p>
        </div>
      ) : !connected ? (
        <div className={styles.emptyState}>
          <span className={styles.emptyStateMark}>
            <Image src="/icons/slack.svg" alt="" width={24} height={24} />
          </span>
          <p className={styles.emptyStateTitle}>
            Slack is not connected yet
          </p>
          <p className={styles.emptyStateCopy}>
            Connect your workspace to choose what Souvenir can access and how it behaves in each channel.
          </p>
          <Button
            variant="default"
            size="sm"
            style={{ marginTop: 4 }}
            onClick={() => setModalOpen(true)}
            leftIcon={<Image src="/icons/slack.svg" alt="" width={14} height={14} />}
          >
            Connect Slack workspace
          </Button>
        </div>
      ) : (
        orgId && (
          <div className={styles.connectedSurface}>
            <div className={styles.connectionBar}>
              <div className={styles.connectionStatus}>
                <span className={styles.connectionMark}>
                  <Image src="/icons/slack.svg" alt="" width={18} height={18} />
                </span>
                <span style={{ minWidth: 0 }}>
                  <span className={styles.connectionTitle} style={{ display: 'block' }}>{teamName ?? 'Slack workspace'}</span>
                  <span className={styles.connectionMeta} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <CheckmarkCircleTwoIcon size={12} color="var(--green-600, #16a34a)" /> Connected
                  </span>
                </span>
              </div>
              <Button variant="danger" size="sm" leftIcon={<CancelOneIcon size={14} />} disabled={removing} loading={removing} onClick={handleRemoveSlack}>
                Disconnect Slack
              </Button>
            </div>
            <SlackWorkspaceConfig orgId={orgId} teamName={teamName} />
          </div>
        )
      )}

      <SlackConnectModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        orgId={orgId}
        onConnected={loadStatus}
      />
    </SettingsPageShell>
  )
}
