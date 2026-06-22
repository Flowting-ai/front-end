'use client'

import React, { useState, useEffect, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { updateVersion, publishPersonaVersion, bustPersonasCache, listVersions } from '@/lib/api/personas'
import {
  ArrowLeftOneIcon,
  QuillWriteOneIcon,
  ArrowUpRightOneIcon,
} from '@strange-huge/icons'
import { Button } from '@/components/Button'
import { IconButton } from '@/components/IconButton'
import { Badge } from '@/components/Badge'
import ConnectorsTab from '@/app/(app)/agent/configure/components/ConnectorsTab'
import { usePersonaConfigure } from '@/app/(app)/agent/configure/context'
import { setVersionTags } from '@/lib/version-tags'
import { derivePublicationState } from '@/lib/persona-version-logic'

// ── Constants ─────────────────────────────────────────────────────────────────

const TABS = ['Instructions', 'Profile', 'Knowledge', 'Connectors', 'Sharing'] as const
type Tab = (typeof TABS)[number]

const TAB_ROUTES: Partial<Record<Tab, string>> = {
  Instructions: '/agent/configure/instructions',
  Profile:      '/agent/configure/profile',
  Knowledge:    '/agent/configure/knowledge',
  Sharing:      '/agent/configure/sharing',
}

// ── Main page content ─────────────────────────────────────────────────────────

function PersonaConfigureConnectorsContent() {
  const { push } = useRouter()
  const searchParams = useSearchParams()
  const personaName = searchParams.get('name')      ?? ''
  const repoId      = searchParams.get('repoId')    ?? ''
  const versionIdParam = searchParams.get('versionId') ?? ''
  const [versionId, setVersionId] = useState(versionIdParam)

  const { anyPanelOpen, updatePersonaInfo, addPendingChangeTag, pendingChangeTags, setPendingChangeTags, refreshVersions, safeNavigate, safeBack, setVersionsOpen, publishedVersionId, markPublished, registerAutoSave, tabDirtyFlags, setTabDirty } = usePersonaConfigure()
  const [isSaving,           setIsSaving]           = useState(false)
  const [showInfo,           setShowInfo]           = useState(false)
  const [isPublishing,       setIsPublishing]       = useState(false)

  // Resolve versionId from URL; if absent, load the latest saved version.
  useEffect(() => {
    if (!repoId) return
    if (versionIdParam) {
      updatePersonaInfo({ repoId, versionId: versionIdParam })
      return
    }
    listVersions(repoId).then(list => {
      const sorted = list.slice().sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      )
      const latest = sorted[0]
      if (latest) {
        setVersionId(latest.id)
        window.history.replaceState(null, '', `?repoId=${repoId}&name=${encodeURIComponent(personaName)}&versionId=${latest.id}`)
        updatePersonaInfo({ repoId, versionId: latest.id })
      } else {
        updatePersonaInfo({ repoId, versionId: '' })
      }
    }).catch(() => updatePersonaInfo({ repoId, versionId: '' }))
  }, [repoId, versionIdParam, personaName, updatePersonaInfo])

  async function handlePublish() {
    if (!repoId || !versionId) return
    const wasPublished = !!publishedVersionId
    setIsPublishing(true)
    try {
      // Connector toggles are saved immediately to the API — no dirty data to flush.
      // Stamp any accumulated change tags onto the version before going live.
      if (pendingChangeTags.length > 0) {
        await updateVersion({ repoId, versionId, name: personaName || undefined })
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
      console.error('[ConnectorsPage] publish error:', err)
      toast.error('Failed to publish')
    } finally {
      setIsPublishing(false)
    }
  }

  async function handleSaveVersion() {
    if (!repoId || !versionId) return
    addPendingChangeTag('Connectors')
    setIsSaving(true)
    try {
      await updateVersion({ repoId, versionId, name: personaName || undefined })
      setVersionTags(versionId, [...pendingChangeTags, 'Connectors'].filter((v, i, a) => a.indexOf(v) === i))
      setPendingChangeTags([])
      refreshVersions()
      setVersionsOpen(true)
      toast.success('Version saved')
    } catch (err) {
      console.error('[ConnectorsPage] save error:', err)
      toast.error('Failed to save version')
    } finally {
      setIsSaving(false)
    }
  }

  // ── Auto-save on tab switch ────────────────────────────────────────────────

  const connectorsAutoSaveRef = useRef<() => Promise<void>>(() => Promise.resolve())
  connectorsAutoSaveRef.current = async () => {
    const hasDirty = pendingChangeTags.length > 0 || tabDirtyFlags['Connectors'] === true
    if (!hasDirty || !repoId || !versionId) return
    try {
      await updateVersion({ repoId, versionId, name: personaName || undefined })
      setTabDirty('Connectors', false)
      toast.success('Changes autosaved')
    } catch (err) {
      console.error('[ConnectorsPage] auto-save error:', err)
    }
  }

  useEffect(() => {
    registerAutoSave(() => connectorsAutoSaveRef.current())
    return () => registerAutoSave(null)
  }, [registerAutoSave])

  const handleTabClick = (tab: Tab) => {
    const route = TAB_ROUTES[tab]
    if (route) safeNavigate(`${route}?${searchParams.toString()}`)
  }

  const { isPublished, needsRepublish } = derivePublicationState({
    repoId,
    versionId,
    publishedVersionId,
    hasUnsavedChanges: pendingChangeTags.length > 0,
  })

  const anyDirty     = pendingChangeTags.length > 0 || TABS.some(tab => tabDirtyFlags[tab] === true)

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
                  const isActive = tab === 'Connectors'
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

          {/* Spacer below nav */}
          <div style={{ height: 35, flexShrink: 0 }} />
        </div>

        {/* ── Scrollable content area ────────────────────────────────────────── */}
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
              maxWidth: 714,
              paddingTop: 3,
              paddingBottom: 32,
            }}
          >
            <ConnectorsTab
              repoId={repoId || undefined}
              versionId={versionId || undefined}
              personaName={personaName || undefined}
              onConnectorsChange={(enabled, disabled) => {
                updatePersonaInfo({ connectorSlugs: enabled, disabledConnectorSlugs: disabled })
                addPendingChangeTag('Connectors')
                setTabDirty('Connectors', true)
              }}
              onSaveVersion={handleSaveVersion}
            />
          </div>
        </div>

      </div>
  )
}

// ── Page export ───────────────────────────────────────────────────────────────

export default function PersonaConfigureConnectorsPage() {
  return (
    <Suspense>
      <PersonaConfigureConnectorsContent />
    </Suspense>
  )
}
