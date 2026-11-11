'use client'

import React from 'react'
import { BubbleChatIcon, CalendarFoldIcon, UserIcon } from '@strange-huge/icons'
import { Button } from '@/components/ui/button'
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/Skeleton'
import { personName } from '@/lib/library/access'
import { sanitizeDisplayText } from '@/lib/library/format'
import { FILE_MESSAGES } from '@/lib/library/messages'
import { useTrashFile } from '@/lib/library/mutations'
import { useFileUsage } from '@/lib/library/queries'
import type { LibraryFile } from '@/lib/library/file'
import { useLibraryViewer } from '@/lib/library/viewer'

const TRASH_DAYS = 30

const rowStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 10, minHeight: 40, fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: '22px', color: 'var(--neutral-900)',
}
const detailStyle: React.CSSProperties = { minWidth: 0, maxWidth: '60%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12, color: 'var(--neutral-600)' }

function joinNames(names: string[]): string {
  if (names.length <= 1) return names.join('')
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

function UsageRow({ icon, label, detail }: { icon: React.ReactNode; label: string; detail: string }) {
  return (
    <div style={rowStyle}>
      <span style={{ display: 'inline-flex', color: 'var(--neutral-600)' }}>{icon}</span>
      <span style={{ flex: 1, minWidth: 0 }}>{label}</span>
      <small title={detail} style={detailStyle}>{detail}</small>
    </div>
  )
}

/**
 * Delete moves a file to Trash. Like the prototype: the title asks the question, three rows say where the
 * file is used and who it is shared with, one quiet line gives the recovery window.
 */
export function DeleteFileDialog({ file, onClose, onDeleted }: { file: LibraryFile; onClose: () => void; onDeleted?: () => void }) {
  const { viewerId } = useLibraryViewer()
  const usage = useFileUsage(file.id)
  const trash = useTrashFile()
  const name = file.name

  const confirm = () => {
    trash.mutate(
      { id: file.id, title: name },
      {
        onSuccess: () => {
          onClose()
          onDeleted?.()
        },
      },
    )
  }

  const chatTitles = (usage.data?.chats ?? []).map((chat) => sanitizeDisplayText(chat.title) || 'Untitled chat')
  const routineTitles = (usage.data?.routines ?? []).map((routine) => sanitizeDisplayText(routine.title) || 'Untitled')
  const chatCount = chatTitles.length + (usage.data?.hiddenChats ?? 0)
  const routineCount = routineTitles.length + (usage.data?.hiddenRoutines ?? 0)
  const chatDetail = chatTitles.length > 2 ? `${chatTitles.slice(0, 2).join(', ')} +${chatCount - 2}` : chatTitles.join(', ') || (chatCount ? `+${chatCount}` : 'None')
  const routineDetail = routineTitles.join(', ') || (routineCount ? `+${routineCount}` : 'None')
  const shares = [
    ...(file.accessSummary.everyone ? ['the whole workspace'] : []),
    ...file.accessSummary.people.filter((person) => person.id !== file.owner.id).map((person) => personName(person, viewerId)),
  ]

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !trash.isPending) onClose() }}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Move {name} to Trash?</DialogTitle>
        </DialogHeader>
        <DialogBody style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {usage.isPending ? (
            <div aria-busy="true" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Skeleton height={20} />
              <Skeleton height={20} />
            </div>
          ) : (
            <div>
              {usage.data ? (
                <>
                  <UsageRow icon={<BubbleChatIcon size={16} />} label={chatCount === 1 ? '1 chat' : `${chatCount} chats`} detail={chatDetail} />
                  <UsageRow icon={<CalendarFoldIcon size={16} />} label={routineCount === 1 ? '1 routine' : `${routineCount} routines`} detail={routineDetail} />
                </>
              ) : (
                // Usage could not be loaded: deleting is still safe (it is recoverable), so do not block it.
                <p style={{ ...rowStyle, margin: 0, color: 'var(--neutral-500)' }}>Couldn&apos;t check where this file is used.</p>
              )}
              <UsageRow icon={<UserIcon size={16} />} label="Shared with" detail={shares.length ? joinNames(shares) : 'No one'} />
            </div>
          )}
          <DialogDescription style={{ margin: 0, fontFamily: 'var(--font-body)', fontSize: 12, lineHeight: '16px', color: 'var(--neutral-500)' }}>
            {FILE_MESSAGES.trashQuiet(TRASH_DAYS)}
          </DialogDescription>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="secondary" disabled={trash.isPending} onClick={onClose}>Cancel</Button>
          <Button type="button" variant="danger" loading={trash.isPending} onClick={confirm}>Move to Trash</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
