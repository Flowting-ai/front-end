'use client'

import React, { useState } from 'react'
import { PlusSignIcon, ArrowUpRightOneIcon, RedoIcon, DeleteTwoIcon } from '@strange-huge/icons'
import { Button, IconButton } from '@/components/ui/button'
import { Skeleton } from '@/components/Skeleton'
import { Spinner } from '@/components/Spinner'
import { Dropdown } from '@/components/Dropdown'
import { MentionAvatar } from '@/components/chat/AgentMentionMenu'
import { Tooltip } from '@/components/Tooltip'
import { DateRangePill } from '@/components/DateRangePill'
import { SettingsTable, SettingsTableToolbar, SettingsTableViewport, SettingsTableHeader, SettingsTableHeaderCell, SettingsTableRow, SettingsTableCell } from '@/components/SettingsTable'
import { type Persona } from '@/lib/api/personas'
import { type PersonaShare, type ReceivedShareResponse, type ShareDashboardResponse } from '@/lib/api/persona-shares'
import { Badge } from '@/components/Badge'
import { TokenBudgetBar } from '@/components/TokenBudgetBar'
import { canonicalShareUrl } from '@/lib/share-url'
import { SuperLinksEmpty } from '@/components/SuperLinksEmpty'
import { Sparkline } from '@/components/Sparkline'
import Tabs from '@/components/Tabs'
import { fmtExpiry, fmtK, fmtRelative, receivedShareStatus, RECEIVED_STATUS_BADGE, shareStatus, SENT_STATUS_BADGE } from '../_lib/super-links'
import { CopyUrlButton, SHADOW_CARD, SHADOW_TILE, StatTile, SectionCard } from './SuperLinkParts'

export interface SuperLinksTabProps {
  dashboard: ShareDashboardResponse | null
  sharesLoading: boolean
  dashboardRefreshing: boolean
  onRefreshDashboard: () => void
  slRange: '7d' | '30d' | '90d'
  setSlRange: (range: '7d' | '30d' | '90d') => void
  slDays: number
  shares: PersonaShare[]
  receivedShares: ReceivedShareResponse[]
  receivedLoading: boolean
  versionToPersona: Record<string, { name: string; imageUrl: string | null; repoId: string }>
  personaByRepoId: Record<string, Persona>
  visiblePersonas: Persona[]
  setSelectedShareId: React.Dispatch<React.SetStateAction<string | null>>
  setShareTarget: (target: { repoId: string; name: string } | null) => void
  setDeleteTarget: (persona: Persona | null) => void
  onBrowseAgents: () => void
  onUseReceivedShareInChat: (share: ReceivedShareResponse) => void | Promise<void>
}

export function SuperLinksTab({
  dashboard, sharesLoading, dashboardRefreshing, onRefreshDashboard,
  slRange, setSlRange, slDays, shares, receivedShares, receivedLoading,
  versionToPersona, personaByRepoId, visiblePersonas,
  setSelectedShareId, setShareTarget, setDeleteTarget,
  onBrowseAgents, onUseReceivedShareInChat,
}: SuperLinksTabProps) {
  const [panelGenOpen, setPanelGenOpen] = useState(false)
  const [superLinksView, setSuperLinksView] = useState<'mine' | 'shared'>('mine')
  const summary      = dashboard?.summary
  const creditsMonth = summary?.credits_this_month ?? 0
  const estimatedCost = parseFloat((creditsMonth / 1_000_000 * 3).toFixed(2))
  const totalLinks   = summary?.total_links ?? shares.length
  const isEmpty      = !sharesLoading && totalLinks === 0
  // Honest placeholder when there isn't enough daily granularity yet
  // (Sparkline needs >=2 points) — flat zeros, never fabricated
  // activity. Only reached once the user has at least one real link
  // (the fully-empty case short-circuits to the empty state below).
  const sparkData: number[] = dashboard && dashboard.daily.length >= 2
    ? dashboard.daily.map(d => d.credits)
    : Array(Math.max(slDays, 2)).fill(0)

  // Widths sized to what each cell's content actually needs at
  // minimum (e.g. "Limit reached" badge, "Jul 24, 2026" expiry,
  // a single icon button) rather than arbitrary round numbers —
  // the previous columns were tighter than their own content,
  // which overflowed into neighboring cells instead of eliding.
  const MY_LINKS_COLUMNS = 'minmax(0, 1.6fr) 116px minmax(0, 1fr) minmax(0, 1fr) 112px 64px'
  const SHARED_LINKS_COLUMNS = 'minmax(0, 1.3fr) minmax(0, 1fr) 116px minmax(0, 1fr) 112px 196px'

  // Date-range label for the stat box footer — dropped during the
  // /org/plans revamp when the page-header DateRangePill was
  // removed as a redundant duplicate of the 7d/30d/90d Tabs; it
  // still belongs somewhere as a plain "as of" readout, just not
  // duplicated next to an already-interactive control.
  const slToday    = new Date()
  const slFromDate = new Date(slToday)
  slFromDate.setDate(slToday.getDate() - slDays)
  const fmtSl = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const slDateRangeLabel = `${fmtSl(slFromDate)} – ${fmtSl(slToday)}`

  // "Most active agent" — fills the space the stat box leaves
  // below it now that it's no longer stretched to match the
  // chart's height. Ranked by conversation count (recipients),
  // same data already used for each table row's activity column.
  const topShare = shares.length > 0
    ? [...shares].sort((a, b) => (b.recipients?.length ?? 0) - (a.recipients?.length ?? 0))[0]
    : null
  const topAgentInfo   = topShare ? versionToPersona[topShare.persona_repo_id] : null
  const topAgentName   = topShare ? (topShare.persona_name ?? topAgentInfo?.name ?? 'Agent') : null
  const topAgentConvos = topShare?.recipients?.length ?? 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* ── Stat tiles (2x2) on the left, chart on the right — "my"
          outgoing usage summary. Hidden entirely when there are no
          outgoing links yet, regardless of which sub-tab below is
          selected. ── */}
      {!isEmpty && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, alignItems: 'stretch' }}>
          {/* Left — one bordered box ditto /org/analytics' Credit
              Pool/Used/Members row (neutral-200 border, SHADOW_CARD,
              neutral-50 background, 12px padding), containing BOTH
              the 4-tile 2x2 grid and the "Most active agent" tile.
              alignItems: 'stretch' on the outer grid makes this
              whole box match the chart card's height — the agent
              tile grows (flex: 1) to absorb the difference instead
              of the StatTiles themselves being distorted taller. */}
          <div style={{ border: '1px solid var(--border-default)', borderRadius: 16, boxShadow: SHADOW_CARD, overflow: 'hidden', backgroundColor: 'var(--neutral-50)', padding: 12, display: 'flex', flexDirection: 'column', gap: 9 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', gap: 9, flexShrink: 0 }}>
              <StatTile
                label="Credits this month"
                value={fmtK(creditsMonth)}
                sub="across all links"
                loading={sharesLoading}
              />
              <StatTile
                label="Conversations"
                value={summary?.conversations ?? 0}
                sub="total sessions"
                loading={sharesLoading}
              />
              <StatTile
                label="Active links"
                value={summary?.active_links ?? 0}
                sub={`of ${summary?.total_links ?? 0} total`}
                loading={sharesLoading}
              />
              <StatTile
                label="Est. cost"
                value={`$${estimatedCost.toFixed(2)}`}
                sub="creator-pays"
                loading={sharesLoading}
              />
            </div>

            {sharesLoading ? (
              <div style={{ backgroundColor: 'var(--card-bg)', borderRadius: 8, padding: 12, boxShadow: SHADOW_TILE, display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
                <Skeleton width={110} height={14} radius={4} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <Skeleton width={24} height={24} radius="50%" />
                  <Skeleton width={100} height={16} radius={4} />
                </div>
                <Skeleton width={160} height={14} radius={4} />
              </div>
            ) : topShare && (
              <div style={{ backgroundColor: 'var(--card-bg)', borderRadius: 8, padding: 12, boxShadow: SHADOW_TILE, display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
                <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-900)', margin: 0 }}>
                  Most active agent
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <MentionAvatar agent={{ id: topAgentInfo?.repoId ?? topShare.persona_repo_id, name: topAgentName ?? 'Agent' }} />
                  <p style={{ fontFamily: 'var(--font-title)', fontWeight: 400, fontSize: 16, lineHeight: '22px', color: 'var(--neutral-900)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {topAgentName}
                  </p>
                </div>
                <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-500)', margin: 0 }}>
                  {topAgentConvos} conversation{topAgentConvos === 1 ? '' : 's'} · {fmtK(topShare.credit_used)} credits
                </p>
              </div>
            )}
          </div>

          {/* Right — chart, time-range readout sits in the header
              space alongside the 7d/30d/90d Tabs. */}
          <SectionCard
            title="Credit usage · daily"
            bodyPadding="0 24px 12px"
            bodyGap={12}
            action={
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <DateRangePill label={slDateRangeLabel} />
                <Tabs value={slRange} onValueChange={(v) => setSlRange(v as '7d' | '30d' | '90d')}>
                  <Tabs.List size="small">
                    <Tabs.Trigger value="7d">7d</Tabs.Trigger>
                    <Tabs.Trigger value="30d">30d</Tabs.Trigger>
                    <Tabs.Trigger value="90d">90d</Tabs.Trigger>
                  </Tabs.List>
                </Tabs>
              </div>
            }
          >
            {sharesLoading ? (
              <Skeleton width={80} height={28} radius={5} />
            ) : (
              <span style={{
                fontFamily: 'var(--font-title)',
                fontSize:   'var(--font-size-heading)',
                lineHeight: 'var(--line-height-heading)',
                fontWeight: 'var(--font-weight-medium)',
                color:      'var(--neutral-900)',
              }}>
                {fmtK(creditsMonth)}
              </span>
            )}

            {sharesLoading ? (
              <Skeleton width="100%" height={180} radius={10} />
            ) : (
              <Sparkline data={sparkData} height={180} />
            )}
          </SectionCard>
        </div>
      )}

      {/* ── My Superlinks / Shared Superlinks — replaces the old
          side-by-side two-column layout with a single switchable
          table. "Shared Superlinks" stays fully independent of
          whether you have any outgoing links yourself. ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Tabs value={superLinksView} onValueChange={(v) => setSuperLinksView(v as 'mine' | 'shared')}>
          <Tabs.List size="small">
            <Tabs.Trigger value="mine">My Superlinks</Tabs.Trigger>
            <Tabs.Trigger value="shared">Shared Superlinks</Tabs.Trigger>
          </Tabs.List>
        </Tabs>

        {superLinksView === 'mine' ? (
          isEmpty ? (
            <SuperLinksEmpty onBrowsePersonas={() => onBrowseAgents()} />
          ) : (
            <SettingsTable columns={MY_LINKS_COLUMNS} columnGap={16} background='var(--card-bg)'>
              <SettingsTableToolbar title={sharesLoading ? <Skeleton width={130} height={16} radius={4} /> : `My Superlinks · ${totalLinks}`}>
                <IconButton
                  variant="ghost"
                  size="sm"
                  aria-label="Refresh usage"
                  disabled={sharesLoading || dashboardRefreshing}
                  icon={dashboardRefreshing ? <Spinner size={14} /> : <RedoIcon size={14} />}
                  onClick={onRefreshDashboard}
                />
                <Dropdown.Float
                  open={panelGenOpen}
                  onOpenChange={setPanelGenOpen}
                  placement="bottom-end"
                  trigger={
                    <Button size="sm" variant="secondary" leftIcon={<PlusSignIcon size={14} />}>
                      Generate link
                    </Button>
                  }
                >
                  <Dropdown style={{ minWidth: 220 }}>
                    {visiblePersonas.length === 0 ? (
                      <Dropdown.Section>
                        <Dropdown.Item label="No agents yet — create one first" disabled fluid />
                      </Dropdown.Section>
                    ) : (
                      <Dropdown.Section label="Select an agent">
                        {visiblePersonas.map(p => (
                          <Dropdown.Item
                            key={p.id}
                            label={p.name}
                            onClick={() => {
                              setPanelGenOpen(false)
                              setShareTarget({ repoId: p.id, name: p.name })
                            }}
                            fluid
                          />
                        ))}
                      </Dropdown.Section>
                    )}
                  </Dropdown>
                </Dropdown.Float>
              </SettingsTableToolbar>
              <SettingsTableViewport ariaLabel="My Super Links">
                <SettingsTableHeader>
                  <SettingsTableHeaderCell>Agent</SettingsTableHeaderCell>
                  <SettingsTableHeaderCell>Status</SettingsTableHeaderCell>
                  <SettingsTableHeaderCell>Usage</SettingsTableHeaderCell>
                  <SettingsTableHeaderCell>Activity</SettingsTableHeaderCell>
                  <SettingsTableHeaderCell>Expires</SettingsTableHeaderCell>
                  <SettingsTableHeaderCell align="end">Actions</SettingsTableHeaderCell>
                </SettingsTableHeader>

                {sharesLoading && [0, 1, 2].map(i => (
                  <SettingsTableRow key={i} minHeight={64}>
                    <SettingsTableCell>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, opacity: 1 - i * 0.25 }}>
                        <div className="kaya-skeleton" style={{ width: 28, height: 28, borderRadius: '50%' }} />
                        <div className="kaya-skeleton" style={{ width: 120, height: 14, borderRadius: 4 }} />
                      </div>
                    </SettingsTableCell>
                    {[0, 1, 2, 3, 4].map(ci => (
                      <SettingsTableCell key={ci}><div className="kaya-skeleton" style={{ width: 70, height: 14, borderRadius: 4, opacity: 1 - i * 0.25 }} /></SettingsTableCell>
                    ))}
                  </SettingsTableRow>
                ))}

                {!sharesLoading && shares.length === 0 && (
                  <SettingsTableRow divider={false} minHeight={80}>
                    <SettingsTableCell style={{ gridColumn: '1 / -1' }}>
                      <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--neutral-500)', margin: 0 }}>
                        No Super Links yet — generate one from the button above.
                      </p>
                    </SettingsTableCell>
                  </SettingsTableRow>
                )}

                {!sharesLoading && shares.map(share => {
                  const personaInfo = versionToPersona[share.persona_repo_id]
                  const name        = share.persona_name ?? personaInfo?.name ?? 'Agent'
                  const repoId      = personaInfo?.repoId ?? ''
                  const recipients  = share.recipients ?? []
                  const uniqueUsers = new Set(recipients.map(r => r.recipient_user_id)).size
                  const status      = shareStatus(share)
                  const badge       = SENT_STATUS_BADGE[status]
                  const url         = canonicalShareUrl(share.share_url).replace(/^https?:\/\//, '')
                  const pctUsed     = share.credit_limit ? Math.min(100, Math.round((share.credit_used / share.credit_limit) * 100)) : null

                  return (
                    <SettingsTableRow
                      key={share.id}
                      minHeight={64}
                      onClick={() => setSelectedShareId(prev => prev === share.id ? null : share.id)}
                    >
                      <SettingsTableCell>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                          <MentionAvatar agent={{ id: repoId || share.persona_repo_id, name }} />
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                            <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, lineHeight: '20px', color: 'var(--neutral-900)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {name}
                            </p>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
                              <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--neutral-500)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {url}
                              </p>
                              <CopyUrlButton url={url} />
                            </div>
                          </div>
                        </div>
                      </SettingsTableCell>
                      <SettingsTableCell>
                        <Badge color={badge.color} label={badge.label} />
                      </SettingsTableCell>
                      <SettingsTableCell>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: '100%' }}>
                          <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--neutral-500)' }}>
                            {pctUsed !== null ? `${pctUsed}% used` : `${share.credit_used.toLocaleString()} credits`}
                          </span>
                          <TokenBudgetBar used={share.credit_used} limit={share.credit_limit ?? 0} size="sm" />
                        </div>
                      </SettingsTableCell>
                      <SettingsTableCell>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, width: '100%' }}>
                          <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--neutral-700)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {recipients.length} conversation{recipients.length === 1 ? '' : 's'} · {uniqueUsers} user{uniqueUsers === 1 ? '' : 's'}
                          </p>
                          <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--neutral-400)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {recipients.length > 0 ? `Last used ${fmtRelative(share.updated_at ?? share.created_at)}` : `Created ${fmtRelative(share.created_at)}`}
                          </p>
                        </div>
                      </SettingsTableCell>
                      <SettingsTableCell>
                        <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--neutral-500)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {fmtExpiry(share.expires_at)}
                        </p>
                      </SettingsTableCell>
                      <SettingsTableCell align="end">
                        {repoId && (
                          <Tooltip content="Manage sharing" side="top">
                            <IconButton
                              aria-label={`Manage sharing for ${name}`}
                              size="xs"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation()
                                setShareTarget({ repoId, name })
                              }}
                              icon={<ArrowUpRightOneIcon size={14} />}
                            />
                          </Tooltip>
                        )}
                      </SettingsTableCell>
                    </SettingsTableRow>
                  )
                })}
              </SettingsTableViewport>
            </SettingsTable>
          )
        ) : (
          <SettingsTable columns={SHARED_LINKS_COLUMNS} columnGap={16} background='var(--card-bg)'>
            <SettingsTableToolbar title={receivedLoading ? <Skeleton width={150} height={16} radius={4} /> : `Shared Superlinks · ${receivedShares.length}`} />
            <SettingsTableViewport ariaLabel="Shared with me">
              <SettingsTableHeader>
                <SettingsTableHeaderCell>Agent</SettingsTableHeaderCell>
                <SettingsTableHeaderCell>Shared by</SettingsTableHeaderCell>
                <SettingsTableHeaderCell>Status</SettingsTableHeaderCell>
                <SettingsTableHeaderCell>Usage</SettingsTableHeaderCell>
                <SettingsTableHeaderCell>Expires</SettingsTableHeaderCell>
                <SettingsTableHeaderCell align="end">Actions</SettingsTableHeaderCell>
              </SettingsTableHeader>

              {receivedLoading && [0, 1, 2].map(i => (
                <SettingsTableRow key={i} minHeight={64}>
                  <SettingsTableCell>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, opacity: 1 - i * 0.25 }}>
                      <div className="kaya-skeleton" style={{ width: 28, height: 28, borderRadius: '50%' }} />
                      <div className="kaya-skeleton" style={{ width: 120, height: 14, borderRadius: 4 }} />
                    </div>
                  </SettingsTableCell>
                  {[0, 1, 2, 3, 4].map(ci => (
                    <SettingsTableCell key={ci}><div className="kaya-skeleton" style={{ width: 70, height: 14, borderRadius: 4, opacity: 1 - i * 0.25 }} /></SettingsTableCell>
                  ))}
                </SettingsTableRow>
              ))}

              {!receivedLoading && receivedShares.length === 0 && (
                <SettingsTableRow divider={false} minHeight={80}>
                  <SettingsTableCell style={{ gridColumn: '1 / -1' }}>
                    <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--neutral-500)', margin: 0 }}>
                      When someone shares a Super Link and you accept it, their agent appears here.
                    </p>
                  </SettingsTableCell>
                </SettingsTableRow>
              )}

              {!receivedLoading && receivedShares.map(share => {
                const persona   = personaByRepoId[share.persona_repo_id]
                const status    = receivedShareStatus(share)
                const badge     = RECEIVED_STATUS_BADGE[status]
                const pctUsed   = share.credit_limit ? Math.min(100, Math.round((share.credit_used / share.credit_limit) * 100)) : null

                return (
                  <SettingsTableRow key={share.share_id} minHeight={64}>
                    <SettingsTableCell>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                        <MentionAvatar agent={{ id: persona?.id ?? share.persona_repo_id, name: share.name }} />
                        <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, lineHeight: '20px', color: 'var(--neutral-900)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {share.name}
                        </p>
                      </div>
                    </SettingsTableCell>
                    <SettingsTableCell>
                      <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--neutral-500)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {share.shared_by_name}
                      </p>
                    </SettingsTableCell>
                    <SettingsTableCell>
                      <Badge color={badge.color} label={badge.label} />
                    </SettingsTableCell>
                    <SettingsTableCell>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: '100%' }}>
                        <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--neutral-500)' }}>
                          {pctUsed !== null ? `${pctUsed}% used` : `${share.credit_used.toLocaleString()} credits`}
                        </span>
                        <TokenBudgetBar used={share.credit_used} limit={share.credit_limit ?? 0} size="sm" />
                      </div>
                    </SettingsTableCell>
                    <SettingsTableCell>
                      <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--neutral-500)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {fmtExpiry(share.expires_at)}
                      </p>
                    </SettingsTableCell>
                    <SettingsTableCell align="end">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Button size="sm" variant="secondary" onClick={() => void onUseReceivedShareInChat(share)}>
                          Use in chat
                        </Button>
                        <Tooltip content="Remove" side="top">
                          <IconButton
                            aria-label={`Remove ${share.name}`}
                            size="xs"
                            variant="ghost"
                            onClick={() => persona && setDeleteTarget(persona)}
                            icon={<DeleteTwoIcon size={14} />}
                          />
                        </Tooltip>
                      </div>
                    </SettingsTableCell>
                  </SettingsTableRow>
                )
              })}
            </SettingsTableViewport>
          </SettingsTable>
        )}
      </div>
    </div>
  )
}
