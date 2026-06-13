'use client'

import React, { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/Button'
import { CardBrandLogo } from '@/components/CardBrandLogo'
import { Avatar } from '@/components/Avatar'
import { useOrg } from '@/context/org-context'
import { setMemberCap } from '@/lib/api/organization'
import type { OrgMember } from '@/types/teams'

// ── Card shell ────────────────────────────────────────────────────────────────

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      border:       '1px solid var(--neutral-200)',
      borderRadius: 16,
      boxShadow:    '0px 2px 2.8px 0px rgba(82,75,71,0.12)',
      overflow:     'hidden',
      ...style,
    }}>
      {children}
    </div>
  )
}

function CardHeader({
  title,
  subtitle,
  action,
}: {
  title:     string
  subtitle?: string
  action?:   React.ReactNode
}) {
  return (
    <div style={{
      borderBottom: '1px solid var(--neutral-100)',
      padding:      '12px 24px 24px',
      display:      'flex',
      alignItems:   'flex-start',
      gap:          12,
    }}>
      <div style={{ flex: '1 0 0', minWidth: 0 }}>
        <p style={{
          fontFamily:   'var(--font-body)',
          fontWeight:   500,
          fontSize:     16,
          lineHeight:   '22px',
          color:        'var(--neutral-900)',
          margin:       '0 0 6px',
        }}>
          {title}
        </p>
        {subtitle && (
          <p style={{
            fontFamily: 'var(--font-body)',
            fontWeight: 400,
            fontSize:   14,
            lineHeight: '22px',
            color:      'var(--neutral-500)',
            margin:     0,
          }}>
            {subtitle}
          </p>
        )}
      </div>
      {action}
    </div>
  )
}

// ── Credit cap input ──────────────────────────────────────────────────────────

function CapInput({
  memberId,
  currentCap,
  orgId,
  onSaved,
}: {
  memberId:  string
  currentCap?: number
  orgId:     string
  onSaved:   (newCap: number | null) => void
}) {
  const [editing, setEditing] = useState(false)
  const [value,   setValue]   = useState(currentCap != null ? String(currentCap) : '')
  const [saving,  setSaving]  = useState(false)

  const handleSave = async () => {
    setSaving(true)
    const parsed = value.trim() === '' ? null : Number(value.replace(/[^0-9]/g, ''))
    try {
      await setMemberCap(orgId, memberId, parsed)
      onSaved(parsed)
      setEditing(false)
      toast.success('Credit cap updated')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update cap')
    } finally {
      setSaving(false)
    }
  }

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        style={{
          background:     'none',
          border:         'none',
          cursor:         'pointer',
          fontFamily:     'var(--font-body)',
          fontSize:       14,
          color:          currentCap != null ? 'var(--neutral-900)' : 'var(--neutral-400)',
          textDecoration: 'underline',
          padding:        0,
        }}
      >
        {currentCap != null ? currentCap.toLocaleString() : 'Set cap'}
      </button>
    )
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <input
        autoFocus
        type="text"
        value={value}
        onChange={e => setValue(e.target.value)}
        placeholder="e.g. 5000"
        style={{
          width:           90,
          height:          28,
          border:          'none',
          borderRadius:    6,
          padding:         '0 8px',
          fontFamily:      'var(--font-body)',
          fontSize:        14,
          boxShadow:       '0px 0px 0px 1px var(--neutral-200)',
          outline:         'none',
        }}
      />
      <Button variant="default" size="sm" onClick={handleSave} disabled={saving}>
        {saving ? '…' : 'Save'}
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
        Cancel
      </Button>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function OrgPlansPage() {
  const { orgId, plan, members: orgMembers, membersLoading, refreshMembers } = useOrg()

  const [members, setMembers] = useState<OrgMember[]>([])

  useEffect(() => {
    setMembers(orgMembers)
  }, [orgMembers])

  const totalCredits   = plan?.totalCredits   ?? 0
  const usedCredits    = plan?.used           ?? 0
  const remainingCreds = plan?.remaining      ?? 0
  const poolStatus     = plan?.poolStatus     ?? '—'

  const handleCapSaved = (memberId: string, newCap: number | null) => {
    setMembers(ms => ms.map(m => m.id === memberId ? { ...m, creditCap: newCap ?? undefined } : m))
  }

  return (
    <div
      className="kaya-scrollbar"
      style={{
        flex:           '1 0 0',
        minHeight:      0,
        overflowY:      'auto',
        overflowX:      'hidden',
        display:        'flex',
        alignItems:     'flex-start',
        justifyContent: 'center',
        padding:        '64px 24px 48px',
      }}
    >
      <div style={{ width: '100%', maxWidth: 860, display: 'flex', flexDirection: 'column', gap: 10 }}>

        {/* ── Page header ── */}
        <div style={{ paddingLeft: 4, marginBottom: 4 }}>
          <h1 style={{
            fontFamily:   'var(--font-title)',
            fontWeight:   400,
            fontSize:     24,
            lineHeight:   '32px',
            color:        'var(--neutral-900)',
            margin:       0,
          }}>
            Plans &amp; Billing
          </h1>
          <p style={{
            fontFamily: 'var(--font-body)',
            fontWeight: 400,
            fontSize:   14,
            lineHeight: '22px',
            color:      'var(--neutral-500)',
            margin:     0,
          }}>
            Manage your subscription, credits, and payment details.
          </p>
        </div>

        {/* ── Credit pool card ── */}
        <Card>
          {/* Stats row */}
          <div style={{ padding: 12, display: 'flex', gap: 9, opacity: membersLoading ? 0.6 : 1 }}>
            {/* Shared credits */}
            <div style={{
              width:           200,
              flexShrink:      0,
              backgroundColor: 'var(--neutral-50)',
              borderRadius:    12,
              padding:         12,
              display:         'flex',
              flexDirection:   'column',
              gap:             2,
            }}>
              <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 13, lineHeight: '20px', color: 'var(--neutral-500)', margin: 0 }}>
                Total credits
              </p>
              <p style={{ fontFamily: 'var(--font-title)', fontWeight: 400, fontSize: 24, lineHeight: '32px', color: 'var(--neutral-900)', margin: 0 }}>
                {totalCredits.toLocaleString()}
              </p>
              <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 12, lineHeight: '16px', color: 'var(--neutral-400)', margin: 0 }}>
                Status: {poolStatus}
              </p>
            </div>

            {/* Credits remaining */}
            <div style={{
              width:           200,
              flexShrink:      0,
              backgroundColor: 'white',
              borderRadius:    12,
              padding:         12,
              display:         'flex',
              flexDirection:   'column',
              gap:             2,
              boxShadow:       '0px 1px 2px 0px rgba(82,75,71,0.08), 0px 0px 0px 1px var(--neutral-100)',
            }}>
              <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 13, lineHeight: '20px', color: 'var(--neutral-500)', margin: 0 }}>
                Credits Remaining
              </p>
              <p style={{ fontFamily: 'var(--font-title)', fontWeight: 400, fontSize: 24, lineHeight: '32px', color: 'var(--neutral-900)', margin: 0 }}>
                {remainingCreds.toLocaleString()}
              </p>
              <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 12, lineHeight: '16px', color: 'var(--neutral-400)', margin: 0 }}>
                {usedCredits.toLocaleString()} used
              </p>
            </div>

            {/* Seats used */}
            <div style={{
              width:           200,
              flexShrink:      0,
              backgroundColor: 'white',
              borderRadius:    12,
              padding:         12,
              display:         'flex',
              flexDirection:   'column',
              gap:             2,
              boxShadow:       '0px 1px 2px 0px rgba(82,75,71,0.08), 0px 0px 0px 1px var(--neutral-100)',
            }}>
              <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 13, lineHeight: '20px', color: 'var(--neutral-500)', margin: 0 }}>
                Members
              </p>
              <p style={{ fontFamily: 'var(--font-title)', fontWeight: 400, fontSize: 24, lineHeight: '32px', color: 'var(--neutral-900)', margin: 0 }}>
                {members.length}
              </p>
              <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 12, lineHeight: '16px', color: 'var(--neutral-400)', margin: 0 }}>
                in this workspace
              </p>
            </div>

            {/* Need more credits */}
            <div style={{
              flex:            '1 0 0',
              minWidth:        0,
              backgroundColor: 'white',
              borderRadius:    12,
              padding:         12,
              display:         'flex',
              flexDirection:   'column',
              gap:             6,
              boxShadow:       '0px 1px 2px 0px rgba(82,75,71,0.08), 0px 0px 0px 1px var(--neutral-100)',
            }}>
              <div style={{ flex: '1 0 0', minHeight: 0 }}>
                <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 13, lineHeight: '20px', color: 'var(--neutral-900)', margin: '0 0 4px' }}>
                  Need more credits?
                </p>
                <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 12, lineHeight: '16px', color: 'var(--neutral-400)', margin: 0 }}>
                  Top up anytime. Credits roll over within the billing period.
                </p>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button variant="secondary" size="sm">Buy more Credits</Button>
              </div>
            </div>
          </div>
        </Card>

        {/* ── Per-member credit caps card ── */}
        <Card>
          <CardHeader
            title="Per-member credit caps"
            subtitle="Set monthly credit limits per member to control spending. Members see their remaining balance in-app."
            action={
              <Button variant="ghost" size="sm" onClick={refreshMembers}>
                Refresh
              </Button>
            }
          />

          {membersLoading ? (
            <div style={{ padding: '24px', textAlign: 'center' }}>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--neutral-400)', margin: 0 }}>
                Loading members…
              </p>
            </div>
          ) : members.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center' }}>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--neutral-400)', margin: 0 }}>
                No members found.
              </p>
            </div>
          ) : members.map((member, i) => (
            <div
              key={member.id}
              style={{
                display:      'flex',
                alignItems:   'center',
                gap:          12,
                padding:      '12px 24px',
                borderBottom: i < members.length - 1 ? '1px solid var(--neutral-100)' : undefined,
              }}
            >
              <Avatar name={member.name} size="sm" />
              <div style={{ flex: '1 0 0', minWidth: 0 }}>
                <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-900)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {member.name || member.email}
                </p>
                <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 12, lineHeight: '16px', color: 'var(--neutral-400)', margin: 0 }}>
                  {member.creditUsed.toLocaleString()} credits used
                </p>
              </div>
              {orgId && (
                <CapInput
                  memberId={member.id}
                  currentCap={member.creditCap}
                  orgId={orgId}
                  onSaved={(cap) => handleCapSaved(member.id, cap)}
                />
              )}
            </div>
          ))}
        </Card>

        {/* ── Payment card ── */}
        <Card>
          <CardHeader
            title="Payment"
            subtitle="Manage your billing details."
          />
          <div style={{
            display:    'flex',
            alignItems: 'center',
            gap:        12,
            padding:    '12px 24px',
          }}>
            <CardBrandLogo brand="visa" />
            <div style={{ flex: '1 0 0', minWidth: 0 }}>
              <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-900)', margin: 0 }}>
                Card details managed via Stripe
              </p>
              <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 12, lineHeight: '16px', color: 'var(--neutral-400)', margin: 0 }}>
                Click below to open the Stripe billing portal.
              </p>
            </div>
            <Button variant="secondary" size="sm">Manage on Stripe</Button>
          </div>
        </Card>

        {/* ── Danger Zone card ── */}
        <Card style={{ border: '1px solid var(--red-400)' }}>
          <div style={{
            borderBottom: '1px solid var(--red-100)',
            padding:      '12px 24px 24px',
          }}>
            <p style={{
              fontFamily:   'var(--font-body)',
              fontWeight:   500,
              fontSize:     16,
              lineHeight:   '22px',
              color:        'var(--red-400)',
              margin:       '0 0 6px',
            }}>
              Danger Zone
            </p>
            <p style={{
              fontFamily: 'var(--font-body)',
              fontWeight: 400,
              fontSize:   14,
              lineHeight: '22px',
              color:      'var(--neutral-500)',
              margin:     0,
            }}>
              Actions here are permanent and cannot be undone.
            </p>
          </div>

          <div style={{
            display:    'flex',
            alignItems: 'center',
            gap:        12,
            padding:    '12px 24px',
          }}>
            <div style={{ flex: '1 0 0', minWidth: 0 }}>
              <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-900)', margin: 0 }}>
                Cancel Plan
              </p>
              <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 12, lineHeight: '16px', color: 'var(--neutral-400)', margin: 0 }}>
                Your workspace will revert to the free tier. All members will lose access to paid features.
              </p>
            </div>
            <Button variant="danger" size="sm">Cancel Plan</Button>
          </div>
        </Card>

      </div>
    </div>
  )
}
