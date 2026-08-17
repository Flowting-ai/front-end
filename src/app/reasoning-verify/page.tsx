'use client'

// ── Dev-only verification harness ──────────────────────────────────────────
// Mounts the REAL ReasoningBlock with fixture props covering the states a live
// stream produces, so the reasoning UI can be reviewed without a backend.
// Lives outside the (app) group so it skips the auth shell but still inherits
// globals.css + MotionProvider from the root layout. Reachable at
// /reasoning-verify in dev only (see the guard in src/proxy.ts).
// Not linked anywhere. Safe to delete.

import React, { useState } from 'react'
import { ReasoningBlock, type ReasoningBlockProps } from '@/components/chat/ReasoningBlock'
import type { ActivityItem } from '@/hooks/use-chat-state'
import type { ReasoningTimelineItem } from '@/lib/reasoning'

const SECTIONS = [
  { heading: 'Planned what to search for and in what order', body: 'The question is about 2026 GTM, so recent sources matter more than evergreen advice. I will start broad, then narrow to founder-led distribution.' },
  { heading: 'Strategized how to connect web findings to the product', body: 'Generic marketing advice is not useful on its own. The findings need to map back to what the user has already saved.' },
  { heading: 'Synthesised the distribution thesis', body: 'Distribution is the moat. Founder-led content is the dominant channel, and building in public compounds it.' },
]

const ACTIVITIES: ActivityItem[] = [
  {
    id: 'a-1', type: 'web-search', label: 'Searching the web', status: 'done',
    detail: 'AI startup GTM strategies 2026 traction growth', durationS: 2.4,
    results: [
      { title: 'Top Marketing Strategies for Startups in 2026', domain: 'excellofficial.com', url: 'https://excellofficial.com' },
      { title: 'Five Growth Strategies Every Early-Stage Startup Should Explore', domain: 'entrepreneurship.edu.au', url: 'https://entrepreneurship.edu.au' },
    ],
  },
  {
    id: 'a-2', type: 'web-search', label: 'Searching the web', status: 'done',
    detail: 'founder-led content distribution AI startup 2026', durationS: 1.9,
    results: [
      { title: 'GTMfund has rewritten the distribution playbook for the AI era', domain: 'techcrunch.com', url: 'https://techcrunch.com' },
    ],
  },
  {
    id: 'a-3', type: 'read-pages', label: 'Reading document', status: 'done',
    detail: '213-Design-Trend-Report.pdf', durationS: 3.1,
  },
  {
    id: 'a-4', type: 'tool-call', label: 'Running tool', status: 'done',
    detail: 'search_pins', durationS: 0.4,
    results: [
      { title: 'Andrew Chen — The Cold Start Problem notes', domain: 'pin' },
      { title: "Lenny's Newsletter — Retention curves and PMF signals", domain: 'pin' },
    ],
  },
]

function timeline(reasoningCount: number, activityCount: number): ReasoningTimelineItem[] {
  const items: ReasoningTimelineItem[] = []
  SECTIONS.slice(0, reasoningCount).forEach((section, i) => {
    items.push({ kind: 'reasoning', id: `r-${i}`, content: `**${section.heading}**\n\n${section.body}` })
    // The tool batch lands after the first reasoning segment, mirroring a real
    // stream where the model plans, then calls tools, then keeps reasoning.
    if (i === 0) {
      ACTIVITIES.slice(0, activityCount).forEach((activity, ai) => {
        items.push({ kind: 'activity', id: `t-${ai}`, activityId: activity.id })
      })
    }
  })
  return items
}

const STATES = {
  'streaming-reasoning': {
    label: 'Streaming — reasoning only',
    props: {
      thinkingContent: '',
      reasoningTimeline: timeline(2, 0),
      activities: [],
      isThinkingInProgress: true,
    },
  },
  'streaming-tool': {
    label: 'Streaming — tool running',
    props: {
      thinkingContent: '',
      reasoningTimeline: timeline(1, 2),
      activities: [ACTIVITIES[0], { ...ACTIVITIES[1], status: 'executing', results: undefined, durationS: undefined }],
      isThinkingInProgress: true,
    },
  },
  'settled-batch': {
    label: 'Done — batch collapsed',
    props: {
      thinkingContent: '',
      reasoningTimeline: timeline(3, 4),
      activities: ACTIVITIES,
      isThinkingInProgress: false,
    },
  },
  'sections-only': {
    label: 'Done — persisted sections (no timeline)',
    props: {
      thinkingContent: '',
      reasoningSections: SECTIONS,
      activities: ACTIVITIES,
      isThinkingInProgress: false,
    },
  },
  'unstructured': {
    label: 'Done — unstructured reasoning',
    props: {
      thinkingContent: 'I need to weigh the two options against the current product stage before answering.',
      activities: [],
      isThinkingInProgress: false,
    },
  },
} satisfies Record<string, { label: string; props: Omit<ReasoningBlockProps, 'isNewMessage'> }>

type StateKey = keyof typeof STATES

export default function ReasoningVerify() {
  const [active, setActive] = useState<StateKey>('settled-batch')

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#FAF6F2', fontFamily: 'var(--font-body)' }}>
      <div style={{ flex: 1, padding: '48px 40px', minWidth: 0 }}>
        <div style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#B6ACA4', marginBottom: 28 }}>
          Reasoning verify — {STATES[active].label}
        </div>
        <div style={{ maxWidth: 720 }} data-testid="reasoning-host">
          {/* Keyed so switching state remounts and entry animations replay. */}
          <ReasoningBlock key={active} isNewMessage {...STATES[active].props} />
        </div>
      </div>

      <div style={{ width: 260, flexShrink: 0, borderLeft: '1px solid #EDE1D7', padding: '48px 20px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#B6ACA4', marginBottom: 8 }}>
          State
        </div>
        {(Object.keys(STATES) as StateKey[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setActive(key)}
            style={{
              padding: '8px 10px', borderRadius: 7, border: 0, cursor: 'pointer', textAlign: 'left',
              fontSize: 12, fontFamily: 'var(--font-body)',
              background: active === key ? 'rgba(104,61,27,0.12)' : 'rgba(59,54,50,0.04)',
              color: active === key ? '#683D1B' : '#524B47',
              fontWeight: active === key ? 600 : 400,
            }}
          >
            {STATES[key].label}
          </button>
        ))}
      </div>
    </div>
  )
}
