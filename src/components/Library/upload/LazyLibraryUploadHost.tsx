'use client'

import dynamic from 'next/dynamic'
import { LIBRARY_ENABLED } from '@/lib/feature-flags'

// The upload system loads only when Library is switched on, and only after the app shell has painted,
// so it adds nothing to the shared bundle of a build that has the feature off.
const LibraryUploadHost = dynamic(() => import('./LibraryUploadHost').then((module) => module.LibraryUploadHost), { ssr: false, loading: () => null })

export function LazyLibraryUploadHost() {
  return LIBRARY_ENABLED ? <LibraryUploadHost /> : null
}
