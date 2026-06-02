'use client'

import React, { useState, useRef, Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  ArrowLeftOneIcon,
  MoreVerticalIcon,
  QuillWriteOneIcon,
  ArrowUpRightOneIcon,
} from '@strange-huge/icons'
import { Button } from '@/components/Button'
import { IconButton } from '@/components/IconButton'
import { toast } from 'sonner'
import ProfileTab from '@/app/(app)/persona/configure/components/ProfileTab'
import RepublishModal from '@/app/(app)/persona/configure/components/RepublishModal'
import { DEFAULT_LANGUAGE } from '@/app/(app)/personas/new/constants'
import {
  getPersonaRepo, updateVersion, setActiveVersion,
  getVersion,
  bustPersonasCache,
} from '@/lib/api/personas'
import { usePersonaConfigure } from '@/app/(app)/persona/configure/context'

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
  Instructions: '/persona/configure/instructions',
  Knowledge:    '/persona/configure/knowledge',
  Connectors:   '/persona/configure/connectors',
  Sharing:      '/persona/configure/sharing',
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

  const [currentPrompt,      setCurrentPrompt]      = useState('')
  const { anyPanelOpen, updatePersonaInfo } = usePersonaConfigure()

  const [isSaving,             setIsSaving]             = useState(false)
  const [isPublishing,         setIsPublishing]         = useState(false)
  const [isDirty,              setIsDirty]              = useState(false)
  const [republishModalOpen,   setRepublishModalOpen]   = useState(false)
  const [publishedVersionId,   setPublishedVersionId]   = useState<string | null>(null)
  const isDirtyRef = useRef(false)

  useEffect(() => {
    if (!repoId) return
    const stored = typeof window !== 'undefined' ? sessionStorage.getItem(publishedVersionKey(repoId)) : null
    setPublishedVersionId(stored)
  }, [repoId])

  // ProfileTab state — initialise from sessionStorage on first render
  const [avatarUrl,          setAvatarUrl]          = useState<string | null>(() => { const d = loadDraft(); return (d?.avatarUrl as string | null) ?? null })
  const [personaName,        setPersonaName]        = useState<string>(() => { const d = loadDraft(); return (d?.personaName as string) || nameParam || 'Persona Name' })
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
  const [personaTags,        setPersonaTags]        = useState<string[]>(() => { const d = loadDraft(); return (d?.personaTags as string[]) ?? ['Internal', 'Legal'] })
  const [isMultilingual,     setIsMultilingual]     = useState<boolean>(() => { const d = loadDraft(); return (d?.isMultilingual as boolean) ?? false })
  const [selectedLanguages,  setSelectedLanguages]  = useState<Set<string>>(() => {
    const d = loadDraft()
    const arr = d?.selectedLanguages as string[] | undefined
    return arr ? new Set(arr) : new Set([DEFAULT_LANGUAGE])
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

    // Wizard purpose has been consumed into state — clean up the one-shot key
    try { sessionStorage.removeItem(`persona_wizard_purpose_${repoId}`) } catch { /* ignore */ }

    // If the user already has meaningful profile data saved, skip overwriting text fields
    // but ALWAYS load the avatar from the API so it shows in the test chat panel.
    const draft = loadDraft()
    const hasMeaningfulDraft = !!draft && (
      !!(draft.personaHandle as string | undefined) ||
      !!(draft.personaDescription as string | undefined) ||
      ((draft.personaName as string | undefined) ?? 'Persona Name') !== 'Persona Name'
    )

    getPersonaRepo(repoId)
      .then(repo => {
        const v = repo.active_version
        // Always refresh avatar — draft may have been set from text fields only, leaving avatar null
        if (v?.image_url && !avatarUrl) setAvatarUrl(v.image_url)
        if (hasMeaningfulDraft) {
          // Text fields are already correct from the draft — just finish initializing
          isInitializedRef.current = true; setIsInitialized(true); return
        }
        // No meaningful draft — overwrite all fields with real API data
        setPersonaName(repo.name || 'Persona Name')
        if (v?.handler)   setPersonaHandle(`@${v.handler}`)
        if (v?.image_url) setAvatarUrl(v.image_url)
        // Use the prompt as description only if it's short enough — on a brand-new
        // persona the prompt is just the one-sentence wizard purpose.
        if (v?.prompt && v.prompt.trim().length <= 120) {
          setPersonaDescription(v.prompt.trim())
        }
      })
      .catch(err => console.error('[ProfilePage] API load error:', err))
      .finally(() => { isInitializedRef.current = true; setIsInitialized(true) })
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
        isMultilingual,
        selectedLanguages: [...selectedLanguages],
      }))
    } catch { /* storage quota exceeded — ignore */ }
  }, [PROFILE_KEY, avatarUrl, personaName, personaHandle, personaDescription, personaTags, isMultilingual, selectedLanguages])

  useEffect(() => {
    if (!repoId || !versionId) return
    getVersion(repoId, versionId)
      .then(v => {
        setCurrentPrompt(v.prompt ?? '')
      })
      .catch(() => {})
  }, [repoId, versionId])

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

  useEffect(() => {
    if (currentPrompt) updatePersonaInfo({ guidePrompt: currentPrompt })
  }, [currentPrompt, updatePersonaInfo])

  function markDirty() {
    if (!isInitializedRef.current) return
    if (!isDirtyRef.current) { isDirtyRef.current = true; setIsDirty(true) }
  }

  function safeNavigate(href: string) {
    if (isDirty && !window.confirm('You have unsaved profile changes. Leave without saving?')) return
    push(href)
  }
  function safeBack() {
    if (isDirty && !window.confirm('You have unsaved profile changes. Leave without saving?')) return
    back()
  }

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
        name:     personaName,
        prompt:   personaDescription,
        image:    imageFile,
        imageUrl: imageFile ? undefined : (avatarUrl ?? undefined),
      })
      isDirtyRef.current = false
      setIsDirty(false)
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
    const storedLiveId = typeof window !== 'undefined' ? sessionStorage.getItem(publishedVersionKey(repoId)) : null
    const wasPublished = !!storedLiveId
    setIsPublishing(true)
    try {
      let imageFile: File | undefined
      if (avatarUrl?.startsWith('data:')) {
        imageFile = dataUrlToFile(avatarUrl, 'avatar.jpg')
      }
      if (isDirty || imageFile || avatarUrl) {
        await updateVersion({
          repoId,
          versionId,
          name:     personaName,
          prompt:   personaDescription,
          image:    imageFile,
          imageUrl: imageFile ? undefined : (avatarUrl ?? undefined),
        })
        isDirtyRef.current = false
        setIsDirty(false)
      }
      await setActiveVersion(repoId, versionId)
      bustPersonasCache()
      if (typeof window !== 'undefined') sessionStorage.setItem(publishedVersionKey(repoId), versionId)
      setPublishedVersionId(versionId)

      const base = `/personas/published?name=${encodeURIComponent(personaName)}&repoId=${repoId}&versionId=${versionId}`
      push(wasPublished ? `${base}&republished=true` : base)
    } catch (err) {
      console.error('[ProfilePage] publish error:', err)
      toast.error('Failed to publish')
    } finally {
      setIsPublishing(false)
    }
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
            justifyContent: anyPanelOpen ? 'flex-start' : 'space-between',
            gap: anyPanelOpen ? 8 : 0,
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
              onClick={safeBack}
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
                      cursor: TAB_ROUTES[tab] || !isActive ? 'pointer' : 'default',
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

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0, marginLeft: anyPanelOpen ? 'auto' : undefined }}>
            <IconButton
              variant="outline"
              size="md"
              icon={<MoreVerticalIcon size={20} />}
              aria-label="More options"
            />
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
              {isPublishing ? 'Publishing…' : publishedVersionId ? 'Republish' : 'Publish'}
            </Button>
          </div>
        </div>

        <div style={{ height: 32, flexShrink: 0 }} />
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
            isMultilingual={isMultilingual}
            onIsMultilingualChange={v => { setIsMultilingual(v); markDirty() }}
            selectedLanguages={selectedLanguages}
            onSelectedLanguagesChange={v => { setSelectedLanguages(v); markDirty() }}
          />
          <div style={{ height: 24, flexShrink: 0 }} />
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

export default function PersonaConfigureProfilePage() {
  return (
    <Suspense>
      <PersonaConfigureProfileContent />
    </Suspense>
  )
}
