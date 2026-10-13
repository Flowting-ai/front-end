'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { personName } from '@/lib/library/access'
import { useLeaveWorkspace } from '@/lib/library/members'
import { useAnswerMyRemoval } from '@/lib/library/mutations'
import { useMyRemoval } from '@/lib/library/queries'
import { useLibraryViewer } from '@/lib/library/viewer'
import { CHAT_ROUTE } from '@/lib/routes'

const OPTIONS = [
  { value: 'yes', title: 'Yes, transfer', line: (admin: string) => `Workspace shares and ${admin}'s go to ${admin}. The rest go to the first person they were shared with.` },
  { value: 'no', title: 'No, delete them', line: () => 'Those files are deleted.' },
] as const

/**
 * The one question a leaving person answers, as in the prototype. Locked (no close, no Escape) when an
 * Admin is removing them; with Cancel when they chose to leave.
 */
function TransferQuestion({
  title,
  admin,
  pending,
  onConfirm,
  onCancel,
}: {
  title: string
  admin: string
  pending: boolean
  onConfirm: (transfer: boolean) => void
  /** Present only when the person may back out (leaving on their own). */
  onCancel?: () => void
}) {
  const [choice, setChoice] = useState<'yes' | 'no' | null>(null)
  const locked = !onCancel
  const block = (event: Event) => event.preventDefault()

  return (
    <Dialog open onOpenChange={(open) => { if (!open && onCancel && !pending) onCancel() }}>
      <DialogContent
        size="sm"
        hideClose={locked}
        onEscapeKeyDown={locked ? block : undefined}
        onPointerDownOutside={locked ? block : undefined}
        onInteractOutside={locked ? block : undefined}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <DialogBody style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ margin: 0, fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-900)' }}>Transfer your shared files to other members?</p>
          <div role="radiogroup" aria-label="Transfer shared files" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {OPTIONS.map((option) => (
              <label
                key={option.value}
                style={{
                  display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 12px', borderRadius: 12, cursor: 'pointer',
                  border: `1px solid ${choice === option.value ? 'var(--neutral-900)' : 'var(--border-default)'}`,
                }}
              >
                <input type="radio" name="transfer" value={option.value} checked={choice === option.value} onChange={() => setChoice(option.value)} style={{ marginTop: 4 }} />
                <span style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-900)' }}>{option.title}</span>
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, lineHeight: '16px', color: 'var(--neutral-500)' }}>{option.line(admin)}</span>
                </span>
              </label>
            ))}
          </div>
          <p style={{ margin: 0, fontFamily: 'var(--font-body)', fontSize: 12, lineHeight: '16px', color: 'var(--neutral-500)' }}>Files you never shared are deleted either way.</p>
        </DialogBody>
        <DialogFooter>
          {onCancel && <Button type="button" variant="secondary" disabled={pending} onClick={onCancel}>Cancel</Button>}
          <Button type="button" disabled={choice === null} loading={pending} onClick={() => choice && onConfirm(choice === 'yes')}>
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * The leaving member's one question. It cannot be dismissed: until it is answered nothing is deleted
 * or transferred and the removal does not finish. Files they never shared are deleted either way.
 */
export function MyRemovalPrompt() {
  const removal = useMyRemoval()
  const answer = useAnswerMyRemoval()
  const { viewerId } = useLibraryViewer()

  if (!removal.data?.pending) return null
  const admin = removal.data.requestedBy ? personName(removal.data.requestedBy, viewerId) : 'An Admin'

  return <TransferQuestion title={`${admin} is removing you`} admin={admin} pending={answer.isPending} onConfirm={(transfer) => answer.mutate({ transfer })} />
}

/** "Leave Souvenir?": the same question, started by the person, with Cancel. On success they leave the app. */
export function LeaveDialog({ admin, onClose }: { admin: string; onClose: () => void }) {
  const leave = useLeaveWorkspace()
  return (
    <TransferQuestion
      title="Leave Souvenir?"
      admin={admin}
      pending={leave.isPending}
      onCancel={onClose}
      onConfirm={(transfer) => leave.mutate({ transfer }, { onSuccess: () => window.location.assign(CHAT_ROUTE) })}
    />
  )
}
