'use client'

import React, { useState, Suspense, useEffect, useCallback, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  ArrowLeftOneIcon,
  MoreVerticalIcon,
  QuillWriteOneIcon,
  ArrowUpRightOneIcon,
} from '@strange-huge/icons'
import { toast } from 'sonner'
import { Button } from '@/components/Button'
import { IconButton } from '@/components/IconButton'
import KnowledgeTab, { KnowledgeFile } from '@/app/(app)/persona/configure/components/KnowledgeTab'
import {
  getVersion,
  updateVersion,
  uploadDocument,
  deleteDocument,
  setActiveVersion,
  bustPersonasCache,
  type PersonaVersionResponse,
} from '@/lib/api/personas'
import RepublishModal from '@/app/(app)/persona/configure/components/RepublishModal'
import { usePersonaConfigure } from '@/app/(app)/persona/configure/context'

function publishedVersionKey(repoId: string) {
  return `persona_live_version_${repoId}`
}

// ── Constants ─────────────────────────────────────────────────────────────────

const TABS = ['Instructions', 'Profile', 'Knowledge', 'Connectors', 'Sharing'] as const
type Tab = (typeof TABS)[number]

const MUTED_TABS = new Set<Tab>(['Sharing'])

const TAB_ROUTES: Partial<Record<Tab, string>> = {
  Instructions: '/persona/configure/instructions',
  Profile:      '/persona/configure/profile',
  Connectors:   '/persona/configure/connectors',
  Sharing:      '/persona/configure/sharing',
}

// ── Convert backend documents to KnowledgeFile ────────────────────────────────

function docsToFiles(version: PersonaVersionResponse): KnowledgeFile[] {
  return (version.documents ?? []).map(doc => {
    const ext = doc.document_filename.split('.').pop()?.toUpperCase() ?? 'FILE'
    const size = (doc as any).size_bytes ? `${((doc as any).size_bytes / 1024 / 1024).toFixed(1)} MB` : '-'
    return {
      id:       doc.id,
      name:     doc.document_filename,
      type:     'file' as const,
      fileType: ext,
      size:     size,
      date:     new Date(doc.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    }
  })
}

// ── Main page content ─────────────────────────────────────────────────────────

function PersonaConfigureKnowledgeContent() {
  const { push, back } = useRouter()
  const searchParams = useSearchParams()

  const repoId    = searchParams.get('repoId')    ?? ''
  const versionId = searchParams.get('versionId') ?? ''
  const personaName = searchParams.get('name') ?? ''

  const { anyPanelOpen, updatePersonaInfo } = usePersonaConfigure()

  const [isSaving,             setIsSaving]             = useState(false)
  const [isPublishing,         setIsPublishing]         = useState(false)
  const [isDirty,              setIsDirty]              = useState(false)
  const [republishModalOpen,   setRepublishModalOpen]   = useState(false)
  const [files, setFiles] = useState<KnowledgeFile[]>([])
  const [isLoading, setIsLoading] = useState(!!repoId && !!versionId)

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
      const withSize = bytes != null ? { ...f, size: `${(bytes / 1024 / 1024).toFixed(1)} MB` } : f
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

  // eslint-disable-next-line react-doctor/no-cascading-set-state -- React 18+ batches these; useReducer refactor tracked separately
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
      size:     `${(raw.size / 1024 / 1024).toFixed(1)} MB`,
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
          if (bytes != null) return { ...f, size: `${(bytes / 1024 / 1024).toFixed(1)} MB`, ...(url ? { url } : {}) }
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
    if (anyUploaded) setIsDirty(true)
  }

  // ── Preview a file ─────────────────────────────────────────────────────────

  function handlePreviewFile(file: KnowledgeFile) {
    // 1. Exact lookup by doc ID (set in post-upload loop)
    // 2. Exact lookup by filename as stored (original raw.name)
    // 3. Inline url on the file object
    const exact = fileUrlMapRef.current[file.id]
      ?? fileUrlMapRef.current[file.name]
      ?? file.url

    if (exact) {
      window.open(exact, '_blank', 'noopener,noreferrer')
      return
    }

    // 4. Fuzzy fallback: strip all non-alphanumeric chars and compare.
    //    Handles API renaming like "My File.pdf" → "my_file.pdf".
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
    const target = norm(file.name)
    const fuzzyEntry = Object.entries(fileUrlMapRef.current).find(([key]) => norm(key) === target)
    if (fuzzyEntry) {
      window.open(fuzzyEntry[1], '_blank', 'noopener,noreferrer')
      return
    }

    // Nothing found — file was likely uploaded in a previous session
    toast.error('Preview not available')
  }

  // ── Delete a single file ──────────────────────────────────────────────────

  async function handleDeleteFile(id: string) {
    const file = files.find(f => f.id === id)
    if (!file) return

    // Optimistic removal
    setFiles(prev => prev.filter(f => f.id !== id))

    try {
      // deleteDocument returns the updated PersonaVersionResponse — use it
      // directly to refresh the list (no second getVersion round-trip needed).
      const updatedVersion = await deleteDocument(repoId, versionId, id)
      setFiles(docsToFilesWithSizes(updatedVersion))
      toast.success(`Removed "${file.name}"`)
      setIsDirty(true)
    } catch (err) {
      console.error('[KnowledgePage] delete error:', err)
      setFiles(prev => [...prev, file])   // restore optimistic removal
      toast.error(`Failed to remove "${file.name}"`)
    }
  }

  // ── Save version ─────────────────────────────────────────────────────────

  async function handleSaveVersion() {
    if (!isDirty || !repoId || !versionId) return
    setIsSaving(true)
    try {
      await updateVersion({ repoId, versionId, name: personaName || undefined })
      setIsDirty(false)
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
    const storedLiveId = typeof window !== 'undefined' ? sessionStorage.getItem(publishedVersionKey(repoId)) : null
    const wasPublished = !!storedLiveId
    setIsPublishing(true)
    try {
      await setActiveVersion(repoId, versionId)
      bustPersonasCache()
      if (typeof window !== 'undefined') sessionStorage.setItem(publishedVersionKey(repoId), versionId)
      if (wasPublished) {
        toast.success(`"${personaName}" is now live with the latest changes`)
        setRepublishModalOpen(true)
      } else {
        push(`/personas/published?name=${encodeURIComponent(personaName)}&repoId=${repoId}`)
      }
    } catch (err) {
      console.error('[KnowledgePage] publish error:', err)
      toast.error('Failed to publish')
    } finally {
      setIsPublishing(false)
    }
  }

  // ── Tab navigation ────────────────────────────────────────────────────────

  function safeNavigate(href: string) {
    if (isDirty && !window.confirm('You have unsaved knowledge changes. Leave without saving?')) return
    push(href)
  }
  function safeBack() {
    if (isDirty && !window.confirm('You have unsaved knowledge changes. Leave without saving?')) return
    back()
  }

  const handleTabClick = (tab: Tab) => {
    const route = TAB_ROUTES[tab]
    if (route) safeNavigate(`${route}?${searchParams.toString()}`)
  }

  return (
    <div
      style={{
        backgroundColor: 'rgba(255,255,255,0.2)',
        border: '1px solid var(--neutral-200)',
        borderRadius: 22,
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: anyPanelOpen ? 'flex-start' : 'space-between', gap: anyPanelOpen ? 8 : 0, height: 36, position: 'relative' }}>
          <div style={{ flexShrink: 0 }}>
            <IconButton variant="ghost" size="md" icon={<ArrowLeftOneIcon size={20} />} aria-label="Go back" onClick={safeBack} />
          </div>

          {/* Tabs — absolutely centered so left/right items don't affect positioning */}
          <div style={anyPanelOpen ? { display: 'inline-flex', alignItems: 'flex-start', position: 'relative' } : { position: 'absolute', left: '50%', transform: 'translateX(-50%)', display: 'inline-flex', alignItems: 'flex-start' }}>
            <div
              aria-hidden
              style={{
                position: 'absolute', inset: 0, borderRadius: 10,
                backgroundColor: 'rgba(247,242,237,0.5)',
                boxShadow: 'inset 0px -1px 0px 0px rgba(255,255,255,0.9), inset 0px 1px 0px 0px var(--neutral-100), inset 0px 0px 4px 0px rgba(209,198,189,0.5)',
              }}
            />
            <div style={{ position: 'relative', display: 'flex', gap: 4, alignItems: 'center' }}>
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
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0, marginLeft: anyPanelOpen ? 'auto' : undefined }}>
            <IconButton variant="outline" size="md" icon={<MoreVerticalIcon size={20} />} aria-label="More options" />
            {anyPanelOpen ? (
              <IconButton
                variant="outline"
                size="sm"
                icon={<QuillWriteOneIcon size={16} />}
                aria-label="Save version"
                onClick={handleSaveVersion}
                disabled={!isDirty || !repoId || !versionId || isSaving}
                loading={isSaving}
              />
            ) : (
              <Button
                variant="outline"
                size="sm"
                leftIcon={<QuillWriteOneIcon size={16} />}
                onClick={handleSaveVersion}
                disabled={!isDirty || !repoId || !versionId || isSaving}
                loading={isSaving}
              >
                {isSaving ? 'Saving…' : 'Save version'}
              </Button>
            )}
            <Button
              variant="default"
              size="sm"
              rightIcon={<ArrowUpRightOneIcon size={16} />}
              onClick={handlePublish}
              disabled={!repoId || !versionId || isPublishing}
            >
              {isPublishing ? 'Publishing…' : 'Publish'}
            </Button>
          </div>
        </div>
        <div style={{ height: 32, flexShrink: 0 }} />
      </div>

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
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--neutral-500)', margin: 0 }}>Loading…</p>
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
          personaName={personaName || 'Persona'}
          superLinkActive={false}
          onClose={() => setRepublishModalOpen(false)}
          onDone={() => { setRepublishModalOpen(false); push('/personas') }}
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
