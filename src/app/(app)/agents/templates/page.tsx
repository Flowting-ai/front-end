'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeftOneIcon, ArrowRightOneIcon, PlusSignIcon } from '@strange-huge/icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { trackFeature } from '@/lib/analytics/events'
import {
  CustomerService01Icon,
  GoldSellIcon,
  CourtHouseIcon,
  SearchVisualIcon,
  ContentWritingIcon,
  InspectCodeIcon,
  Login01Icon,
  Target02Icon,
  AnalysisTextLinkIcon,
  OfficeChairIcon,
  Briefcase08Icon,
  Mortarboard01Icon,
  Analytics01Icon,
  MentoringIcon,
  BrowserIcon,
} from '@hugeicons/core-free-icons'
import { Button } from '@/components/Button'
import { WizardShell, STEPS_TEMPLATE } from '../_components/WizardShell'
import { AGENTS_BASICS_PURPOSE_ROUTE, AGENTS_ROUTE } from '@/lib/routes'

// ── Template categories ───────────────────────────────────────────────────────

const TEMPLATE_ICONS: Record<string, typeof CustomerService01Icon> = {
  'Customer Support': CustomerService01Icon,
  'Sales': GoldSellIcon,
  'Legal': CourtHouseIcon,
  'Research': SearchVisualIcon,
  'Content Writer': ContentWritingIcon,
  'Code Review': InspectCodeIcon,
  'Onboarding': Login01Icon,
  'Marketing': Target02Icon,
  'Data Analyst': AnalysisTextLinkIcon,
  'HR & Recruiting': OfficeChairIcon,
  'Executive Assistant': Briefcase08Icon,
  'Education': Mortarboard01Icon,
  'Productivity': Analytics01Icon,
  'Tutoring': MentoringIcon,
  'Web QA': BrowserIcon,
}

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

// Reuses the shared tag palette (`--color-tag-{Color}-*`, see Badge) so each
// category reads as a distinct, on-brand accent rather than an arbitrary hue.
type TagColor = 'Blue' | 'Red' | 'Green' | 'Yellow' | 'Purple' | 'Brown' | 'Neutral'

const TEMPLATE_COLORS: Record<string, TagColor> = {
  'Customer Support': 'Blue',
  'Sales': 'Green',
  'Legal': 'Brown',
  'Research': 'Purple',
  'Content Writer': 'Yellow',
  'Code Review': 'Neutral',
  'Onboarding': 'Blue',
  'Marketing': 'Green',
  'Data Analyst': 'Purple',
  'HR & Recruiting': 'Yellow',
  'Executive Assistant': 'Neutral',
  'Education': 'Brown',
  'Productivity': 'Blue',
  'Tutoring': 'Yellow',
  'Web QA': 'Red',
}

const TEMPLATE_ROWS: string[][] = [
  ['Customer Support', 'Sales', 'Legal', 'Research'],
  ['Content Writer', 'Code Review', 'Onboarding', 'Marketing'],
  ['Data Analyst', 'HR & Recruiting', 'Executive Assistant', 'Education'],
  ['Productivity', 'Tutoring', 'Web QA'],
]

// ── Template card ─────────────────────────────────────────────────────────────
// Fixed width AND height so the grid stays aligned regardless of how long a
// given name/description is — both are 2-line-clamped rather than left to
// grow the card.

const CARD_WIDTH = 179
const CARD_HEIGHT = 172

function TemplateCard({ name, onClick }: { name: string; onClick: () => void }) {
  const [hovered, setHovered] = useState(false)
  const color = TEMPLATE_COLORS[name] ?? 'Neutral'

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? 'var(--neutral-50)' : 'var(--neutral-white)',
        border: `1.274px solid ${hovered ? 'var(--neutral-300)' : 'var(--neutral-100)'}`,
        borderRadius: 15,
        padding: '20px 16px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
        boxShadow: hovered
          ? '0px 8px 16px 0px rgba(202,220,241,0.6)'
          : '0px 2.548px 3.821px 0px rgba(202,220,241,0.4)',
        cursor: 'pointer',
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        transform: hovered ? 'translateY(-2px)' : 'none',
        transition: 'background-color 150ms, border-color 150ms, box-shadow 150ms, transform 150ms',
      }}
    >
      <div style={{
        width: 44, height: 44,
        borderRadius: 12,
        flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: `var(--color-tag-${color}-bg)`,
        transform: hovered ? 'scale(1.06)' : 'scale(1)',
        transition: 'transform 150ms',
      }}>
        <HugeiconsIcon
          icon={TEMPLATE_ICONS[name]}
          size={22}
          color={`var(--color-tag-${color}-text)`}
          strokeWidth={1.5}
        />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minHeight: 0 }}>
        <span style={{
          fontFamily: 'var(--font-body)', fontWeight: 'var(--font-weight-medium)',
          fontSize: 15, lineHeight: '20px', color: 'var(--neutral-950)',
          textAlign: 'center',
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>
          {name}
        </span>
        <span
          title={TEMPLATE_DESCRIPTIONS[name]}
          style={{
            fontFamily: 'var(--font-body)', fontWeight: 400,
            fontSize: 'var(--font-size-caption)', lineHeight: 'var(--line-height-caption)',
            color: 'var(--neutral-500)',
            textAlign: 'center',
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}
        >
          {TEMPLATE_DESCRIPTIONS[name]}
        </span>
      </div>
    </button>
  )
}

// ── Custom / start-blank card ───────────────────────────────────────────────────
// Same accent-icon + caption-description language as TemplateCard, but a wide
// dashed row rather than a grid tile — signals "not a template" while still
// matching the new visual system. Whole row is one button (was previously
// only the "Start blank" pill), so the "Start blank" pill below is decorative.

function CustomCard({ onClick }: { onClick: () => void }) {
  const [hovered, setHovered] = useState(false)

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? 'var(--neutral-50)' : 'var(--neutral-white)',
        border: `1px dashed ${hovered ? 'var(--neutral-400)' : 'var(--neutral-300)'}`,
        borderRadius: 16,
        padding: '16px 17px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        width: 764,
        boxShadow: hovered
          ? '0px 8px 16px 0px rgba(202,220,241,0.5), 0px 0px 0px 1px var(--neutral-100)'
          : '0px 2px 2.8px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-100)',
        cursor: 'pointer',
        transform: hovered ? 'translateY(-1px)' : 'none',
        transition: 'background-color 150ms, border-color 150ms, box-shadow 150ms, transform 150ms',
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

export default function PersonaTemplatesPage() {
  const { push } = useRouter()

  // Only show the Continue button when the user has already stepped into the wizard
  // (i.e. navigated back from the purpose page mid-flow).
  const [hasWizardDraft, setHasWizardDraft] = useState(false)
  useEffect(() => {
    try {
      const draft = JSON.parse(sessionStorage.getItem('persona_wizard_draft') ?? '{}')
      setHasWizardDraft(!!(draft.name || draft.purpose || draft.template))
    } catch { /* ignore */ }
  }, [])

  // Analytics: the template gallery was browsed (Layer 4 feature).
  useEffect(() => { trackFeature('agent_template_browsed') }, [])

  function continueToBasics(name?: string) {
    // Starting fresh — clear any previously created wizard repo so a new one is made.
    try { sessionStorage.removeItem('persona_wizard_repo') } catch { /* ignore */ }
    const q = name ? `?template=${encodeURIComponent(name)}` : ''
    push(`${AGENTS_BASICS_PURPOSE_ROUTE}${q}`)
  }

  return (
    <WizardShell steps={STEPS_TEMPLATE}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 36, alignItems: 'center', width: '100%' }}>

        {/* Heading */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center', textAlign: 'center' }}>
          <p style={{
            fontFamily: 'var(--font-title)', fontWeight: 400,
            fontSize: 24, lineHeight: '32px', color: '#1a1916', margin: 0,
          }}>
            Choose a starting point
          </p>
          <p style={{
            fontFamily: 'var(--font-body)', fontWeight: 400,
            fontSize: 14, lineHeight: '22px', color: '#827a74', margin: 0,
          }}>
            Start with a template or build from scratch
          </p>
        </div>

        {/* Grid area */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

          {/* Custom / start blank row */}
          <CustomCard onClick={() => push(AGENTS_BASICS_PURPOSE_ROUTE)} />

          {/* Template card rows */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {TEMPLATE_ROWS.map((row, ri) => (
              <div key={ri} style={{ display: 'flex', gap: 16 }}>
                {row.map(name => (
                  <TemplateCard key={name} name={name} onClick={() => continueToBasics(name)} />
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          width: 764, paddingTop: 64,
        }}>
          <Button
            variant="outline"
            size="sm"
            leftIcon={<ArrowLeftOneIcon size={16} />}
            onClick={() => push(AGENTS_ROUTE)}
          >
            Library
          </Button>
          {hasWizardDraft && (
            <Button
              variant="default"
              size="sm"
              rightIcon={<ArrowRightOneIcon size={16} />}
              onClick={() => continueToBasics()}
            >
              Continue
            </Button>
          )}
        </div>

      </div>
    </WizardShell>
  )
}
