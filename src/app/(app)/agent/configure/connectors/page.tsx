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
import { usePersonaConfigure, type ConfigureTabKey } from '@/app/(app)/agent/configure/context'
import { setVersionTags } from '@/lib/version-tags'
import { derivePublicationState } from '@/lib/persona-version-logic'
import { AttributeTocRail, type AttributeTocItem } from '@/app/(app)/agent/configure/components/AttributeTrackerRail'

// Toggling any connector (workspace or personal) marks the same shared
// 'connectors' field touched — no per-connector or per-section granularity
// is tracked, so this is a single row rather than one per section.
const CONNECTORS_TOC_ITEMS: AttributeTocItem[] = [
  { id: 'connectors', label: 'Connectors', anchor: 'help-connectors-workspace' },
]

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

  const { anyPanelOpen, updatePersonaInfo, addPendingChangeTag, pendingChangeTags, setPendingChangeTags, refreshVersions, safeNavigate, safeBack, setVersionsOpen, publishedVersionId, markPublished, registerAutoSave, tabDirtyFlags, setTabDirty, changesTrackerOpen, touchedFieldsByTab, visitedTabs } = usePersonaConfigure()
  const connectorsTouchedFields = touchedFieldsByTab.connectors
  const [isSaving,           setIsSaving]           = useState(false)
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
      toast.error('Failed to autosave changes')
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
            <div style={{ flex: '0 0 auto', display: 'inline-flex', alignItems: 'flex-start', position: 'relative', marginTop: 2 }}>
              {/* Frosted glass — only covers the tab button row, not the traffic lights */}
              <div
                aria-hidden
                style={{
                  position: 'absolute', top: 0, left: 0, right: 0, height: 36, borderRadius: 10,
                  backgroundColor: 'rgba(247,242,237,0.5)',
                  boxShadow: 'inset 0px -1px 0px 0px rgba(255,255,255,0.9), inset 0px 1px 0px 0px var(--neutral-100), inset 0px 0px 4px 0px rgba(209,198,189,0.5)',
                }}
              />
              <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', gap: 4 }}>
                {TABS.map(tab => {
                  const isActive = tab === 'Connectors'
                  return (
                    <button
                      key={tab}
                      onClick={() => handleTabClick(tab)}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        // Fixed width (fits "Instructions", the longest label) so
                        // all 5 tabs render the same size — same value across all
                        // 5 configure pages (Instructions/Profile/Knowledge/
                        // Connectors/Sharing), which each duplicate this tab bar.
                        padding: '9px 10px', width: 132, borderRadius: 10, border: 'none',
                        cursor: TAB_ROUTES[tab] ? 'pointer' : 'default',
                        backgroundColor: isActive ? 'var(--neutral-white)' : 'transparent',
                        // Two-sided inner shadow (soft top highlight + a slightly
                        // stronger, blurred bottom shadow) instead of a single
                        // flat line — was previously also duplicated by a
                        // separate overlay div painting the same line on top.
                        boxShadow: isActive ? '0px 1px 1.5px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-100), inset 0px -1px 1.5px 0px rgba(38,33,30,0.16), inset 0px 1px 0px 0px rgba(255,255,255,0.7)' : 'none',
                        fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, lineHeight: '22px',
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

        <AttributeTocRail
          items={CONNECTORS_TOC_ITEMS}
          touchedFields={connectorsTouchedFields}
          open={changesTrackerOpen && !anyPanelOpen}
        />

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
              onConnectorsChange={(enabled, disabled, isInitial) => {
                updatePersonaInfo({ connectorSlugs: enabled, disabledConnectorSlugs: disabled })
                // The initial report right after load is hydration, not a user edit —
                // marking dirty here would flip the tab orange just from visiting it.
                if (isInitial) return
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
