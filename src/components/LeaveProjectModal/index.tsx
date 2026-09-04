'use client'

import React, { useEffect, useState } from 'react'
import { ArrowDownOneIcon, TickTwoIcon } from '@strange-huge/icons'
import { Button } from '@/components/Button'
import { Dropdown } from '@/components/Dropdown'
import { Spinner } from '@/components/Spinner'
import { toast } from 'sonner'
import { fetchProjectMembers, leaveProjectApi, type ApiProjectMember } from '@/lib/api/projects'

// Same hand-rolled overlay shape as ConfirmModal/LeaveWorkspaceModal. Needs
// its own component: the owner's exit branches into a successor picker OR an
// archive/convert-to-personal choice depending on whether anyone else is
// still on the project — neither existing modal has a slot for that.
const SHADOW_MODAL = '0px 19px 32px 0px rgba(18,12,8,0.15), 0px 2px 2.8px 0px rgba(130,122,116,0.1)'

type AloneAction = 'archive' | 'convertPersonal'

export interface LeaveProjectModalProps {
  projectId:     string
  isOwner:       boolean
  currentUserId: string
  onClose:       () => void
  /** Called after a successful leave — refresh the caller's project list/state. */
  onLeft:        () => void
}

export function LeaveProjectModal({ projectId, isOwner, currentUserId, onClose, onLeft }: LeaveProjectModalProps) {
  const [loadingMembers, setLoadingMembers] = useState(isOwner)
  const [others,         setOthers]         = useState<ApiProjectMember[]>([])
  // Distinct from "loaded, zero others" — a failed fetch must never be read
  // as "you're alone", or the owner could archive/convert a project that
  // actually still has other collaborators on it, based on a network error
  // rather than the real membership.
  const [membersLoadFailed, setMembersLoadFailed] = useState(false)
  const [loadAttempt,    setLoadAttempt]    = useState(0)
  const [submitting,     setSubmitting]     = useState(false)
  const [successorMenuOpen, setSuccessorMenuOpen] = useState(false)
  const [successorId,       setSuccessorId]       = useState<string | null>(null)
  const [aloneAction,       setAloneAction]       = useState<AloneAction | null>(null)

  useEffect(() => {
    if (!isOwner) return
    let cancelled = false
    setLoadingMembers(true)
    setMembersLoadFailed(false)
    fetchProjectMembers(projectId)
      .then(members => {
        if (cancelled) return
        setOthers(members.filter(m => m.userId !== currentUserId))
      })
      .catch(() => {
        if (cancelled) return
        setMembersLoadFailed(true)
        toast.error("Couldn't load project members")
      })
      .finally(() => { if (!cancelled) setLoadingMembers(false) })
    return () => { cancelled = true }
  }, [isOwner, projectId, currentUserId, loadAttempt])

  const hasOthers = others.length > 0
  const selectedSuccessor = others.find(m => m.userId === successorId) ?? null
  const canConfirm = !isOwner || (!membersLoadFailed && (hasOthers ? !!successorId : !!aloneAction))

  const handleLeave = async () => {
    if (!canConfirm) return
    setSubmitting(true)
    try {
      if (!isOwner) {
        await leaveProjectApi(projectId, {})
      } else if (hasOthers) {
        await leaveProjectApi(projectId, { successorUserId: successorId! })
      } else {
        await leaveProjectApi(projectId, { aloneAction: aloneAction! })
      }
      toast.success(isOwner ? 'Ownership handled — you left the project.' : 'You left the project.')
      onLeft()
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to leave project')
      setSubmitting(false)
    }
  }

  const description = !isOwner
    ? "You'll lose access to this project."
    : loadingMembers
      ? 'Checking who else is on this project…'
      : membersLoadFailed
        ? "Couldn't check who else is on this project."
        : hasOthers
          ? 'Pick who takes over as owner before you leave.'
          : "You're the only one on this project — archive it or convert it to a personal project first."

  return (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events
    <div
      onClick={() => { if (!submitting) onClose() }}
      style={{
        position: 'fixed', inset: 0, zIndex: 9998, background: 'rgba(0,0,0,0.28)',
        backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
    >
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--neutral-white, #fff)', borderRadius: 16, padding: 24, width: 420, maxWidth: 'calc(100vw - 32px)',
          boxShadow: SHADOW_MODAL, display: 'flex', flexDirection: 'column', gap: 20,
        }}
      >
        <div>
          <p style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 16, lineHeight: '24px', color: 'var(--neutral-900)', margin: 0 }}>
            Leave project?
          </p>
          <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-500)', margin: '8px 0 0' }}>
            {description}
          </p>
        </div>

        {isOwner && loadingMembers && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 12 }}>
            <Spinner size={20} />
          </div>
        )}

        {isOwner && !loadingMembers && membersLoadFailed && (
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <Button variant="secondary" size="sm" onClick={() => setLoadAttempt(a => a + 1)}>
              Try again
            </Button>
          </div>
        )}

        {isOwner && !loadingMembers && !membersLoadFailed && hasOthers && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 13, lineHeight: '18px', color: 'var(--neutral-700)', margin: 0 }}>
              New owner
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
                  {selectedSuccessor ? (selectedSuccessor.name || selectedSuccessor.email) : 'Select a member'}
                  <ArrowDownOneIcon size={16} color="var(--neutral-400)" />
                </button>
              }
            >
              <Dropdown size="md">
                <Dropdown.Section fluid>
                  {others.map(m => (
                    <Dropdown.Item
                      key={m.userId}
                      label={m.name || m.email || m.userId}
                      subLabel={m.name ? (m.email ?? undefined) : undefined}
                      selected={m.userId === successorId}
                      rightIcon={m.userId === successorId ? <TickTwoIcon size={16} /> : undefined}
                      onClick={() => { setSuccessorId(m.userId); setSuccessorMenuOpen(false) }}
                      fluid
                    />
                  ))}
                </Dropdown.Section>
              </Dropdown>
            </Dropdown.Float>
          </div>
        )}

        {isOwner && !loadingMembers && !membersLoadFailed && !hasOthers && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {([
              { value: 'archive' as const, label: 'Archive project', desc: 'Keep it, but make it read-only.' },
              { value: 'convertPersonal' as const, label: 'Convert to personal project', desc: 'Keep working in it, just for you.' },
            ]).map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setAloneAction(opt.value)}
                style={{
                  display: 'flex', flexDirection: 'column', gap: 2, textAlign: 'left',
                  padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
                  border: aloneAction === opt.value ? '1.5px solid var(--neutral-900)' : '1px solid var(--neutral-200)',
                  backgroundColor: aloneAction === opt.value ? 'var(--neutral-50)' : 'var(--neutral-white)',
                }}
              >
                <span style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, color: 'var(--neutral-900)' }}>{opt.label}</span>
                <span style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 12, color: 'var(--neutral-500)' }}>{opt.desc}</span>
              </button>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button variant="secondary" disabled={submitting} onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="danger"
            loading={submitting}
            disabled={!canConfirm || loadingMembers}
            onClick={() => { void handleLeave() }}
          >
            Leave project
          </Button>
        </div>
      </div>
    </div>
  )
}

export default LeaveProjectModal
