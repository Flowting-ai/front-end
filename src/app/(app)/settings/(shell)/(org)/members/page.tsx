'use client'

import React, { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { InformationCircleIcon } from '@strange-huge/icons'
import { Button } from '@/components/ui/button'
import type { InviteResult } from '@/components/InviteModal'
import { toast } from 'sonner'
import { useOrg } from '@/context/org-context'
import { useAuth } from '@/context/auth-context'
import { setMemberRole, removeMember, revokeInvite, getOrgSettings } from '@/lib/api/organization'
import { inviteMembers } from '@/lib/api/teams'
import { updateUser } from '@/lib/api/user'
import type { OrgMember, WorkspaceRole } from '@/types/teams'
import { SHADOW_CARD, SHADOW_STAT_CARD, displayRoleFor } from './_components/members-shared'
import { MembersTable } from './_components/MembersTable'
import { MembersPageSkeleton } from './_components/MembersSkeleton'

// Both dialogs load the first time they open, then stay mounted so their exit animation plays.
const RolesPermissionsModal = dynamic(() => import('./_components/RoleModals').then(m => m.RolesPermissionsModal), { ssr: false })
const AppInviteModal = dynamic(() => import('@/components/InviteModal').then(m => m.AppInviteModal), { ssr: false })

// ── Page ──────────────────────────────────────────────────────────────────────

export default function OrgMembersPage() {
  const { orgId, org, members: orgMembers, membersLoading, currentUserRole, refreshMembers } = useOrg()
  const { user } = useAuth()
  const isAdmin = currentUserRole === 'admin'

  const [members,        setMembers]        = useState<OrgMember[]>(orgMembers)
  // Bumped by every optimistic local edit (role change, remove, invite, ...)
  // so a stale render from a superseded orgMembers update never clobbers it.
  const membersVersionRef = useRef(0)

  // Sync context members into local state when the API response arrives.
  // useState only uses its initial value once, so without this effect the table
  // stays empty until the component is remounted.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setMembers(orgMembers.map(member => ({ ...member, role: displayRoleFor(member) })))
    }, 0)
    return () => window.clearTimeout(timer)
  }, [orgMembers])

  // Every optimistic local edit goes through this instead of setMembers
  // directly, so any in-flight background resync (see syncMembers above)
  // knows to discard its result rather than clobber the edit.
  const bumpMembers = (updater: React.SetStateAction<OrgMember[]>) => {
    membersVersionRef.current += 1
    setMembers(updater)
  }

  const [inviteOpen,     setInviteOpen]     = useState(false)
  const [inviteLoading,  setInviteLoading]  = useState(false)
  const [allowedDomains, setAllowedDomains] = useState<string[]>([])
  const [rolesInfoOpen,  setRolesInfoOpen]  = useState(false)
  const [inviteSeen, setInviteSeen] = useState(false)
  const [rolesSeen, setRolesSeen] = useState(false)
  if (inviteOpen && !inviteSeen) setInviteSeen(true)
  if (rolesInfoOpen && !rolesSeen) setRolesSeen(true)

  useEffect(() => {
    if (!orgId) return
    getOrgSettings(orgId)
      .then(s => setAllowedDomains(s.allowedEmailDomains ?? []))
      .catch(() => { /* non-fatal — open invite if settings unavailable */ })
  }, [orgId])

  // Sync the current user's name to the backend when it appears stale
  // ("Someone" or empty) — mirrors how the individual plan syncs via
  // updateUser() during onboarding/settings.
  const currentUserName =
    [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim() ||
    (user?.name && !user.name.includes('@') ? user.name : '')

  useEffect(() => {
    if (!user?.email || !currentUserName) return
    const self = members.find(m => m.email === user.email)
    if (!self) return
    const nameIsStale = !self.name || self.name.toLowerCase() === 'someone'
    if (!nameIsStale) return
    const [first, ...rest] = currentUserName.split(' ')
    updateUser({ first_name: first ?? '', last_name: rest.join(' ') || null })
      .then(() => {
        bumpMembers(prev => prev.map(m =>
          m.email === user.email ? { ...m, name: currentUserName } : m,
        ))
      })
      .catch(() => { /* non-fatal — UI already shows the correct name via displayMembers */ })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.email, currentUserName, members.length])

  const displayMembers = members.map(m =>
    user?.email && m.email === user.email && currentUserName
      ? { ...m, name: currentUserName }
      : m
  )

  const totalMembers   = members.length
  const adminCount     = members.filter(m => displayRoleFor(m) === 'admin').length
  const pendingInvites = members.filter(m => m.inviteStatus === 'invite_sent').length

  // Applies the Manage-role modal's result: a plain org-level Admin/Member
  // choice. Used to also diff a per-team None/Member/Editor grant here (Team
  // has no backend route left at all, so that's gone with no replacement).
  // Returns whether the save fully succeeded, so ManageRoleModal only closes
  // itself (via doSave) on a clean save.
  const handleManageRole = async (
    memberId: string,
    desiredOrgRole: 'admin' | 'member',
  ): Promise<boolean> => {
    const member = members.find(m => m.id === memberId)
    if (!member || !orgId) return false
    const memberName = member.name || member.email
    const prev = members
    const toastId = toast.loading(`Updating ${memberName}'s role…`)

    try {
      // Compare against the *displayed* role, not the raw one — an 'owner'
      // member already displays (and behaves) as Admin, so picking "Admin"
      // for them shouldn't fire a write that would demote them off the
      // owner role.
      if (desiredOrgRole !== displayRoleFor(member)) {
        await setMemberRole(orgId, memberId, desiredOrgRole)
      }
      bumpMembers(ms => ms.map(m => m.id === memberId ? { ...m, role: desiredOrgRole, orgRole: desiredOrgRole } : m))
      toast.success(desiredOrgRole === 'admin' ? `${memberName} is now an Admin` : `Updated ${memberName}'s role`, { id: toastId })
      refreshMembers()
      return true
    } catch (err) {
      bumpMembers(prev)
      toast.error(err instanceof Error ? err.message : 'Failed to update role', { id: toastId })
      return false
    }
  }

  const handleRemove = async (id: string) => {
    if (!orgId) return
    const prev = members
    const removed = prev.find(m => m.id === id)
    const memberLabel = removed?.name || removed?.email || 'member'
    bumpMembers(ms => ms.filter(m => m.id !== id))
    const toastId = toast.loading(`Removing ${memberLabel}…`)
    try {
      await removeMember(orgId, id)
      toast.success(`Removed ${memberLabel}`, { id: toastId })
    } catch (err) {
      bumpMembers(prev)
      toast.error(err instanceof Error ? err.message : 'Failed to remove member', { id: toastId })
    }
  }

  const handleRevokeInvite = async (id: string) => {
    if (!orgId) return
    const prev = members
    const invited = prev.find(m => m.id === id)
    const memberLabel = invited?.email || 'member'
    bumpMembers(ms => ms.filter(m => m.id !== id))
    const toastId = toast.loading(`Withdrawing invite to ${memberLabel}…`)
    try {
      // Pending invites live in the invite table, not the member table. Use
      // the invite-specific DELETE endpoint; fall back to removeMember only
      // if invite metadata is missing (e.g. optimistic row before BE refresh).
      if (invited?.inviteId) {
        await revokeInvite(orgId, invited.inviteId)
      } else {
        await removeMember(orgId, id)
      }
      toast.success(`Invite to ${memberLabel} revoked`, { id: toastId })
    } catch (err) {
      bumpMembers(prev)
      toast.error(err instanceof Error ? err.message : 'Failed to revoke invite', { id: toastId })
    }
  }

  // Returns per-email results rather than throwing, so InviteModal can drop
  // only the emails that actually succeeded and keep the rest (with why they
  // failed) visible as chips instead of silently clearing the whole batch —
  // see InviteModal's handleSubmit for the other half of this contract.
  const handleInvite = async (
    emails: string[],
    role: WorkspaceRole,
  ): Promise<InviteResult> => {
    if (!orgId) {
      return { succeeded: [], failed: emails.map(email => ({ email, reason: 'No organization selected' })) }
    }

    // Local checks first (no round trip needed): already-a-member and
    // domain-restriction. Only what passes both goes into the batched call.
    const failed: { email: string; reason: string }[] = []
    const toSend: string[] = []
    for (const raw of emails) {
      const email = raw.trim()
      const normalizedEmail = email.toLowerCase()
      const alreadyMember = members.some(m => m.email?.toLowerCase() === normalizedEmail)
      if (alreadyMember) {
        failed.push({ email, reason: 'Already a member of this workspace' })
        continue
      }
      if (allowedDomains.length > 0) {
        const domain = email.split('@')[1]?.toLowerCase() ?? ''
        if (!allowedDomains.includes(domain)) {
          failed.push({ email, reason: `Domain not allowed — restricted to ${allowedDomains.join(', ')}` })
          continue
        }
      }
      toSend.push(email)
    }

    if (toSend.length === 0) return { succeeded: [], failed }

    setInviteLoading(true)
    try {
      await inviteMembers(orgId, toSend, role)

      // Optimistic pending rows.
      bumpMembers(prev => [
        ...prev,
        ...toSend.map(email => ({
          id:              `invite_${Date.now()}_${email}`,
          name:            email.split('@')[0] ?? email,
          email,
          role,
          orgRole:         (role === 'admin' ? 'admin' : 'member') as OrgMember['orgRole'],
          inviteStatus:    'invite_sent' as const,
          teamMemberships: [],
          creditUsed:      0,
        })),
      ])
      toast.success(toSend.length === 1 ? 'Invite sent' : `${toSend.length} invites sent`)
      // Reconcile the optimistic (synthetic-id) rows with the real backend
      // invite records so their user_ids are available for revoking.
      refreshMembers()
      return { succeeded: toSend, failed }
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'Failed to send invite'
      toast.error(reason)
      return { succeeded: [], failed: [...failed, ...toSend.map(email => ({ email, reason }))] }
    } finally {
      setInviteLoading(false)
    }
  }

  if (membersLoading) {
    return (
      <div className="kaya-scrollbar" style={{ flex: '1 0 0', minHeight: 0, overflowY: 'auto', overflowX: 'hidden', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 64, paddingBottom: 48 }}>
        <MembersPageSkeleton />
      </div>
    )
  }

  return (
    <div
      className="kaya-scrollbar"
      style={{
        flex:           '1 0 0',
        minHeight:      0,
        overflowY:      'auto',
        overflowX:      'hidden',
        display:        'flex',
        alignItems:     'flex-start',
        justifyContent: 'center',
        paddingTop:     64,
        paddingBottom:  48,
      }}
    >
      {/* Horizontal padding lives here, not on the scrolling element above —
          keeps the scrollbar flush with the container's edge. */}
      <div style={{ width: '100%', maxWidth: 908, padding: '0 24px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* Page header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            {/* 24/32 matches the header treatment on every other v1.5 settings
                page (Account, Usage, General) and Figma node 18:24255. */}
            <h1 style={{ fontFamily: 'var(--font-title)', fontWeight: 400, fontSize: 24, lineHeight: '32px', color: 'var(--neutral-900)', margin: 0 }}>
              Members
            </h1>
            <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-500)', margin: '4px 0 0' }}>
              Manage who has access to your workspace and what they can do.
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<InformationCircleIcon size={16} />}
            onClick={() => setRolesInfoOpen(true)}
          >
            Roles &amp; Permissions
          </Button>
        </div>

        {/* Stats row */}
        <div style={{
          border:       '1px solid var(--border-default)',
          borderRadius: 16,
          boxShadow:    SHADOW_CARD,
          padding:      12,
          display:      'flex',
          gap:          9,
        }}>
          <div style={{ flex: '1 0 0', minWidth: 0, backgroundColor: 'var(--neutral-white)', borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column', gap: 6, boxShadow: SHADOW_STAT_CARD }}>
            <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 13, lineHeight: '20px', color: 'var(--neutral-500)', margin: 0 }}>Total members</p>
            <p style={{ fontFamily: 'var(--font-title)', fontWeight: 400, fontSize: 28, lineHeight: '36px', color: 'var(--neutral-900)', margin: 0 }}>{totalMembers}</p>
            <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 12, lineHeight: '16px', color: 'var(--neutral-400)', margin: 0 }}>unlimited seats</p>
          </div>
          <div style={{ flex: '1 0 0', minWidth: 0, backgroundColor: 'var(--neutral-white)', borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column', gap: 6, boxShadow: SHADOW_STAT_CARD }}>
            <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 13, lineHeight: '20px', color: 'var(--neutral-500)', margin: 0 }}>Admins</p>
            <p style={{ fontFamily: 'var(--font-title)', fontWeight: 400, fontSize: 28, lineHeight: '36px', color: 'var(--neutral-900)', margin: 0 }}>{adminCount}</p>
            <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 12, lineHeight: '16px', color: 'var(--neutral-400)', margin: 0 }}>workspace admins</p>
          </div>
          <div style={{ flex: '1 0 0', minWidth: 0, backgroundColor: 'var(--neutral-white)', borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column', gap: 6, boxShadow: SHADOW_STAT_CARD }}>
            <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 13, lineHeight: '20px', color: 'var(--neutral-500)', margin: 0 }}>Pending invites</p>
            <p style={{ fontFamily: 'var(--font-title)', fontWeight: 400, fontSize: 28, lineHeight: '36px', color: 'var(--neutral-900)', margin: 0 }}>{pendingInvites}</p>
            <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 12, lineHeight: '16px', color: 'var(--neutral-400)', margin: 0 }}>awaiting acceptance</p>
          </div>
        </div>

        {/* Members table */}
        <MembersTable
          members={displayMembers}
          isAdmin={isAdmin}
          currentUserEmail={user?.email}
          loading={membersLoading}
          onManageRole={(id, desiredOrgRole) => handleManageRole(id, desiredOrgRole)}
          onRemove={handleRemove}
          onRevokeInvite={handleRevokeInvite}
          onInviteClick={() => setInviteOpen(true)}
        />

      </div>

      {/* Roles & Permissions info modal — opened from the info button next to the page title */}
      {rolesSeen && <RolesPermissionsModal open={rolesInfoOpen} onClose={() => setRolesInfoOpen(false)} />}

      {/* Invite modal */}
      {inviteSeen && <AppInviteModal
        isOpen={inviteOpen}
        onClose={() => setInviteOpen(false)}
        onInvite={handleInvite}
        workspaceName={org?.name ?? ''}
        loading={inviteLoading}
        existingEmails={members.map(m => m.email).filter(Boolean)}
        allowedDomains={allowedDomains}
      />}
    </div>
  )
}
