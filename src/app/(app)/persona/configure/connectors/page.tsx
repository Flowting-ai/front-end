'use client'

import React, { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { updateVersion, setActiveVersion, bustPersonasCache } from '@/lib/api/personas'
import {
  ArrowLeftOneIcon,
  MoreVerticalIcon,
  QuillWriteOneIcon,
  ArrowUpRightOneIcon,
} from '@strange-huge/icons'
import { Button } from '@/components/Button'
import { IconButton } from '@/components/IconButton'
import ConnectorsTab from '@/app/(app)/persona/configure/components/ConnectorsTab'
import { usePersonaConfigure } from '@/app/(app)/persona/configure/context'

function publishedVersionKey(repoId: string) {
  return `persona_live_version_${repoId}`
}

// ── Constants ─────────────────────────────────────────────────────────────────

const TABS = ['Instructions', 'Profile', 'Knowledge', 'Connectors', 'Sharing'] as const
type Tab = (typeof TABS)[number]

const TAB_ROUTES: Partial<Record<Tab, string>> = {
  Instructions: '/persona/configure/instructions',
  Profile:      '/persona/configure/profile',
  Knowledge:    '/persona/configure/knowledge',
  Sharing:      '/persona/configure/sharing',
}

// ── Main page content ─────────────────────────────────────────────────────────

function PersonaConfigureConnectorsContent() {
  const { push, back } = useRouter()
  const searchParams = useSearchParams()
  const personaName = searchParams.get('name')      ?? ''
  const repoId      = searchParams.get('repoId')    ?? ''
  const versionId   = searchParams.get('versionId') ?? ''

  const { anyPanelOpen, updatePersonaInfo } = usePersonaConfigure()
  const [isSaving,           setIsSaving]           = useState(false)
  const [isPublishing,       setIsPublishing]       = useState(false)
  const [publishedVersionId, setPublishedVersionId] = useState<string | null>(null)

  useEffect(() => {
    if (!repoId) return
    updatePersonaInfo({ repoId, versionId })
  }, [repoId, versionId, updatePersonaInfo])

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
      await setActiveVersion(repoId, versionId)
      bustPersonasCache()
      if (typeof window !== 'undefined') sessionStorage.setItem(publishedVersionKey(repoId), versionId)
      setPublishedVersionId(versionId)
      const base = `/personas/published?name=${encodeURIComponent(personaName)}&repoId=${repoId}&versionId=${versionId}`
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
    setIsSaving(true)
    try {
      await updateVersion({ repoId, versionId, name: personaName || undefined })
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
    if (route) push(`${route}?${searchParams.toString()}`)
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
                onClick={() => back()}
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
                  disabled={true}
                  loading={isSaving}
                />
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={<QuillWriteOneIcon size={16} />}
                  onClick={handleSaveVersion}
                  disabled={true}
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
                loading={isPublishing}
              >
                {isPublishing ? 'Publishing…' : publishedVersionId ? 'Republish' : 'Publish'}
              </Button>
            </div>
          </div>

          {/* Spacer below nav */}
          <div style={{ height: 32, flexShrink: 0 }} />
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
              paddingBottom: 32,
            }}
          >
            <ConnectorsTab repoId={repoId || undefined} versionId={versionId || undefined} />
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
