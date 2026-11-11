'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Badge } from '@/components/Badge'
import { LeaveWorkspaceModal } from '@/components/LeaveWorkspaceModal'
import { deleteOrg } from '@/lib/api/organization'
import { CHAT_ROUTE } from '@/lib/routes'
import { Card, TextInput } from './GeneralParts'

/**
 * Leave, archive and delete. Hidden on the page (SHOW_DANGER_ZONE). Archive has no backend
 * enforcement yet and Delete is wired but held behind "Coming soon", so both buttons are disabled.
 */
export function OrgDangerZoneCard({ orgId, workspaceName, canDeleteOrg }: { orgId: string | null; workspaceName: string; canDeleteOrg: boolean }) {
  const router = useRouter()
  const [deleteOrgInput, setDeleteOrgInput] = useState('')
  const [deletingOrg,    setDeletingOrg]    = useState(false)
  // No archive endpoint exists in lib/api/organization.ts yet — the button is
  // real and enabled (matching Figma 18:23880), but until there's a backend
  // contract it can only tell the admin that, not actually archive anything.
  const [leaveWorkspaceOpen, setLeaveWorkspaceOpen] = useState(false)

  const handleArchiveOrg = () => {
    // TODO: no backend enforcement exists yet — wire once `archived` is
    // actually read/gated somewhere server-side.
  }

  const handleDeleteOrg = async () => {
    if (!orgId || deleteOrgInput !== workspaceName) return
    if (!canDeleteOrg) { toast.error('Only an admin or owner can delete this organization.'); return }
    setDeletingOrg(true)
    try {
      await deleteOrg(orgId, deleteOrgInput)
      toast.success('Organization deleted')
      router.push(CHAT_ROUTE)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete organization')
    } finally {
      setDeletingOrg(false)
    }
  }

  return (
    <>
    <Card danger>
      <div style={{ borderBottom: '1px solid var(--neutral-100)', padding: '20px 24px' }}>
        <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 16, lineHeight: '22px', color: 'var(--red-400)', margin: '0 0 2px' }}>
          Danger Zone
        </p>
        <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-500)', margin: 0 }}>
          Actions here are permanent and cannot be undone.
        </p>
      </div>

      {/* Leave workspace */}
      <div style={{ borderBottom: '1px solid var(--neutral-100)', padding: '20px 24px', display: 'flex', alignItems: 'flex-end', gap: 24 }}>
        <div style={{ flex: '1 0 0', minWidth: 0 }}>
          <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 16, lineHeight: '22px', color: 'var(--neutral-900)', margin: 0 }}>
            Leave workspace
          </p>
          <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-500)', margin: 0 }}>
            Remove yourself from this workspace. You&apos;ll lose access to its projects and chats.
          </p>
        </div>
        <button
          onClick={() => setLeaveWorkspaceOpen(true)}
          style={{
            flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '6px 10px 8px', borderRadius: 10, border: 'none', cursor: 'pointer',
            backgroundColor: 'var(--neutral-white)',
            boxShadow: '0px 1.091px 1.091px 0px rgba(24,2,2,0.05), 0px 1.455px 3.127px 0px rgba(24,2,2,0.15), 0px 0px 0px 1px var(--red-100)',
            fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, lineHeight: '22px', color: 'var(--red-500)', whiteSpace: 'nowrap',
          }}
        >
          Leave
        </button>
      </div>

      {/* handleArchiveOrg kept as a no-op stub (matching account page's
          handleDeleteAccount precedent) so the disabled button stays
          wired rather than dead-code. */}
      {/* Archive workspace — no backend enforcement exists behind the
          `archived` org field yet (nothing reads it to actually gate
          member access), so this stays disabled behind a "Coming soon"
          badge rather than wiring a button that wouldn't really archive
          anything. */}
      <div style={{ borderBottom: '1px solid var(--neutral-100)', padding: '20px 24px', display: 'flex', alignItems: 'flex-end', gap: 24 }}>
        <div style={{ flex: '1 0 0', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
            <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 16, lineHeight: '22px', color: 'var(--neutral-900)', margin: 0 }}>
              Archive workspace
            </p>
            <Badge label="Coming soon" color="Red" />
          </div>
          <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-500)', margin: 0 }}>
            Temporarily disable the workspace. Members will lose access until restored.
          </p>
        </div>
        <button
          disabled
          onClick={handleArchiveOrg}
          style={{
            flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '6px 10px 8px', borderRadius: 10, border: 'none', cursor: 'not-allowed',
            opacity: 0.5,
            backgroundColor: 'var(--neutral-white)',
            boxShadow: '0px 1.091px 1.091px 0px rgba(24,2,2,0.05), 0px 1.455px 3.127px 0px rgba(24,2,2,0.15), 0px 0px 0px 1px var(--red-100)',
            fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, lineHeight: '22px', color: 'var(--red-500)', whiteSpace: 'nowrap',
          }}
        >
          Archive
        </button>
      </div>

      {/* Delete workspace — real DELETE endpoint exists and is fully
          wired (see handleDeleteOrg), but stays behind "Coming soon"
          per the same disable-until-ready treatment as Archive above. */}
      <div style={{ padding: '20px 24px', display: 'flex', alignItems: 'flex-end', gap: 24 }}>
        <div style={{ flex: '1 0 0', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
            <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 16, lineHeight: '22px', color: 'var(--neutral-900)', margin: 0 }}>
              Delete workspace
            </p>
            <Badge label="Coming soon" color="Red" />
          </div>
          <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-500)', margin: 0 }}>
            Permanently delete this workspace, all teams, projects, and data. This cannot be undone.
          </p>
        </div>
        <TextInput
          value={deleteOrgInput}
          onChange={setDeleteOrgInput}
          placeholder={`Type "${workspaceName}" to confirm`}
          readOnly
          style={{ width: 327, flexShrink: 0 }}
        />
        <button
          disabled
          onClick={() => void handleDeleteOrg()}
          style={{
            flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '6px 10px 8px', borderRadius: 10, border: 'none',
            cursor: 'not-allowed',
            opacity: 0.5,
            backgroundColor: 'var(--neutral-white)',
            boxShadow: '0px 1.091px 1.091px 0px rgba(24,2,2,0.05), 0px 1.455px 3.127px 0px rgba(24,2,2,0.15), 0px 0px 0px 1px var(--red-100)',
            fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, lineHeight: '22px', color: 'var(--red-500)', whiteSpace: 'nowrap',
          }}
        >
          {deletingOrg ? 'Deleting…' : 'Delete workspace'}
        </button>
      </div>
    </Card>
      {leaveWorkspaceOpen && <LeaveWorkspaceModal onClose={() => setLeaveWorkspaceOpen(false)} />}
    </>
  )
}
