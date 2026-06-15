'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function OrgIndexPage() {
  const { replace } = useRouter()
  useEffect(() => { replace('/org/general') }, [replace])
  return null
}
