'use client'

import React, { useState } from 'react'

// ── Shared button styles ──────────────────────────────────────────────────────

function DarkButton({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display:         'inline-flex',
        alignItems:      'center',
        justifyContent:  'center',
        padding:         '6px 10px 8px',
        borderRadius:    10,
        border:          'none',
        cursor:          'pointer',
        background:      'linear-gradient(180deg, var(--neutral-700) 0%, var(--neutral-900) 100%)',
        boxShadow:       '0px 1px 1.5px 0px rgba(82,75,71,0.5), 0px 0px 0px 1px var(--neutral-900), inset 0px 1px 0px 0px rgba(255,255,255,0.08)',
        fontFamily:      'var(--font-body)',
        fontWeight:      500,
        fontSize:        14,
        lineHeight:      '22px',
        color:           'white',
        whiteSpace:      'nowrap',
        flexShrink:      0,
      }}
    >
      {children}
    </button>
  )
}

function WhiteButton({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display:         'inline-flex',
        alignItems:      'center',
        justifyContent:  'center',
        padding:         '6px 10px 8px',
        borderRadius:    10,
        border:          'none',
        cursor:          'pointer',
        backgroundColor: 'white',
        boxShadow:       '0px 1.091px 1.091px 0px rgba(59,54,50,0.05), 0px 1.455px 3.127px 0px rgba(38,33,30,0.15), 0px 0px 0px 1px var(--neutral-100), inset 0px -2.182px 0.364px 0px var(--neutral-100)',
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

// ── Text input ────────────────────────────────────────────────────────────────

function TextInput({
  value,
  onChange,
  placeholder,
  readOnly,
  style,
}: {
  value:        string
  onChange?:    (v: string) => void
  placeholder?: string
  readOnly?:    boolean
  style?:       React.CSSProperties
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={e => onChange?.(e.target.value)}
      placeholder={placeholder}
      readOnly={readOnly}
      style={{
        height:          36,
        backgroundColor: readOnly ? 'var(--neutral-50)' : 'white',
        borderRadius:    10,
        boxShadow:       '0px 1px 1.5px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-100)',
        border:          'none',
        padding:         '7px 10px',
        fontFamily:      'var(--font-body)',
        fontWeight:      400,
        fontSize:        14,
        lineHeight:      '22px',
        color:           readOnly ? 'var(--neutral-400)' : 'var(--neutral-900)',
        boxSizing:       'border-box',
        outline:         'none',
        ...style,
      }}
    />
  )
}

// ── Copy icon ─────────────────────────────────────────────────────────────────

function CopyIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="5.5" y="5.5" width="7" height="8" rx="1.5" stroke="var(--neutral-400)" strokeWidth="1.2" />
      <path d="M10.5 5.5V4a1.5 1.5 0 0 0-1.5-1.5H4A1.5 1.5 0 0 0 2.5 4v5A1.5 1.5 0 0 0 4 10.5h1.5" stroke="var(--neutral-400)" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  )
}

// ── Card shell ────────────────────────────────────────────────────────────────

function Card({ children }: { children: React.ReactNode }) {
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

function CardHeader({
  title,
  subtitle,
  badge,
}: {
  title:     string
  subtitle?: string
  badge?:    React.ReactNode
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
          overflow:     'hidden',
          textOverflow: 'ellipsis',
          whiteSpace:   'nowrap',
        }}>
          {title}
        </p>
        {subtitle && (
          <p style={{
            fontFamily:   'var(--font-body)',
            fontWeight:   400,
            fontSize:     14,
            lineHeight:   '22px',
            color:        'var(--neutral-500)',
            margin:       0,
          }}>
            {subtitle}
          </p>
        )}
      </div>
      {badge}
    </div>
  )
}

// ── Field row ─────────────────────────────────────────────────────────────────

function FieldRow({
  label,
  helper,
  children,
}: {
  label:    string
  helper?:  string
  children: React.ReactNode
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <p style={{
        fontFamily: 'var(--font-body)',
        fontWeight: 500,
        fontSize:   14,
        lineHeight: '22px',
        color:      'var(--neutral-900)',
        margin:     0,
      }}>
        {label}
      </p>
      {children}
      {helper && (
        <p style={{
          fontFamily: 'var(--font-body)',
          fontWeight: 400,
          fontSize:   11,
          lineHeight: '16px',
          color:      'var(--neutral-400)',
          margin:     0,
        }}>
          {helper}
        </p>
      )}
    </div>
  )
}

// ── Dropdown select pill ──────────────────────────────────────────────────────

function SelectPill({ label }: { label: string }) {
  return (
    <button style={{
      display:         'inline-flex',
      alignItems:      'center',
      gap:             6,
      padding:         '5px 10px',
      borderRadius:    8,
      border:          'none',
      cursor:          'pointer',
      backgroundColor: 'white',
      boxShadow:       '0px 1.091px 1.091px 0px rgba(59,54,50,0.05), 0px 1.455px 3.127px 0px rgba(38,33,30,0.15), 0px 0px 0px 1px var(--neutral-100), inset 0px -2.182px 0.364px 0px var(--neutral-100)',
      fontFamily:      'var(--font-body)',
      fontWeight:      400,
      fontSize:        14,
      lineHeight:      '22px',
      color:           'var(--neutral-700)',
      whiteSpace:      'nowrap',
      width:           327,
      justifyContent:  'space-between',
    }}>
      <span>{label}</span>
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M4 6l4 4 4-4" stroke="var(--neutral-500)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  )
}

// ── Verification badge ────────────────────────────────────────────────────────

function VerifiedBadge() {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="7" cy="7" r="6" fill="var(--green-50)" stroke="var(--green-400)" strokeWidth="1" />
        <path d="M4.5 7l2 2 3-3" stroke="var(--green-700)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span style={{
        fontFamily: 'var(--font-body)',
        fontWeight: 400,
        fontSize:   13,
        lineHeight: '20px',
        color:      'var(--green-700)',
      }}>
        Verified
      </span>
    </div>
  )
}

function VerifyLink() {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <span style={{
        fontFamily: 'var(--font-body)',
        fontWeight: 400,
        fontSize:   13,
        lineHeight: '20px',
        color:      'var(--neutral-500)',
      }}>
        Verify
      </span>
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M3 7h8M7 3l4 4-4 4" stroke="var(--neutral-500)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  )
}

// ── Domain row ────────────────────────────────────────────────────────────────

function DomainRow({
  domain,
  discoverableLabel,
  verification,
  divider,
}: {
  domain:            string
  discoverableLabel: string
  verification:      'verified' | 'pending'
  divider?:          boolean
}) {
  return (
    <div style={{
      display:      'flex',
      alignItems:   'center',
      gap:          32,
      padding:      '10px 24px',
      borderBottom: divider ? '1px solid var(--neutral-100)' : undefined,
    }}>
      <span style={{
        flex:       '1 0 0',
        minWidth:   0,
        fontFamily: 'var(--font-body)',
        fontWeight: 400,
        fontSize:   14,
        lineHeight: '22px',
        color:      'var(--neutral-900)',
      }}>
        {domain}
      </span>
      <div style={{ width: 91 }}>
        <button style={{
          display:         'inline-flex',
          alignItems:      'center',
          gap:             4,
          padding:         '2px 8px',
          borderRadius:    6,
          border:          'none',
          cursor:          'pointer',
          backgroundColor: 'white',
          boxShadow:       '0px 1px 1.5px 0px rgba(82,75,71,0.08), 0px 0px 0px 1px var(--neutral-200)',
          fontFamily:      'var(--font-body)',
          fontWeight:      400,
          fontSize:        13,
          lineHeight:      '20px',
          color:           'var(--neutral-700)',
          whiteSpace:      'nowrap',
        }}>
          {discoverableLabel}
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M3 4.5l3 3 3-3" stroke="var(--neutral-500)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
      <div style={{ width: 91 }}>
        {verification === 'verified' ? <VerifiedBadge /> : <VerifyLink />}
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function OrgGeneralPage() {
  const [workspaceName,    setWorkspaceName]    = useState('Souvenir_Core')
  const [slugValue,        setSlugValue]        = useState('souvenir-core')
  const [aiInstructions,   setAiInstructions]   = useState('')

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
        padding:        '96px 155px 48px',
      }}
    >
      <div style={{ flex: '1 0 0', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>

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
            General
          </h1>
          <p style={{
            fontFamily: 'var(--font-body)',
            fontWeight: 400,
            fontSize:   14,
            lineHeight: '22px',
            color:      'var(--neutral-500)',
            margin:     0,
          }}>
            Manage your workspace identity, AI instructions, and default settings.
          </p>
        </div>

        {/* ── Workspace Identity card ── */}
        <Card>
          <CardHeader
            title="Workspace Identity"
            subtitle="Set your workspace name, logo, and URL."
          />

          {/* Avatar row */}
          <div style={{
            display:      'flex',
            alignItems:   'center',
            gap:          12,
            padding:      '12px 24px',
            borderBottom: '1px solid var(--neutral-100)',
          }}>
            <div style={{
              width:           65,
              height:          65,
              borderRadius:    '50%',
              backgroundColor: 'var(--neutral-200)',
              flexShrink:      0,
              overflow:        'hidden',
              display:         'flex',
              alignItems:      'center',
              justifyContent:  'center',
            }}>
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect width="32" height="32" rx="16" fill="var(--neutral-300)" />
                <path d="M16 8a5 5 0 1 1 0 10A5 5 0 0 1 16 8zM8 26c0-4.418 3.582-8 8-8s8 3.582 8 8" stroke="var(--neutral-500)" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
            <div style={{ flex: '1 0 0', minWidth: 0 }}>
              <p style={{
                fontFamily: 'var(--font-body)',
                fontWeight: 500,
                fontSize:   14,
                lineHeight: '22px',
                color:      'var(--neutral-900)',
                margin:     0,
              }}>
                Workspace logo
              </p>
              <p style={{
                fontFamily: 'var(--font-body)',
                fontWeight: 400,
                fontSize:   11,
                lineHeight: '16px',
                color:      'var(--neutral-400)',
                margin:     0,
              }}>
                PNG, JPG or GIF. Recommended 512×512px.
              </p>
            </div>
            <WhiteButton>Change Avatar</WhiteButton>
          </div>

          {/* Workspace name */}
          <div style={{
            padding:      '12px 24px',
            borderBottom: '1px solid var(--neutral-100)',
          }}>
            <FieldRow label="Workspace name">
              <TextInput
                value={workspaceName}
                onChange={setWorkspaceName}
                style={{ width: 521 }}
              />
            </FieldRow>
          </div>

          {/* Slug + ID side by side */}
          <div style={{
            padding:      '12px 24px',
            borderBottom: '1px solid var(--neutral-100)',
            display:      'flex',
            gap:          16,
          }}>
            <div style={{ flex: '1 0 0', minWidth: 0 }}>
              <FieldRow
                label="Workspace URL slug"
                helper={`souvenir.ai/workspace/${slugValue}`}
              >
                <TextInput
                  value={slugValue}
                  onChange={setSlugValue}
                />
              </FieldRow>
            </div>
            <div style={{ flex: '1 0 0', minWidth: 0 }}>
              <FieldRow label="Workspace ID" helper="Read-only identifier">
                <div style={{ position: 'relative' }}>
                  <TextInput
                    value="ws_01HXN3K7Y2BVQTM4Z"
                    readOnly
                    style={{ width: '100%', paddingRight: 32 }}
                  />
                  <button
                    style={{
                      position:        'absolute',
                      right:           8,
                      top:             '50%',
                      transform:       'translateY(-50%)',
                      background:      'none',
                      border:          'none',
                      cursor:          'pointer',
                      padding:         0,
                      display:         'flex',
                      alignItems:      'center',
                      justifyContent:  'center',
                    }}
                  >
                    <CopyIcon />
                  </button>
                </div>
              </FieldRow>
            </div>
          </div>

          {/* Save changes */}
          <div style={{ padding: '12px 24px', display: 'flex', justifyContent: 'flex-end' }}>
            <DarkButton>Save changes</DarkButton>
          </div>
        </Card>

        {/* ── Organization-level AI instructions card ── */}
        <Card>
          <CardHeader
            title="Organization-level AI instructions"
            subtitle="These instructions apply to all AI interactions across your workspace. Members can add personal instructions that stack on top of these."
            badge={
              <div style={{
                display:         'inline-flex',
                alignItems:      'center',
                justifyContent:  'center',
                padding:         '2px 6px',
                borderRadius:    6,
                backgroundColor: 'var(--yellow-100)',
                boxShadow:       '0px 1px 1.5px 0px rgba(17,25,1,0.1), 0px 0px 0px 1px rgba(143,116,39,0.5)',
                flexShrink:      0,
              }}>
                <span style={{
                  fontFamily: 'var(--font-body)',
                  fontWeight: 500,
                  fontSize:   11,
                  lineHeight: '16px',
                  color:      'var(--yellow-700)',
                  whiteSpace: 'nowrap',
                }}>
                  Overrides personal
                </span>
              </div>
            }
          />

          <div style={{ padding: '12px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <textarea
              value={aiInstructions}
              onChange={e => setAiInstructions(e.target.value.slice(0, 3000))}
              placeholder={`e.g. "Always cite sources", "Keep responses under 200 words", "Use bullet points for lists"`}
              style={{
                width:           '100%',
                height:          96,
                resize:          'none',
                backgroundColor: 'white',
                borderRadius:    10,
                boxShadow:       '0px 1px 1.5px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-100)',
                border:          'none',
                padding:         '7px 10px',
                fontFamily:      'var(--font-body)',
                fontWeight:      400,
                fontSize:        14,
                lineHeight:      '22px',
                color:           'var(--neutral-600)',
                boxSizing:       'border-box',
                outline:         'none',
              }}
            />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <p style={{
                fontFamily: 'var(--font-body)',
                fontWeight: 400,
                fontSize:   11,
                lineHeight: '16px',
                color:      'var(--neutral-400)',
                margin:     0,
              }}>
                Changes take up to 1 hour to propagate across active sessions.
              </p>
              <p style={{
                fontFamily: 'var(--font-body)',
                fontWeight: 400,
                fontSize:   14,
                lineHeight: '22px',
                color:      'var(--neutral-500)',
                margin:     0,
                flexShrink: 0,
              }}>
                {aiInstructions.length}/3000
              </p>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <DarkButton>Save instructions</DarkButton>
            </div>
          </div>
        </Card>

        {/* ── Allowed email domains card ── */}
        <Card>
          <div style={{
            borderBottom: '1px solid var(--neutral-100)',
            padding:      '12px 24px',
            display:      'flex',
            alignItems:   'center',
            gap:          12,
          }}>
            <p style={{
              flex:       '1 0 0',
              minWidth:   0,
              fontFamily: 'var(--font-body)',
              fontWeight: 500,
              fontSize:   16,
              lineHeight: '22px',
              color:      'var(--neutral-900)',
              margin:     0,
            }}>
              Allowed email domains
            </p>
            <WhiteButton>+ Add domain</WhiteButton>
          </div>

          {/* Column headers */}
          <div style={{
            display:      'flex',
            alignItems:   'center',
            gap:          32,
            padding:      '6px 24px',
            borderBottom: '1px solid var(--neutral-100)',
          }}>
            <p style={{
              flex:       '1 0 0',
              fontFamily: 'var(--font-body)',
              fontWeight: 500,
              fontSize:   11,
              lineHeight: '16px',
              color:      'var(--neutral-500)',
              margin:     0,
            }}>
              Domain
            </p>
            <p style={{
              width:      91,
              fontFamily: 'var(--font-body)',
              fontWeight: 500,
              fontSize:   11,
              lineHeight: '16px',
              color:      'var(--neutral-500)',
              margin:     0,
            }}>
              Discoverable
            </p>
            <p style={{
              width:      91,
              fontFamily: 'var(--font-body)',
              fontWeight: 500,
              fontSize:   11,
              lineHeight: '16px',
              color:      'var(--neutral-500)',
              margin:     0,
            }}>
              Verification
            </p>
          </div>

          <DomainRow domain="getsouvenir.com" discoverableLabel="Allowed"  verification="verified" divider />
          <DomainRow domain="opent3st.com"    discoverableLabel="Blocked"  verification="verified" divider />
          <DomainRow domain="cca.edu"         discoverableLabel="Blocked"  verification="pending" />
        </Card>

        {/* ── Workspace defaults card ── */}
        <Card>
          <CardHeader
            title="Workspace defaults"
            subtitle="Set default behaviors for new chats and AI interactions in your workspace."
          />

          {/* Default chat visibility */}
          <div style={{
            display:      'flex',
            alignItems:   'center',
            gap:          12,
            padding:      '12px 24px',
            borderBottom: '1px solid var(--neutral-100)',
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
                Default chat visibility
              </p>
              <p style={{
                fontFamily: 'var(--font-body)',
                fontWeight: 400,
                fontSize:   11,
                lineHeight: '16px',
                color:      'var(--neutral-400)',
                margin:     0,
              }}>
                Controls whether new chats are visible to workspace members by default.
              </p>
            </div>
            <SelectPill label="Private by default" />
          </div>

          {/* Default persona */}
          <div style={{
            display:    'flex',
            alignItems: 'center',
            gap:        12,
            padding:    '12px 24px',
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
                Default persona
              </p>
              <p style={{
                fontFamily: 'var(--font-body)',
                fontWeight: 400,
                fontSize:   11,
                lineHeight: '16px',
                color:      'var(--neutral-400)',
                margin:     0,
              }}>
                The persona automatically applied to new conversations.
              </p>
            </div>
            <SelectPill label="None — use model default" />
          </div>
        </Card>

      </div>
    </div>
  )
}
