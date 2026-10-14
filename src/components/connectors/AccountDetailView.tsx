'use client'

// Account detail — S20/S21/S22 in one dialog over the connector page: the
// name renames in place, the rail holds sharing and removal, and the
// permissions list fills the rest. See docs v1.5/connectors-v1.5-migration-plan.md
// §4 (edge cases to preserve).
//
// Everything here edits one account, and only its owner may. Permissions belong
// to the account rather than the connector, so two linked Gmails can be
// permissioned differently; sharing is a flag the owner flips.

//
// Parts: AccountPermissions.tsx (permissions tab), AccountRail.tsx (name,
// sharing, removal), account-styles.ts.

import React, { useEffect } from 'react'
import { m } from 'framer-motion'
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

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape' && !event.defaultPrevented) close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [close])

  return (
    <div className={styles.overlay} onClick={close}>
      <m.div
        role="dialog"
        aria-modal="true"
        aria-label={`${catalog.name} · ${account.nickname}`}
        className={styles.dialog}
        onClick={event => event.stopPropagation()}
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.16, ease: 'easeOut' }}
      >
        <header className={styles.header}>
          <ConnectorGlyph slug={catalog.slug} name={catalog.name} logoUrl={catalog.logoUrl} size={44} />
          <div style={{ flex: '1 1 auto', minWidth: 0 }}>
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
      </m.div>
    </div>
  )
}
