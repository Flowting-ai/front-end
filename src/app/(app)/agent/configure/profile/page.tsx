'use client'

import React, { useState, useRef, Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  ArrowLeftOneIcon,
} from '@strange-huge/icons'
import { Button } from '@/components/Button'
import { IconButton } from '@/components/IconButton'
import { toast } from 'sonner'
import ProfileTab from '@/app/(app)/agent/configure/components/ProfileTab'
import RepublishModal from '@/app/(app)/agent/configure/components/RepublishModal'
import {
  getPersonaRepo, updateVersion, setActiveVersion,
  bustPersonasCache,
} from '@/lib/api/personas'
import { usePersonaConfigure } from '@/app/(app)/agent/configure/context'
import { setVersionTags } from '@/lib/version-tags'
import { derivePublicationState } from '@/lib/persona-version-logic'

function publishedVersionKey(repoId: string) {
  return `persona_live_version_${repoId}`
}

function dataUrlToFile(dataUrl: string, filename: string): File {
  const [header, data] = dataUrl.split(',')
  const mime = header.match(/:(.*?);/)?.[1] ?? 'image/jpeg'
  const bytes = atob(data)
  const arr = new Uint8Array(bytes.length)
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i)
  return new File([arr], filename, { type: mime })
}

const TABS = ['Instructions', 'Profile', 'Knowledge', 'Connectors', 'Sharing'] as const
type Tab = (typeof TABS)[number]

const TAB_ROUTES: Partial<Record<Tab, string>> = {
  Instructions: '/agent/configure/instructions',
  Knowledge:    '/agent/configure/knowledge',
  Connectors:   '/agent/configure/connectors',
  Sharing:      '/agent/configure/sharing',
}

function PersonaConfigureProfileContent() {
  const { push, back } = useRouter()
  const searchParams = useSearchParams()
  const nameParam  = searchParams.get('name')      ?? ''
  const repoId     = searchParams.get('repoId')    ?? ''
  const versionId  = searchParams.get('versionId') ?? ''

  // Session-storage key scoped to this persona (or 'new' while creating)
  const PROFILE_KEY = `persona_profile_${repoId || 'new'}`

  // Helper: read saved draft (runs synchronously — client only)
  function loadDraft() {
    if (typeof window === 'undefined') return null
    try { return JSON.parse(sessionStorage.getItem(PROFILE_KEY) ?? 'null') as Record<string, unknown> | null }
    catch { return null }
  }

  const { anyPanelOpen, updatePersonaInfo, personaInfo, addPendingChangeTag, pendingChangeTags, setPendingChangeTags, refreshVersions, safeNavigate: ctxSafeNavigate, safeBack: ctxSafeBack, registerAutoSave, setVersionsOpen, activeVersionId, markPublished } = usePersonaConfigure()

  const [isSaving,             setIsSaving]             = useState(false)
  const [isPublishing,         setIsPublishing]         = useState(false)
  const [isDirty,              setIsDirty]              = useState(false)
  const [republishModalOpen,   setRepublishModalOpen]   = useState(false)
  const isDirtyRef = useRef(false)

  // ProfileTab state — initialise from sessionStorage on first render
  const [avatarUrl,          setAvatarUrl]          = useState<string | null>(() => { const d = loadDraft(); return (d?.avatarUrl as string | null) ?? null })
  const [personaName,        setPersonaName]        = useState<string>(() => { const d = loadDraft(); return (d?.personaName as string) || nameParam || 'Agent Name' })
  const [personaHandle,      setPersonaHandle]      = useState<string>(() => { const d = loadDraft(); return (d?.personaHandle as string) ?? '' })
  const [personaDescription, setPersonaDescription] = useState<string>(() => {
    const d = loadDraft()
    if (d?.personaDescription as string | undefined) return d!.personaDescription as string
    // Seed from wizard purpose saved by instructions page after creating the persona
    if (repoId && typeof window !== 'undefined') {
      try {
        const seed = sessionStorage.getItem(`persona_wizard_purpose_${repoId}`)
        if (seed) return seed
      } catch { /* ignore */ }
    }
    return ''
  })
  const [personaTags,        setPersonaTags]        = useState<string[]>(() => {
    const d = loadDraft()
    if (d?.personaTags) return d.personaTags as string[]
    // Seed tags from the /persona/starter result stored by the tone wizard page
    if (typeof window !== 'undefined') {
      try {
        const starter = JSON.parse(sessionStorage.getItem('persona_wizard_starter') ?? 'null') as { persona_tags?: string[] } | null
        if (starter?.persona_tags?.length) return starter.persona_tags
      } catch { /* ignore */ }
    }
    return []
  })

  // Gate auto-save so we never persist placeholder defaults before the API has
  // had a chance to load the real persona data.
  // • No repoId (still in wizard): initialize as true — save whatever the user types.
  // • Has repoId (editing existing): start false, flip to true after API resolves.
  const [isInitialized, setIsInitialized] = useState(!repoId)
  // Ref mirrors the state so the auto-save effect can gate on it without listing
  // isInitialized as a dep (which would create an effect chain: fetch sets
  // isInitialized → auto-save effect triggers solely because isInitialized changed).
  const isInitializedRef = useRef(!repoId)


  // ── Load real persona data from API on first visit (no meaningful draft yet) ───
  useEffect(() => {
    if (!repoId) { isInitializedRef.current = true; setIsInitialized(true); return }

    // Clean up one-shot wizard keys
    try { sessionStorage.removeItem(`persona_wizard_purpose_${repoId}`) } catch { /* ignore */ }

    // If the user already has meaningful profile data saved, skip overwriting text fields
    // but ALWAYS load the avatar from the API so it shows in the test chat panel.
    const draft = loadDraft()
    const hasMeaningfulDraft = !!draft && (
      !!(draft.personaHandle as string | undefined) ||
      !!(draft.personaDescription as string | undefined) ||
      ((draft.personaName as string | undefined) ?? 'Agent Name') !== 'Agent Name'
    )

    // Capture local tags at mount so we can detect wizard-seeded tags that were never
    // PATCHed to the backend (backend empty, local has tags → auto-save must sync them).
    const localTagsAtMount = personaTags.slice()
    let shouldMarkDirtyForTags = false

    getPersonaRepo(repoId)
      .then(repo => {
        const v = repo.active_version
        // Always refresh avatar — draft may have been set from text fields only, leaving avatar null
        if (v?.image_url && !avatarUrl) setAvatarUrl(v.image_url)
        // Always set handle from API when not already in the draft — even when hasMeaningfulDraft
        // is true (wizard data exists), the handle is generated server-side and won't be in the draft.
        if (v?.handler && !personaHandle) setPersonaHandle(`@${v.handler}`)
        // Always load tags from API when the local state is empty (edit flow / no wizard draft).
        if (v?.persona_tags?.length && !personaTags.length) setPersonaTags(v.persona_tags)
        if (!hasMeaningfulDraft) {
          // No meaningful draft — overwrite all fields with real API data
          setPersonaName(repo.name || 'Agent Name')
          if (v?.image_url) setAvatarUrl(v.image_url)
          // Description is already seeded from persona_wizard_purpose_{repoId} in the
          // useState initializer — do NOT overwrite it with the system instruction here.
        }
        // Clear one-shot wizard key so stale data doesn't bleed into the next wizard run.
        try { sessionStorage.removeItem('persona_wizard_starter') } catch { /* ignore */ }
        // If local has tags (from wizard starter / sessionStorage) but backend has none,
        // flag for dirty-marking after init so auto-save will PATCH them on next navigation.
        const apiTags = v?.persona_tags ?? []
        if (localTagsAtMount.length > 0 && apiTags.length === 0) {
          shouldMarkDirtyForTags = true
        }
      })
      .catch(err => console.error('[ProfilePage] API load error:', err))
      .finally(() => {
        isInitializedRef.current = true
        setIsInitialized(true)
        // Must run after isInitializedRef = true so markDirty's own guard passes.
        if (shouldMarkDirtyForTags) markDirty()
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repoId])

  // Auto-save to sessionStorage whenever any profile field changes.
  // Uses isInitializedRef (not state) so this effect is not triggered by the
  // initialization itself — only by actual field edits after loading completes.
  useEffect(() => {
    if (!isInitializedRef.current) return
    try {
      sessionStorage.setItem(PROFILE_KEY, JSON.stringify({
        avatarUrl,
        personaName,
        personaHandle,
        personaDescription,
        personaTags,
      }))
      // Also persist tags to localStorage so persona cards survive browser-session changes.
      // An empty array explicitly removes the key so stale data never lingers.
      if (repoId) {
        if (personaTags.length > 0) {
          localStorage.setItem(`persona_tags_${repoId}`, JSON.stringify(personaTags))
        } else {
          localStorage.removeItem(`persona_tags_${repoId}`)
        }
      }
    } catch { /* storage quota exceeded — ignore */ }
  }, [PROFILE_KEY, repoId, avatarUrl, personaName, personaHandle, personaDescription, personaTags])

  // Push persona info to shared layout context
  useEffect(() => {
    if (!repoId) return
    updatePersonaInfo({
      repoId,
      versionId,
      personaName: personaName || undefined,
      imageUrl: avatarUrl,
    })
  }, [repoId, versionId, personaName, avatarUrl, updatePersonaInfo])

  function markDirty() {
    if (!isInitializedRef.current) return
    if (!isDirtyRef.current) { isDirtyRef.current = true; setIsDirty(true) }
    addPendingChangeTag('Profile')
  }

  function safeNavigate(href: string) { ctxSafeNavigate(href) }
  function safeBack()                 { ctxSafeBack() }

  const { isPublished, needsRepublish } = derivePublicationState({
    repoId,
    versionId,
    activeVersionId,
    hasUnsavedChanges: isDirty || pendingChangeTags.length > 0,
  })

  async function handleSaveVersion() {
    if (!isDirty || !repoId || !versionId) return
    setIsSaving(true)
    try {
      let imageFile: File | undefined
      if (avatarUrl?.startsWith('data:')) {
        imageFile = dataUrlToFile(avatarUrl, 'avatar.jpg')
      }
      await updateVersion({
        repoId,
        versionId,
        name:         personaName,
        prompt:       personaDescription,
        persona_tags: personaTags,
        image:        imageFile,
        imageUrl:     imageFile ? undefined : (avatarUrl ?? undefined),
      })
      isDirtyRef.current = false
      setIsDirty(false)
      setVersionTags(versionId, pendingChangeTags)
      setPendingChangeTags([])
      refreshVersions()
      setVersionsOpen(true)
      toast.success('Profile saved')
    } catch (err) {
      console.error('[ProfilePage] save error:', err)
      toast.error('Failed to save profile')
    } finally {
      setIsSaving(false)
    }
  }

  async function handlePublish() {
    if (!repoId || !versionId) return
    const wasPublished = !!activeVersionId
    setIsPublishing(true)
    try {
      // If profile data is dirty, flush it to the current version in-place before publishing.
      // This mirrors the Instructions tab behaviour: no new version is created — unsaved changes
      // are written into the existing version so nothing is lost when the user publishes directly.
      if (isDirty) {
        let imageFile: File | undefined
        if (avatarUrl?.startsWith('data:')) {
          imageFile = dataUrlToFile(avatarUrl, 'avatar.jpg')
        }
        await updateVersion({
          repoId,
          versionId,
          name:         personaName,
          prompt:       personaDescription,
          persona_tags: personaTags,
          image:        imageFile,
          imageUrl:     imageFile ? undefined : (avatarUrl ?? undefined),
        })
        isDirtyRef.current = false
        setIsDirty(false)
        setVersionTags(versionId, pendingChangeTags)
        setPendingChangeTags([])
      }
      await setActiveVersion(repoId, versionId)
      bustPersonasCache()
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(publishedVersionKey(repoId), versionId)
        try { sessionStorage.removeItem('persona_wizard_repo') } catch { /* ignore */ }
        try { localStorage.removeItem(`persona_needs_publish_${repoId}`) } catch { /* ignore */ }
        try { sessionStorage.removeItem(`persona_initial_version_${repoId}`) } catch { /* ignore */ }
      }
      markPublished(versionId)

      const base = `/agents/published?name=${encodeURIComponent(personaName)}&repoId=${repoId}&versionId=${versionId}`
      push(wasPublished ? `${base}&republished=true` : base)
    } catch (err) {
      console.error('[ProfilePage] publish error:', err)
      toast.error('Failed to publish')
    } finally {
      setIsPublishing(false)
    }
  }

  // ── Auto-save on tab switch ────────────────────────────────────────────────

  const profileAutoSaveRef = useRef<() => Promise<void>>(() => Promise.resolve())

  // On tab switch: flush text fields + tags to the API so persona cards on /agents
  // always show current tags even after a browser refresh (sessionStorage would be gone).
  // Image upload is skipped here — only done on explicit Save Version or Publish.
  profileAutoSaveRef.current = async () => {
    if (!isDirtyRef.current || !repoId || !versionId) return
    try {
      await updateVersion({
        repoId,
        versionId,
        name:         personaName,
        prompt:       personaDescription,
        persona_tags: personaTags,
        // No image / imageUrl — avoid re-downloading remote URLs or uploading data: blobs on every tab switch.
      })
      // Clear dirty only when the avatar doesn't need an upload (it's a remote URL or null).
      // If the user cropped/uploaded a new avatar, leave isDirty so Save Version stays available.
      if (!avatarUrl?.startsWith('data:')) {
        isDirtyRef.current = false
        setIsDirty(false)
      }
    } catch (err) {
      console.error('[ProfilePage] auto-save error:', err)
      // Don't block navigation on error — user can still explicitly save.
    }
  }

  useEffect(() => {
    registerAutoSave(() => profileAutoSaveRef.current())
    return () => registerAutoSave(null)
  }, [registerAutoSave])

  async function handleContinue() {
    await profileAutoSaveRef.current()
    const params = new URLSearchParams(searchParams.toString())
    push(`/agent/configure/knowledge?${params.toString()}`)
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
      {/* ── Top navigation bar ─────────────────────────────────────────────────── */}
      <div style={{ flexShrink: 0, width: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-start',
            gap: 8,
            height: 36,
            position: 'relative',
          }}
        >
          {/* Back arrow */}
          <div style={{ flexShrink: 0 }}>
            <IconButton
              variant="ghost"
              size="md"
              icon={<ArrowLeftOneIcon size={20} />}
              aria-label="Go back"
              onClick={() => safeNavigate('/agents')}
            />
          </div>

          {/* Tabs — absolutely centered so left/right items don't affect positioning */}
          <div style={anyPanelOpen ? { display: 'inline-flex', alignItems: 'flex-start', position: 'relative' } : { position: 'absolute', left: '50%', transform: 'translateX(-50%)', display: 'inline-flex', alignItems: 'flex-start' }}>
            <div
              aria-hidden
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: 10,
                backgroundColor: 'rgba(247,242,237,0.5)',
                boxShadow:
                  'inset 0px -1px 0px 0px rgba(255,255,255,0.9), inset 0px 1px 0px 0px var(--neutral-100), inset 0px 0px 4px 0px rgba(209,198,189,0.5)',
              }}
            />
            <div style={{ position: 'relative', display: 'flex', gap: 4, alignItems: 'center' }}>
              {TABS.map(tab => {
                const isActive = tab === 'Profile'
                return (
                  <button
                    key={tab}
                    onClick={() => handleTabClick(tab)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '7px 8px',
                      borderRadius: 10,
                      border: 'none',
                      cursor: TAB_ROUTES[tab] ? 'pointer' : 'default',
                      backgroundColor: isActive ? 'var(--neutral-white)' : 'transparent',
                      boxShadow: isActive
                        ? '0px 1px 1.5px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-100), inset 0px -1px 0px 0px rgba(38,33,30,0.1)'
                        : 'none',
                      fontFamily: 'var(--font-body)',
                      fontWeight: 500,
                      fontSize: 14,
                      lineHeight: '22px',
                      color: isActive ? 'var(--blue-600)' : 'var(--neutral-700)',
                      whiteSpace: 'nowrap',
                      transition: 'background-color 150ms, box-shadow 150ms, color 150ms',
                      position: 'relative',
                    }}
                  >
                    {isActive && (
                      <div
                        aria-hidden
                        style={{
                          position: 'absolute',
                          inset: 0,
                          borderRadius: 'inherit',
                          boxShadow: 'inset 0px -1px 0px 0px rgba(38,33,30,0.1)',
                          pointerEvents: 'none',
                        }}
                      />
                    )}
                    {tab}
                  </button>
                )
              })}
            </div>
          </div>



          {/* Status badges — centered below the tab bar */}
          {(!!versionId || pendingChangeTags.length > 0 || isPublished || needsRepublish) && (
            <div style={{ position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', marginTop: 6, pointerEvents: 'none', zIndex: 1, display: 'flex', gap: 4 }}>
              {(!!versionId || pendingChangeTags.length > 0) && (
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '1px 8px', borderRadius: 6, fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 11, lineHeight: '16px', whiteSpace: 'nowrap', ...(pendingChangeTags.length > 0 ? { backgroundColor: '#ffedd5', color: '#c2410c', boxShadow: '0px 0px 0px 1px rgba(194,65,12,0.2)' } : { backgroundColor: '#f5f5f4', color: '#44403c', boxShadow: '0px 0px 0px 1px rgba(68,64,60,0.2)' }) }}>
                  {pendingChangeTags.length > 0 ? 'Unsaved' : 'Saved'}
                </span>
              )}
              {(isPublished || needsRepublish) && (
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '1px 8px', borderRadius: 6, fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 11, lineHeight: '16px', whiteSpace: 'nowrap', ...(isPublished ? { backgroundColor: '#d1fae5', color: '#065f46', boxShadow: '0px 0px 0px 1px rgba(6,95,70,0.2)' } : { backgroundColor: '#fef3c7', color: '#92400e', boxShadow: '0px 1px 1.5px 0px rgba(24,15,2,0.15), 0px 0px 0px 1px rgba(146,64,14,0.3)' }) }}>
                  {isPublished ? 'Live' : 'Unpublished'}
                </span>
              )}
            </div>
          )}
        </div>

        <div style={{ height: 35, flexShrink: 0 }} />
      </div>

      {/* ── Scrollable profile form ─────────────────────────────────────────────── */}
      <div
        className="kaya-scrollbar"
        style={{
          flex: '1 0 0',
          minHeight: 0,
          overflowY: 'auto',
          overflowX: 'hidden',
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 24,
            width: '100%',
            maxWidth: 429,
            paddingTop: 3,
            paddingBottom: 32,
          }}
        >
          <ProfileTab
            avatarUrl={avatarUrl}
            onAvatarChange={v => { setAvatarUrl(v); markDirty() }}
            personaName={personaName}
            onPersonaNameChange={v => { setPersonaName(v); markDirty() }}
            personaHandle={personaHandle}
            onPersonaHandleChange={v => { setPersonaHandle(v); markDirty() }}
            personaDescription={personaDescription}
            onPersonaDescriptionChange={v => { setPersonaDescription(v); markDirty() }}
            personaTags={personaTags}
            onPersonaTagsChange={v => { setPersonaTags(v); markDirty() }}
          />
          <div style={{ height: 24, flexShrink: 0 }} />
        </div>
      </div>

      {/* ── Bottom navigation ────────────────────────────────────────────────── */}
      <div style={{ flexShrink: 0, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', padding: '12px 16px 4px', borderTop: '1px solid var(--neutral-100)' }}>
        <Button variant="default" size="sm" onClick={() => void handleContinue()}>
          Continue
        </Button>
      </div>

      {republishModalOpen && (
        <RepublishModal
          personaName={personaName || 'Persona'}
          superLinkActive={false}
          onClose={() => setRepublishModalOpen(false)}
          onDone={() => { setRepublishModalOpen(false); push('/agents') }}
        />
      )}
    </div>
  )
}

export default function PersonaConfigureProfilePage() {
  return (
    <Suspense>
      <PersonaConfigureProfileContent />
    </Suspense>
  )
}
