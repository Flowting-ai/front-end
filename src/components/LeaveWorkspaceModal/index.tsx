'use client'

import React, { useMemo, useState } from 'react'
import { ArrowDownOneIcon, TickTwoIcon } from '@strange-huge/icons'
import { Button } from '@/components/ui/button'
import { Dropdown } from '@/components/Dropdown'
import { toast } from 'sonner'
import { useOrg } from '@/context/org-context'
import { useAuth } from '@/context/auth-context'
import { leaveOrganization } from '@/lib/api/organization'
import { CHAT_ROUTE } from '@/lib/routes'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'

// Same Radix dialog shell as ConfirmModal — this one needs its own
// component (not ConfirmModal) because the last-admin case adds a required
// successor picker step ConfirmModal has no slot for.
// The successor picker's menu portals to document.body — a click in it isn't a click outside the dialog.
const isInDropdown = (t: EventTarget | null) => t instanceof Element && !!t.closest('[data-kds-dropdown-panel]')

export interface LeaveWorkspaceModalProps {
  onClose: () => void
}

export function LeaveWorkspaceModal({ onClose }: LeaveWorkspaceModalProps) {
  const { orgId, members, membersLoading, currentUserRole } = useOrg()
  const { user } = useAuth()
  const [submitting, setSubmitting] = useState(false)
  const [successorMenuOpen, setSuccessorMenuOpen] = useState(false)
  const [successorId, setSuccessorId] = useState<string | null>(null)

  // Owner folds into admin for this count too — same fold used everywhere
  // else this session (organization.ts's foldOwnerRole, members/page.tsx's
  // displayRoleFor) — an org's creator counts as an admin for "last admin" purposes.
  const adminCount = members.filter(m => m.orgRole === 'admin' || m.orgRole === 'owner').length
  // Must also check the CALLER is actually an admin — a plain member leaving
  // an org that happens to have exactly one admin isn't a succession case at
  // all (adminCount alone doesn't say anything about the leaving member's own
  // role). Without this, a non-admin member could get stuck unable to leave.
  const isLastAdmin = currentUserRole === 'admin' && adminCount <= 1

  const candidates = useMemo(
    // 'invite_sent' members haven't actually joined yet — not a real
    // successor candidate (they have no account to promote).
    () => members.filter(m => m.id !== user?.auth0Id && m.orgRole !== 'service' && m.inviteStatus === 'signed_up'),
    [members, user?.auth0Id],
  )
  const selectedCandidate = candidates.find(m => m.id === successorId) ?? null

  const handleLeave = async () => {
    if (membersLoading) return // isLastAdmin isn't trustworthy yet
    if (isLastAdmin && !successorId) {
      toast.error('Pick a replacement admin first.')
      return
    }
    setSubmitting(true)
    try {
      await leaveOrganization(orgId ?? '', successorId ?? undefined)
      // Leaving invalidates the entire org-context tree — a full reload is
      // the safe way to guarantee nothing stale lingers anywhere in the app.
      window.location.href = CHAT_ROUTE
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to leave workspace')
      setSubmitting(false)
    }
  }

  return (
    <Dialog open onOpenChange={(next) => { if (!next && !submitting) onClose() }}>
      {/* Esc closes unless leaving is in flight or the successor menu is open (Esc closes that menu first). */}
      <DialogContent
        hideClose
        role="alertdialog"
        aria-modal="true"
        aria-busy={submitting}
        onEscapeKeyDown={(e) => { if (submitting || successorMenuOpen) e.preventDefault() }}
        onInteractOutside={(e) => { if (submitting || isInDropdown(e.target)) e.preventDefault() }}
        style={{ width: 420, padding: 24, gap: 20 }}
      >
        <div>
          <DialogTitle>Leave workspace?</DialogTitle>
          <DialogDescription style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-500)', margin: '8px 0 0' }}>
            {membersLoading
              ? 'Checking workspace admins…'
              : isLastAdmin
                ? "You're the only admin — pick someone to take over admin duties before you leave."
                : "You'll lose access to every project and chat in this workspace."}
          </DialogDescription>
        </div>

        {!membersLoading && isLastAdmin && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 13, lineHeight: '18px', color: 'var(--neutral-700)', margin: 0 }}>
              New admin
            </p>
            <Dropdown.Float
              open={successorMenuOpen}
              onOpenChange={setSuccessorMenuOpen}
              placement="bottom-start"
              trigger={
                <button
                  type="button"
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                    width: '100%', padding: '8px 10px', borderRadius: 10, border: 'none',
                    backgroundColor: 'var(--neutral-white)', boxShadow: '0px 0px 0px 1px rgba(59,54,50,0.3)',
                    cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, color: 'var(--neutral-900)',
                  }}
                >
                  {selectedCandidate ? (selectedCandidate.name || selectedCandidate.email) : 'Select a member'}
                  <ArrowDownOneIcon size={16} color="var(--neutral-400)" />
                </button>
              }
            >
              <Dropdown size="md">
                <Dropdown.Section fluid>
                  {candidates.length === 0
                    ? <Dropdown.Item label="No other members" fluid disabled />
                    : candidates.map(m => (
                        <Dropdown.Item
                          key={m.id}
                          label={m.name || m.email}
                          subLabel={m.name ? m.email : undefined}
                          selected={m.id === successorId}
                          rightIcon={m.id === successorId ? <TickTwoIcon size={16} /> : undefined}
                          onClick={() => { setSuccessorId(m.id); setSuccessorMenuOpen(false) }}
                          fluid
                        />
                      ))
                  }
                </Dropdown.Section>
              </Dropdown>
            </Dropdown.Float>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button variant="secondary" disabled={submitting} onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="danger"
            loading={submitting}
            disabled={membersLoading || (isLastAdmin && !successorId)}
            onClick={() => { void handleLeave() }}
          >
            Leave workspace
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default LeaveWorkspaceModal
