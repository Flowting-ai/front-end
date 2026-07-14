'use client'

import React, { useState, Suspense, useEffect, useCallback, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  ArrowLeftOneIcon,
  QuillWriteOneIcon,
  ArrowUpRightOneIcon,
} from '@strange-huge/icons'
import { toast } from 'sonner'
import { Button } from '@/components/Button'
import { IconButton } from '@/components/IconButton'
import { Badge } from '@/components/Badge'
import KnowledgeTab, { KnowledgeFile } from '@/app/(app)/agent/configure/components/KnowledgeTab'
import {
  getVersion,
  updateVersion,
  uploadDocument,
  deleteDocument,
  publishPersonaVersion,
  bustPersonasCache,
  type PersonaVersionResponse,
} from '@/lib/api/personas'
import RepublishModal from '@/app/(app)/agent/configure/components/RepublishModal'
import { AGENTS_ROUTE } from '@/lib/routes'
import { usePersonaConfigure } from '@/app/(app)/agent/configure/context'
import { setVersionTags } from '@/lib/version-tags'
import { derivePublicationState } from '@/lib/persona-version-logic'
import { parseServerDate } from '@/lib/utils/format-utils'
import { AttributeTocRail, type AttributeTocItem } from '@/app/(app)/agent/configure/components/AttributeTrackerRail'
import { ConfigureFormSkeleton } from '@/app/(app)/agent/configure/components/ConfigureFormSkeleton'

const KNOWLEDGE_TOC_ITEMS: AttributeTocItem[] = [
  { id: 'files', label: 'Upload files', anchor: 'help-knowledge-upload' },
]

// ── Constants ─────────────────────────────────────────────────────────────────

const TABS = ['Instructions', 'Profile', 'Knowledge', 'Connectors', 'Sharing'] as const
type Tab = (typeof TABS)[number]

const MUTED_TABS = new Set<Tab>(['Sharing'])

const TAB_ROUTES: Partial<Record<Tab, string>> = {
  Instructions: '/agent/configure/instructions',
  Profile:      '/agent/configure/profile',
  Connectors:   '/agent/configure/connectors',
  Sharing:      '/agent/configure/sharing',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

// ── Convert backend documents to KnowledgeFile ────────────────────────────────

// Backend `created_at` is UTC — render it in the user's local timezone.
function fmtFileDate(iso: string): string {
  const d = parseServerDate(iso)
  return d ? d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : ''
}

function docsToFiles(version: PersonaVersionResponse): KnowledgeFile[] {
  const fileItems: KnowledgeFile[] = (version.documents ?? []).map(doc => {
    const isUrl = doc.document_filename.startsWith('http')
    if (isUrl) {
      return {
        id:       doc.id,
        name:     doc.document_filename.replace(/^https?:\/\//, '').split('/')[0],
        url:      doc.download_url ?? doc.document_filename,
        type:     'url' as const,
        fileType: 'URL',
        size:     '-',
        date:     fmtFileDate(doc.created_at),
      }
    }
    const ext  = doc.document_filename.split('.').pop()?.toUpperCase() ?? 'FILE'
    const size = doc.size_bytes ? formatFileSize(doc.size_bytes) : '-'
    return {
      id:       doc.id,
      name:     doc.document_filename,
      type:     'file' as const,
      fileType: ext,
      size,
      date:     fmtFileDate(doc.created_at),
      url:      doc.download_url ?? undefined,
    }
  })

  // URL knowledge sources are stored separately in version.links, not version.documents
  const linkItems: KnowledgeFile[] = (version.links ?? []).map(link => ({
    id:       link.id,
    name:     link.document_filename.replace(/^https?:\/\//, '').split('/')[0],
    url:      link.source_url ?? link.document_filename,
    type:     'url' as const,
    fileType: 'URL',
    size:     '-',
    date:     fmtFileDate(link.created_at),
  }))

  return [...fileItems, ...linkItems]
}

// ── Main page content ─────────────────────────────────────────────────────────

function PersonaConfigureKnowledgeContent() {
  const { push, back } = useRouter()
  const searchParams = useSearchParams()

  const repoId    = searchParams.get('repoId')    ?? ''
  const versionId = searchParams.get('versionId') ?? ''
  const personaName = searchParams.get('name') ?? ''

  const { anyPanelOpen, updatePersonaInfo, addPendingChangeTag, pendingChangeTags, setPendingChangeTags, refreshVersions, safeNavigate: ctxSafeNavigate, safeBack: ctxSafeBack, setKnowledgeFileCount, setVersionsOpen, publishedVersionId, markPublished, registerAutoSave, tabDirtyFlags, setTabDirty, changesTrackerOpen, touchedFieldsByTab, markFieldTouched, resetTouchedFields } = usePersonaConfigure()
  const knowledgeTouchedFields = touchedFieldsByTab.knowledge

  const [isSaving,             setIsSaving]             = useState(false)
  const [showInfo,             setShowInfo]             = useState(false)
  const [isPublishing,         setIsPublishing]         = useState(false)
  const [isDirty,              setIsDirty]              = useState(false)
  const [republishModalOpen,   setRepublishModalOpen]   = useState(false)
  const [files, setFiles] = useState<KnowledgeFile[]>([])
  const [isLoading, setIsLoading] = useState(!!repoId && !!versionId)

  // Sync file count to shared progress indicator
  useEffect(() => { setKnowledgeFileCount(files.length) }, [files.length, setKnowledgeFileCount])

  // Tracks file sizes (bytes) by filename so the MB counter stays accurate
  // after an API reload (which strips size info). Uses a ref to avoid stale
  // closure issues inside async upload functions.
  const fileSizeMapRef = useRef<Record<string, number>>({})
  // Tracks blob preview URLs by filename so the eye-icon preview survives
  // the API reload that replaces placeholder entries with server records.
  const fileUrlMapRef  = useRef<Record<string, string>>({})

  function docsToFilesWithSizes(version: PersonaVersionResponse): KnowledgeFile[] {
    return docsToFiles(version).map(f => {
      const bytes = fileSizeMapRef.current[f.name]
      // Check by doc ID first — survives API filename normalisation (spaces→underscores etc.)
      const url   = fileUrlMapRef.current[f.id] ?? fileUrlMapRef.current[f.name]
      const withSize = bytes != null ? { ...f, size: formatFileSize(bytes) } : f
      return url ? { ...withSize, url } : withSize
    })
  }

  // Restore file sizes from sessionStorage on mount or version change
  useEffect(() => {
    if (!repoId || !versionId || typeof window === 'undefined') return
    const storageKey = `persona_file_sizes_${repoId}_${versionId}`
    const stored = sessionStorage.getItem(storageKey)
    if (stored) {
      try {
        fileSizeMapRef.current = JSON.parse(stored)
      } catch (e) {
        console.error('[KnowledgePage] Failed to parse stored file sizes:', e)
      }
    }
  }, [repoId, versionId])

  useEffect(() => {
    if (!repoId) return
    updatePersonaInfo({ repoId, versionId })
  }, [repoId, versionId, updatePersonaInfo])

  // ── Load existing documents from API on mount ──────────────────────────────

  useEffect(() => {
    if (!repoId || !versionId) return
    setIsLoading(true)
    getVersion(repoId, versionId)
      .then(version => setFiles(docsToFilesWithSizes(version)))
      .catch(err => {
        console.error('[KnowledgePage] load error:', err)
        toast.error('Failed to load knowledge files')
      })
      .finally(() => setIsLoading(false))
  }, [repoId, versionId])

  // ── Handle file upload (called from KnowledgeTab's file picker) ──────────

  const handleFilesChange = useCallback(async (nextFiles: KnowledgeFile[]) => {
    if (!repoId || !versionId) {
      setFiles(nextFiles)
      return
    }

    // Find newly added local files (those whose id starts with a timestamp, not a UUID)
    const currentIds = new Set(files.map(f => f.id))
    const added = nextFiles.filter(f => !currentIds.has(f.id) && f.type === 'file')

    // Find removed (deleted) files - these are real API files with UUID ids
    const nextIds = new Set(nextFiles.map(f => f.id))
    const removed = files.filter(f => !nextIds.has(f.id) && /^[0-9a-f-]{36}$/i.test(f.id))

    // Optimistically update local state
    setFiles(nextFiles)

    // Upload new files
    for (const file of added) {
      // KnowledgeTab generates temp ids like "123456789-filename.pdf"
      // We need the actual File object - but KnowledgeTab doesn't expose it.
      // Since we can't get File objects here, uploads are handled in handleRawFileInput.
    }

    // Deletions are handled by the dedicated handleDeleteFile — nothing to do here.
  }, [repoId, versionId, files])

  // ── Handle raw File objects from the file input ───────────────────────────

  async function uploadFiles(rawFiles: File[]) {
    if (!repoId || !versionId) return
    // Lights the rail dot for the round-trip; cleared once the upload(s) resolve below.
    markFieldTouched('knowledge', 'files')

    // Record file sizes and create blob preview URLs before uploading
    rawFiles.forEach(f => {
      fileSizeMapRef.current[f.name] = f.size
      // Only create a new blob URL if we don't already have one (avoid leaking)
      if (!fileUrlMapRef.current[f.name]) {
        const blobUrl = URL.createObjectURL(f)
        // Store under several normalised keys so we survive API filename renaming
        fileUrlMapRef.current[f.name]                                    = blobUrl // original
        fileUrlMapRef.current[f.name.toLowerCase()]                      = blobUrl // lowercase
        fileUrlMapRef.current[f.name.toLowerCase().replace(/\s+/g, '_')] = blobUrl // spaces→underscores
        fileUrlMapRef.current[f.name.toLowerCase().replace(/_+/g, ' ')]  = blobUrl // underscores→spaces
      }
    })

    // Persist file sizes to sessionStorage so they survive page reloads
    if (typeof window !== 'undefined') {
      const storageKey = `persona_file_sizes_${repoId}_${versionId}`
      sessionStorage.setItem(storageKey, JSON.stringify(fileSizeMapRef.current))
    }

    // Show placeholder entries immediately so the UI doesn't appear frozen
    const placeholders: KnowledgeFile[] = rawFiles.map(raw => ({
      id:       `uploading-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name:     raw.name,
      type:     'file' as const,
      fileType: raw.name.split('.').pop()?.toUpperCase() ?? 'FILE',
      size:     formatFileSize(raw.size),
      date:     new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      url:      fileUrlMapRef.current[raw.name],
    }))
    setFiles(prev => [...prev, ...placeholders])

    // Upload all files in parallel
    const results = await Promise.allSettled(
      rawFiles.map(raw => uploadDocument(repoId, versionId, raw))
    )

    // Also key blob URLs by document ID so the lookup works even when the API
    // normalises filenames (e.g. "My File.pdf" → "my_file.pdf").
    results.forEach((result, i) => {
      if (result.status !== 'fulfilled') return
      const blobUrl = fileUrlMapRef.current[rawFiles[i].name]
      if (!blobUrl) return
      const rawNameLower = rawFiles[i].name.toLowerCase()
      const match = (result.value.documents ?? []).find(d =>
        d.document_filename.toLowerCase() === rawNameLower ||
        d.document_filename.toLowerCase().replace(/[\s_]/g, '') === rawNameLower.replace(/[\s_]/g, '')
      )
      if (match) fileUrlMapRef.current[match.id] = blobUrl
    })

    // Reload from API to get the authoritative file list (avoids race-condition with parallel responses)
    try {
      const version = await getVersion(repoId, versionId)
      // Use setFiles(prev=>) so placeholder sizes survive even when the API
      // sanitizes filenames and the ref lookup misses.
      setFiles(prev => {
        const apiFiles = docsToFiles(version)
        return apiFiles.map(f => {
          // Restore preview URL — check by doc ID first, then by name, then prev state
          const url = fileUrlMapRef.current[f.id]
            ?? fileUrlMapRef.current[f.name]
            ?? prev.find(e => e.name.toLowerCase() === f.name.toLowerCase())?.url

          // 1. Ref lookup by doc ID (most reliable)
          const bytes = fileSizeMapRef.current[f.id] ?? fileSizeMapRef.current[f.name]
          if (bytes != null) return { ...f, size: formatFileSize(bytes), ...(url ? { url } : {}) }
          // 2. Fallback: find placeholder with matching name (case-insensitive to
          //    survive minor API filename normalisation like "GRAD2.pdf" → "grad2.pdf")
          const fNameLower = f.name.toLowerCase()
          const ph = prev.find(e =>
            (e.name === f.name || e.name.toLowerCase() === fNameLower) &&
            e.size && e.size !== '-'
          )
          const withSize = ph ? { ...f, size: ph.size! } : f
          return url ? { ...withSize, url } : withSize
        })
      })
    } catch {
      // getVersion failed — fall back to the last successful upload response.
      // If ALL uploads failed, no fulfilled result exists: remove every
      // placeholder row so phantom files don't linger in the UI.
      const last = [...results].reverse().find(r => r.status === 'fulfilled')
      if (last?.status === 'fulfilled') {
        setFiles(docsToFilesWithSizes(last.value))
      } else {
        setFiles(prev => prev.filter(f => !/^uploading-/.test(f.id)))
      }
    }

    // Toast per-file results; mark dirty when at least one upload succeeded
    let anyUploaded = false
    results.forEach((result, i) => {
      if (result.status === 'fulfilled') {
        toast.success(`Uploaded ${rawFiles[i].name}`)
        anyUploaded = true
      } else {
        console.error('[KnowledgePage] upload error:', result.reason)
        toast.error(`Failed to upload ${rawFiles[i].name}`)
      }
    })
    if (anyUploaded) { setIsDirty(true); addPendingChangeTag('Knowledge') }
    // Files persist to the backend immediately (not batched into Save Version) —
    // the upload attempt is over either way, so clear the touched dot now.
    resetTouchedFields('knowledge')
  }

  // ── Preview a file ─────────────────────────────────────────────────────────

  async function handlePreviewFile(file: KnowledgeFile) {
    // 1. Exact lookup by doc ID or filename — these are local blob URLs, always inline
    const localBlob = fileUrlMapRef.current[file.id] ?? fileUrlMapRef.current[file.name]
    if (localBlob) { window.open(localBlob, '_blank', 'noopener,noreferrer'); return }

    // 2. Fuzzy fallback for local blobs (handles API filename normalisation)
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
    const target = norm(file.name)
    const fuzzyEntry = Object.entries(fileUrlMapRef.current).find(([key]) => norm(key) === target)
    if (fuzzyEntry) { window.open(fuzzyEntry[1], '_blank', 'noopener,noreferrer'); return }

    // 3. Remote URL — open tab synchronously (required by popup blocker), then navigate
    //    to a blob URL so the browser renders inline instead of downloading.
    if (file.url) {
      const newTab = window.open('about:blank', '_blank')
      if (!newTab) { toast.error('Allow pop-ups to preview files'); return }
      try {
        const res = await fetch(file.url)
        const blob = await res.blob()
        const blobUrl = URL.createObjectURL(blob)
        newTab.location.href = blobUrl
        setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000)
      } catch {
        newTab.close()
        toast.error('Preview not available')
      }
      return
    }

    toast.error('Preview not available')
  }

  // ── Delete a single file ──────────────────────────────────────────────────

  async function handleDeleteFile(id: string) {
    const file = files.find(f => f.id === id)
    if (!file) return

    markFieldTouched('knowledge', 'files')
    try {
      await deleteDocument(repoId, versionId, id)
      setFiles(prev => prev.filter(f => f.id !== id))
      toast.success(`Removed "${file.name}"`)
      setIsDirty(true)
      addPendingChangeTag('Knowledge')
    } catch (err) {
      console.error('[KnowledgePage] delete error:', err)
      toast.error(`Failed to remove "${file.name}"`)
    } finally {
      // Deletes persist immediately (not batched into Save Version) — clear either way.
      resetTouchedFields('knowledge')
    }
  }

  // ── Save version ─────────────────────────────────────────────────────────

  async function handleSaveVersion() {
    if (!repoId || !versionId) return
    setIsSaving(true)
    try {
      await updateVersion({ repoId, versionId, name: personaName || undefined })
      setIsDirty(false)
      setVersionTags(versionId, pendingChangeTags)
      setPendingChangeTags([])
      refreshVersions()
      setVersionsOpen(true)
      toast.success('Version saved')
    } catch (err) {
      console.error('[KnowledgePage] save error:', err)
      toast.error('Failed to save version')
    } finally {
      setIsSaving(false)
    }
  }

  async function handlePublish() {
    if (!repoId || !versionId) return
    const wasPublished = !!publishedVersionId
    setIsPublishing(true)
    try {
      // Flush any unsaved knowledge changes (file uploads/deletes mark isDirty) into the
      // current version before publishing — no new version is created.
      if (isDirty) {
        await updateVersion({ repoId, versionId, name: personaName || undefined })
        setIsDirty(false)
        setVersionTags(versionId, pendingChangeTags)
        setPendingChangeTags([])
      }
      await publishPersonaVersion(repoId, versionId)
      bustPersonasCache()
      if (typeof window !== 'undefined') {
        try { sessionStorage.removeItem('persona_wizard_repo') } catch { /* ignore */ }
        try { sessionStorage.removeItem(`persona_initial_version_${repoId}`) } catch { /* ignore */ }
      }
      markPublished(versionId)

      const base = `/agents/published?name=${encodeURIComponent(personaName)}&repoId=${repoId}&versionId=${versionId}`
      push(wasPublished ? `${base}&republished=true` : base)
    } catch (err) {
      console.error('[KnowledgePage] publish error:', err)
      toast.error('Failed to publish')
    } finally {
      setIsPublishing(false)
    }
  }

  // ── Auto-save on tab switch ────────────────────────────────────────────────

  const knowledgeAutoSaveRef = useRef<() => Promise<void>>(() => Promise.resolve())
  knowledgeAutoSaveRef.current = async () => {
    if (pendingChangeTags.length === 0 || !repoId || !versionId) return
    try {
      await updateVersion({ repoId, versionId, name: personaName || undefined })
      toast.success('Changes autosaved')
    } catch (err) {
      console.error('[KnowledgePage] auto-save error:', err)
    }
  }

  useEffect(() => {
    registerAutoSave(() => knowledgeAutoSaveRef.current())
    return () => registerAutoSave(null)
  }, [registerAutoSave])

  // Sync dirty state to context for traffic light
  useEffect(() => { setTabDirty('Knowledge', isDirty) }, [isDirty, setTabDirty])

  // ── Tab navigation ────────────────────────────────────────────────────────

  function safeNavigate(href: string) { ctxSafeNavigate(href) }
  function safeBack()                 { ctxSafeBack() }

  const { isPublished, needsRepublish } = derivePublicationState({
    repoId,
    versionId,
    publishedVersionId,
    hasUnsavedChanges: isDirty || pendingChangeTags.length > 0,
  })

  const anyDirty     = pendingChangeTags.length > 0 || TABS.some(tab => tabDirtyFlags[tab] === true)

  const handleTabClick = (tab: Tab) => {
    const route = TAB_ROUTES[tab]
    if (route) safeNavigate(`${route}?${searchParams.toString()}`)
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        position: 'relative',
        paddingBottom: 12,
        paddingTop: 10,
        paddingLeft: 12,
        paddingRight: 12,
        width: '100%',
        height: '100%',
      }}
    >
      {/* ── Top navigation bar ────────────────────────────────────────────── */}
      <div style={{ flexShrink: 0, width: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 36, position: 'relative' }}>
          {/* Back arrow + label — left column. Equal flex on both side columns
             keeps the centre tabs perfectly centred at any width. */}
          <div style={{ flex: '1 1 0', minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'flex-start' }}>
            {anyPanelOpen ? (
              <IconButton
                variant="ghost"
                size="sm"
                icon={<ArrowLeftOneIcon size={20} animated />}
                aria-label="Back to Agents"
                onClick={() => safeNavigate('/agents')}
              />
            ) : (
              <Button
                variant="ghost"
                size="sm"
                leftIcon={<ArrowLeftOneIcon size={20} animated />}
                onClick={() => safeNavigate('/agents')}
              >
                Back to Agents
              </Button>
            )}
          </div>

          {/* Tabs — centre column, centred between the back button and actions. */}
          <div style={{ flex: '0 0 auto', display: 'inline-flex', alignItems: 'flex-start', position: 'relative' }}>
            {/* Frosted glass — only covers the tab button row, not the traffic lights */}
            <div
              aria-hidden
              style={{
                position: 'absolute', top: 0, left: 0, right: 0, height: 36, borderRadius: 10,
                backgroundColor: 'rgba(247,242,237,0.5)',
                boxShadow: 'inset 0px -1px 0px 0px rgba(255,255,255,0.9), inset 0px 1px 0px 0px var(--neutral-100), inset 0px 0px 4px 0px rgba(209,198,189,0.5)',
              }}
            />
            <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: TABS.map(() => 'auto').join(' '), columnGap: 4, rowGap: 6, justifyContent: 'start' }}>
              {/* Info legend */}
              <div style={{ position: 'absolute', right: 'calc(100% + 8px)', top: 0, height: 36, display: 'flex', alignItems: 'center', zIndex: 9999 }}>
                <button type="button" onMouseEnter={() => setShowInfo(true)} onMouseLeave={() => setShowInfo(false)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 18, height: 18, borderRadius: '50%', border: '1.5px solid var(--neutral-400)', backgroundColor: 'transparent', cursor: 'default', fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 600, color: 'var(--neutral-500)', padding: 0 }}>i</button>
                {showInfo && (
                  <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: '50%', transform: 'translateX(-50%)', backgroundColor: 'white', border: '1px solid var(--neutral-200)', borderRadius: 8, padding: '8px 10px', boxShadow: '0px 4px 12px rgba(0,0,0,0.08)', display: 'flex', flexDirection: 'column', gap: 6, whiteSpace: 'nowrap', zIndex: 9999 }}>
                    {([{ color: '#D1D5DB', border: '#9CA3AF', label: 'No changes' }, { color: '#F97316', border: '#C2600F', label: 'Unsaved changes' }, { color: '#6FCF97', border: '#27AE60', label: 'Saved' }] as const).map(({ color, border, label }) => (
                      <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 24, height: 4, backgroundColor: color, border: `1px solid ${border}`, borderRadius: 2, flexShrink: 0 }} />
                        <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--neutral-600)' }}>{label}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {TABS.map(tab => {
                const isActive = tab === 'Knowledge'
                return (
                  <button
                    key={tab}
                    onClick={() => handleTabClick(tab)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      padding: '7px 8px', borderRadius: 10, border: 'none',
                      cursor: TAB_ROUTES[tab] ? 'pointer' : 'default',
                      backgroundColor: isActive ? 'var(--neutral-white)' : 'transparent',
                      boxShadow: isActive ? '0px 1px 1.5px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-100), inset 0px -1px 0px 0px rgba(38,33,30,0.1)' : 'none',
                      fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, lineHeight: '22px',
                      color: isActive ? 'var(--blue-600)' : 'var(--neutral-700)',
                      whiteSpace: 'nowrap',
                      transition: 'background-color 150ms, box-shadow 150ms, color 150ms',
                      position: 'relative',
                    }}
                  >
                    {isActive && (
                      <div aria-hidden style={{ position: 'absolute', inset: 0, borderRadius: 'inherit', boxShadow: 'inset 0px -1px 0px 0px rgba(38,33,30,0.1)', pointerEvents: 'none' }} />
                    )}
                    {tab}
                  </button>
                )
              })}
              {TABS.map(tab => {
                const hasFlag     = tabDirtyFlags[tab] !== undefined
                const isDirtyT    = hasFlag ? tabDirtyFlags[tab] ?? false : pendingChangeTags.includes(tab)
                const isPristine  = !hasFlag && !pendingChangeTags.includes(tab)
                const showGray    = isPristine && !publishedVersionId
                const bgColor     = showGray ? '#D1D5DB' : (isDirtyT ? '#F97316' : '#6FCF97')
                const borderColor = showGray ? '#9CA3AF' : (isDirtyT ? '#C2600F' : '#27AE60')
                return (
                  <div key={`${tab}-light`} aria-hidden style={{ height: 4, backgroundColor: bgColor, border: `1px solid ${borderColor}`, borderRadius: 2, transition: 'background-color 300ms, border-color 300ms' }} />
                )
              })}
              {(anyDirty || publishedVersionId != null || (!!repoId && !!versionId)) && (
                <div style={{ position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', marginTop: 10, pointerEvents: 'none', zIndex: 1, display: 'flex', gap: 6, alignItems: 'center' }}>
                  {(anyDirty || publishedVersionId != null) && (
                    <>
                      {anyDirty ? <Badge color="Red" label="Unsaved" /> : <Badge color="Green" label="Saved" />}
                      <div aria-hidden style={{ width: 1, height: 12, backgroundColor: 'var(--neutral-300)', flexShrink: 0 }} />
                    </>
                  )}
                  {isPublished
                    ? <Badge color="Green" label="Live" />
                    : <Badge color="Red" label="Unpublished" />
                  }
                </div>
              )}
            </div>
          </div>

          {/* Action buttons — right column (equal flex mirrors the left column) */}
          <div style={{ flex: '1 1 0', minWidth: 0, display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'flex-end' }}>
            {anyPanelOpen ? (
              <IconButton
                variant="outline"
                size="sm"
                icon={<QuillWriteOneIcon size={16} />}
                aria-label="Save version"
                onClick={handleSaveVersion}
                loading={isSaving}
                disabled={!repoId || !versionId || isSaving}
              />
            ) : (
              <Button
                variant="outline"
                size="sm"
                leftIcon={<QuillWriteOneIcon size={16} />}
                onClick={handleSaveVersion}
                disabled={!repoId || !versionId || isSaving}
                loading={isSaving}
              >
                {isSaving ? 'Saving…' : 'Save version'}
              </Button>
            )}
            <Button
              variant="default"
              size="sm"
              rightIcon={<ArrowUpRightOneIcon size={16} />}
              onClick={() => void handlePublish()}
              disabled={!repoId || !versionId || isPublishing}
              loading={isPublishing}
            >
              {isPublishing
                ? (publishedVersionId != null ? 'Republishing…' : 'Publishing…')
                : (publishedVersionId != null ? 'Republish' : 'Publish')}
            </Button>
          </div>
        </div>
        <div style={{ height: 35, flexShrink: 0 }} />
      </div>

      <AttributeTocRail
        items={KNOWLEDGE_TOC_ITEMS}
        touchedFields={knowledgeTouchedFields}
        open={changesTrackerOpen && !anyPanelOpen}
      />

      {/* ── Scrollable content area ────────────────────────────────────────── */}
      <div
        className="kaya-scrollbar"
        style={{
          flex: '1 0 0', minHeight: 0, overflowY: 'auto', overflowX: 'hidden',
          display: 'flex', justifyContent: 'center',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24, width: '100%', maxWidth: 714, paddingBottom: 32 }}>
          {isLoading ? (
            <ConfigureFormSkeleton rows={4} />
          ) : (
            <KnowledgeTab
              files={files}
              onFilesChange={handleFilesChange}
              onRawFilesSelected={uploadFiles}
              onRemoveFile={handleDeleteFile}
              onPreviewFile={handlePreviewFile}
            />
          )}
        </div>
      </div>

      {republishModalOpen && (
        <RepublishModal
          personaName={personaName || 'Agent'}
          superLinkActive={false}
          onClose={() => setRepublishModalOpen(false)}
          onDone={() => { setRepublishModalOpen(false); push(AGENTS_ROUTE) }}
        />
      )}
    </div>
  )
}

// ── Page export ───────────────────────────────────────────────────────────────

export default function PersonaConfigureKnowledgePage() {
  return (
    <Suspense>
      <PersonaConfigureKnowledgeContent />
    </Suspense>
  )
}
