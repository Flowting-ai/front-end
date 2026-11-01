'use client'

import { useState } from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { Dialog, DialogClose, DialogContent } from '@/components/ui/dialog'
import { CancelCircleIcon, TickTwoIcon } from '@strange-huge/icons'
import { RoleGlyph, ROLE_TOKENS, ROLE_LABEL } from '@/components/RoleBadge'
import { Button, IconButton } from '@/components/ui/button'
import { ROLES_INFO } from './RoleControls'

// Opened on demand from the page header, so the page loads them lazily.

// ── Roles & Permissions modal ──────────────────────────────────────────────────
// Triggered by the info button next to the "Members" page title, rather than
// a standalone card in the page flow. ROLES_INFO itself lives above, next to
// RoleDropdown, which is the other consumer.

// Badge diameter — same size for all four levels; the rail (connecting line +
// ordering) carries the hierarchy, not badge scale.
const ROLE_STACK_BADGE_SIZE = 36
const ROLE_STACK_RAIL_WIDTH = ROLE_STACK_BADGE_SIZE

export function RolesPermissionsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [detailOpen, setDetailOpen] = useState(false)
  // Radix shell: focus trap, Escape and outside-press close. The comparison dialog
  // stacks on top as its own layer, so Escape/outside clicks reach it first.

  return (
    <>
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose() }}>
      <DialogContent
        hideClose
        aria-label="Roles & Permissions"
        style={{
          width:      640,
          maxHeight:  'calc(100vh - 64px)',
          borderRadius: 20,
          background: 'var(--legacy-f9f5f1)',
          border:     '1px solid var(--border-default)',
          boxShadow:  '0px 8px 32px color-mix(in srgb, var(--static-black) 12%, transparent)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, padding: '24px 24px 16px' }}>
          <div>
            <DialogPrimitive.Title asChild>
            <h2 style={{ fontFamily: 'var(--font-title)', fontWeight: 500, fontSize: 20, lineHeight: '28px', color: 'var(--neutral-900)', margin: 0 }}>
              Roles &amp; Permissions
            </h2>
            </DialogPrimitive.Title>
            <DialogPrimitive.Description asChild>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: '22px', color: 'var(--neutral-500)', margin: '4px 0 0' }}>
              Default behavior for new projects and chats across the workspace.
            </p>
            </DialogPrimitive.Description>
          </div>
          <DialogClose asChild>
            <IconButton variant="ghost" size="sm" aria-label="Close" icon={<CancelCircleIcon size={18} />} />
          </DialogClose>
        </div>

        {/* Hierarchical stack, highest role first — a vertical timeline (rail +
            circular badges, all the same size) connecting the four roles top
            to bottom; ordering and copy carry the hierarchy. The connector
            between two badges is a flex-grown div, so it always fills exactly
            the gap between them with no manual pixel math. */}
        <div className="kaya-scrollbar" style={{ overflowY: 'auto' }}>
          <div style={{ display: 'flex', flexDirection: 'column', padding: '4px 24px 24px' }}>
            {ROLES_INFO.map((item, i) => {
              const tokens = ROLE_TOKENS[item.role]
              const badgeSize = ROLE_STACK_BADGE_SIZE
              const isLast = i === ROLES_INFO.length - 1
              return (
                <div
                  key={item.role}
                  style={{ display: 'flex', gap: 14 }}
                >
                  {/* Rail column — badge, then a connector filling the rest of this row's height */}
                  <div style={{ width: ROLE_STACK_RAIL_WIDTH, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{
                      flexShrink:      0,
                      width:           badgeSize,
                      height:          badgeSize,
                      borderRadius:    '50%',
                      display:         'flex',
                      alignItems:      'center',
                      justifyContent:  'center',
                      backgroundColor: tokens.bg,
                      boxShadow:       tokens.shadow,
                      color:           tokens.text,
                    }}>
                      <RoleGlyph role={item.role} size={Math.round(badgeSize * 0.5)} />
                    </div>
                    {!isLast && (
                      <div aria-hidden style={{ width: 2, flex: '1 0 0', marginTop: 4, backgroundColor: 'var(--neutral-200)' }} />
                    )}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingTop: 4, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                      <p style={{
                        margin:     0,
                        fontFamily: 'var(--font-title)',
                        fontWeight: 400,
                        fontSize:   20,
                        lineHeight: '24px',
                        color:      tokens.text,
                      }}>
                        {ROLE_LABEL[item.role]}
                      </p>
                      {(i === 0 || isLast) && (
                        <span style={{
                          fontFamily: 'var(--font-body)',
                          fontWeight: 500,
                          fontSize:   'var(--font-size-caption)',
                          color:      'var(--neutral-400)',
                        }}>
                          {i === 0 ? 'Highest access' : 'Lowest access'}
                        </span>
                      )}
                    </div>
                    <p style={{
                      margin:     0,
                      fontFamily: 'var(--font-body)',
                      fontWeight: 400,
                      fontSize:   'var(--font-size-body)',
                      lineHeight: 'var(--line-height-body)',
                      color:      'var(--neutral-600)',
                    }}>
                      {item.description}
                    </p>
                    {/* Gap to the next role — lives in the text column (not row
                        padding/margin) so the rail's flex-grown connector, which
                        stretches to match this column's full height, threads
                        through it and reaches the next badge with no gap in the line. */}
                    {!isLast && <div style={{ height: 20 }} />}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '16px 24px 24px' }}>
          <Button variant="secondary" size="sm" onClick={() => setDetailOpen(true)}>
            View in detail
          </Button>
        </div>
      </DialogContent>
    </Dialog>

    <RoleComparisonModal open={detailOpen} onClose={() => setDetailOpen(false)} />
    </>
  )
}

// ── Role comparison table ──────────────────────────────────────────────────────
// Rows mirror the actual capability ladder in src/lib/roles.ts (itself a mirror
// of the backend's services/organizations/roles.py) — not a separate marketing
// description of the roles, so this can't drift from what the roles actually do.

const ROLE_COMPARISON_COLUMNS = ROLES_INFO.map(r => r.role)
const ROLE_COMPARISON_GRID_COLUMNS = 'minmax(200px, 1fr) repeat(2, 84px)'

const ROLE_CAPABILITIES: { label: string; grants: Record<'admin' | 'member', boolean> }[] = [
  {
    label: 'Access assigned projects',
    grants: { admin: true, member: true },
  },
  {
    label: 'Full access to every project org-wide',
    grants: { admin: true, member: false },
  },
  {
    label: 'Manage the org: invites, members, roles, connectors',
    grants: { admin: true, member: false },
  },
  {
    label: 'Manage billing: plans, top-ups, invoices, payment method',
    grants: { admin: true, member: false },
  },
]

function RoleComparisonModal({ open, onClose }: { open: boolean; onClose: () => void }) {

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose() }}>
      <DialogContent
        hideClose
        aria-label="Role comparison"
        style={{
          width:      720,
          maxHeight:  'calc(100vh - 64px)',
          borderRadius: 20,
          background: 'var(--modal-bg)',
          border:     '1px solid var(--border-default)',
          boxShadow:  '0px 8px 32px color-mix(in srgb, var(--static-black) 12%, transparent)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, padding: '24px 24px 16px' }}>
          <div>
            <DialogPrimitive.Title asChild>
            <h2 style={{ fontFamily: 'var(--font-title)', fontWeight: 500, fontSize: 20, lineHeight: '28px', color: 'var(--neutral-900)', margin: 0 }}>
              Role comparison
            </h2>
            </DialogPrimitive.Title>
            <DialogPrimitive.Description asChild>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: '22px', color: 'var(--neutral-500)', margin: '4px 0 0' }}>
              What each role can do, side by side.
            </p>
            </DialogPrimitive.Description>
          </div>
          <DialogClose asChild>
            <IconButton variant="ghost" size="sm" aria-label="Close" icon={<CancelCircleIcon size={18} />} />
          </DialogClose>
        </div>

        {/* Table */}
        <div className="kaya-scrollbar" style={{ overflowX: 'auto', overflowY: 'auto', paddingBottom: 24 }}>
          {/* Horizontal padding lives on this inner wrapper, not the
              scrolling element above — keeps the scrollbar flush with the
              modal's edge. */}
          <div style={{ padding: '0 24px' }}>
          <div style={{ minWidth: 640 }}>
            {/* Column header — role icon + name, same colors as the stack above */}
            <div style={{ display: 'grid', gridTemplateColumns: ROLE_COMPARISON_GRID_COLUMNS, gap: 8, padding: '8px 0' }}>
              <div />
              {ROLE_COMPARISON_COLUMNS.map(role => {
                const tokens = ROLE_TOKENS[role]
                return (
                  <div key={role} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <span style={{ display: 'inline-flex', color: tokens.text }}>
                      <RoleGlyph role={role} size={18} />
                    </span>
                    <p style={{ margin: 0, fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 13, color: tokens.text }}>
                      {ROLE_LABEL[role]}
                    </p>
                  </div>
                )
              })}
            </div>

            <div style={{ height: 1, backgroundColor: 'var(--neutral-200)' }} />

            {/* Capability rows */}
            {ROLE_CAPABILITIES.map((cap, i) => (
              <div
                key={cap.label}
                style={{
                  display:             'grid',
                  gridTemplateColumns: ROLE_COMPARISON_GRID_COLUMNS,
                  gap:                 8,
                  alignItems:          'center',
                  padding:             '12px 0',
                  borderBottom:        i < ROLE_CAPABILITIES.length - 1 ? '1px solid var(--neutral-100)' : 'none',
                }}
              >
                <p style={{ margin: 0, fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 13, lineHeight: '18px', color: 'var(--neutral-700)' }}>
                  {cap.label}
                </p>
                {ROLE_COMPARISON_COLUMNS.map(role => (
                  <div key={role} style={{ display: 'flex', justifyContent: 'center' }}>
                    {cap.grants[role]
                      ? <TickTwoIcon size={16} color="var(--green-600)" />
                      : <span style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--neutral-300)' }}>–</span>}
                  </div>
                ))}
              </div>
            ))}
          </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
