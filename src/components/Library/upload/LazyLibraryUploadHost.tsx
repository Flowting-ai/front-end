'use client'

import dynamic from 'next/dynamic'

// The upload system loads only after the app shell has painted, so it adds nothing to the first paint.
const LibraryUploadHost = dynamic(() => import('./LibraryUploadHost').then((module) => module.LibraryUploadHost), { ssr: false, loading: () => null })

export function LazyLibraryUploadHost() {
  return <LibraryUploadHost />
}
