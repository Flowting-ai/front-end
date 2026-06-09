'use client'

import React, { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/Button'

// ── Shadows ───────────────────────────────────────────────────────────────────
const SHADOW_INPUT    = '0px 1px 1.5px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-100,#ede1d7)'
const SHADOW_PIN_CARD = '0px 2px 2.8px 0px var(--neutral-200,#d1c6bd), 0px 0px 0px 1px var(--neutral-200,#d1c6bd)'
const SHADOW_BTN_BACK = '0px 1.091px 1.091px 0px rgba(59,54,50,0.05), 0px 1.455px 3.127px 0px rgba(38,33,30,0.15), 0px 0px 0px 1px var(--neutral-100,#ede1d7)'

// ── Step badges ───────────────────────────────────────────────────────────────
function StepBadges({ step }: { step: 0 | 1 }) {
  const steps: Array<{ label: string; index: 0 | 1 }> = [
    { label: 'Team',    index: 0 },
    { label: 'Connect', index: 1 },
  ]
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      {steps.map(({ label, index }) => (
        <span key={label} style={{ opacity: index > step ? 0.5 : 1 }}>
          <Badge label={label} color="Blue" />
        </span>
      ))}
    </div>
  )
}

// ── Gradient avatar ────────────────────────────────────────────────────────────
function GradientAvatar({ initial = 'M' }: { initial?: string }) {
  return (
    <div style={{
      width: 65, height: 65, borderRadius: 8, flexShrink: 0,
      background: 'linear-gradient(180deg, #12036a 0%, #4800ff 100%)',
      boxShadow: '0px 1.091px 1.09px 0px rgba(59,54,50,0.05), 0px 1.455px 1px 0px rgba(38,33,30,0.15), 0px 0px 0px 1px var(--neutral-100,#ede1d7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden',
    }}>
      <span style={{
        fontFamily: 'var(--font-title)', fontWeight: 400, fontSize: 40,
        lineHeight: 1, color: 'var(--neutral-white)',
      }}>
        {initial}
      </span>
    </div>
  )
}

// ── Field label ───────────────────────────────────────────────────────────────
function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14,
      lineHeight: '22px', color: 'var(--neutral-700)', margin: 0,
    }}>
      {children}
    </p>
  )
}

// ── Text input ────────────────────────────────────────────────────────────────
function FormInput({
  value, onChange, placeholder, multiline, rows, autoFocus, type = 'text',
}: {
  value: string; onChange: (v: string) => void; placeholder?: string
  multiline?: boolean; rows?: number; autoFocus?: boolean; type?: string
}) {
  const sharedStyle: React.CSSProperties = {
    flex: '1 0 0', minWidth: 0, border: 'none', outline: 'none',
    background: 'transparent', fontFamily: 'var(--font-body)',
    fontSize: 14, fontWeight: 400, lineHeight: '22px', color: 'var(--neutral-600)',
    resize: 'none',
  }
  return (
    <div style={{
      display: 'flex', backgroundColor: 'var(--neutral-white)',
      borderRadius: 10, boxShadow: SHADOW_INPUT,
      padding: '7px 10px', width: '100%', boxSizing: 'border-box',
    }}>
      {multiline ? (
        <textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows ?? 5}
          style={{ ...sharedStyle, height: '100%', width: '100%' }}
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          style={{ ...sharedStyle, width: '100%' }}
        />
      )}
    </div>
  )
}

// ── Inline chip ───────────────────────────────────────────────────────────────
function InlineChip({ label, color = 'Neutral', onRemove }: {
  label: string; color?: 'Blue' | 'Yellow' | 'Neutral'; onRemove?: () => void
}) {
  const CHIP_COLORS = {
    Blue:    { bg: 'var(--color-tag-Blue-bg-soft)',   text: 'var(--color-tag-Blue-text)'   },
    Yellow:  { bg: 'var(--color-tag-Yellow-bg-soft)', text: 'var(--color-tag-Yellow-text)' },
    Neutral: { bg: 'var(--neutral-100)',              text: 'var(--neutral-700)'            },
  }
  const c = CHIP_COLORS[color]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: 999,
      backgroundColor: c.bg, color: c.text,
      fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 12,
    }}>
      {label}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'none', border: 'none', cursor: 'pointer', padding: 0,
            color: 'inherit', opacity: 0.6, lineHeight: 0,
          }}
          aria-label={`Remove ${label}`}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
            <path d="M7.5 2.5l-5 5M2.5 2.5l5 5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
        </button>
      )}
    </span>
  )
}

// ── Icon sidebar ──────────────────────────────────────────────────────────────
function IconSidebar() {
  return (
    <div style={{
      width: 52, flexShrink: 0, display: 'flex', flexDirection: 'column',
      alignItems: 'center', backgroundColor: '#f7f2ed', height: '100%',
      padding: '24px 0 12px', gap: 4, position: 'relative',
    }}>
      {[
        <svg key="home" width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M3 8.5L10 3l7 5.5V17a1 1 0 01-1 1H4a1 1 0 01-1-1V8.5z" stroke="var(--neutral-500)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>,
        <svg key="user" width="20" height="20" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="7" r="3" stroke="var(--neutral-600)" strokeWidth="1.4"/><path d="M4 17c0-3.314 2.686-5 6-5s6 1.686 6 5" stroke="var(--neutral-600)" strokeWidth="1.4" strokeLinecap="round"/></svg>,
        <svg key="search" width="20" height="20" viewBox="0 0 20 20" fill="none"><circle cx="9" cy="9" r="5" stroke="var(--neutral-500)" strokeWidth="1.4"/><path d="M13.5 13.5L17 17" stroke="var(--neutral-500)" strokeWidth="1.4" strokeLinecap="round"/></svg>,
      ].map((icon, i) => (
        <div key={i} style={{
          width: 32, height: 32, borderRadius: 10, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          ...(i === 1 ? {
            backgroundColor: 'rgba(237,225,215,0.6)',
            boxShadow: '0px 1px 1.5px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px rgba(182,172,164,0.4)',
          } : {}),
        }}>
          {icon}
        </div>
      ))}
      <div style={{
        position: 'absolute', bottom: 12,
        width: 32, height: 32, borderRadius: '50%',
        backgroundColor: 'var(--neutral-white)',
        boxShadow: '0px 1px 1.5px 0px rgba(82,75,71,0.15), 0px 0px 0px 1px rgba(182,172,164,0.4)',
      }} />
    </div>
  )
}

// ── Card shell ────────────────────────────────────────────────────────────────
function CardShell({ step, heading, sub, onClose, children, footer }: {
  step: 0 | 1; heading: string; sub: string
  onClose?: () => void; children: React.ReactNode; footer: React.ReactNode
}) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', flex: '1 0 0',
      minWidth: 0, padding: '10px 10px 10px 0', height: '100%', boxSizing: 'border-box',
    }}>
      <div
        className="kaya-scrollbar"
        style={{
          display: 'flex', flexDirection: 'column', flex: '1 0 0', minHeight: 0,
          borderRadius: 22, border: '1px solid var(--neutral-200,#d1c6bd)',
          backgroundColor: 'rgba(255,255,255,0.2)',
          paddingTop: 32, paddingLeft: 48, paddingRight: 48, paddingBottom: 32,
          overflowY: 'auto', boxSizing: 'border-box',
        }}
      >
        {/* Step badges + close */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 90 }}>
          <div style={{ flex: '1 0 0', display: 'flex', justifyContent: 'center' }}>
            <StepBadges step={step} />
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 36, height: 36, borderRadius: 10, border: 'none',
              background: 'transparent', boxShadow: '0px 0px 0px 1px rgba(59,54,50,0.3)',
              cursor: 'pointer', outline: 'none',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
              <path d="M14.5 5.5L5.5 14.5M5.5 5.5l9 9" stroke="var(--neutral-700)" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Heading */}
        <div style={{ textAlign: 'center', marginBottom: 35, display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }}>
          <p style={{
            fontFamily: 'var(--font-title)', fontWeight: 400, fontSize: 24,
            lineHeight: '32px', color: '#1a1916', margin: 0, whiteSpace: 'nowrap',
          }}>
            {heading}
          </p>
          <p style={{
            fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14,
            lineHeight: '22px', color: '#827a74', margin: 0, width: 416, textAlign: 'center',
          }}>
            {sub}
          </p>
        </div>

        {/* Content */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: '1 0 0' }}>
          {children}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 64 }}>
          {footer}
        </div>
      </div>
    </div>
  )
}

// ── Footer buttons ────────────────────────────────────────────────────────────
function CardFooter({ step, onBack, onSkip, onContinue, continueLabel = 'Continue' }: {
  step: 0 | 1; onBack?: () => void; onSkip?: () => void
  onContinue: () => void; continueLabel?: string
}) {
  const backButton = step === 1 && onBack ? (
    <button
      type="button"
      onClick={onBack}
      style={{
        display: 'flex', alignItems: 'center', gap: 2, padding: '6px 10px',
        borderRadius: 10, border: 'none', cursor: 'pointer', outline: 'none',
        backgroundColor: 'white', boxShadow: SHADOW_BTN_BACK,
        fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, color: 'var(--neutral-700)',
      }}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden style={{ marginRight: 2 }}>
        <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      Back
    </button>
  ) : <div />

  return (
    <>
      {backButton}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {step === 0 && onSkip && (
          <button
            type="button"
            onClick={onSkip}
            style={{
              border: 'none', background: 'none', cursor: 'pointer', outline: 'none',
              fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14,
              color: 'var(--neutral-400)', padding: '6px 4px',
            }}
          >
            Skip for now
          </button>
        )}
        <Button variant="default" size="sm" onClick={onContinue}>{continueLabel}</Button>
      </div>
    </>
  )
}

// ── Invitee type ──────────────────────────────────────────────────────────────
type InviteeRole = 'editor' | 'member'
interface Invitee { email: string; role: InviteeRole }

const SEED_INVITEES: Invitee[] = [
  { email: 'priya@acme.com',  role: 'editor' },
  { email: 'hassan@acme.com', role: 'member' },
]

// ── Step 0 — Basics ───────────────────────────────────────────────────────────
function BasicsStep({ name, setName }: { name: string; setName: (v: string) => void }) {
  const [invite,   setInvite]   = useState('')
  const [invites,  setInvites]  = useState<Invitee[]>(SEED_INVITEES)
  const [desc,     setDesc]     = useState('')
  const [tags,     setTags]     = useState<string[]>(['Internal', 'Legal'])
  const [tagInput, setTagInput] = useState('')
  const initial = name.trim() ? name.trim().charAt(0).toUpperCase() : 'M'

  function addInvite() {
    const t = invite.trim().replace(/,+$/, '')
    if (!t || invites.some(i => i.email === t)) return
    setInvites(p => [...p, { email: t, role: 'member' }])
    setInvite('')
  }

  return (
    <div style={{ width: 406, display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Avatar */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 24 }}>
        <FieldLabel>Avatar</FieldLabel>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <GradientAvatar initial={initial} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <button type="button" style={{
              display: 'flex', gap: 2, alignItems: 'center',
              padding: '5px 8px', borderRadius: 8, border: 'none', cursor: 'pointer',
              backgroundColor: 'transparent', outline: 'none',
              boxShadow: '0px 0px 0px 1px rgba(59,54,50,0.3)',
              fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, color: 'var(--neutral-700)',
            }}>
              Change image
            </button>
            <span style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 11, color: 'var(--neutral-700)' }}>
              drag &amp; drop · paste
            </span>
          </div>
        </div>
      </div>

      {/* Workspace name */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '8px 0' }}>
        <FieldLabel>Workspace name</FieldLabel>
        <FormInput value={name} onChange={setName} placeholder="Marketing" autoFocus />
      </div>

      {/* Invite teammates */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7, padding: '8px 0' }}>
        <FieldLabel>Invite teammates</FieldLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            backgroundColor: 'var(--neutral-white)',
            border: '1px solid var(--neutral-200,#d1c6bd)', borderRadius: 6, padding: '8px 12px',
          }}>
            <input
              type="email"
              value={invite}
              onChange={e => setInvite(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ',' || e.key === ' ') { e.preventDefault(); addInvite() } }}
              placeholder="teammate@company.com"
              style={{
                flex: '1 0 0', border: 'none', outline: 'none', background: 'transparent',
                fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, color: 'var(--neutral-600)',
              }}
            />
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden style={{ flexShrink: 0 }}>
              <path d="M5 8l5 5 5-5" stroke="var(--neutral-400)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 11, color: '#d97757', margin: 0 }}>
            Type an email and press space, comma, or enter to add them.
          </p>
        </div>
        {invites.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
            {invites.map(inv => (
              <InlineChip
                key={inv.email}
                color={inv.role === 'editor' ? 'Blue' : 'Neutral'}
                label={inv.email.split('@')[0] ?? inv.email}
                onRemove={() => setInvites(p => p.filter(i => i.email !== inv.email))}
              />
            ))}
          </div>
        )}
      </div>

      {/* Description */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '8px 0', height: 129 }}>
        <FieldLabel>Description</FieldLabel>
        <FormInput value={desc} onChange={setDesc} placeholder="What does this team work on?" multiline rows={4} />
      </div>

      {/* Tags */}
      <div style={{ marginTop: 8 }}>
        <FieldLabel>Tags</FieldLabel>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '8px 6px', flexWrap: 'wrap' }}>
          {tags.map(tag => {
            const color: 'Blue' | 'Yellow' | 'Neutral' =
              tag === 'Internal' ? 'Blue' : tag === 'Legal' ? 'Yellow' : 'Neutral'
            return (
              <InlineChip
                key={tag}
                color={color}
                label={tag}
                onRemove={() => setTags(p => p.filter(t => t !== tag))}
              />
            )
          })}
          <input
            value={tagInput}
            onChange={e => setTagInput(e.target.value)}
            placeholder="Add tag…"
            onKeyDown={e => {
              if ((e.key === 'Enter' || e.key === ',') && tagInput.trim()) {
                e.preventDefault()
                setTags(p => [...p, tagInput.trim()])
                setTagInput('')
              }
            }}
            style={{
              border: 'none', outline: 'none', background: 'transparent',
              fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--neutral-500)',
              minWidth: 80,
            }}
          />
          <span style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 11, color: 'var(--neutral-300)', marginLeft: 'auto' }}>
            {tags.join('').length}/120
          </span>
        </div>
      </div>
    </div>
  )
}

// ── Connector letter mark ─────────────────────────────────────────────────────
const CONNECTOR_COLORS: Record<string, { bg: string; text: string }> = {
  googledrive: { bg: '#fff',    text: '#2f73d9' },
  notion:      { bg: '#fff',    text: '#1f1b18' },
  github:      { bg: '#000',    text: '#fff'    },
  linear:      { bg: '#5e6ad2', text: '#fff'    },
  slack:       { bg: '#4a154b', text: '#fff'    },
  gmail:       { bg: '#fff',    text: '#d93025' },
  figma:       { bg: '#f24e1e', text: '#fff'    },
  hubspot:     { bg: '#fff2e8', text: '#c54f1c' },
}

function ConnectorLetterMark({ id, name }: { id: string; name: string }) {
  const colors = CONNECTOR_COLORS[id] ?? { bg: 'var(--neutral-100)', text: 'var(--neutral-700)' }
  return (
    <div style={{
      width: 30, height: 30, borderRadius: 6, display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: colors.bg, color: colors.text,
      fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 13,
      border: colors.bg === '#fff' ? '1px solid var(--neutral-100)' : 'none',
    }}>
      {name.charAt(0)}
    </div>
  )
}

// ── Configure connectors data ─────────────────────────────────────────────────
const CONFIGURE_CONNECTORS: Array<{ id: string; name: string; category: string; description: string }> = [
  { id: 'googledrive', name: 'Google Drive',  category: 'Productivity',  description: 'Access, attach, and search files from your Drive directly in chat.' },
  { id: 'notion',      name: 'Notion',        category: 'Productivity',  description: 'Read and write docs, databases, and pages directly from Souvenir Brain.' },
  { id: 'github',      name: 'GitHub',        category: 'Interactive',   description: 'Reference repos, pull requests, and issues. Review code with full repo context.' },
  { id: 'linear',      name: 'Linear',        category: 'Interactive',   description: 'Manage issues, projects, and cycles directly from Souvenir Brain.' },
  { id: 'slack',       name: 'Slack',         category: 'Communication', description: 'Send messages, search channels, and surface summaries.' },
  { id: 'gmail',       name: 'Gmail',         category: 'Communication', description: 'Read, draft, and send emails directly from Souvenir Brain.' },
  { id: 'figma',       name: 'Figma',         category: 'Design',        description: 'Reference designs, extract specs, and annotate components.' },
  { id: 'hubspot',     name: 'HubSpot',       category: 'Data',          description: 'Read contacts, deals, and pipelines. Surface CRM context inside Brain.' },
]

// ── Pin card (connector card for onboarding grid) ─────────────────────────────
function PinCard({ id, name, category, description, added, onAdd }: {
  id: string; name: string; category: string; description: string; added: boolean; onAdd: () => void
}) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 12, padding: 16,
      borderRadius: 16, backgroundColor: 'var(--neutral-white)',
      boxShadow: SHADOW_PIN_CARD, width: 385, boxSizing: 'border-box', flexShrink: 0,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', gap: 4, alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', flex: '1 0 0', gap: 12, alignItems: 'center', minWidth: 0 }}>
          <div style={{ width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <ConnectorLetterMark id={id} name={name} />
          </div>
          <div style={{ flex: '1 0 0', minWidth: 0 }}>
            <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-900)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {name}
            </p>
            <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 11, lineHeight: '16px', color: 'var(--neutral-500)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {category}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: 10, flexShrink: 0 }}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
            <circle cx="10" cy="5" r="1.2" fill="var(--neutral-400)"/>
            <circle cx="10" cy="10" r="1.2" fill="var(--neutral-400)"/>
            <circle cx="10" cy="15" r="1.2" fill="var(--neutral-400)"/>
          </svg>
        </div>
      </div>

      {/* Description */}
      <p style={{
        fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 11, lineHeight: '16px',
        color: '#827a74', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis',
        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const,
      }}>
        {description}
      </p>

      {/* Add button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={onAdd}
          style={{
            display: 'flex', alignItems: 'center', gap: 2, padding: '4px 8px 6px',
            borderRadius: 8, border: 'none', cursor: 'pointer', outline: 'none', position: 'relative',
            boxShadow: '0px 0px 0px 1px black, 0px 1.091px 1.091px 0px rgba(59,54,50,0.1), 0px 1.455px 3.127px 0px rgba(59,54,50,0.4)',
          }}
        >
          <span aria-hidden style={{
            position: 'absolute', inset: 0, borderRadius: 8, pointerEvents: 'none',
            background: added
              ? 'linear-gradient(180deg, #4b9b6b 0%, #2d6e4b 100%)'
              : 'linear-gradient(180deg, var(--neutral-700,#524b47) 0%, var(--neutral-900,#26211e) 100%)',
            transition: 'background 200ms',
          }} />
          <span aria-hidden style={{
            position: 'absolute', inset: 0, borderRadius: 8, pointerEvents: 'none',
            boxShadow: 'inset 0px 1px 0.364px 0px rgba(247,242,237,0.3), inset 0px -2.182px 0.364px 0px #120c08',
          }} />
          <span style={{ position: 'relative', width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
              {added
                ? <path d="M3 8l4 4 6-6" stroke="rgba(247,242,237,0.9)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                : <path d="M8 3v10M3 8h10" stroke="rgba(247,242,237,0.9)" strokeWidth="1.5" strokeLinecap="round"/>
              }
            </svg>
          </span>
          <span style={{ position: 'relative', fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-50,#f7f2ed)', whiteSpace: 'nowrap', padding: '0 2px' }}>
            {added ? 'Added' : 'Add'}
          </span>
        </button>
      </div>
    </div>
  )
}

// ── Step 1 — Configure ────────────────────────────────────────────────────────
function ConfigureStep() {
  const [added, setAdded] = useState<string[]>([])
  const toggle = (id: string) => setAdded(p => p.includes(id) ? p.filter(c => c !== id) : [...p, id])
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 13, width: 783 }}>
      {CONFIGURE_CONNECTORS.map(c => (
        <PinCard key={c.id} {...c} added={added.includes(c.id)} onAdd={() => toggle(c.id)} />
      ))}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
const SUB = 'Name your team, add a logo, and invite your teammates. You all share one credit pool.'

export default function WorkspaceSetupPage() {
  const [step, setStep] = useState<0 | 1>(0)
  const [name, setName] = useState('')

  return (
    <div style={{ display: 'flex', width: '100%', height: '100vh', backgroundColor: '#f7f2ed', overflow: 'hidden' }}>
      <IconSidebar />
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0, transition: { duration: 0.18, ease: [0.16, 1, 0.3, 1] } }}
          exit={{ opacity: 0, x: -12, transition: { duration: 0.12 } }}
          style={{ display: 'flex', flex: '1 0 0', minWidth: 0, height: '100%' }}
        >
          <CardShell
            step={step}
            heading="Set up your team"
            sub={SUB}
            footer={
              <CardFooter
                step={step}
                onBack={step === 1 ? () => setStep(0) : undefined}
                onSkip={step === 0 ? () => setStep(1) : undefined}
                onContinue={() => step === 0 ? setStep(1) : undefined}
                continueLabel={step === 1 ? 'Finish setup' : 'Continue'}
              />
            }
          >
            {step === 0
              ? <BasicsStep name={name} setName={setName} />
              : <ConfigureStep />
            }
          </CardShell>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
