import type { Workspace } from '@/lib/api/warehouse'
import styles from './Dashboard.module.css'

export interface DashboardHeaderProps {
  workspace: Workspace
}

function syncedLabel(lastSyncedAt: string | null): string {
  if (!lastSyncedAt) return 'not synced yet'
  const minutes = Math.round((Date.now() - new Date(lastSyncedAt).getTime()) / 60_000)
  if (minutes < 1) return 'synced just now'
  if (minutes < 60) return `synced ${minutes} min ago`
  const hours = Math.round(minutes / 60)
  return hours < 48 ? `synced ${hours} h ago` : `synced ${Math.round(hours / 24)} d ago`
}

/** The store's name and one pill per data category with its sync state. */
export function DashboardHeader({ workspace }: DashboardHeaderProps) {
  return (
    <header className={styles.header}>
      <h1 className={styles.title}>{workspace.name}</h1>
      <ul className={styles.categories} aria-label="Data categories">
        {workspace.categories.map(category => (
          <li key={category.category} className={styles.pill} data-status={category.status}>
            <span className={styles.statusDot} aria-hidden />
            <span className={styles.pillName}>{category.category.replace(/_/g, ' ')}</span>
            <span className={styles.pillMeta}>{category.status === 'failed' ? 'failed' : syncedLabel(category.lastSyncedAt)}</span>
          </li>
        ))}
      </ul>
    </header>
  )
}
