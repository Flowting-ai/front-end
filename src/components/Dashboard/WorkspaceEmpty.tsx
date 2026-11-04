import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { ORG_CONNECTORS_ROUTE } from '@/lib/routes'
import styles from './Dashboard.module.css'

/** Shown while the organization has no store workspace: linking a store connector builds one on its own. */
export function WorkspaceEmpty() {
  return (
    <section className={styles.empty}>
      <h1 className={styles.title}>Dashboard</h1>
      <p className={styles.emptyText}>
        Connect your store and the dashboard builds itself: orders, products and refunds sync in, and the metrics show up here.
      </p>
      <Link href={ORG_CONNECTORS_ROUTE} className={styles.action}>
        Connect Shopify
        <ArrowRight size={16} strokeWidth={1.75} aria-hidden />
      </Link>
    </section>
  )
}

/** Shown between the first link and the first finished sync. */
export function WorkspaceBuilding() {
  return (
    <section className={styles.empty} aria-live="polite">
      <p className={styles.emptyText}>
        Your store is syncing for the first time. This takes a few minutes; the dashboard fills in on its own when it lands.
      </p>
    </section>
  )
}
