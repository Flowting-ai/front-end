'use client'

import { Suspense, useEffect } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { toConnector } from '@/lib/connector'

/**
 * Native MCP connector OAuth callbacks redirect back into the app with
 * `?connector=<slug>&link=<connected|error|cancelled>` (see
 * back-end/services/connectors/router.py's oauth_callback). The root page
 * forwards that query string through its redirect instead of dropping it;
 * this reads it once on mount, shows the result as a toast, then strips the
 * params from the URL so a refresh doesn't re-fire the toast.
 */
function ConnectorAuthResultToastInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    const slug = searchParams.get('connector')
    const link = searchParams.get('link')
    if (!slug || !link) return

    const name = toConnector(slug).name
    if (link === 'connected') {
      toast.success(`${name} connected`)
    } else if (link === 'cancelled') {
      toast.info(`${name} connection cancelled`)
    } else {
      toast.error(`Failed to connect ${name}`)
    }

    const next = new URLSearchParams(searchParams.toString())
    next.delete('connector')
    next.delete('link')
    const qs = next.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname)
    // Only ever meant to run once for the params present on initial load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}

export function ConnectorAuthResultToast() {
  return (
    <Suspense fallback={null}>
      <ConnectorAuthResultToastInner />
    </Suspense>
  )
}

export default ConnectorAuthResultToast
