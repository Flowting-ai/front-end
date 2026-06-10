'use client'

import React, { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { updateVersion, setActiveVersion, bustPersonasCache, listVersions } from '@/lib/api/personas'
import {
  ArrowLeftOneIcon,
  QuillWriteOneIcon,
  ArrowUpRightOneIcon,
} from '@strange-huge/icons'
import { Button } from '@/components/Button'
import { IconButton } from '@/components/IconButton'
import ConnectorsTab from '@/app/(app)/agent/configure/components/ConnectorsTab'
import { usePersonaConfigure } from '@/app/(app)/agent/configure/context'
import { setVersionTags } from '@/lib/version-tags'

function publishedVersionKey(repoId: string) {
  return `persona_live_version_${repoId}`
}

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

  const { anyPanelOpen, updatePersonaInfo, addPendingChangeTag, pendingChangeTags, setPendingChangeTags, refreshVersions, safeNavigate, safeBack, setVersionsOpen } = usePersonaConfigure()
  const [isSaving,           setIsSaving]           = useState(false)
  const [isPublishing,       setIsPublishing]       = useState(false)
  const [publishedVersionId, setPublishedVersionId] = useState<string | null>(null)

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

  useEffect(() => {
    if (!repoId) return
    const stored = typeof window !== 'undefined' ? sessionStorage.getItem(publishedVersionKey(repoId)) : null
    setPublishedVersionId(stored)
  }, [repoId])

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
      await setActiveVersion(repoId, versionId)
      bustPersonasCache()
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(publishedVersionKey(repoId), versionId)
        try { sessionStorage.removeItem('persona_wizard_repo') } catch { /* ignore */ }
        try { localStorage.removeItem(`persona_needs_publish_${repoId}`) } catch { /* ignore */ }
      }
      setPublishedVersionId(versionId)
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

  const handleTabClick = (tab: Tab) => {
    const route = TAB_ROUTES[tab]
    if (route) safeNavigate(`${route}?${searchParams.toString()}`)
  }

  const isPublished    = !!publishedVersionId && publishedVersionId === versionId && pendingChangeTags.length === 0
  const needsRepublish = !!repoId && !!versionId && !isPublished

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
                  const isActive = tab === 'Connectors'
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
                        cursor: isActive ? 'default' : (TAB_ROUTES[tab] ? 'pointer' : 'default'),
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
              {anyPanelOpen ? (
                <IconButton
                  variant="outline"
                  size="sm"
                  icon={<QuillWriteOneIcon size={16} />}
                  aria-label="Save version"
                  onClick={handleSaveVersion}
                  disabled={pendingChangeTags.length === 0 || !repoId || !versionId || isSaving}
                  loading={isSaving}
                />
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={<QuillWriteOneIcon size={16} />}
                  onClick={handleSaveVersion}
                  disabled={pendingChangeTags.length === 0 || !repoId || !versionId || isSaving}
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
                disabled={!needsRepublish || isPublishing || pendingChangeTags.length > 0}
                loading={isPublishing}
              >
                {isPublishing ? 'Publishing…' : 'Publish'}
              </Button>
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
              onConnectorsChange={(enabled, disabled) => updatePersonaInfo({ connectorSlugs: enabled, disabledConnectorSlugs: disabled })}
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
