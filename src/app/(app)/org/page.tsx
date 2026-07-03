'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ORG_GENERAL_ROUTE } from '@/lib/routes'

export default function OrgIndexPage() {
  const { replace } = useRouter()
  useEffect(() => { replace(ORG_GENERAL_ROUTE) }, [replace])
  return null
}
