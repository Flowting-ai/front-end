'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeftOneIcon, ArrowRightOneIcon } from '@strange-huge/icons'
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
}

const TEMPLATE_ROWS: string[][] = [
  ['Customer Support', 'Sales', 'Legal', 'Research'],
  ['Content Writer', 'Code Review', 'Onboarding', 'Marketing'],
  ['Data Analyst', 'HR & Recruiting', 'Executive Assistant', 'Education'],
  ['Productivity', 'Tutoring'],
]

// ── Template card ─────────────────────────────────────────────────────────────

function TemplateCard({ name, onClick }: { name: string; onClick: () => void }) {
  const [hovered, setHovered] = useState(false)

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? 'var(--neutral-50)' : 'var(--neutral-white)',
        border: `1.274px solid ${hovered ? 'var(--neutral-300)' : 'var(--neutral-100)'}`,
        borderRadius: 15,
        padding: 20,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14,
        boxShadow: hovered
          ? '0px 4px 8px 0px rgba(202,220,241,0.55)'
          : '0px 2.548px 3.821px 0px rgba(202,220,241,0.4)',
        cursor: 'pointer',
        width: 179,
        transition: 'background-color 150ms, border-color 150ms, box-shadow 150ms',
      }}
    >
      <HugeiconsIcon
        icon={TEMPLATE_ICONS[name]}
        size={30}
        color="#26211e"
        strokeWidth={1.5}
      />
      <span style={{
        fontFamily: 'var(--font-body)', fontWeight: 'var(--font-weight-medium)',
        fontSize: 16, lineHeight: '22px', color: 'var(--neutral-950)',
        textAlign: 'center',
      }}>
        {name}
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
          <div style={{
            background: 'var(--neutral-white)',
            border: '1px dashed var(--neutral-300)',
            borderRadius: 16,
            padding: '16px 17px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: 764,
            boxShadow: '0px 2px 2.8px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-100)',
          }}>
            <div>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 16, lineHeight: '22px', color: 'var(--neutral-900)', margin: 0 }}>
                Custom
              </p>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 13, lineHeight: '16px', color: 'var(--neutral-500)', margin: 0 }}>
                Start from scratch.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => push(AGENTS_BASICS_PURPOSE_ROUTE)}
            >
              Start blank
            </Button>
          </div>

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
