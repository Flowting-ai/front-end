'use client'

// Connectors v1.5 — full UI replacement. See
// docs v1.5/connectors-v1.5-migration-plan.md. The old split between a
// personal connectors page (/settings/connectors, removed) and an org-admin
// connectors page no longer exists (§0/§2 of the plan doc) — this is the one
// unified experience for every account type.

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { ConnectorsExperience } from '@/components/connectors/ConnectorsExperience'

function ConnectorsPageContent() {
  const searchParams = useSearchParams()
  return <ConnectorsExperience initialSearch={searchParams.get('q') ?? ''} />
}

export default function ConnectorsPage() {
  return (
    <Suspense fallback={null}>
      <ConnectorsPageContent />
    </Suspense>
  )
}
