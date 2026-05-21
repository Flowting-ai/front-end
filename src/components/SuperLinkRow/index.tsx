'use client'

import React from 'react'
import { AnimatePresence, m } from 'framer-motion'
import { CopyOneIcon, TickTwoIcon } from '@strange-huge/icons'
import { Avatar } from '@/components/Avatar'
import { Badge, type BadgeColor } from '@/components/Badge'
import { IconButton } from '@/components/IconButton'
import { TokenBudgetBar } from '@/components/TokenBudgetBar'
import { springs } from '@/lib/springs'
import { cn } from '@/lib/utils'

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
  url:          string
  tokenUsed:    number
  tokenLimit:   number
  status:       SuperLinkStatus
  selected?:    boolean
  onCopyUrl?:   (e: React.MouseEvent<HTMLButtonElement>) => void
}

// ── Component ─────────────────────────────────────────────────────────────────

export function SuperLinkRow(
  {
    ref,
    personaName, avatarColor, url, tokenUsed, tokenLimit, status,
    selected = false, onCopyUrl, onClick,
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
          boxShadow:       selected
                             ? 'var(--shadow-surface-card-selected)'
                             : hovered
                               ? 'var(--shadow-surface-card-hover)'
                               : 'var(--shadow-surface-card)',
          cursor:          dimmed ? 'default' : 'pointer',
          opacity:         dimmed ? 0.55 : 1,
          transition:      'box-shadow 150ms ease, background-color 150ms ease',
          outline:         'none',
          ...style,
        }}
        {...props}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <Avatar name={personaName} color={avatarColor} size="xs" />
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
        </div>

        <TokenBudgetBar used={tokenUsed} limit={tokenLimit} size="sm" />
      </div>
    )
}

SuperLinkRow.displayName = 'SuperLinkRow'
export default SuperLinkRow
