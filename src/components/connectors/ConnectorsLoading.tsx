'use client'

import { ConnectionsView } from './ConnectionsView'

const noop = () => {}

/** The connections list in its loading state: the route's loading.tsx and Suspense fallback. */
export function ConnectorsLoading() {
  return <ConnectionsView catalog={[]} loading select={noop} addCustomApi={noop} />
}
