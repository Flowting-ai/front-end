'use client'

import { Suspense } from 'react'
import { AiModelsLoading, AiModelsView } from '@/components/AiModelsView'

// The view reads ?tab= and ?q= (useSearchParams), which needs a Suspense boundary.
export default function AiModelsPage() {
  return (
    <Suspense fallback={<AiModelsLoading />}>
      <AiModelsView />
    </Suspense>
  )
}
