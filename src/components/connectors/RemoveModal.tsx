'use client'

// Remove confirmation — S15 / S16. Ported from the story's Remove modal.
// The story's "Used by 3 agents · 2 automations" copy is intentionally NOT
// reproduced: nothing reports what depends on an account (Gap #3 in
// docs-v1.5/connectors-v1.5-migration-plan.md), and inventing counts would be
// worse than saying nothing. A shared account is warned about instead, since
// removing it takes it away from everyone.

import React from 'react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { ConnectorGlyph } from '@/components/ConnectorGlyph'
import { Button } from '@/components/ui/button'
import { ConnectorCatalog, ConnectorConnection } from '@/lib/api/connectors'

const heading = 'm-0 font-[family-name:var(--font-title)] text-[22px] font-normal leading-[1.2] text-[var(--neutral-900)]'
const muted = 'm-0 font-[family-name:var(--font-body)] text-[length:var(--font-size-body)] leading-[var(--line-height-body)] text-[var(--color-text-muted)]'
const panel = 'rounded-xl bg-[var(--neutral-white)] shadow-[0_0_0_1px_var(--neutral-100)]'

export function RemoveModal({
  account, catalog, blockedReason, busy, cancel, confirm,
}: {
  account: ConnectorConnection
  catalog: ConnectorCatalog
  /** Set when the viewer isn't the owner — disables Remove and explains why. */
  blockedReason?: string
  busy: boolean
  cancel: () => void
  confirm: () => void
}) {
  // Radix keeps Tab inside and returns focus; Esc and outside clicks cancel unless the removal is in flight.
  return (
    <Dialog open onOpenChange={open => { if (!open && !busy) cancel() }}>
      <DialogContent
        hideClose
        role="alertdialog"
        aria-describedby={undefined}
        aria-busy={busy}
        onEscapeKeyDown={event => { if (busy) event.preventDefault() }}
        onInteractOutside={event => { if (busy) event.preventDefault() }}
        className="p-6"
        style={{ width: 480, boxShadow: '0 24px 72px rgba(30,28,27,.28)', borderRadius: 12 }}
      >
        <div className="mb-4 grid size-11 place-items-center rounded-[11px] bg-[var(--neutral-white)] shadow-[0_0_0_1px_var(--neutral-100)]">
          <ConnectorGlyph slug={catalog.slug} name={catalog.name} logoUrl={catalog.logoUrl} size={30} />
        </div>
        <DialogTitle className="sr-only">{`Remove ${account.nickname} (${account.email})?`}</DialogTitle>
        <h2 className={heading} aria-hidden="true">Remove account?</h2>
        <p className={`${muted} mt-1.5`}>
          <strong className="font-medium text-[var(--neutral-800)]">{account.nickname}</strong>
          {account.email ? ` · ${account.email}` : ''}
        </p>
        {account.shared && (
          <div className={`${panel} mt-4 p-3`}>
            <strong className="font-medium">This account is shared</strong>
            <p className={`${muted} mt-1`}>Everyone in your workspace loses it, along with any agents or automations running on it. We can&apos;t show exactly which ones yet.</p>
          </div>
        )}
        {blockedReason && (
          <div className={`${panel} mt-4 bg-[var(--yellow-50)] p-3`}>
            <p className={muted}>{blockedReason}</p>
          </div>
        )}
        <p className={`${muted} mt-3`}>Other {catalog.name} accounts stay connected.</p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={cancel} disabled={busy}>Keep account</Button>
          <Button variant="danger" size="sm" onClick={confirm} loading={busy} disabled={Boolean(blockedReason)}>Remove</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
