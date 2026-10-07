'use client'

import { Tooltip } from '@/components/Tooltip'
import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeftOneIcon, PlusSignIcon } from '@strange-huge/icons'
import { trackFeature } from '@/lib/analytics/events'
import { Button } from '@/components/Button'
import { PersonaCard, PERSONA_CARD_HEIGHT, PERSONA_CARD_WIDTH } from '@/components/PersonaCard'
import type { AvatarChoice } from '@/components/PersonaCard/AnimatedPersonaAvatar'
import type { AnySceneKind } from '@/components/PersonaCard/HeroScene'
import Tabs from '@/components/Tabs'
import { AgentPageShell } from '../_components/AgentPageShell'
import { TEMPLATE_PRESETS } from '../_data/template-presets'
import { listLinkedConnectors } from '@/lib/api/connectors'
import { fetchPersonas } from '@/lib/api/personas'
import { recommendTemplates, type TemplateRecommendation } from '@/lib/agent-templates'
import { AGENTS_NEW_ROUTE, AGENTS_ROUTE } from '@/lib/routes'

// ── Template categories ───────────────────────────────────────────────────────

// One line each — clamped to 2 lines in the card, so longer copy just wraps.
const TEMPLATE_DESCRIPTIONS: Record<string, string> = {
  'Customer Support': 'Answer tickets and resolve issues fast',
  'Sales': 'Qualify leads and move deals forward',
  'Legal': 'Review contracts and flag legal risk',
  'Research': 'Dig into topics and summarize findings',
  'Content Writer': 'Draft blog posts, copy, and social content',
  'Code Review': 'Catch bugs and suggest cleaner code',
  'Onboarding': 'Guide new hires through their first weeks',
  'Marketing': 'Plan campaigns and write marketing copy',
  'Data Analyst': 'Turn raw data into clear insights',
  'HR & Recruiting': 'Screen candidates and manage hiring',
  'Executive Assistant': 'Manage schedules, email, and logistics',
  'Education': 'Build lesson plans and course material',
  'Productivity': 'Organize tasks and keep projects on track',
  'Tutoring': 'Explain concepts and coach through problems',
  'Web QA': 'Test flows and catch UI regressions',
}

// Each template gets its own animated avatar, so a template card reads like the agent it becomes.
const TEMPLATE_AVATARS: Record<string, AvatarChoice> = {
  'Customer Support':    'sky',
  'Sales':               'lime',
  'Legal':               'slate',
  'Research':            'scout',
  'Content Writer':      'coral',
  'Code Review':         'indigo',
  'Onboarding':          'teal',
  'Marketing':           'marketing',
  'Data Analyst':        'violet',
  'HR & Recruiting':     'amber',
  'Executive Assistant': 'dusk',
  'Education':           'sand',
  'Productivity':        'mint',
  'Tutoring':            'rose',
  'Web QA':              'ember',
}

// …and its own animated banner for the job. Research and Marketing use their avatars'
// themed scenes (radar, social reactions), which already are those jobs.
const TEMPLATE_SCENES: Record<string, AnySceneKind> = {
  'Customer Support':    'support',
  'Sales':               'sales',
  'Legal':               'legal',
  'Research':            'scout',
  'Content Writer':      'writer',
  'Code Review':         'code',
  'Onboarding':          'onboarding',
  'Marketing':           'marketing',
  'Data Analyst':        'data',
  'HR & Recruiting':     'hr',
  'Executive Assistant': 'exec',
  'Education':           'education',
  'Productivity':        'productivity',
  'Tutoring':            'tutoring',
  'Web QA':              'webqa',
}

const TEMPLATE_NAMES = Object.keys(TEMPLATE_DESCRIPTIONS)

// ── Template card ─────────────────────────────────────────────────────────────
// The same animated agent card as /agents, with the template's own avatar and job banner; its button
// starts building an agent from the template.

const CARD_WIDTH = PERSONA_CARD_WIDTH
const CARD_HEIGHT = PERSONA_CARD_HEIGHT

// Three columns of agent cards; the page is as wide as the three plus their gaps.
const GRID_GAP = 16
const GRID_WIDTH = CARD_WIDTH * 3 + GRID_GAP * 2
const GRID_STYLE: React.CSSProperties = { display: 'grid', gridTemplateColumns: `repeat(3, ${CARD_WIDTH}px)`, gap: GRID_GAP }

function TemplateCard({ name, onClick, disabled }: { name: string; onClick: () => void; disabled?: boolean }) {
  return (
    <div data-template={name} style={{ opacity: disabled ? 0.6 : 1, pointerEvents: disabled ? 'none' : undefined }}>
      <PersonaCard
        name={name}
        handle=""
        description={TEMPLATE_DESCRIPTIONS[name]}
        avatarSeed={name}
        avatarChoice={TEMPLATE_AVATARS[name] ?? null}
        scene={TEMPLATE_SCENES[name]}
        createdBy="Souvenir"
        hideMenu
        onUseInChat={onClick}
        useInChatLabel="Use template"
      />
    </div>
  )
}

// ── Custom / start-blank card ───────────────────────────────────────────────────
// Same accent-icon + caption-description language as TemplateCard, but a wide
// dashed row rather than a grid tile — signals "not a template" while still
// matching the new visual system. Whole row is one button (was previously
// only the "Start blank" pill), so the "Start blank" pill below is decorative.

function CustomCard({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  const [hovered, setHovered] = useState(false)

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? 'var(--neutral-50)' : 'var(--neutral-white)',
        border: `1px dashed ${hovered ? 'var(--neutral-400)' : 'var(--neutral-300)'}`,
        borderRadius: 16,
        padding: '16px 17px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        width: GRID_WIDTH,
        boxShadow: hovered
          ? '0px 8px 16px 0px color-mix(in srgb, var(--blue-100) 50%, transparent), 0px 0px 0px 1px var(--neutral-100)'
          : '0px 2px 2.8px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-100)',
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        transform: hovered ? 'translateY(-1px)' : 'none',
        transition: 'background-color 150ms, border-color 150ms, box-shadow 150ms, transform 150ms, opacity 150ms',
        textAlign: 'left',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'var(--color-tag-Neutral-bg)',
          transform: hovered ? 'scale(1.06)' : 'scale(1)',
          transition: 'transform 150ms',
        }}>
          <PlusSignIcon size={20} color="var(--color-tag-Neutral-text)" />
        </div>
        <div>
          <p style={{
            fontFamily: 'var(--font-body)', fontWeight: 'var(--font-weight-medium)',
            fontSize: 15, lineHeight: '20px', color: 'var(--neutral-950)', margin: 0,
          }}>
            Custom
          </p>
          <p style={{
            fontFamily: 'var(--font-body)', fontWeight: 400,
            fontSize: 'var(--font-size-caption)', lineHeight: 'var(--line-height-caption)',
            color: 'var(--neutral-500)', margin: 0,
          }}>
            Start from scratch
          </p>
        </div>
      </div>
      <span
        aria-hidden
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          padding: '6px 12px', borderRadius: 8,
          border: `1px solid ${hovered ? 'var(--neutral-400)' : 'var(--neutral-300)'}`,
          fontFamily: 'var(--font-body)', fontWeight: 'var(--font-weight-medium)',
          fontSize: 13, lineHeight: '18px', color: 'var(--neutral-700)',
          transition: 'border-color 150ms',
        }}
      >
        Start blank
      </span>
    </button>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

// ── Recommended grid ──────────────────────────────────────────────────────────


function RecommendedGrid({
  recommendation, disabled, onPick, onBrowseAll,
}: {
  recommendation: { items: TemplateRecommendation[]; personalized: boolean } | null
  disabled: boolean
  onPick: (name: string) => void
  onBrowseAll: () => void
}) {
  if (!recommendation) {
    return (
      <div role="status" aria-live="polite" style={GRID_STYLE}>
        {[0, 1, 2].map(i => <div key={i} className="kaya-skeleton" style={{ height: CARD_HEIGHT, borderRadius: 15 }} />)}
      </div>
    )
  }
  const { items, personalized } = recommendation
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <p style={{ margin: 0, fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: '22px', color: 'var(--neutral-500)' }}>
        {personalized
          ? 'Picked from the apps you’ve connected.'
          : 'Connect apps to get suggestions that fit how you work. Until then, here are popular starting points.'}
      </p>
      {items.length === 0 ? (
        <p style={{ margin: 0, fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--neutral-600)' }}>
          You already have an agent for each of our suggestions.{' '}
          <button type="button" onClick={onBrowseAll} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', textDecoration: 'underline', color: 'inherit', font: 'inherit' }}>
            Browse all templates
          </button>
        </p>
      ) : (
        <div style={GRID_STYLE}>
          {items.map(item => (
            <div key={item.name} style={{ display: 'flex', flexDirection: 'column', gap: 6, width: CARD_WIDTH }}>
              <TemplateCard name={item.name} onClick={() => onPick(item.name)} disabled={disabled} />
              {item.because.length > 0 && (
                <Tooltip content={`Works with ${item.because.join(', ')}`} maxWidth={280}><span
                  style={{
                    fontFamily: 'var(--font-body)', fontSize: 'var(--font-size-caption)', lineHeight: 'var(--line-height-caption)',
                    color: 'var(--neutral-500)', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}
                >
                  Works with {item.because.join(', ')}
                </span></Tooltip>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function PersonaTemplatesPage() {
  const { push } = useRouter()

  // Hydration-race guard for the template/"Start blank" cards below: the
  // pre-hydration HTML renders every card `disabled` (this starts `false`,
  // so the very first — server/static — render has `hydrated === false`).
  // A native `disabled` button never dispatches click at all, so a click
  // that lands in the window between paint and hydration completing is
  // visibly inert instead of being silently swallowed (confirmed live: an
  // early click on a plain enabled button in that window does nothing, no
  // navigation, no error — see 02b-agents-before-scan.md). The effect below
  // only runs once hydration has completed, so the flip to enabled can't
  // happen any earlier than the point React's event handlers are actually
  // live. On a normal machine this resolves in well under one frame and is
  // imperceptible; it only matters on the slow/throttled devices where the
  // race was reproducible.
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => { setHydrated(true) }, [])

  // Analytics: the template gallery was browsed (Layer 4 feature).
  useEffect(() => { trackFeature('agent_template_browsed') }, [])

  // "Recommended for you": ranked from the apps the user has connected and the
  // agents they already have. Both lookups are best-effort — without them the
  // tab simply falls back to popular starting points.
  const [tab, setTab] = useState<'recommended' | 'general'>('recommended')
  const [signals, setSignals] = useState<{ linked: Array<{ slug: string; displayName: string }>; agents: string[] } | null>(null)
  useEffect(() => {
    let cancelled = false
    Promise.all([
      listLinkedConnectors().then(list => list.map(c => ({ slug: c.slug, displayName: c.displayName }))).catch(() => []),
      fetchPersonas().then(list => list.map(p => p.name)).catch(() => [] as string[]),
    ]).then(([linked, agents]) => { if (!cancelled) setSignals({ linked, agents }) })
    return () => { cancelled = true }
  }, [])

  const recommended = useMemo(() => {
    if (!signals) return null
    return recommendTemplates({
      templates: TEMPLATE_NAMES,
      linked: signals.linked,
      existingAgents: signals.agents,
      presetNames: Object.fromEntries(Object.entries(TEMPLATE_PRESETS).map(([name, preset]) => [name, preset.name])),
    })
  }, [signals])

  // A template pre-fills the purpose on the new-agent screen.
  function startFromTemplate(name: string) {
    push(`${AGENTS_NEW_ROUTE}?template=${encodeURIComponent(name)}`)
  }

  return (
    <AgentPageShell maxWidth={GRID_WIDTH}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 36, alignItems: 'center', width: '100%' }}>

        {/* Heading */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center', textAlign: 'center' }}>
          <p style={{
            fontFamily: 'var(--font-title)', fontWeight: 400,
            fontSize: 24, lineHeight: '32px', color: 'var(--legacy-1a1916)', margin: 0,
          }}>
            Choose a starting point
          </p>
          <p style={{
            fontFamily: 'var(--font-body)', fontWeight: 400,
            fontSize: 14, lineHeight: '22px', color: 'var(--neutral-500)', margin: 0,
          }}>
            Start with a template or build from scratch
          </p>
        </div>

        {/* Grid area */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

          {/* Custom / start blank row */}
          <CustomCard onClick={() => push(AGENTS_NEW_ROUTE)} disabled={!hydrated} />

          <Tabs value={tab} onValueChange={value => setTab(value as 'recommended' | 'general')}>
            <Tabs.List>
              <Tabs.Trigger value="recommended">Recommended for you</Tabs.Trigger>
              <Tabs.Trigger value="general">General</Tabs.Trigger>
            </Tabs.List>
          </Tabs>

          {tab === 'general' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={GRID_STYLE}>
                {TEMPLATE_NAMES.map(name => (
                  <TemplateCard key={name} name={name} onClick={() => startFromTemplate(name)} disabled={!hydrated} />
                ))}
              </div>
            </div>
          ) : (
            <RecommendedGrid
              recommendation={recommended}
              disabled={!hydrated}
              onPick={startFromTemplate}
              onBrowseAll={() => setTab('general')}
            />
          )}
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          width: GRID_WIDTH, paddingTop: 64,
        }}>
          <Button
            variant="outline"
            size="sm"
            leftIcon={<ArrowLeftOneIcon size={16} />}
            onClick={() => push(AGENTS_ROUTE)}
          >
            Library
          </Button>
        </div>

      </div>
    </AgentPageShell>
  )
}
