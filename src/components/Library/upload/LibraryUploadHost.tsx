'use client'

import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/context/auth-context'
import { trackLibrary } from '@/lib/library/analytics'
import { LIBRARY_FILES_CHANGED_EVENT } from '@/lib/library/files-changed'
import { libraryKeys } from '@/lib/library/keys'
import { durationBucket } from '@/lib/library/observability'
import { getUploadController } from '@/lib/library/upload/controller'
import type { UploadStatusKind } from '@/lib/library/upload/machine'
import { uploadStore } from '@/lib/library/upload/store'
import { useLibraryViewer } from '@/lib/library/viewer'

/**
 * Renders nothing. It owns the upload system's life: pauses when the browser goes offline and resumes
 * when it is back, checks processing again when the tab becomes visible, stops everything on sign-out
 * or a workspace switch (an upload must never continue under another workspace), and reports upload
 * outcomes to analytics (format-free, enums and buckets only). Mounted once in the app layout.
 */
export function LibraryUploadHost() {
  const { orgKey } = useLibraryViewer()
  const { isAuthenticated } = useAuth()
  const queryClient = useQueryClient()

  // A chat turn that carried files saves them to Library on the server. Every Library query (lists,
  // Suggested, storage, the picker) is stale from then on, so mark them all and refetch the ones on screen.
  useEffect(() => {
    const refresh = () => { void queryClient.invalidateQueries({ queryKey: libraryKeys.all(orgKey) }) }
    window.addEventListener(LIBRARY_FILES_CHANGED_EVENT, refresh)
    return () => window.removeEventListener(LIBRARY_FILES_CHANGED_EVENT, refresh)
  }, [queryClient, orgKey])

  // Browser state: online/offline and tab visibility.
  useEffect(() => {
    const controller = getUploadController()
    const onOffline = () => controller.pauseAll()
    const onOnline = () => controller.resumeAll()
    const onVisible = () => { if (!document.hidden) controller.pollNow() }
    window.addEventListener('offline', onOffline)
    window.addEventListener('online', onOnline)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener('offline', onOffline)
      window.removeEventListener('online', onOnline)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  // Everything in flight belongs to one person in one workspace: leaving either ends it.
  useEffect(() => {
    return () => getUploadController().abortAll()
  }, [orgKey])
  useEffect(() => {
    if (!isAuthenticated) getUploadController().abortAll()
    const onExpired = () => getUploadController().abortAll()
    window.addEventListener('auth:session-expired', onExpired)
    return () => window.removeEventListener('auth:session-expired', onExpired)
  }, [isAuthenticated])

  // Outcomes: one event per upload when it reaches ready or failed.
  const seen = useRef(new Map<string, UploadStatusKind>())
  useEffect(() => {
    return uploadStore.subscribe(() => {
      for (const item of uploadStore.all()) {
        const before = seen.current.get(item.id)
        if (before === item.status) continue
        seen.current.set(item.id, item.status)
        if (item.status === 'ready') trackLibrary('upload_completed', { durationBucket: durationBucket(Date.now() - item.startedAt) })
        if (item.status === 'failed') trackLibrary('upload_failed', { reason: item.failure })
      }
      // Forget attachments that left the store so the map does not grow for ever.
      const live = new Set(uploadStore.all().map((item) => item.id))
      for (const id of seen.current.keys()) if (!live.has(id)) seen.current.delete(id)
    })
  }, [])

  return null
}
