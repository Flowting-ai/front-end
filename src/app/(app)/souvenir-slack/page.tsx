'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { toast } from 'sonner'
import { CancelOneIcon, CheckmarkCircleTwoIcon } from '@strange-huge/icons'
import { useOrg } from '@/context/org-context'
import { Button } from '@/components/Button'
import { SettingsPageShell } from '@/components/SettingsPageShell'
import { SlackConnectModal } from '@/components/SlackConnectModal'
import { getOrgSlackStatus, getSlackInstallUrl, removeOrgSlackInstallation } from '@/lib/api/slack'
import type { SlackStatus } from '@/lib/api/slack'
import { SlackWorkspaceConfig } from './SlackWorkspaceConfig'
import { SlackAdminOnly, SlackNotConnected } from './SlackEmptyState'
import styles from './slack-config.module.css'

export default function SouvenirSlackPage() {
  const { orgId, orgReady, orgRole } = useOrg()

  const [statusLoading, setStatusLoading] = useState(true)
  const [status,        setStatus]        = useState<SlackStatus | null>(null)
  const [modalOpen,     setModalOpen]     = useState(false)

  const [removing,      setRemoving]      = useState(false)
  const [updating, setUpdating] = useState(false)

  const isAdmin = orgRole === 'admin'
  const connected = status?.connected ?? false
  const teamName  = status?.workspaces[0]?.teamName ?? null
  const workspace = status?.workspaces[0]

  useEffect(() => {
    const url = new URL(window.location.href)
    const result = url.searchParams.get('slack')
    if (result === 'cancelled' || result === 'error') {
      toast.error(result === 'cancelled'
        ? 'Slack permission update cancelled. Your existing setup is still connected.'
        : 'Could not update Slack permissions. Please try again.')
      url.searchParams.delete('slack')
      window.history.replaceState(null, '', url)
    }
  }, [])

  const handleUpdatePermissions = async () => {
    if (!isAdmin || !workspace || updating || removing) return
    setUpdating(true)
    try {
      const url = await getSlackInstallUrl(workspace.teamId)
      window.location.assign(url)
    } catch (err) {
      setUpdating(false)
      toast.error(err instanceof Error ? err.message : 'Could not start Slack permission update')
    }
  }

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
    if (!orgId || removing || updating) return
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
        <SlackAdminOnly />
      ) : !connected ? (
        <SlackNotConnected onConnect={() => setModalOpen(true)} />
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
                    <CheckmarkCircleTwoIcon size={12} color="var(--green-600, #16a34a)" />
                    {workspace?.needsReinstall ? 'Connected · Permission update needed' : 'Connected'}
                  </span>
                </span>
              </div>
              <div className={styles.connectionActions}>
                <Button variant={workspace?.needsReinstall ? 'default' : 'secondary'} size="sm" disabled={removing || updating} loading={updating} onClick={handleUpdatePermissions}>
                  Update Slack permissions
                </Button>
                <Button variant="danger" size="sm" leftIcon={<CancelOneIcon size={14} />} disabled={removing || updating} loading={removing} onClick={handleRemoveSlack}>
                  Disconnect Slack
                </Button>
              </div>
            </div>
            <p className={styles.permissionNotice}>
              {workspace?.needsReinstall && 'Souvenir needs additional Slack permissions. '}
              Updating permissions keeps your channels, automations, and settings. Slack will ask you to approve access.
            </p>
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
