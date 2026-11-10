'use client'

// Account detail — S20/S21/S22 in one dialog over the connector page: the
// name renames in place, the rail holds sharing and removal, and the
// permissions list fills the rest. See docs-v1.5/connectors-v1.5-migration-plan.md
// §4 (edge cases to preserve).
//
// Everything here edits one account, and only its owner may. Permissions belong
// to the account rather than the connector, so two linked Gmails can be
// permissioned differently; sharing is a flag the owner flips.

//
// Parts: AccountPermissions.tsx (permissions tab), AccountRail.tsx (name,
// sharing, removal), account-styles.ts.

import React from 'react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { useOrg } from '@/context/org-context'
import { connectionAddedBy } from '@/lib/connector-owner'
import { CancelOneIcon } from '@strange-huge/icons'
import { ConnectorGlyph } from '@/components/ConnectorGlyph'
import { IconButton } from '@/components/ui/button'
import { ConnectorCatalog, ConnectorConnection } from '@/lib/api/connectors'
import styles from './AccountDetailView.module.css'
import { secondary } from './account-styles'
import { AccountName, AccountRail } from './AccountRail'
import { PermissionsTab } from './AccountPermissions'

export { PermissionsTab } from './AccountPermissions'

export function AccountDetailView({
  account, catalog, close, onChanged, onRemove,
}: {
  account: ConnectorConnection
  catalog: ConnectorCatalog
  close: () => void
  onChanged: () => void
  onRemove: () => void
}) {
  const { members } = useOrg()
  const addedBy = connectionAddedBy(account, members)

  return (
    // Radix handles Esc, outside click, focus trap and focus return (nested menus close first).
    <Dialog open onOpenChange={open => { if (!open) close() }}>
      <DialogContent
        hideClose
        aria-describedby={undefined}
        className={styles.dialog}
        style={{ width: 'min(85vw, 1280px)', height: '85vh', maxHeight: '85vh', boxShadow: '0 24px 72px rgba(30, 28, 27, 0.28), 0 0 0 1px var(--neutral-100)' }}
      >
        <DialogTitle className="sr-only">{`${catalog.name} · ${account.nickname}`}</DialogTitle>
        <header className={styles.header}>
          <ConnectorGlyph slug={catalog.slug} name={catalog.name} logoUrl={catalog.logoUrl} size={44} />
          <div className="min-w-0 flex-auto">
            <AccountName account={account} onChanged={onChanged} />
            <p style={secondary}>
              {[catalog.name, account.email, `Added by ${addedBy}`, account.owned ? null : 'shared with you'].filter(Boolean).join(' · ')}
            </p>
          </div>
          <IconButton variant="outline" size="sm" aria-label="Close" icon={<CancelOneIcon size={16} />} onClick={close} />
        </header>
        {!account.canManage && (
          <p className={styles.readOnlyNotice}>You can use this shared account. Only the person who added it can edit its settings.</p>
        )}
        <div className={styles.body}>
          <div className={styles.column}>
            <AccountRail account={account} catalog={catalog} onChanged={onChanged} onRemove={onRemove} />
          </div>
          <div className={`${styles.column} ${styles.main}`}>
            <PermissionsTab account={account} catalog={catalog} onChanged={onChanged} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
