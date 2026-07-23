'use client'

import React from 'react'
import { AnimatePresence, m } from 'framer-motion'
import { CopyOneIcon, TickTwoIcon, ArrowUpRightOneIcon } from '@strange-huge/icons'
import { Avatar } from '@/components/Avatar'
import { Badge, type BadgeColor } from '@/components/Badge'
import { IconButton } from '@/components/IconButton'
import { Tooltip } from '@/components/Tooltip'
import { TokenBudgetBar } from '@/components/TokenBudgetBar'
import { springs } from '@/lib/springs'
import { cn } from '@/lib/utils'

function fmt(n: number): string {
  return n.toLocaleString('en-US')
}

function fmtRelative(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const diffMin = Math.floor((Date.now() - then) / 60_000)
  if (diffMin < 1)  return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24)  return `${diffHr}h ago`
  const diffDay = Math.floor(diffHr / 24)
  if (diffDay < 30) return `${diffDay}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function fmtShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const COPIED_RESET_MS = 1500

// ── Types ─────────────────────────────────────────────────────────────────────

export type SuperLinkStatus = 'active' | 'paused' | 'limit-reached' | 'revoked'

const STATUS_BADGE: Record<SuperLinkStatus, { color: BadgeColor, label: string }> = {
  'active':        { color: 'Green',   label: 'Active'        },
  'paused':        { color: 'Neutral', label: 'Paused'        },
  'limit-reached': { color: 'Red',     label: 'Limit reached' },
  'revoked':       { color: 'Neutral', label: 'Revoked'       },
}

export interface SuperLinkRowProps extends React.HTMLAttributes<HTMLDivElement> {
  personaName:  string
  avatarColor:  string
  /** Optional persona image URL — shown instead of initials when provided. */
  avatarUrl?:   string | null
  url:          string
  tokenUsed:    number
  tokenLimit:   number
  status:       SuperLinkStatus
  selected?:    boolean
  /** Total conversations this link has ever seen. Omit to hide the usage line entirely. */
  conversations?: number
  /** Unique recipients across those conversations. */
  uniqueUsers?:   number
  /**
   * ISO timestamp of the most recent activity (falls back to creation time
   * when never used). Labeled "Created" instead of "Last used" when
   * `conversations` is 0/undefined, since it isn't really usage in that case.
   */
  lastActivityAt?: string
  /** ISO timestamp the link expires at, if it has an expiry. */
  expiresAt?:      string
  onCopyUrl?:   (e: React.MouseEvent<HTMLButtonElement>) => void
  /** When provided, renders a configure button that navigates to the sharing tab. */
  onConfigure?: (e: React.MouseEvent<HTMLButtonElement>) => void
}

// ── Component ─────────────────────────────────────────────────────────────────

export function SuperLinkRow(
  {
    ref,
    personaName, avatarColor, avatarUrl, url, tokenUsed, tokenLimit, status,
    conversations, uniqueUsers, lastActivityAt, expiresAt,
    selected = false, onCopyUrl, onConfigure, onClick,
    className, style, ...props
  }: SuperLinkRowProps & { ref?: React.Ref<HTMLDivElement> },
) {
    const [hovered, setHovered] = React.useState(false)
    const [copied, setCopied]   = React.useState(false)
    const copyTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
    React.useEffect(() => () => { if (copyTimer.current) clearTimeout(copyTimer.current) }, [])

    const handleCopy = (e: React.MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation()
      // Best-effort clipboard write; consumers can also wire `onCopyUrl` for analytics.
      try { void navigator.clipboard?.writeText(url) } catch { /* ignore */ }
      onCopyUrl?.(e)
      setCopied(true)
      if (copyTimer.current) clearTimeout(copyTimer.current)
      copyTimer.current = setTimeout(() => setCopied(false), COPIED_RESET_MS)
    }

    const badge = STATUS_BADGE[status]
    const dimmed = status === 'revoked'

    return (
      <div
        ref={ref}
        role="button"
        tabIndex={0}
        aria-pressed={selected}
        onClick={onClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            ;(onClick as ((evt: React.MouseEvent<HTMLDivElement>) => void) | undefined)?.(e as unknown as React.MouseEvent<HTMLDivElement>)
          }
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={cn('kds-superlink-row', className)}
        style={{
          display:         'flex',
          flexDirection:   'column',
          gap:             10,
          padding:         '14px 16px',
          borderRadius:    14,
          backgroundColor: selected ? 'var(--neutral-50)' : 'var(--neutral-white)',
          border:          '1px solid var(--neutral-100)',
          boxShadow:       selected
                             ? 'var(--shadow-surface-card-selected)'
                             : hovered
                               ? 'var(--shadow-surface-card-hover)'
                               : 'var(--shadow-surface-card)',
          cursor:          dimmed ? 'default' : 'pointer',
          opacity:         dimmed ? 0.55 : 1,
          transition:      'box-shadow 150ms ease, background-color 150ms ease, border-color 150ms ease',
          outline:         'none',
          ...style,
        }}
        {...props}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          {/* Avatar — image when available, initials fallback */}
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={personaName}
              style={{
                width: 24, height: 24,
                borderRadius: '50%',
                objectFit: 'cover',
                flexShrink: 0,
              }}
            />
          ) : (
            <Avatar name={personaName} color={avatarColor} size="xs" />
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
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
                {personaName}
              </span>
              <Badge color={badge.color} label={badge.label} />
            </div>
            <span
              style={{
                fontFamily:   'var(--font-body)',
                fontSize:     'var(--font-size-caption)',
                lineHeight:   'var(--line-height-caption)',
                color:        'var(--neutral-500)',
                whiteSpace:   'nowrap',
                overflow:     'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {url}
            </span>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
            {onConfigure && (
              <Tooltip content="Open sharing settings" side="top">
                <IconButton
                  aria-label={`Open sharing settings for ${personaName}`}
                  size="xs"
                  variant="ghost"
                  onClick={(e) => { e.stopPropagation(); onConfigure(e) }}
                  icon={<ArrowUpRightOneIcon size={14} />}
                />
              </Tooltip>
            )}
            <Tooltip content={copied ? 'Copied!' : 'Copy link URL'} side="top">
              <IconButton
                aria-label={copied ? 'Link copied' : 'Copy link URL'}
                size="xs"
                variant="ghost"
                onClick={handleCopy}
                icon={
                  <AnimatePresence mode="popLayout" initial={false}>
                    <m.span
                      key={copied ? 'check' : 'copy'}
                      initial={{ scale: 0.75, opacity: 0, filter: 'blur(4px)' }}
                      animate={{ scale: 1,    opacity: 1, filter: 'blur(0px)' }}
                      exit={{    scale: 0.75, opacity: 0, filter: 'blur(4px)' }}
                      transition={springs.fast}
                      style={{ display: 'inline-flex', transformOrigin: 'center' }}
                    >
                      {copied ? <TickTwoIcon size={14} /> : <CopyOneIcon size={14} />}
                    </m.span>
                  </AnimatePresence>
                }
              />
            </Tooltip>
          </div>
        </div>

        {/* Usage + activity — only rendered when the caller supplies the data
            (all optional, so existing consumers with no share/recipient info
            are unaffected). */}
        {(conversations !== undefined || lastActivityAt || expiresAt) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', rowGap: 2 }}>
            {conversations !== undefined && (
              <span style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--font-size-caption)', lineHeight: 'var(--line-height-caption)', color: 'var(--neutral-500)' }}>
                {conversations} conversation{conversations === 1 ? '' : 's'}
                {uniqueUsers !== undefined && conversations > 0 ? ` · ${uniqueUsers} user${uniqueUsers === 1 ? '' : 's'}` : ''}
              </span>
            )}
            {(conversations !== undefined && (lastActivityAt || expiresAt)) && (
              <span style={{ color: 'var(--neutral-300)', fontSize: 12 }}>·</span>
            )}
            {lastActivityAt && (
              <span style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--font-size-caption)', lineHeight: 'var(--line-height-caption)', color: 'var(--neutral-500)' }}>
                {conversations ? `Last used ${fmtRelative(lastActivityAt)}` : `Created ${fmtRelative(lastActivityAt)}`}
              </span>
            )}
            {lastActivityAt && expiresAt && (
              <span style={{ color: 'var(--neutral-300)', fontSize: 12 }}>·</span>
            )}
            {expiresAt && (
              <span style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--font-size-caption)', lineHeight: 'var(--line-height-caption)', color: 'var(--neutral-500)' }}>
                Expires {fmtShortDate(expiresAt)}
              </span>
            )}
          </div>
        )}

        {/* Token usage — text line matching SuperLink component format */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{
            fontFamily: 'var(--font-body)',
            fontSize:   'var(--font-size-caption)',
            color:      'var(--neutral-500)',
            lineHeight: 'var(--line-height-caption)',
          }}>
            {tokenLimit > 0
              ? `${Math.min(100, Math.round((tokenUsed / tokenLimit) * 100))}% used · ${fmt(tokenUsed)} / ${fmt(tokenLimit)} credits`
              : `${fmt(tokenUsed)} credits`}
          </span>
          <TokenBudgetBar used={tokenUsed} limit={tokenLimit} size="sm" />
        </div>
      </div>
    )
}

SuperLinkRow.displayName = 'SuperLinkRow'
export default SuperLinkRow
