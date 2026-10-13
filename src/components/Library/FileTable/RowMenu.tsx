'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAskAbout } from '../useAskAbout'
import { ArrowUpRightOneIcon, BubbleChatIcon, DeleteTwoIcon, DownloadOneIcon, MoreHorizontalIcon, PenOneIcon, ShareOneIcon } from '@strange-huge/icons'
import { Dropdown } from '@/components/Dropdown'
import { Tooltip } from '@/components/Tooltip'
import { IconButton } from '@/components/ui/button'
import { ONLY_OWNER_TIP, capsOf } from '@/lib/library/access'
import { displayFileName } from '@/lib/library/format'
import { MESSAGES } from '@/lib/library/messages'
import { rememberLibraryReturn, watchLibraryFileLinks } from '@/lib/library/return-to'
import type { LibraryFileRow } from '@/lib/library/schemas'
import { LIBRARY_FILE_ROUTE } from '@/lib/routes'
import styles from './FileTable.module.css'

export type RowAction = 'share' | 'rename' | 'download' | 'delete'

export interface RowMenuProps {
  /** A list row, or the file page's detail (which also says whether the file is ready). */
  file: LibraryFileRow & { phase?: 'uploading' | 'processing' | 'ready' }
  onAction: (action: RowAction, file: LibraryFileRow) => void
  /** False when an Admin switched sharing off for the workspace. */
  sharingEnabled?: boolean
  /** Always visible (the file page header), instead of appearing on row hover. */
  alwaysVisible?: boolean
  /** Adds "Open" at the top. Off on the file page, where the file is already open. */
  withOpen?: boolean
  /** Class for the trigger button, for the card and tile "more" buttons that show on hover. */
  triggerClassName?: string
  /** Which edge of the button the menu lines up with. Default: its right edge. */
  placement?: "bottom-start" | "bottom-end"
  /** Minimum menu width in px. */
  menuWidth?: number
  /** A custom trigger (the file page's title pill) in place of the "..." button. */
  trigger?: React.ReactElement
}

/** A menu row that is turned off says why in a tooltip, like the prototype. */
function WithReason({ reason, children }: { reason?: string; children: React.ReactElement }) {
  if (!reason) return children
  return <Tooltip content={reason} side="left">{children}</Tooltip>
}

/**
 * The "..." menu for a file, on table rows, Suggested cards and the file page, in the prototype's order:
 * Open, Ask about this, Share, Download | Rename | Delete. Controls a person may not use stay visible but
 * disabled, with the reason in a tooltip (never hidden, never an unexplained grey row).
 */
export function RowMenu({ file, onAction, sharingEnabled = true, alwaysVisible = false, withOpen = true, triggerClassName, placement = "bottom-end", menuWidth, trigger: customTrigger }: RowMenuProps) {
  const router = useRouter()
  const ask = useAskAbout()
  const [open, setOpen] = useState(false)
  const caps = capsOf(file)
  const active = file.life === 'active'
  const canAsk = active && (file.phase ?? 'ready') === 'ready'
  const shareReason = !sharingEnabled ? MESSAGES.sharingOff : !caps.share ? ONLY_OWNER_TIP : undefined

  // On a list, remember it when a file is opened from it, so Close on the file page comes back here.
  useEffect(() => {
    if (withOpen) watchLibraryFileLinks()
  }, [withOpen])

  // The menu is portaled, so it would stay put while its row scrolls away: close it on any scroll.
  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    window.addEventListener('scroll', close, { capture: true, passive: true })
    return () => window.removeEventListener('scroll', close, { capture: true })
  }, [open])

  const choose = (action: RowAction, allowed = true) => {
    if (!allowed) return
    setOpen(false)
    onAction(action, file)
  }
  return (
    <Dropdown.Float
      open={open}
      onOpenChange={setOpen}
      placement={placement}
      autoFlipVertical
      trigger={customTrigger ?? (
        <IconButton
          className={triggerClassName ?? (alwaysVisible ? undefined : styles.menu)}
          data-open={open || undefined}
          variant="ghost"
          size="sm"
          aria-label={`More actions for ${displayFileName(file)}`}
          aria-haspopup="menu"
          aria-expanded={open}
          icon={<MoreHorizontalIcon size={18} />}
        />
      )}
    >
      <Dropdown maxHeight={false} style={{ minWidth: menuWidth ?? 176 }}>
        <Dropdown.Section fluid>
          {withOpen && (
            <Dropdown.Item
              label="Open"
              icon={<ArrowUpRightOneIcon />}
              fluid
              onClick={() => {
                setOpen(false)
                rememberLibraryReturn(`${window.location.pathname}${window.location.search}`)
                router.push(LIBRARY_FILE_ROUTE(file.id))
              }}
            />
          )}
          <Dropdown.Item
            label="Ask about this"
            icon={<BubbleChatIcon />}
            fluid
            disabled={!canAsk}
            onClick={() => {
              if (!canAsk) return
              setOpen(false)
              void ask(file)
            }}
          />
          {active && (
            <WithReason reason={shareReason}>
              <Dropdown.Item label="Share" icon={<ShareOneIcon />} fluid disabled={Boolean(shareReason)} onClick={() => choose('share', !shareReason)} />
            </WithReason>
          )}
          <Dropdown.Item label="Download" icon={<DownloadOneIcon />} fluid onClick={() => choose('download')} />
        </Dropdown.Section>
        <Dropdown.Section fluid divider>
          <WithReason reason={caps.rename || !active ? undefined : ONLY_OWNER_TIP}>
            <Dropdown.Item label="Rename" icon={<PenOneIcon />} fluid disabled={!caps.rename} onClick={() => choose('rename', caps.rename)} />
          </WithReason>
        </Dropdown.Section>
        <Dropdown.Section fluid divider>
          <WithReason reason={caps.delete || !active ? undefined : ONLY_OWNER_TIP}>
            <Dropdown.Item label="Delete" icon={<DeleteTwoIcon />} variant="danger" fluid disabled={!caps.delete} onClick={() => choose('delete', caps.delete)} />
          </WithReason>
        </Dropdown.Section>
      </Dropdown>
    </Dropdown.Float>
  )
}
