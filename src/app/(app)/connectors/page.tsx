'use client'

// Connectors v1.5 — full UI replacement. See
// docs v1.5/connectors-v1.5-migration-plan.md. This route and
// /settings/connectors both mount the same unified experience: the old
// split between a personal connectors page and an org-admin connectors page
// no longer exists (§0/§2 of the plan doc).

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
