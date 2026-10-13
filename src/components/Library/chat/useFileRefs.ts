'use client'

// What a chat may show about each Library file it mentions. The contract has a cheap batch
// (`GET /library/files/names?ids=`, 04 section 5b) that does not exist yet, so until it does this
// reads each file through the same detail query the File page uses (shared cache). Locked and gone
// answers become `{state}` only, so a chip never learns a name it may not show.

import { useMemo } from 'react'
import { useQueries } from '@tanstack/react-query'
import { getLibraryApi } from '@/lib/library/api'
import { isGoneError, isLockedError, libraryRetry } from '@/lib/library/errors'
import { libraryKeys } from '@/lib/library/keys'
import type { LibraryFileDetail } from '@/lib/library/schemas'
import type { FileRef } from '@/lib/library/sources'
import { useLibraryViewer } from '@/lib/library/viewer'

export function refFromDetail(file: LibraryFileDetail): FileRef {
  if (file.life === 'trashed') return { id: file.id, state: 'deleted' }
  return {
    id: file.id,
    state: 'open',
    title: file.title,
    format: file.format,
    extension: file.extension,
    phase: file.phase,
    createdAt: file.createdAt,
    generated: file.source === 'generated',
  }
}

export function useFileRefs(ids: string[]): { refs: Record<string, FileRef>; loading: boolean } {
  const { orgKey, ready } = useLibraryViewer()
  const unique = useMemo(() => Array.from(new Set(ids)), [ids])
  const results = useQueries({
    queries: unique.map((id) => ({
      queryKey: libraryKeys.detail(orgKey, id),
      enabled: ready,
      queryFn: async ({ signal }: { signal: AbortSignal }) => (await getLibraryApi()).getFile(id, signal),
      staleTime: 30_000,
      retry: (count: number, error: unknown) => !isLockedError(error) && !isGoneError(error) && libraryRetry(count, error),
    })),
  })
  const refs: Record<string, FileRef> = {}
  let loading = false
  results.forEach((result, index) => {
    const id = unique[index]
    if (result.data) refs[id] = refFromDetail(result.data)
    else if (isLockedError(result.error)) refs[id] = { id, state: 'locked' }
    else if (result.error) refs[id] = { id, state: 'deleted' }
    else loading = true
  })
  return { refs, loading }
}
