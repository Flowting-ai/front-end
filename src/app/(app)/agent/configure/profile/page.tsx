'use client'

import React, { useState, useRef, Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  ArrowLeftOneIcon,
  QuillWriteOneIcon,
  ArrowUpRightOneIcon,
} from '@strange-huge/icons'
import { Button } from '@/components/Button'
import { IconButton } from '@/components/IconButton'
import { Badge } from '@/components/Badge'
import { toast } from 'sonner'
import ProfileTab from '@/app/(app)/agent/configure/components/ProfileTab'
import { fetchPersonaRepo } from '@/lib/api/persona-repo'
import {
  updateVersion, publishPersonaVersion,
  bustPersonasCache,
} from '@/lib/api/personas'
import { usePersonaConfigure, type ConfigureTabKey } from '@/app/(app)/agent/configure/context'
import { setVersionTags } from '@/lib/version-tags'
import { derivePublicationState } from '@/lib/persona-version-logic'
import { personaTagsKey, personaProfileKey } from '@/lib/storage-keys'
import { AGENTS_ROUTE } from '@/lib/routes'
import { AttributeTocRail, type AttributeTocItem } from '@/app/(app)/agent/configure/components/AttributeTrackerRail'
import { ConfigureFormSkeleton } from '@/app/(app)/agent/configure/components/ConfigureFormSkeleton'

const PROFILE_TOC_ITEMS: AttributeTocItem[] = [
  { id: 'avatar',      label: 'Avatar',      anchor: 'help-profile-avatar' },
  { id: 'name',        label: 'Name',        anchor: 'help-profile-name' },
  { id: 'description', label: 'Description', anchor: 'help-profile-description' },
  { id: 'tags',        label: 'Tags',        anchor: 'help-profile-tags' },
]

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
  const PROFILE_KEY = personaProfileKey(repoId)

  // Helper: read saved draft (runs synchronously — client only)
  function loadDraft() {
    if (typeof window === 'undefined') return null
    try { return JSON.parse(sessionStorage.getItem(PROFILE_KEY) ?? 'null') as Record<string, unknown> | null }
    catch { return null }
  }

  const { anyPanelOpen, updatePersonaInfo, personaInfo, addPendingChangeTag, pendingChangeTags, setPendingChangeTags, refreshVersions, safeNavigate: ctxSafeNavigate, safeBack: ctxSafeBack, registerAutoSave, setVersionsOpen, publishedVersionId, markPublished, tabDirtyFlags, setTabDirty, changesTrackerOpen, touchedFieldsByTab, markFieldTouched, resetTouchedFields, visitedTabs } = usePersonaConfigure()
  const profileTouchedFields = touchedFieldsByTab.profile

  const [isSaving,             setIsSaving]             = useState(false)
  const [isPublishing,         setIsPublishing]         = useState(false)
  const [isDirty,              setIsDirty]              = useState(false)
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

    fetchPersonaRepo(repoId)
      .then(repo => {
        const v = repo.workingVersion
        // Always refresh avatar — draft may have been set from text fields only, leaving avatar null
        if (v?.imageUrl && !avatarUrl) setAvatarUrl(v.imageUrl)
        // Always set handle from API when not already in the draft — even when hasMeaningfulDraft
        // is true (wizard data exists), the handle is generated server-side and won't be in the draft.
        if (v?.handle && !personaHandle) setPersonaHandle(v.handle)
        // Always load tags from API when the local state is empty (edit flow / no wizard draft).
        if (v?.tags.length && !personaTags.length) setPersonaTags(v.tags)
        if (!hasMeaningfulDraft) {
          // No meaningful draft — overwrite all fields with real API data
          setPersonaName(repo.name || 'Agent Name')
          if (v?.imageUrl) setAvatarUrl(v.imageUrl)
          setPersonaDescription(v?.description ?? '')
        }
        // Clear one-shot wizard key so stale data doesn't bleed into the next wizard run.
        try { sessionStorage.removeItem('persona_wizard_starter') } catch { /* ignore */ }
        // If local has tags (from wizard starter / sessionStorage) but backend has none,
        // flag for dirty-marking after init so auto-save will PATCH them on next navigation.
        const apiTags = v?.tags ?? []
        if (localTagsAtMount.length > 0 && apiTags.length === 0) {
          shouldMarkDirtyForTags = true
        }
      })
      .catch(err => console.error('[ProfilePage] API load error:', err))
      .finally(() => {
        isInitializedRef.current = true
        setIsInitialized(true)
        // Reconcile wizard-seeded tags that never made it to the backend silently —
        // this is a background sync the app is doing on the user's behalf, not an
        // edit they made, so it must never flip the tab to "unsaved changes."
        if (shouldMarkDirtyForTags && versionId) {
          updateVersion({ repoId, versionId, persona_tags: localTagsAtMount }).catch(() => {})
        }
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
          localStorage.setItem(personaTagsKey(repoId), JSON.stringify(personaTags))
        } else {
          localStorage.removeItem(personaTagsKey(repoId))
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
    publishedVersionId,
    hasUnsavedChanges: isDirty || pendingChangeTags.length > 0,
  })

  const anyDirty     = pendingChangeTags.length > 0 || TABS.some(tab => tabDirtyFlags[tab] === true)

  async function handleSaveVersion() {
    if (!repoId || !versionId) return
    setIsSaving(true)
    try {
      let imageFile: File | undefined
      if (avatarUrl?.startsWith('data:')) {
        imageFile = dataUrlToFile(avatarUrl, 'avatar.jpg')
      }
      const version = await updateVersion({
        repoId,
        versionId,
        name:         personaName,
        description:  personaDescription,
        persona_tags: personaTags,
        image:        imageFile,
        imageUrl:     imageFile ? undefined : (avatarUrl ?? undefined),
      })
      // Swap the local data: URL for the persisted remote URL — otherwise the
      // next save would re-upload the same image again (still starts with 'data:').
      if (version.image_url) setAvatarUrl(version.image_url)
      isDirtyRef.current = false
      setIsDirty(false)
      resetTouchedFields('profile')
      setVersionTags(versionId, pendingChangeTags)
      setPendingChangeTags([])
      bustPersonasCache()
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
    const wasPublished = !!publishedVersionId
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
        const version = await updateVersion({
          repoId,
          versionId,
          name:         personaName,
          description:  personaDescription,
          persona_tags: personaTags,
          image:        imageFile,
          imageUrl:     imageFile ? undefined : (avatarUrl ?? undefined),
        })
        if (version.image_url) setAvatarUrl(version.image_url)
        isDirtyRef.current = false
        setIsDirty(false)
        resetTouchedFields('profile')
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
        description:  personaDescription,
        persona_tags: personaTags,
        // No image / imageUrl — avoid re-downloading remote URLs or uploading data: blobs on every tab switch.
      })
      // Was missing — the tab's traffic light stayed stuck on "Unsaved" forever
      // after any edit + tab switch, even though this autosave just persisted it.
      isDirtyRef.current = false
      setIsDirty(false)
      toast.success('Changes autosaved')
    } catch (err) {
      console.error('[ProfilePage] auto-save error:', err)
      toast.error('Failed to autosave changes')
    }
  }

  useEffect(() => {
    registerAutoSave(() => profileAutoSaveRef.current())
    return () => registerAutoSave(null)
  }, [registerAutoSave])

  // Sync dirty state to context for traffic light
  useEffect(() => { setTabDirty('Profile', isDirty) }, [isDirty, setTabDirty])

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
      {/* ── Top navigation bar ─────────────────────────────────────────────────── */}
      <div style={{ flexShrink: 0, width: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            height: 36,
            position: 'relative',
          }}
        >
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
          <div style={{ flex: '0 0 auto', display: 'inline-flex', alignItems: 'flex-start', position: 'relative', marginTop: 2 }}>
            {/* Frosted glass — only covers the tab button row, not the traffic lights */}
            <div
              aria-hidden
              style={{
                position: 'absolute',
                top: 0, left: 0, right: 0,
                height: 36,
                borderRadius: 10,
                backgroundColor: 'rgba(247,242,237,0.5)',
                boxShadow:
                  'inset 0px -1px 0px 0px rgba(255,255,255,0.9), inset 0px 1px 0px 0px var(--neutral-100), inset 0px 0px 4px 0px rgba(209,198,189,0.5)',
              }}
            />
            <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', gap: 4 }}>
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
                      padding: '9px 10px',
                      // Fixed width (fits "Instructions", the longest label) so
                      // all 5 tabs render the same size — same value across all
                      // 5 configure pages (Instructions/Profile/Knowledge/
                      // Connectors/Sharing), which each duplicate this tab bar.
                      width: 132,
                      borderRadius: 10,
                      border: 'none',
                      cursor: TAB_ROUTES[tab] ? 'pointer' : 'default',
                      backgroundColor: isActive ? 'var(--neutral-white)' : 'transparent',
                      // Two-sided inner shadow (soft top highlight + a slightly
                      // stronger, blurred bottom shadow) reads as a proper
                      // pressed-in inset instead of a single flat line — was
                      // previously also duplicated by a separate overlay div
                      // painting the same bottom line on top of this.
                      boxShadow: isActive
                        ? '0px 1px 1.5px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-100), inset 0px -1px 1.5px 0px rgba(38,33,30,0.16), inset 0px 1px 0px 0px rgba(255,255,255,0.7)'
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
                    {tab}
                  </button>
                )
              })}
            </div>
            {/* Visited-tab dots — one per tab, filled once you've landed on that
                tab this editing session (auto-tracked by the provider from the
                route), cleared entirely on publish. Simple visited/not-visited,
                unrelated to the dirty-tracking that used to live here. */}
            <div style={{ display: 'flex', gap: 4 }}>
              {TABS.map(tab => (
                <div key={`${tab}-dot`} style={{ width: 132, display: 'flex', justifyContent: 'center' }}>
                  <span
                    aria-hidden
                    style={{
                      width: 7, height: 7, borderRadius: '50%', boxSizing: 'border-box',
                      backgroundColor: visitedTabs[tab.toLowerCase() as ConfigureTabKey] ? '#27AE60' : 'var(--neutral-200)',
                      border: visitedTabs[tab.toLowerCase() as ConfigureTabKey] ? '1px solid #1E8449' : '1px solid var(--neutral-300)',
                      transition: 'background-color 200ms, border-color 200ms',
                    }}
                  />
                </div>
              ))}
            </div>
              {/* Hidden for now — Saved/Unsaved + Live/Unpublished status badges under the tab strip. */}
              {false && (anyDirty || publishedVersionId != null || (!!repoId && !!versionId)) && (
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
                onClick={() => void handleSaveVersion()}
                loading={isSaving}
                disabled={!repoId || !versionId || isSaving}
              />
            ) : (
              <Button
                variant="outline"
                size="sm"
                leftIcon={<QuillWriteOneIcon size={16} />}
                onClick={() => void handleSaveVersion()}
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
        items={PROFILE_TOC_ITEMS}
        touchedFields={profileTouchedFields}
        open={changesTrackerOpen && !anyPanelOpen}
      />

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
          {!isInitialized ? (
            <ConfigureFormSkeleton rows={4} />
          ) : (
            <>
              <ProfileTab
                avatarUrl={avatarUrl}
                onAvatarChange={v => { setAvatarUrl(v); markDirty(); markFieldTouched('profile', 'avatar') }}
                personaName={personaName}
                onPersonaNameChange={v => { setPersonaName(v); markDirty(); markFieldTouched('profile', 'name') }}
                personaHandle={personaHandle}
                onPersonaHandleChange={v => { setPersonaHandle(v); markDirty() }}
                personaDescription={personaDescription}
                onPersonaDescriptionChange={v => { setPersonaDescription(v); markDirty(); markFieldTouched('profile', 'description') }}
                personaTags={personaTags}
                onPersonaTagsChange={v => { setPersonaTags(v); markDirty(); markFieldTouched('profile', 'tags') }}
              />
              <div style={{ height: 24, flexShrink: 0 }} />
            </>
          )}
        </div>
      </div>

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
