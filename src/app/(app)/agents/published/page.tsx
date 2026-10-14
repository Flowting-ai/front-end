'use client'
// published persona confirmation page
import React, { useState, useEffect, Suspense } from 'react'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeftOneIcon, BubbleChatAddIcon, ShareOneIcon } from '@strange-huge/icons'
import { Button } from '@/components/ui/button'
import { fetchPersonaRepo, type PersonaRepo } from '@/lib/api/persona-repo'
import { useQuery } from '@tanstack/react-query'
import { activeLinkFor, personaSharesQuery } from '@/lib/share/share-queries'
import { ShareAgentPanel } from '@/components/ShareAgentPanel'
import { AGENTS_ROUTE, CHAT_ROUTE } from '@/lib/routes'
import { emitSidebarNewChat } from '@/hooks/use-sidebar-events'
import type { SelectedPersonaInfo } from '@/lib/chat-personas'
import { PENDING_PERSONA_KEY } from '@/lib/storage-keys'

const AgentShareModal = dynamic(() => import('@/components/AgentShareModal').then(m => m.AgentShareModal), { ssr: false })

// ── Helpers ───────────────────────────────────────────────────────────────────

function toHandle(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}

// ── Token usage bar ───────────────────────────────────────────────────────────

// ── Page content ──────────────────────────────────────────────────────────────

function PersonaPublishedContent() {
  const { push } = useRouter()
  const searchParams = useSearchParams()
  const nameParam     = searchParams.get('name') || ''
  const repoId        = searchParams.get('repoId')     ?? ''
  const isRepublished = searchParams.get('republished') === 'true'


  const [personaName,    setPersonaName]    = useState(nameParam || 'Your Agent')
  const [shareModalOpen, setShareModalOpen] = useState(false)
  const [personaImageUrl, setPersonaImageUrl] = useState<string | null>(null)
  // Kept in full (not just name/imageUrl) so "Use this Agent" can build a
  // complete SelectedPersonaInfo without a second fetch.
  const [personaRepo,    setPersonaRepo]    = useState<PersonaRepo | null>(null)

  // Fetch the persona's avatar and authoritative name from the API.
  useEffect(() => {
    if (!repoId) return
    fetchPersonaRepo(repoId)
      .then(repo => {
        setPersonaImageUrl(repo.workingVersion?.imageUrl ?? null)
        if (repo.name) setPersonaName(repo.name)
        setPersonaRepo(repo)
      })
      .catch(() => {})
  }, [repoId])

  // The existing link share — shares are repo-scoped, not frozen to a version,
  // so this matches on persona_repo_id. The shared query updates when the share
  // modal (or the buttons below) change anything.
  const sharesQ = useQuery(personaSharesQuery(!!repoId))
  const linkShare = repoId ? activeLinkFor(sharesQ.data, repoId) : null

  // "Use this Agent" opens a fresh /chat with the agent pre-attached to the
  // input (not sent, not the agent's own dedicated /agents/[id]/chat page).
  // /chat isn't mounted yet when this fires, so the persona is handed across
  // via sessionStorage (read synchronously in a lazy initializer on /chat, the
  // same mechanism project/[id]/chat/[chatId]/page.tsx already uses for its
  // own pending-persona key) rather than the AGENT_SELECT_EVENT used when the
  // Agents floating panel is opened from a page that's already mounted.
  function handleUseAgent() {
    if (!personaRepo) return
    const v = personaRepo.currentVersion
    const info: SelectedPersonaInfo = {
      id:              personaRepo.id,
      name:            personaRepo.name,
      handle:          personaRepo.handle,
      imageUrl:        personaRepo.imageUrl,
      modelId:         v?.modelId ?? null,
      activeVersionId: personaRepo.liveVersionId,
      systemPrompt:    null,
      temperature:     v?.temperature ?? null,
      visibility:      personaRepo.visibility,
      ownedByViewer:   true,
      description:     personaRepo.description,
      tags:            personaRepo.tags,
      paused:          personaRepo.isPaused,
      shared:          false,
    }
    sessionStorage.setItem(PENDING_PERSONA_KEY, JSON.stringify(info))
    // /chat may already be mounted from an earlier visit — a plain push() to
    // the same route won't remount it, so the pending-persona sessionStorage
    // read (a mount-time-only lazy initializer) never fires and the chip
    // silently never appears. Force the same reset the sidebar's own
    // "New chat" button uses (same fix applied to agents/page.tsx's
    // "Chat with agent" actions).
    emitSidebarNewChat()
    push(CHAT_ROUTE)
  }

  return (
    <div
      style={{
        backgroundColor: 'var(--neutral-50)',
        display: 'flex',
        flexDirection: 'column',
        flex: '1 0 0',
        minHeight: 0,
        position: 'relative',
      }}
    >
      {/* Inner card */}
      <div
        style={{
          backgroundColor: 'var(--color-surface-container)',
          border: '1px solid var(--border-default)',
          borderRadius: 22,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          flex: '1 0 0',
          minHeight: 0,
          overflow: 'hidden',
          paddingBottom: 12,
          paddingTop: 10,
          paddingLeft: 12,
          paddingRight: 12,
          alignItems: 'center',
        }}
      >
        {/* ── Scrollable content ────────────────────────────────────────────── */}
        <div
          className="kaya-scrollbar"
          style={{
            flex: '1 0 0',
            minHeight: 0,
            overflowY: 'auto',
            overflowX: 'hidden',
            display: 'flex',
            justifyContent: 'center',
            width: '100%',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 76,
              position: 'relative',
              paddingBottom: 48,
            }}
          >
            {/* Radial gradient blob */}
            <div
              aria-hidden
              style={{
                position: 'absolute',
                top: 0,
                left: '50%',
                transform: 'translate(-50%, 0)',
                width: 716,
                height: 586,
                borderRadius: 28,
                filter: 'blur(108px)',
                mixBlendMode: 'hard-light',
                background:
                  'radial-gradient(ellipse at 50% 26%, color-mix(in srgb, var(--red-200) 21%, transparent) 14.4%, color-mix(in srgb, var(--brown-400) 45%, transparent) 38%, color-mix(in srgb, var(--neutral-500) 70%, transparent) 61.5%, color-mix(in srgb, var(--neutral-500) 70%, transparent) 100%)',
                pointerEvents: 'none',
                zIndex: 0,
              }}
            />

            {/* Title container */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 32,
                alignItems: 'center',
                width: 291,
                position: 'relative',
                zIndex: 1,
                paddingTop: 20,
              }}
            >
              {/* Persona image */}
              <div
                style={{
                  position: 'relative',
                  width: 152,
                  height: 152,
                  borderRadius: 32,
                  flexShrink: 0,
                  overflow: 'hidden',
                  boxShadow:
                    '0px 1.091px 1.09px 0px rgba(59,54,50,0.05), 0px 1.455px 1px 0px rgba(38,33,30,0.15), 0px 0px 0px 5px var(--neutral-100)',
                  backgroundColor: 'var(--neutral-100)',
                }}
              >
                <Image
                  src={personaImageUrl ?? '/icons/persona-image.svg'}
                  alt={personaName}
                  fill
                  sizes="152px"
                  unoptimized
                  style={{ objectFit: 'cover' }}
                />
              </div>

              {/* Title + description */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center', width: '100%' }}>
                <p
                  style={{
                    fontFamily: 'var(--font-title)',
                    fontWeight: 400,
                    fontSize: 40,
                    lineHeight: '48px',
                    color: 'var(--neutral-900)',
                    margin: 0,
                    textAlign: 'center',
                  }}
                >
                  {personaName}
                </p>
                <p
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontWeight: 400,
                    fontSize: 16,
                    lineHeight: '22px',
                    color: 'var(--neutral-700)',
                    margin: 0,
                    textAlign: 'center',
                    width: 392,
                  }}
                >
                  {isRepublished
                    ? `“${personaName}” is now live with your latest changes.`
                    : `“${personaName}” is now live. Add it from the Add button in any conversation.`}
                </p>
              </div>
            </div>

            {/* ── What's next ──────────────────────────────────────────────── */}
            <div
              style={{
                display:        'flex',
                flexDirection:  'column',
                gap:            14,
                alignItems:     'center',
                position:       'relative',
                zIndex:         1,
                // Pulls this whole block closer to the description text above —
                // the outer column's gap:76 (shared with the spacing before the
                // action-button row further down) is too wide for just this
                // pairing, so this overrides only its own top offset.
                marginTop:      -48,
              }}
            >
              {/* Own bordered card — separates "What's next" + Super Link
                  generation from the page title above and the action-button
                  row below, instead of all three floating on the same
                  gradient background with no visual grouping. */}
              <div
                style={{
                  display:         'flex',
                  flexDirection:   'column',
                  gap:             14,
                  alignItems:      'center',
                  backgroundColor: 'rgba(var(--surface-rgb), 0.5)',
                  border:          '1px solid var(--border-default)',
                  borderRadius:    20,
                  padding:         '24px 28px',
                }}
              >
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontFamily: 'var(--font-title)', fontWeight: 400, fontSize: 20, lineHeight: '28px', color: 'var(--neutral-900)', margin: '0 0 4px' }}>
                    What&apos;s next?
                  </p>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, lineHeight: '20px', color: 'var(--neutral-500)', margin: 0 }}>
                    {linkShare
                      ? 'Share this link with anyone — no account needed to chat with your agent.'
                      : 'Generate a Super Link so anyone can chat with your agent — no account needed.'}
                  </p>
                </div>

                {/* Same panel as the share modal, link only, asking for the credit limit. */}
                <div style={{ width: '100%', maxWidth: 560 }}>
                  <ShareAgentPanel repoId={repoId} invites={false} askLimit />
                </div>
              </div>

              {/* Back to Library | Use this Agent | Configure Sharing — side by
                  side, all three sharing the same secondary/sm Button styling,
                  each with an inline icon sized a bit above Button's usual
                  16px default for a bit more visual weight. */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
                <Button
                  variant="secondary"
                  size="sm"
                  leftIcon={<ArrowLeftOneIcon size={18} />}
                  onClick={() => push(AGENTS_ROUTE)}
                >
                  Back to Library
                </Button>

                {repoId && (
                  <Button
                    variant="secondary"
                    size="sm"
                    leftIcon={<BubbleChatAddIcon size={18} />}
                    disabled={!personaRepo}
                    onClick={handleUseAgent}
                  >
                    Use this Agent
                  </Button>
                )}

                {/* Visible when no super link yet. */}
                {!linkShare && repoId && (
                  <Button
                    variant="secondary"
                    size="sm"
                    leftIcon={<ShareOneIcon size={18} />}
                    onClick={() => setShareModalOpen(true)}
                  >
                    Configure Sharing
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      {shareModalOpen && repoId && (
        <AgentShareModal
          open
          repoId={repoId}
          agentName={personaName}
          onClose={() => setShareModalOpen(false)}
        />
      )}
    </div>
  )
}

// ── Page export ───────────────────────────────────────────────────────────────

export default function PersonaPublishedPage() {
  return (
    <Suspense>
      <PersonaPublishedContent />
    </Suspense>
  )
}
