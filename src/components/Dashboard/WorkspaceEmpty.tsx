import styles from './Dashboard.module.css'

/** Shown while the organization has no store workspace: the warehouse is created from a chat, not from here. */
export function WorkspaceEmpty() {
  return (
    <section className={styles.empty}>
      <h1 className={styles.title}>Dashboard</h1>
      <p className={styles.emptyText}>
        No store workspace yet. Ask Souvenir to set up your store&apos;s data warehouse, and its metrics and tables show up here.
      </p>
    </section>
  )
}
