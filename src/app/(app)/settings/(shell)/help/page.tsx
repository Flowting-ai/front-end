'use client'

import React, { useState, useEffect } from 'react'
import { HelpSkeleton } from '../SettingsSkeleton'

// ── External link arrow icon ──────────────────────────────────────────────────

function ArrowUpRightIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M4.5 11.5L11.5 4.5M11.5 4.5H6.5M11.5 4.5V9.5"
        stroke="var(--neutral-700)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// ── Ghost button (outline, transparent) ──────────────────────────────────────

function GhostButton({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display:         'inline-flex',
        alignItems:      'center',
        gap:             2,
        justifyContent:  'center',
        padding:         '5px 8px',
        borderRadius:    8,
        border:          'none',
        cursor:          'pointer',
        backgroundColor: 'transparent',
        boxShadow:       '0px 0px 0px 1px rgba(59,54,50,0.3)',
        fontFamily:      'var(--font-body)',
        fontWeight:      500,
        fontSize:        14,
        lineHeight:      '22px',
        color:           'var(--neutral-700)',
        whiteSpace:      'nowrap',
        flexShrink:      0,
      }}
    >
      {children}
    </button>
  )
}

// ── Link row (used in both Help resources and Legal cards) ────────────────────

function LinkRow({
  title,
  description,
  divider,
  href,
}: {
  title:       string
  description: string
  divider?:    boolean
  href?:       string
}) {
  return (
    <div style={{
      display:      'flex',
      alignItems:   'center',
      gap:          12,
      padding:      '12px 24px 24px',
      borderBottom: divider ? '1px solid var(--neutral-100)' : undefined,
    }}>
      <div style={{ flex: '1 0 0', minWidth: 0 }}>
        <p style={{
          fontFamily: 'var(--font-body)',
          fontWeight: 500,
          fontSize:   14,
          lineHeight: '22px',
          color:      'var(--neutral-900)',
          margin:     0,
        }}>
          {title}
        </p>
        <p style={{
          fontFamily: 'var(--font-body)',
          fontWeight: 400,
          fontSize: 12,
          lineHeight: '16px',
          color:      'var(--neutral-500)',
          margin:     0,
          whiteSpace: 'nowrap',
        }}>
          {description}
        </p>
      </div>
      <GhostButton onClick={() => href && window.open(href, '_blank')}>
        View <ArrowUpRightIcon />
      </GhostButton>
    </div>
  )
}

// ── Card shell ────────────────────────────────────────────────────────────────

function InfoCard({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      border:       '1px solid var(--neutral-200)',
      borderRadius: 16,
      boxShadow:    '0px 2px 2.8px 0px rgba(82,75,71,0.12)',
      overflow:     'hidden',
    }}>
      {children}
    </div>
  )
}

function CardHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div style={{
      borderBottom: '1px solid var(--neutral-100)',
      padding:      '12px 24px 24px',
    }}>
      <p style={{
        fontFamily:   'var(--font-body)',
        fontWeight:   500,
        fontSize:     16,
        lineHeight:   '22px',
        color:        'var(--neutral-900)',
        margin:       '0 0 6px',
        overflow:     'hidden',
        textOverflow: 'ellipsis',
        whiteSpace:   'nowrap',
      }}>
        {title}
      </p>
      <p style={{
        fontFamily:   'var(--font-body)',
        fontWeight:   400,
        fontSize:     14,
        lineHeight:   '22px',
        color:        'var(--neutral-500)',
        margin:       0,
        overflow:     'hidden',
        textOverflow: 'ellipsis',
        whiteSpace:   'nowrap',
      }}>
        {subtitle}
      </p>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function HelpPage() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])
  if (!mounted) return <HelpSkeleton />
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
            overflow:     'hidden',
            textOverflow: 'ellipsis',
            whiteSpace:   'nowrap',
          }}>
            Help &amp; Legal
          </h1>
          <p style={{
            fontFamily: 'var(--font-body)',
            fontWeight: 400,
            fontSize:   14,
            lineHeight: '22px',
            color:      'var(--neutral-500)',
            margin:     0,
          }}>
            Get support, share feedback, and review the legal documents that govern your use of Souvenir.
          </p>
        </div>

        {/* ── Feature Request + Report a Bug (side by side) ── */}
        <div style={{ display: 'flex', gap: 10 }}>

          {/* Feature Request */}
          <div style={{
            flex:            '1 0 0',
            minWidth:        0,
            backgroundColor: 'white',
            borderRadius:    16,
            boxShadow:       '0px 2px 2.8px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-100)',
            padding:         12,
            display:         'flex',
            flexDirection:   'column',
            gap:             12,
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <p style={{
                fontFamily:   'var(--font-body)',
                fontWeight:   500,
                fontSize:     14,
                lineHeight:   '22px',
                color:        'var(--neutral-900)',
                margin:       0,
                overflow:     'hidden',
                textOverflow: 'ellipsis',
                whiteSpace:   'nowrap',
              }}>
                Feature Request
              </p>
              <p style={{
                fontFamily: 'var(--font-body)',
                fontWeight: 400,
                fontSize:   14,
                lineHeight: '22px',
                color:      'var(--neutral-500)',
                margin:     0,
              }}>
                We&apos;re building Souvenir with you, not just for you. Tell us what would make your experience better - we read every request.
              </p>
            </div>
            <GhostButton>Suggest a feature</GhostButton>
          </div>

          {/* Report a Bug */}
          <div style={{
            flex:            '1 0 0',
            minWidth:        0,
            backgroundColor: 'white',
            borderRadius:    16,
            boxShadow:       '0px 2px 2.8px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-100)',
            padding:         12,
            display:         'flex',
            flexDirection:   'column',
            gap:             12,
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <p style={{
                fontFamily:   'var(--font-body)',
                fontWeight:   500,
                fontSize:     14,
                lineHeight:   '22px',
                color:        'var(--neutral-900)',
                margin:       0,
                overflow:     'hidden',
                textOverflow: 'ellipsis',
                whiteSpace:   'nowrap',
              }}>
                Report a Bug
              </p>
              <p style={{
                fontFamily: 'var(--font-body)',
                fontWeight: 400,
                fontSize:   14,
                lineHeight: '22px',
                color:      'var(--neutral-500)',
                margin:     0,
              }}>
                Something didn&apos;t work right? Your report helps our small team ship a better Souvenir. Please describe what happened and what you expected.
              </p>
            </div>
            <GhostButton>Report a bug</GhostButton>
          </div>

        </div>

        {/* ── Help resources card ── */}
        <InfoCard>
          <CardHeader
            title="Help resources"
            subtitle="Guides, documentation, and direct support options."
          />
          <LinkRow title="Help Center"         description="Guides, documentation, and direct support options."                  divider />
          <LinkRow title="Contact Support"     description="Guides, tutorials, and FAQs for getting the most out of Souvenir"    divider />
          <LinkRow title="Community Slack"   description="Connect with other Souvenir users, share workflows, get tips"   href="https://join.slack.com/t/souvenircommunity/shared_invite/zt-41rhgppbm-G7Z_dv1VJXdSL087irwKJg" divider />
          {/* <LinkRow title="What's new"          description="Changelog - see every feature release, fix, and update" /> */}
        </InfoCard>

        {/* ── Legal card ── */}
        <InfoCard>
          <CardHeader
            title="Legal"
            subtitle="Review the agreements and policies that govern your use of Souvenir."
          />
          <LinkRow title="Terms of Service"           description="Your agreement with Souvenir AI regarding use of the platform"     href="https://www.getsouvenir.com/legal/terms"   divider />
          <LinkRow title="Privacy Policy"             description="How we collect, use, and protect your personal data"               href="https://www.getsouvenir.com/legal/privacy" divider />
          {/* <LinkRow title="Data Processing Agreement"  description="DPA for teams and enterprise customers - GDPR, DPDPA compliant"    divider /> */}
          <LinkRow title="Cookie Policy"              description="How we use cookies and similar tracking technologies"              href="https://www.getsouvenir.com/legal/cookies" />
        </InfoCard>

        {/* ── Footer ── */}
        <div style={{
          display:    'flex',
          alignItems: 'center',
          gap:        8,
          padding:    '0 12px',
        }}>
          <p style={{
            flex:         '1 0 0',
            minWidth:     0,
            fontFamily:   'var(--font-body)',
            fontWeight:   500,
            fontSize:     16,
            lineHeight:   '22px',
            color:        'var(--neutral-200)',
            margin:       0,
            overflow:     'hidden',
            textOverflow: 'ellipsis',
            whiteSpace:   'nowrap',
          }}>
            Souvenir v1.1 · © 2026 Souvenir AI
          </p>
          <p style={{
            fontFamily:   'var(--font-body)',
            fontWeight:   500,
            fontSize:     16,
            lineHeight:   '22px',
            color:        'var(--neutral-200)',
            margin:       0,
            flexShrink:   0,
            overflow:     'hidden',
            textOverflow: 'ellipsis',
            whiteSpace:   'nowrap',
          }}>
          </p>
        </div>

      </div>
    </div>
  )
}
