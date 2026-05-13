'use client'

import { Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

function RedirectContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const qs = searchParams.toString()
    router.replace(`/persona/configure/instructions${qs ? `?${qs}` : ''}`)
  }, [router, searchParams])

  return null
}

export default function PersonasConfigurePage() {
  return (
    <Suspense>
      <RedirectContent />
    </Suspense>
  )
}
