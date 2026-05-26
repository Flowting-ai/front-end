'use client'

import React, { useState, Suspense, useEffect, useCallback, useRef } from 'react'
import { AnimatePresence, m } from 'framer-motion'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  ArrowLeftOneIcon,
  MoreVerticalIcon,
  QuillWriteOneIcon,
  ArrowUpRightOneIcon,
  UserAiIcon,
  AiIdeaIcon,
  FolderLibraryIcon,
  ArrowDownOneIcon,
  CancelOneIcon,
  ExpandIcon,
  ViewOffSlashIcon,
} from '@strange-huge/icons'
import { toast } from 'sonner'
import { Button } from '@/components/Button'
import { IconButton } from '@/components/IconButton'
import { ChatInput } from '@/components/ChatInput'
import KnowledgeTab, { KnowledgeFile } from '@/app/(app)/persona/configure/components/KnowledgeTab'
import {
  getVersion,
  updateVersion,
  uploadDocument,
  deleteDocument,
  listVersions,
  type PersonaVersionResponse,
  type PersonaVersionListItem,
} from '@/lib/api/personas'

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
    return {
      id:       doc.id,
      name:     doc.document_filename,
      type:     'file' as const,
      fileType: ext,
      size:     '-',
      date:     new Date(doc.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    }
  })
}

// ── Floating menu ─────────────────────────────────────────────────────────────

const MAX_VERSIONS = 5

function formatVersionDate(iso: string): string {
  const d = new Date(iso)
  const date = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  return `${date} · ${time}`
}

function nameInitials(name: string): string {
  return (name || '?').trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

function FloatingMenu({
  testChatOpen,
  onToggleTestChat,
  versionsOpen,
  onToggleVersions,
}: {
  testChatOpen: boolean
  onToggleTestChat: () => void
  versionsOpen: boolean
  onToggleVersions: () => void
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        backgroundColor: 'var(--neutral-white)',
        borderRadius: 12,
        padding: '4px 4px 6px',
        boxShadow:
          '0px 1.091px 1.091px 0px rgba(59,54,50,0.05), 0px 1.455px 3.127px 0px rgba(38,33,30,0.15), 0px 0px 0px 1px var(--neutral-200)',
        position: 'relative',
      }}
    >
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 'inherit',
          boxShadow: 'inset 0px -2.182px 0.364px 0px var(--neutral-100)',
          pointerEvents: 'none',
        }}
      />
      <button
        onClick={onToggleTestChat}
        title={testChatOpen ? 'Close test chat' : 'Open test chat'}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 6,
          borderRadius: 8,
          border: 'none',
          cursor: 'pointer',
          position: 'relative',
          backgroundColor: testChatOpen ? 'rgba(237,225,215,0.6)' : 'transparent',
          boxShadow: testChatOpen
            ? '0px 1px 1.5px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px rgba(182,172,164,0.4)'
            : 'none',
          transition: 'background-color 150ms, box-shadow 150ms',
        }}
      >
        {testChatOpen && (
          <div
            aria-hidden
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: 'inherit',
              boxShadow:
                'inset 0px 1px 0px 0px rgba(247,242,237,0.61), inset 0px -1px 0px 0px rgba(106,98,93,0.05)',
              pointerEvents: 'none',
            }}
          />
        )}
        <UserAiIcon size={20} color="var(--neutral-700)" animated />
      </button>
      <button
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 6, borderRadius: 8, border: 'none', cursor: 'pointer', backgroundColor: 'transparent',
        }}
      >
        <AiIdeaIcon size={20} color="var(--neutral-700)" animated />
      </button>
      <button
        onClick={onToggleVersions}
        title={versionsOpen ? 'Close versions' : 'View versions'}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 6,
          borderRadius: 8,
          border: 'none',
          cursor: 'pointer',
          position: 'relative',
          backgroundColor: versionsOpen ? 'rgba(237,225,215,0.6)' : 'transparent',
          boxShadow: versionsOpen
            ? '0px 1px 1.5px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px rgba(182,172,164,0.4)'
            : 'none',
          transition: 'background-color 150ms, box-shadow 150ms',
        }}
      >
        {versionsOpen && (
          <div
            aria-hidden
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: 'inherit',
              boxShadow:
                'inset 0px 1px 0px 0px rgba(247,242,237,0.61), inset 0px -1px 0px 0px rgba(106,98,93,0.05)',
              pointerEvents: 'none',
            }}
          />
        )}
        <FolderLibraryIcon size={20} color="var(--neutral-700)" animated />
      </button>
    </div>
  )
}

// ── Main page content ─────────────────────────────────────────────────────────

function PersonaConfigureKnowledgeContent() {
  const { push, back } = useRouter()
  const searchParams = useSearchParams()

  const repoId    = searchParams.get('repoId')    ?? ''
  const versionId = searchParams.get('versionId') ?? ''
  const personaName = searchParams.get('name') ?? ''

  const [testChatOpen,    setTestChatOpen]    = useState(false)
  const [versionsOpen,    setVersionsOpen]    = useState(false)
  const [versions,        setVersions]        = useState<PersonaVersionListItem[]>([])
  const [versionsLoading, setVersionsLoading] = useState(false)
  const [restoringId,     setRestoringId]     = useState<string | null>(null)
  const [isSaving,        setIsSaving]        = useState(false)
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
      // Fallback: use the last successful upload response
      const last = [...results].reverse().find(r => r.status === 'fulfilled')
      if (last?.status === 'fulfilled') setFiles(docsToFilesWithSizes(last.value))
    }

    // Toast per-file results
    results.forEach((result, i) => {
      if (result.status === 'fulfilled') {
        toast.success(`Uploaded ${rawFiles[i].name}`)
      } else {
        console.error('[KnowledgePage] upload error:', result.reason)
        toast.error(`Failed to upload ${rawFiles[i].name}`)
      }
    })
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

    // --- deleteDocument can fail (network / auth) → restore and show error
    try {
      await deleteDocument(repoId, versionId, id)
    } catch (err) {
      console.error('[KnowledgePage] delete error:', err)
      setFiles(prev => [...prev, file])   // restore
      toast.error(`Failed to remove \u201c${file.name}\u201d`)
      return
    }

    // Delete succeeded
    toast.success(`Removed \u201c${file.name}\u201d`)

    // Silently reload to sync with server — if this fails, the optimistic
    // removal already shows the correct UI so we just log and move on.
    try {
      const version = await getVersion(repoId, versionId)
      setFiles(prev => {
        const apiFiles = docsToFiles(version)
        return apiFiles.map(f => {
          const bytes = fileSizeMapRef.current[f.id] ?? fileSizeMapRef.current[f.name]
          if (bytes != null) return { ...f, size: `${(bytes / 1024 / 1024).toFixed(1)} MB` }
          const existing = prev.find(e => (e.id === f.id || e.name === f.name) && e.size && e.size !== '-')
          return existing ? { ...f, size: existing.size! } : f
        })
      })
    } catch (reloadErr) {
      console.warn('[KnowledgePage] reload after delete failed (ignored):', reloadErr)
    }
  }

  useEffect(() => {
    if (!versionsOpen || !repoId) return
    setVersionsLoading(true)
    listVersions(repoId)
      .then(v => setVersions(v.slice().sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, MAX_VERSIONS)))
      .catch(() => {})
      .finally(() => setVersionsLoading(false))
  }, [versionsOpen, repoId])

  function handleRestoreVersion(targetId: string) {
    if (!repoId || restoringId) return
    setRestoringId(targetId)
    push(`/persona/configure/instructions?repoId=${repoId}&versionId=${targetId}&name=${encodeURIComponent(personaName)}`)
  }

  // ── Save version ─────────────────────────────────────────────────────────

  async function handleSaveVersion() {
    if (!repoId || !versionId) return
    setIsSaving(true)
    try {
      // updateVersion patches in place, preserving document attachments on this versionId.
      await updateVersion({ repoId, versionId, name: personaName || undefined })
      toast.success('Version saved')
    } catch (err) {
      console.error('[KnowledgePage] save error:', err)
      toast.error('Failed to save version')
    } finally {
      setIsSaving(false)
    }
  }

  // ── Tab navigation ────────────────────────────────────────────────────────

  const handleTabClick = (tab: Tab) => {
    const route = TAB_ROUTES[tab]
    if (route) push(`${route}?${searchParams.toString()}`)
  }

  return (
    <div style={{ display: 'flex', gap: 7, alignItems: 'stretch', width: '100%', height: '100%', position: 'relative' }}>
      {/* ── Left configure panel ─────────────────────────────────────────────── */}
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
          height: '100%',
          flex: '1 0 0',
          minWidth: 0,
        }}
      >
        {/* ── Top navigation bar ────────────────────────────────────────────── */}
        <div style={{ flexShrink: 0, width: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 36, position: 'relative' }}>
            <div style={{ flexShrink: 0 }}>
              <IconButton variant="ghost" size="md" icon={<ArrowLeftOneIcon size={20} />} aria-label="Go back" onClick={() => back()} />
            </div>

            {/* Tabs — absolutely centered so left/right items don't affect positioning */}
            <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', display: 'inline-flex', alignItems: 'flex-start' }}>
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
                        color: isActive ? 'var(--neutral-700)' : MUTED_TABS.has(tab) ? 'var(--neutral-500)' : 'var(--neutral-700)',
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
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
              <IconButton variant="outline" size="md" icon={<MoreVerticalIcon size={20} />} aria-label="More options" />
              {testChatOpen ? (
                <IconButton
                  variant="outline"
                  size="sm"
                  icon={<QuillWriteOneIcon size={16} />}
                  aria-label="Save version"
                  onClick={handleSaveVersion}
                  disabled={!repoId || !versionId || isSaving}
                  loading={isSaving}
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
              <Button variant="default" size="sm" rightIcon={<ArrowUpRightOneIcon size={16} />}>Publish</Button>
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

        {/* ── Floating vertical menu ────────────────────────────────────────── */}
        <div style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', zIndex: 10 }}>
          <FloatingMenu
            testChatOpen={testChatOpen}
            onToggleTestChat={() => setTestChatOpen(v => !v)}
            versionsOpen={versionsOpen}
            onToggleVersions={() => setVersionsOpen(v => !v)}
          />
        </div>
      </div>

      {/* ── Test chat panel ────────────────────────────────────────────────── */}
      <AnimatePresence>
        {testChatOpen && (
          <m.div
            key="test-chat"
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 448, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 32, mass: 0.9 }}
            style={{
              flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 16, height: '100%',
              backgroundColor: 'var(--neutral-white)', border: '1px solid var(--neutral-200)',
              borderRadius: 16, padding: 12, overflow: 'hidden',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, backgroundColor: 'var(--neutral-100)', boxShadow: '0px 0px 0px 1px rgba(59,54,50,0.3)', overflow: 'hidden' }} />
                <p style={{ fontFamily: 'var(--font-title)', fontWeight: 400, fontSize: 24, lineHeight: '32px', color: '#1a1916', margin: 0, whiteSpace: 'nowrap' }}>
                  {personaName || 'Name'}
                </p>
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                {/* <div style={{ opacity: 0.7 }}>
                  <Button variant="outline" size="sm" leftIcon={<ViewOffSlashIcon size={16} />} rightIcon={<ArrowDownOneIcon size={16} />}>Mock connector</Button>
                </div> */}
                {/* <IconButton variant="outline" size="md" icon={<ExpandIcon size={20} />} aria-label="Expand test chat" /> */}
                <IconButton variant="outline" size="md" icon={<CancelOneIcon size={20} />} aria-label="Close test chat" onClick={() => setTestChatOpen(false)} />
              </div>
            </div>
            <div className="kaya-scrollbar" style={{ flex: '1 0 0', minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
              <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 16, lineHeight: '22px', color: 'var(--neutral-600)', margin: 0 }}>
                {`Hi! I'm ${personaName || 'your persona'}. Test me here while you configure.`}
              </p>
            </div>
            <div style={{ flexShrink: 0 }}>
              <ChatInput placeholder={`Message ${personaName || 'persona'}...`} textareaLabel="Test message" modelName="Souvenir" />
            </div>
          </m.div>
        )}
      </AnimatePresence>

      {/* ── Versions panel ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {versionsOpen && (
          <m.div
            key="versions-panel"
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 400, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 32, mass: 0.9 }}
            style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 16, height: '100%', paddingLeft: 5, paddingRight: 5, paddingTop: 12, paddingBottom: 12, overflow: 'hidden' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 8 }}>
                  <FolderLibraryIcon size={20} color="var(--neutral-700)" animated />
                </div>
                <p style={{ fontFamily: 'var(--font-title)', fontWeight: 400, fontSize: 24, lineHeight: '32px', color: '#1a1916', margin: 0, whiteSpace: 'nowrap' }}>Versions</p>
              </div>
              <IconButton variant="outline" size="md" icon={<CancelOneIcon size={20} />} aria-label="Close versions" onClick={() => setVersionsOpen(false)} />
            </div>
            <div className="kaya-scrollbar" style={{ flex: '1 0 0', minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 4 }}>
              {versionsLoading ? (
                <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--neutral-500)', margin: 0 }}>Loading…</p>
              ) : versions.length === 0 ? (
                <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--neutral-500)', margin: '24px 0', textAlign: 'center' }}>No versions yet. Use &ldquo;Save version&rdquo; to create one.</p>
              ) : versions.map((v, i) => {
                const isCurrent = v.id === versionId
                const vNum = versions.length - i
                const vLabel = `v${String(vNum).padStart(3, '0')}`
                const handle = v.handler ? `@${v.handler}·${vLabel}` : vLabel
                const dateStr = formatVersionDate(v.created_at)
                const initials = nameInitials(v.name || personaName)
                return (
                  <div key={v.id} style={{ display: 'flex', flexDirection: 'column', gap: 9, padding: 12, borderRadius: 16, backgroundColor: isCurrent ? 'var(--neutral-white)' : 'var(--neutral-50)', border: isCurrent ? 'none' : '1px dashed var(--neutral-300)', boxShadow: isCurrent ? '0px 2px 2.8px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-100)' : 'none', flexShrink: 0 }}>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', width: '100%' }}>
                      <div style={{ width: 37, height: 37, borderRadius: 8, flexShrink: 0, backgroundColor: 'var(--neutral-100)', boxShadow: '0px 1.091px 1.09px 0px rgba(59,54,50,0.05), 0px 1.455px 1px 0px rgba(38,33,30,0.15), 0px 0px 0px 1px var(--neutral-100)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 13, color: 'var(--neutral-600)', lineHeight: 1 }}>{initials}</span>
                      </div>
                      <div style={{ flex: '1 0 0', minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', whiteSpace: 'nowrap', width: '100%' }}>
                          <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 16, lineHeight: '22px', color: 'var(--neutral-900)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '55%' }}>{v.name || personaName}</p>
                          <p style={{ fontFamily: 'monospace', fontWeight: 400, fontSize: 13, lineHeight: '16px', color: 'var(--neutral-500)', margin: 0, flexShrink: 0 }}>{dateStr}</p>
                        </div>
                        <p style={{ fontFamily: 'monospace', fontWeight: 400, fontSize: 13, lineHeight: '16px', color: 'var(--neutral-500)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{handle}</p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end', width: '100%' }}>
                      {isCurrent ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px 8px 6px', borderRadius: 8, flexShrink: 0, cursor: 'default', background: 'linear-gradient(180deg, #524b47 0%, #26211e 100%)', boxShadow: '0px 0px 0px 1px black, 0px 1.091px 1.091px 0px rgba(59,54,50,0.1), 0px 1.455px 3.127px 0px rgba(59,54,50,0.4)', position: 'relative' }}>
                          <div aria-hidden style={{ position: 'absolute', inset: 0, borderRadius: 'inherit', boxShadow: 'inset 0px 1px 0.364px 0px rgba(247,242,237,0.3), inset 0px -2.182px 0.364px 0px #120c08, inset 0px -2.545px 4px -2.182px rgba(247,242,237,0.5)', pointerEvents: 'none' }} />
                          <span style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, lineHeight: '22px', color: '#f7f2ed', whiteSpace: 'nowrap', textShadow: '0px -0.727px 0.364px rgba(0,0,0,0.25), 0px 0.364px 0.364px rgba(255,255,255,0.25)' }}>Current</span>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleRestoreVersion(v.id)}
                          disabled={!!restoringId}
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, padding: '5px 8px', borderRadius: 8, border: 'none', flexShrink: 0, cursor: restoringId ? 'not-allowed' : 'pointer', backgroundColor: 'transparent', boxShadow: '0px 0px 0px 1px rgba(59,54,50,0.3)', opacity: restoringId ? 0.5 : 1, transition: 'opacity 150ms' }}
                        >
                          <span style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-700)', whiteSpace: 'nowrap' }}>
                            {restoringId === v.id ? 'Loading…' : 'Restore'}
                          </span>
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </m.div>
        )}
      </AnimatePresence>
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
