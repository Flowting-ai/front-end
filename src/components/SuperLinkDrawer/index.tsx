'use client'

import React, { useEffectEvent } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, m, useReducedMotion } from 'framer-motion'
import { CancelOneIcon } from '@strange-huge/icons'
import { Avatar } from '@/components/Avatar'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/Button'
import { Divider } from '@/components/Divider'
import { IconButton } from '@/components/IconButton'
import { InputField } from '@/components/InputField'
import { SessionRow, type SessionStatus } from '@/components/SessionRow'
import { Sparkline } from '@/components/Sparkline'
import { StatCard } from '@/components/StatCard'
import { Switch } from '@/components/Switch'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/Tabs'
import { TokenBudgetBar } from '@/components/TokenBudgetBar'
import { springs } from '@/lib/springs'
import { cn } from '@/lib/utils'
import type { SuperLinkStatus } from '@/components/SuperLinkRow'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SuperLinkDrawerSession {
  id:        string
  time:      string
  messages:  number
  tokens:    number
  status:    SessionStatus
}

export interface SuperLinkDrawerLink {
  id:           string
  personaName:  string
  avatarColor:  string
  /** Optional persona image URL — shown instead of initials when provided. */
  avatarUrl?:   string | null
  /** Persona repo ID — used to link to the sharing configuration tab. */
  repoId?:      string
  url:          string
  tokenUsed:    number
  tokenLimit:   number
  conversations: number
  uniqueUsers:  number
  tokensPerConvo: number
  lastUsedAt:   string
  status:       SuperLinkStatus
  dailyTokens:  number[]
  sessions:     SuperLinkDrawerSession[]
}

export interface SuperLinkDrawerProps {
  link:            SuperLinkDrawerLink | null
  onClose:         () => void
  onStatusChange?: (next: SuperLinkStatus) => void
  onLimitChange?:  (next: number) => void
  className?:      string
  style?:          React.CSSProperties
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtK(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M'
  if (n >= 1_000)     return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K'
  return String(n)
}

// ── Drawer body sections ──────────────────────────────────────────────────────

function DrawerOverview({ link }: { link: SuperLinkDrawerLink }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <StatCard
          label="Tokens used"
          value={fmtK(link.tokenUsed)}
          sub={`of ${fmtK(link.tokenLimit)} limit`}
        />
        <StatCard
          label="Conversations"
          value={link.conversations}
          sub={`${link.uniqueUsers} unique users`}
        />
        <StatCard
          label="Avg / convo"
          value={fmtK(link.tokensPerConvo)}
          sub="tokens"
        />
        <StatCard
          label="Budget left"
          value={fmtK(link.tokenLimit - link.tokenUsed)}
          sub="remaining"
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--font-size-body)', lineHeight: 'var(--line-height-body)', fontWeight: 'var(--font-weight-medium)', color: 'var(--neutral-700)' }}>
            Token budget
          </span>
        </div>
        <TokenBudgetBar used={link.tokenUsed} limit={link.tokenLimit} size="lg" showLabel />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--font-size-body)', lineHeight: 'var(--line-height-body)', fontWeight: 'var(--font-weight-medium)', color: 'var(--neutral-700)' }}>
          Last 7 days
        </span>
        <Sparkline data={link.dailyTokens} height={120} />
      </div>
    </div>
  )
}

function DrawerSessions({ link }: { link: SuperLinkDrawerLink }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <span style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--font-size-caption)', lineHeight: 'var(--line-height-caption)', color: 'var(--neutral-500)', marginBottom: 8 }}>
        {link.sessions.length} conversations · {link.uniqueUsers} unique users
      </span>
      {link.sessions.map((s, i) => (
        <React.Fragment key={s.id}>
          <SessionRow num={i + 1} time={s.time} messages={s.messages} tokens={s.tokens} status={s.status} />
          {i < link.sessions.length - 1 && <Divider />}
        </React.Fragment>
      ))}
    </div>
  )
}

function DrawerSettings({
  link, onStatusChange, onLimitChange,
}: {
  link: SuperLinkDrawerLink
  onStatusChange?: (next: SuperLinkStatus) => void
  onLimitChange?:  (next: number) => void
}) {
  const [limitDraft, setLimitDraft] = React.useState(String(link.tokenLimit))
  const [editing, setEditing]       = React.useState(false)
  const [showRevoke, setShowRevoke] = React.useState(false)

  const avgDaily = link.dailyTokens.reduce((s, n) => s + n, 0) / Math.max(link.dailyTokens.length, 1)
  const daysLeft = avgDaily > 0 ? Math.max(0, Math.round((link.tokenLimit - link.tokenUsed) / avgDaily)) : null

  const saveLimit = () => {
    const next = parseInt(limitDraft, 10)
    if (!Number.isNaN(next) && next > 0) onLimitChange?.(next)
    setEditing(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 16 }}>
        <span style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--font-size-body)', lineHeight: 'var(--line-height-body)', fontWeight: 'var(--font-weight-medium)', color: 'var(--neutral-700)' }}>
          Token limit
        </span>
        {editing ? (
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <InputField
                fluid
                size="small"
                showLabel={false}
                showSubtitle={false}
                label="Token limit"
                placeholder="50000"
                value={limitDraft}
                onChange={setLimitDraft}
              />
            </div>
            <Button size="sm" variant="default" onClick={saveLimit}>Save</Button>
            <Button size="sm" variant="ghost" onClick={() => { setLimitDraft(String(link.tokenLimit)); setEditing(false) }}>Cancel</Button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div
              style={{
                flex:            1,
                minWidth:        0,
                padding:         '8px 12px',
                borderRadius:    10,
                backgroundColor: 'var(--neutral-50)',
                boxShadow:       '0px 0px 0px 1px var(--neutral-100)',
                fontFamily:      'var(--font-body)',
                fontSize:        'var(--font-size-body)',
                lineHeight:      'var(--line-height-body)',
                color:           'var(--neutral-900)',
              }}
            >
              {parseInt(limitDraft, 10).toLocaleString()} tokens
            </div>
            <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>Edit</Button>
          </div>
        )}
        {daysLeft !== null && (
          <span style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--font-size-caption)', lineHeight: 'var(--line-height-caption)', color: 'var(--neutral-500)' }}>
            At current rate, runs out in ~{daysLeft} {daysLeft === 1 ? 'day' : 'days'}.
          </span>
        )}
      </div>

      <Divider />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '16px 0' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
          <span style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--font-size-body)', lineHeight: 'var(--line-height-body)', fontWeight: 'var(--font-weight-medium)', color: 'var(--neutral-900)' }}>
            Pause this link
          </span>
          <span style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--font-size-caption)', lineHeight: 'var(--line-height-caption)', color: 'var(--neutral-500)' }}>
            External users can&rsquo;t access it while paused. Existing sessions end.
          </span>
        </div>
        <Switch
          checked={link.status === 'paused'}
          onCheckedChange={(on) => onStatusChange?.(on ? 'paused' : 'active')}
          aria-label="Pause this Super Link"
        />
      </div>

      <Divider />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 16 }}>
        <span style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--font-size-body)', lineHeight: 'var(--line-height-body)', fontWeight: 'var(--font-weight-medium)', color: 'var(--neutral-900)' }}>
          Revoke link
        </span>
        <span style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--font-size-caption)', lineHeight: 'var(--line-height-caption)', color: 'var(--neutral-500)' }}>
          Permanently invalidates the URL. Cannot be undone. All active sessions are terminated immediately.
        </span>
        {!showRevoke ? (
          <Button size="sm" variant="secondary" onClick={() => setShowRevoke(true)}>
            Revoke link
          </Button>
        ) : (
          <div
            style={{
              padding:         12,
              borderRadius:    12,
              backgroundColor: 'var(--color-status-danger-bg)',
              boxShadow:       '0 0 0 1px var(--color-status-danger-dot)',
              display:         'flex',
              flexDirection:   'column',
              gap:             10,
            }}
          >
            <span style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--font-size-body)', lineHeight: 'var(--line-height-body)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-status-danger-text)' }}>
              Are you sure?
            </span>
            <span style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--font-size-caption)', lineHeight: 'var(--line-height-caption)', color: 'var(--color-status-danger-text)' }}>
              Anyone using this link will lose access immediately. This cannot be undone.
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button
                size="sm"
                variant="danger"
                onClick={() => { onStatusChange?.('revoked'); setShowRevoke(false) }}
              >
                Yes, revoke
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowRevoke(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Drawer ────────────────────────────────────────────────────────────────────

// Modal sizing — keeps the panel a fixed size regardless of content. Width
// matches the previous side-panel (440); height is locked so users can scroll
// the body without the drawer growing/shrinking.
const MODAL_WIDTH  = 440
const MODAL_HEIGHT = 640

export function SuperLinkDrawer({ ref, link, onClose, onStatusChange, onLimitChange, className, style }: SuperLinkDrawerProps & { ref?: React.Ref<HTMLDivElement> }) {
    const reduceMotion = useReducedMotion() ?? false

    // ESC closes; only mounted while open so no idle keyboard listener.
    const closeOnEscape = useEffectEvent(onClose)
    React.useEffect(() => {
      if (!link) return
      const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeOnEscape() }
      window.addEventListener('keydown', onKey)
      return () => window.removeEventListener('keydown', onKey)
    }, [link])

    // Lock body scroll while modal is open.
    React.useEffect(() => {
      if (!link || typeof document === 'undefined') return
      const prev = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = prev }
    }, [link])

    if (typeof document === 'undefined') return null

    return createPortal(
      <AnimatePresence initial={false}>
        {link && (
          <m.div
            key="superlink-modal-root"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{    opacity: 0 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            style={{
              position:        'fixed',
              inset:           0,
              zIndex:          10,
              display:         'flex',
              alignItems:      'center',
              justifyContent:  'center',
              padding:         24,
              backgroundColor: 'var(--overlay-bg)',
              backdropFilter:  'blur(var(--overlay-blur))',
              WebkitBackdropFilter: 'blur(var(--overlay-blur))',
            }}
            onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
          >
          <m.aside
            ref={ref}
            key={link.id}
            role="dialog"
            aria-modal="true"
            aria-label={`${link.personaName} Super Link detail`}
            initial={reduceMotion ? { opacity: 0 } : { y: 12, opacity: 0, scale: 0.98 }}
            animate={reduceMotion ? { opacity: 1 } : { y: 0,  opacity: 1, scale: 1   }}
            exit={reduceMotion    ? { opacity: 0 } : { y: 12, opacity: 0, scale: 0.98 }}
            transition={springs.moderate}
            className={cn(className)}
            style={{
              isolation:       'isolate',
              position:        'relative',
              width:           MODAL_WIDTH,
              maxWidth:        '100%',
              height:          MODAL_HEIGHT,
              maxHeight:       '100%',
              flexShrink:      0,
              display:         'flex',
              flexDirection:   'column',
              borderRadius:    16,
              backgroundColor: 'var(--neutral-white)',
              boxShadow:       'var(--shadow-popover)',
              overflow:        'hidden',
              minHeight:       0,
              ...style,
            }}
          >
            <header
              style={{
                display:         'flex',
                alignItems:      'center',
                justifyContent:  'space-between',
                gap:             12,
                padding:         '16px 18px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                {link.avatarUrl ? (
                  <img
                    src={link.avatarUrl}
                    alt={link.personaName}
                    style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                  />
                ) : (
                  <Avatar name={link.personaName} color={link.avatarColor} size="md" />
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                  <span
                    style={{
                      fontFamily: 'var(--font-title)',
                      fontSize:   'var(--font-size-body)',
                      lineHeight: 'var(--line-height-body)',
                      fontWeight: 'var(--font-weight-medium)',
                      color:      'var(--neutral-900)',
                      whiteSpace: 'nowrap',
                      overflow:   'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {link.personaName}
                  </span>
                  <span
                    style={{
                      fontFamily: 'var(--font-body)',
                      fontSize:   'var(--font-size-caption)',
                      lineHeight: 'var(--line-height-caption)',
                      color:      'var(--neutral-500)',
                      whiteSpace: 'nowrap',
                      overflow:   'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {link.url}
                  </span>
                </div>
              </div>
              <IconButton aria-label="Close drawer" size="sm" variant="ghost" onClick={onClose} icon={<CancelOneIcon size={16} />} />
            </header>

            <Tabs defaultValue="overview" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
              <div style={{ padding: '0 18px' }}>
                <TabsList size="small">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="sessions">
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      Sessions
                      <Badge color="Neutral" label={String(link.sessions.length)} />
                    </span>
                  </TabsTrigger>
                  <TabsTrigger value="settings">Settings</TabsTrigger>
                </TabsList>
              </div>

              <div
                className="kaya-scrollbar"
                style={{
                  flex:                1,
                  minHeight:           0,
                  overflowY:           'auto',
                  overscrollBehaviorY: 'contain',
                  padding:             '18px',
                }}
              >
                <TabsContent value="overview"><DrawerOverview link={link} /></TabsContent>
                <TabsContent value="sessions"><DrawerSessions link={link} /></TabsContent>
                <TabsContent value="settings">
                  <DrawerSettings link={link} onStatusChange={onStatusChange} onLimitChange={onLimitChange} />
                </TabsContent>
              </div>
            </Tabs>
          </m.aside>
          </m.div>
        )}
      </AnimatePresence>,
      document.body,
    )
}

SuperLinkDrawer.displayName = 'SuperLinkDrawer'
export default SuperLinkDrawer
