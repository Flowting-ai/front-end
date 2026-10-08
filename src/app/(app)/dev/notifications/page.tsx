import { notFound } from 'next/navigation'
import { NotificationsPlayground } from './NotificationsPlayground'

// Dev-only: the sidebar notification bell's test harness (see
// NotificationsPlayground). Lives inside (app) on purpose — it needs the real
// sidebar, auth and NotificationsProvider. 404s in production builds.
export default function DevNotificationsPage() {
  if (process.env.NODE_ENV === 'production') notFound()
  return <NotificationsPlayground />
}
