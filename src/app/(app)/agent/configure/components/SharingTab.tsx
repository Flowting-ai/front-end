'use client'

import React, { useState, useEffect } from 'react'
import { Switch } from '@/components/Switch'
import { Button } from '@/components/Button'
import { Checkbox } from '@/components/Checkbox'
import { CancelOneIcon, ArrowDownOneIcon } from '@strange-huge/icons'
import { ModelFeaturedCard } from '@/components/ModelFeaturedCard'
import { Dropdown } from '@/components/Dropdown'
import { ConfigureFormSkeleton } from '@/app/(app)/agent/configure/components/ConfigureFormSkeleton'

import { toast } from 'sonner'
import {
  createShare,
  listShares,
  revokeShare,
  type PersonaShare,
} from '@/lib/api/persona-shares'
import { getPersonaRepo, setPersonaVisibility, bustPersonasCache } from '@/lib/api/personas'
import { ApiError } from '@/lib/api/client'
import { useAuth } from '@/context/auth-context'
import { useOrg } from '@/context/org-context'
import { getShareTokenLimit } from '@/lib/plan-config'
import { canonicalShareUrl } from '@/lib/share-url'
import { usePersonaConfigure } from '@/app/(app)/agent/configure/context'
import { ATTRIBUTE_HEADER_STYLE } from '@/app/(app)/agent/configure/components/AttributeTrackerRail'

// ── Types ─────────────────────────────────────────────────────────────────────

type Visibility = 'private' | 'team' | 'community'

export interface SharingTabProps {
  /** persona REPO id — passed as persona_repo_id when creating shares */
  repoId?: string
  /** persona VERSION id — used to filter the existing shares list */
  versionId?: string
  hasTeamsPlan?: boolean
  onChanged?: () => void
}

// ── Token usage progress bar ───────────────────────────────────────────────────

function UsageBar({ percent }: { percent: number }) {
  const clamped = Math.max(0, Math.min(100, percent))
  return (
    <div
      style={{
        position: 'relative',
        height: 4,
        backgroundColor: 'white',
        borderRadius: 2,
        width: '100%',
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          height: '100%',
          width: `${clamped}%`,
          backgroundColor: '#0d6eb2',
          borderRadius: 2,
          transition: 'width 300ms ease',
        }}
      />
      <div
        aria-hidden
        style={{
          position: 'absolute',
          left: `${clamped}%`,
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: 10,
          height: 10,
          borderRadius: '50%',
          backgroundColor: '#0d6eb2',
          border: '1.5px solid white',
          boxShadow: '0px 0px 0px 1px rgba(13,110,178,0.5)',
        }}
      />
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function SharingTab({ repoId, versionId, onChanged }: SharingTabProps) {
  const { user } = useAuth()
  const { orgId, teams } = useOrg()
  const editableTeams = teams.filter(team => !team.archived && team.canEdit)
  const maxTokenLimit = getShareTokenLimit(user?.planType)
  const { setHasShareLink, publishedVersionId, panelsLocked, markFieldTouched, resetTouchedFields } = usePersonaConfigure()

  const [visibility,        setVisibility]        = useState<Visibility>('private')
  const [selectedTeamIds,   setSelectedTeamIds]   = useState<string[]>([])
  const [visibilitySaving,  setVisibilitySaving]  = useState(false)
  const [savedVisibility,   setSavedVisibility]   = useState<Visibility>('private')
  const [savedTeamIds,      setSavedTeamIds]      = useState<string[]>([])
  const [teamsOpen,         setTeamsOpen]         = useState(false)

  // ── Loading gate — true until both the visibility (repo) and shares fetches settle ──
  const [visibilityLoaded, setVisibilityLoaded] = useState(!repoId)
  const [sharesLoaded,     setSharesLoaded]     = useState(!versionId)
  const isLoading = !visibilityLoaded || !sharesLoaded

  const visibilityChanged =
    visibility !== savedVisibility ||
    selectedTeamIds.slice().sort().join(',') !== savedTeamIds.slice().sort().join(',')

  function handleVisibilitySelect(v: Visibility) {
    if (v === 'team' && panelsLocked) { toast.error('Save a version first to set team visibility.'); return }
    setVisibility(v)
    if (v !== 'team') setTeamsOpen(false)
    markFieldTouched('sharing', 'visibility')
  }

  async function handleSaveVisibility() {
    if (!repoId) { toast.error('Save the agent first.'); return }
    if (visibility === 'team' && selectedTeamIds.length === 0) { toast.error('Select at least one team.'); return }
    setVisibilitySaving(true)
    try {
      await setPersonaVisibility(
        repoId,
        visibility === 'private' ? 'private' : 'team',
        visibility === 'team' ? selectedTeamIds : undefined,
      )
      setSavedVisibility(visibility)
      setSavedTeamIds(selectedTeamIds)
      bustPersonasCache()
      resetTouchedFields('sharing', 'visibility')
      onChanged?.()
      toast.success('Visibility updated')
    } catch (err) {
      toast.error((err as ApiError).message ?? 'Failed to update visibility')
    } finally {
      setVisibilitySaving(false)
    }
  }

  // Team dropdown toggle
  // ── Link share state ───────────────────────────────────────────────────────
  const [superLinkEnabled, setSuperLinkEnabled] = useState(false)
  const [linkShare, setLinkShare] = useState<PersonaShare | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isRevoking, setIsRevoking] = useState(false)
  const [tokenLimit, setTokenLimit] = useState(Math.floor(maxTokenLimit / 2))

  // ── Email share state ──────────────────────────────────────────────────────
  const [emailShares, setEmailShares] = useState<PersonaShare[]>([])
  const [emailInput, setEmailInput] = useState('')
  const [emailTokenLimit, setEmailTokenLimit] = useState(Math.floor(maxTokenLimit / 2))
  const [isSendingEmail, setIsSendingEmail] = useState(false)
  const [revokingEmailId, setRevokingEmailId] = useState<string | null>(null)

  const currentLinkShare = linkShare?.persona_id === versionId ? linkShare : null
  const currentEmailShares = emailShares.filter(share => share.persona_id === versionId)
  const allEditableTeamsSelected =
    editableTeams.length > 0 && selectedTeamIds.length === editableTeams.length

  // Sync share-link existence to shared progress indicator
  useEffect(() => { setHasShareLink(!!currentLinkShare) }, [currentLinkShare, setHasShareLink])

  // ── Sync token limit defaults when plan resolves ──────────────────────────
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset defaults when the user's plan limit resolves
    setTokenLimit(Math.floor(maxTokenLimit / 2))
    setEmailTokenLimit(Math.floor(maxTokenLimit / 2))
  }, [maxTokenLimit])

  // ── Load existing shares for the current version ──────────────────────────
  useEffect(() => {
    if (!versionId) return
    let cancelled = false
    listShares().then(all => {
      if (cancelled) return
      const mine = all.filter(s => s.persona_id === versionId && s.is_active)
      const existing = mine.find(s => s.share_type === 'link') ?? null
      setLinkShare(existing)
      setSuperLinkEnabled(existing !== null)
      setEmailShares(mine.filter(s => s.share_type === 'email'))
    }).catch(() => {
      if (cancelled) return
      // Share state is version-scoped; do not keep a previous version's link visible on failures.
      setLinkShare(null)
      setSuperLinkEnabled(false)
      setEmailShares([])
    }).finally(() => { if (!cancelled) setSharesLoaded(true) })
    return () => { cancelled = true }
  }, [versionId])

  useEffect(() => {
    if (!repoId) return
    let cancelled = false
    getPersonaRepo(repoId)
      .then(repo => {
        if (cancelled) return
        setVisibility(repo.visibility)
        setSelectedTeamIds(repo.team_ids ?? [])
        setSavedVisibility(repo.visibility)
        setSavedTeamIds(repo.team_ids ?? [])
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setVisibilityLoaded(true) })
    return () => { cancelled = true }
  }, [repoId])

  // ── Link share handlers ────────────────────────────────────────────────────

  async function handleGenerateLink() {
    if (!repoId || !versionId) {
      toast.error('Save the agent first before generating a share link.')
      return
    }
    if (publishedVersionId !== versionId) {
      toast.error('Publish this agent version before generating a share link.')
      setSuperLinkEnabled(false)
      return
    }
    setIsGenerating(true)
    try {
      const share = await createShare({
        persona_repo_id: repoId!,
        share_type: 'link',
        credit_limit: tokenLimit,
      })
      if (share.persona_id !== versionId) {
        setLinkShare(null)
        setSuperLinkEnabled(false)
        toast.error('The active version changed. Reopen Sharing and try again.')
        return
      }
      setLinkShare(share)
      resetTouchedFields('sharing', 'superlink')
      onChanged?.()
      toast.success('Share link generated')
    } catch (err) {
      toast.error((err as ApiError).message ?? 'Failed to generate link')
      setSuperLinkEnabled(false)
    } finally {
      setIsGenerating(false)
    }
  }

  async function handleRevokeLink() {
    if (!currentLinkShare) return
    setIsRevoking(true)
    try {
      await revokeShare(currentLinkShare.id)
      setLinkShare(null)
      setSuperLinkEnabled(false)
      resetTouchedFields('sharing', 'superlink')
      onChanged?.()
      toast.success('Share link revoked')
    } catch (err) {
      toast.error((err as ApiError).message ?? 'Failed to revoke link')
    } finally {
      setIsRevoking(false)
    }
  }

  function handleCopy() {
    if (!currentLinkShare?.share_url) return
    navigator.clipboard.writeText(canonicalShareUrl(currentLinkShare.share_url)).catch(() => {})
    toast.success('Link copied')
  }

  // ── Email share handlers ───────────────────────────────────────────────────

  async function handleSendEmailInvite() {
    const email = emailInput.trim()
    if (!email) return
    if (!repoId || !versionId) {
      toast.error('Save the agent first before sending invites.')
      return
    }
    if (publishedVersionId !== versionId) {
      toast.error('Publish this agent version before sending invites.')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error('Enter a valid email address')
      return
    }
    setIsSendingEmail(true)
    try {
      const share = await createShare({
        persona_repo_id: repoId!,
        share_type: 'email',
        recipient_emails: [email],
        credit_limit: emailTokenLimit,
      })
      if (share.persona_id !== versionId) {
        toast.error('The active version changed. Reopen Sharing and try again.')
        return
      }
      setEmailShares(prev => [...prev, share])
      setEmailInput('')
      resetTouchedFields('sharing', 'email')
      onChanged?.()
      toast.success(`Invite sent to ${email}`)
    } catch (err) {
      toast.error((err as ApiError).message ?? 'Failed to send invite')
    } finally {
      setIsSendingEmail(false)
    }
  }

  async function handleRevokeEmailShare(id: string) {
    setRevokingEmailId(id)
    try {
      await revokeShare(id)
      setEmailShares(prev => prev.filter(s => s.id !== id))
      resetTouchedFields('sharing', 'email')
      onChanged?.()
      toast.success('Invite revoked')
    } catch (err) {
      toast.error((err as ApiError).message ?? 'Failed to revoke invite')
    } finally {
      setRevokingEmailId(null)
    }
  }

  // ── Derived values ─────────────────────────────────────────────────────────

  const displayUrl = currentLinkShare?.share_url
    ? canonicalShareUrl(currentLinkShare.share_url).replace(/^https?:\/\//, '')
    : 'Your link will appear here'

  const usagePercent =
    currentLinkShare && currentLinkShare.credit_limit
      ? Math.min(100, Math.round((currentLinkShare.credit_used / currentLinkShare.credit_limit) * 100))
      : 0

  // ── Render ─────────────────────────────────────────────────────────────────

  if (isLoading) {
    return <ConfigureFormSkeleton rows={3} />
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, width: '100%' }}>

      {/* ── Heading ─────────────────────────────────────────────────────────── */}
      <h1
        style={{
          fontFamily: 'var(--font-title)',
          fontWeight: 400,
          fontSize: 24,
          lineHeight: '32px',
          color: '#1a1916',
          margin: 0,
        }}
      >
        Sharing Configuration
      </h1>

      {/* ── Visibility ──────────────────────────────────────────────────────── */}
      <div data-help-id="help-sharing-visibility" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        <span style={ATTRIBUTE_HEADER_STYLE}>
          Visibility
        </span>

        {/* ── 2 cards, same radio-pair pattern as the Muse/Advanced featured cards ── */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', width: '100%' }}>
          <div style={{ flex: '1 0 0', minWidth: 0 }}>
            <ModelFeaturedCard
              title="Private"
              description="Only you can use this agent"
              selected={visibility === 'private'}
              onSelectedChange={next => { if (next) handleVisibilitySelect('private') }}
            />
          </div>
          <div style={{ flex: '1 0 0', minWidth: 0, position: 'relative' }}>
            <ModelFeaturedCard
              title="Team"
              description={!orgId ? 'Requires a team plan' : editableTeams.length === 0 ? 'No editable teams' : 'Deploy to selected teams'}
              selected={visibility === 'team'}
              onSelectedChange={next => { if (next && orgId && editableTeams.length > 0) handleVisibilitySelect('team') }}
              style={{
                opacity: !orgId || editableTeams.length === 0 ? 0.45 : 1,
                cursor:  !orgId || editableTeams.length === 0 ? 'not-allowed' : 'pointer',
              }}
            />

            {/* Team-picker dropdown — floats over the card; the trigger itself
               carries the "Shared to N teams" label, the card above keeps "Team". */}
            {visibility === 'team' && orgId && editableTeams.length > 0 && (
              <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', maxWidth: 'calc(100% - 24px)' }}>
                <Dropdown.Float
                  open={teamsOpen}
                  onOpenChange={setTeamsOpen}
                  placement="bottom-end"
                  trigger={
                    <button
                      type="button"
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6,
                        maxWidth: '100%', padding: '6px 8px', borderRadius: 8, border: 'none', cursor: 'pointer',
                        backgroundColor: 'rgba(255,255,255,0.12)',
                        boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.25)',
                        fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 12, lineHeight: '16px',
                        color: 'var(--neutral-50)',
                      }}
                    >
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {selectedTeamIds.length > 0
                          ? `Shared to ${selectedTeamIds.length} team${selectedTeamIds.length === 1 ? '' : 's'}`
                          : 'Select teams'}
                      </span>
                      <div style={{ flexShrink: 0, lineHeight: 0, transform: teamsOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 150ms' }}>
                        <ArrowDownOneIcon size={14} />
                      </div>
                    </button>
                  }
                >
                  <Dropdown size="md">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: 4 }}>
                      {editableTeams.map(team => {
                        const checked = selectedTeamIds.includes(team.id)
                        const toggle = () => {
                          setSelectedTeamIds(current =>
                            checked ? current.filter(id => id !== team.id) : [...current, team.id]
                          )
                          markFieldTouched('sharing', 'visibility')
                        }
                        return (
                          <div
                            key={team.id}
                            role="button"
                            tabIndex={0}
                            onClick={toggle}
                            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle() } }}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 10,
                              padding: '8px', borderRadius: 8, cursor: 'pointer', userSelect: 'none',
                            }}
                          >
                            <span style={{ pointerEvents: 'none', flexShrink: 0 }}>
                              <Checkbox checked={checked} />
                            </span>
                            <span style={{
                              fontFamily: 'var(--font-body)', fontWeight: 400,
                              fontSize: 14, lineHeight: '22px', color: 'var(--neutral-800)',
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            }}>
                              {team.name}
                            </span>
                            {allEditableTeamsSelected && editableTeams[editableTeams.length - 1]?.id === team.id && (
                              <span style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--neutral-500)', flexShrink: 0 }}>
                                All teams
                              </span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                    <p style={{ margin: '4px 8px 8px', fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 11, lineHeight: '16px', color: 'var(--neutral-400)' }}>
                      Selected members will have access to this agent.
                    </p>
                  </Dropdown>
                </Dropdown.Float>
              </div>
            )}
          </div>
        </div>

        {/* Save button — primary, full width, disabled until something changes */}
        <Button
          variant="default"
          fluid
          disabled={visibilitySaving || !repoId || !visibilityChanged || (visibility === 'team' && (!orgId || selectedTeamIds.length === 0))}
          loading={visibilitySaving}
          onClick={handleSaveVisibility}
        >
          {visibilitySaving ? 'Saving…' : 'Save visibility'}
        </Button>
      </div>

      {/* ── Divider ─────────────────────────────────────────────────────────── */}
      <div style={{ height: 1, width: '100%', backgroundColor: 'rgba(59,54,50,0.15)' }} />

      {/* ── Super Link ──────────────────────────────────────────────────────── */}
      <div data-help-id="help-sharing-superlink" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* Toggle header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={ATTRIBUTE_HEADER_STYLE}>
              Super Link
            </span>
            <span
              style={{
                fontFamily: 'var(--font-body)',
                fontWeight: 500,
                fontSize: 12,
                lineHeight: '16px',
                color: '#6a625d',
                maxWidth: 560,
              }}
            >
              Generate a shareable URL. Recipients get their own copy of this persona — you cover their credit usage up to the limit you set.
            </span>
          </div>
          <Switch
            checked={superLinkEnabled}
            onCheckedChange={v => { setSuperLinkEnabled(v); markFieldTouched('sharing', 'superlink') }}
            disabled={isGenerating || isRevoking}
          />
        </div>

        {/* URL bar — visible when toggle is on */}
        {superLinkEnabled && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* URL input row */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: 'white',
                border: '1px solid var(--neutral-200)',
                borderRadius: 10,
                padding: '8px 7px',
                height: 46,
              }}
            >
              {/* URL text */}
              <div style={{ flex: '1 0 0', minWidth: 0, overflow: 'hidden', paddingLeft: 8 }}>
                <span
                  style={{
                    display: 'block',
                    fontFamily: 'var(--font-body)',
                    fontWeight: 500,
                    fontSize: 14,
                    lineHeight: '22px',
                    color: currentLinkShare ? 'var(--neutral-800)' : 'var(--neutral-300)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {displayUrl}
                </span>
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                {currentLinkShare ? (
                  <>
                    <button
                      onClick={handleRevokeLink}
                      disabled={isRevoking}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 2,
                        padding: '5px 8px',
                        borderRadius: 8,
                        border: 'none',
                        cursor: isRevoking ? 'not-allowed' : 'pointer',
                        backgroundColor: 'transparent',
                        fontFamily: 'var(--font-body)',
                        fontWeight: 500,
                        fontSize: 14,
                        lineHeight: '22px',
                        color: isRevoking ? 'var(--neutral-400)' : '#ee3030',
                        opacity: isRevoking ? 0.6 : 1,
                        transition: 'opacity 150ms',
                      }}
                    >
                      <CancelOneIcon size={16} color={isRevoking ? 'var(--neutral-400)' : '#ee3030'} />
                      {isRevoking ? 'Revoking…' : 'Revoke link'}
                    </button>
                    <Button variant="secondary" size="sm" onClick={handleCopy}>
                      Copy
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleGenerateLink}
                    loading={isGenerating}
                    disabled={isGenerating}
                  >
                    Generate link
                  </Button>
                )}
              </div>
            </div>

            {/* Token limit — shown before generation so the user can configure it */}
            {!currentLinkShare && (
              <div
                data-help-id="help-sharing-token"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span style={ATTRIBUTE_HEADER_STYLE}>
                  Credit limit
                </span>
                <div
                  style={{
                    backgroundColor: 'white',
                    border: '1px solid var(--neutral-200)',
                    borderRadius: 8,
                    padding: 7,
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <input
                    type="number"
                    value={tokenLimit}
                    min={1}
                    max={maxTokenLimit}
                    onChange={e => { setTokenLimit(Math.min(maxTokenLimit, Math.max(1, parseInt(e.target.value) || 1))); markFieldTouched('sharing', 'superlink') }}
                    style={{
                      width: 96,
                      border: 'none',
                      outline: 'none',
                      backgroundColor: 'transparent',
                      fontFamily: 'var(--font-body)',
                      fontWeight: 400,
                      fontSize: 12,
                      lineHeight: 'normal',
                      color: '#3b3632',
                    }}
                  />
                </div>
              </div>
            )}

            {/* Token usage — shown after link is generated */}
            {currentLinkShare && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <span
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontWeight: 400,
                    fontSize: 14,
                    lineHeight: '22px',
                    color: 'var(--neutral-700)',
                  }}
                >
                  {currentLinkShare.credit_limit !== null
                    ? `${usagePercent}% used · ${currentLinkShare.credit_used.toLocaleString()} / ${currentLinkShare.credit_limit.toLocaleString()} credits`
                    : `${currentLinkShare.credit_used.toLocaleString()} credits used · No limit`}
                </span>
                {currentLinkShare.credit_limit !== null && <UsageBar percent={usagePercent} />}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Divider ─────────────────────────────────────────────────────────── */}
      <div style={{ height: 1, width: '100%', backgroundColor: 'rgba(59,54,50,0.15)' }} />

      {/* ── Email sharing ────────────────────────────────────────────────────── */}
      <div data-help-id="help-sharing-email" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span
            style={ATTRIBUTE_HEADER_STYLE}
          >
            Email Invite
          </span>
          <span
            style={{
              fontFamily: 'var(--font-body)',
              fontWeight: 500,
              fontSize: 12,
              lineHeight: '16px',
              color: '#6a625d',
              maxWidth: 560,
            }}
          >
            Send the share link directly to someone via email. Their usage is billed to you up to the token limit you set.
          </span>
        </div>

        {/* Email input row */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <div
            style={{
              flex: '1 0 0',
              minWidth: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                backgroundColor: 'white',
                border: '1px solid var(--neutral-200)',
                borderRadius: 10,
                padding: '8px 12px',
                height: 46,
              }}
            >
              <input
                type="email"
                value={emailInput}
                onChange={e => { setEmailInput(e.target.value); markFieldTouched('sharing', 'email') }}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void handleSendEmailInvite() } }}
                placeholder="colleague@company.com"
                style={{
                  flex: 1,
                  border: 'none',
                  outline: 'none',
                  backgroundColor: 'transparent',
                  fontFamily: 'var(--font-body)',
                  fontWeight: 400,
                  fontSize: 14,
                  lineHeight: '22px',
                  color: 'var(--neutral-900)',
                }}
              />
            </div>
          </div>

          {/* Token limit for this invite */}
          <div
            style={{
              backgroundColor: 'white',
              border: '1px solid var(--neutral-200)',
              borderRadius: 10,
              padding: '8px 12px',
              height: 46,
              display: 'flex',
              alignItems: 'center',
              flexShrink: 0,
            }}
          >
            <input
              type="number"
              value={emailTokenLimit}
              min={1}
              max={maxTokenLimit}
              onChange={e => { setEmailTokenLimit(Math.min(maxTokenLimit, Math.max(1, parseInt(e.target.value) || 1))); markFieldTouched('sharing', 'email') }}
              style={{
                width: 80,
                border: 'none',
                outline: 'none',
                backgroundColor: 'transparent',
                fontFamily: 'var(--font-body)',
                fontWeight: 400,
                fontSize: 12,
                lineHeight: 'normal',
                color: '#3b3632',
              }}
            />
            <span
              style={{
                fontFamily: 'var(--font-body)',
                fontWeight: 400,
                fontSize: 12,
                color: 'var(--neutral-500)',
                marginLeft: 4,
                flexShrink: 0,
              }}
            >
              credits
            </span>
          </div>

          <Button
            variant="default"
            size="sm"
            onClick={handleSendEmailInvite}
            loading={isSendingEmail}
            disabled={isSendingEmail || !emailInput.trim()}
            style={{ height: 46, flexShrink: 0 }}
          >
            Send invite
          </Button>
        </div>

        {/* Existing email shares */}
        {currentEmailShares.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {currentEmailShares.map(share => {
              const emails = share.recipient_emails ?? []
              const emailStr = emails.join(', ') || 'Unknown recipient'
              const pct = share.credit_limit
                ? Math.min(100, Math.round((share.credit_used / share.credit_limit) * 100))
                : null
              const isRevoking = revokingEmailId === share.id
              return (
                <div
                  key={share.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderRadius: 10,
                    backgroundColor: 'white',
                    boxShadow: '0px 0px 0px 1px var(--neutral-100)',
                    gap: 12,
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                    <span
                      style={{
                        fontFamily: 'var(--font-body)',
                        fontWeight: 500,
                        fontSize: 14,
                        lineHeight: '22px',
                        color: 'var(--neutral-800)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {emailStr}
                    </span>
                    <span
                      style={{
                        fontFamily: 'var(--font-body)',
                        fontWeight: 400,
                        fontSize: 12,
                        lineHeight: '16px',
                        color: 'var(--neutral-500)',
                      }}
                    >
                      {share.credit_limit !== null
                        ? `${share.credit_used.toLocaleString()} / ${share.credit_limit.toLocaleString()} credits${pct !== null ? ` · ${pct}% used` : ''}`
                        : `${share.credit_used.toLocaleString()} credits used · No limit`}
                    </span>
                  </div>

                  <button
                    onClick={() => handleRevokeEmailShare(share.id)}
                    disabled={isRevoking}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 2,
                      padding: '4px 8px',
                      borderRadius: 8,
                      border: 'none',
                      cursor: isRevoking ? 'not-allowed' : 'pointer',
                      backgroundColor: 'transparent',
                      fontFamily: 'var(--font-body)',
                      fontWeight: 500,
                      fontSize: 14,
                      lineHeight: '22px',
                      color: isRevoking ? 'var(--neutral-400)' : '#ee3030',
                      opacity: isRevoking ? 0.6 : 1,
                      flexShrink: 0,
                      transition: 'opacity 150ms',
                    }}
                  >
                    <CancelOneIcon size={14} color={isRevoking ? 'var(--neutral-400)' : '#ee3030'} />
                    {isRevoking ? 'Revoking…' : 'Revoke'}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
