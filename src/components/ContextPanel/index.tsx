'use client'

import React, { useState } from 'react'
import { BROWSER_VIEW_ENABLED } from '@/lib/feature-flags'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/Tabs'
import { BrowserScreen } from '@/components/BrowserPanel/BrowserScreen'
import { useBrowserSession, type BrowserSession } from '@/components/BrowserPanel/use-browser-session'
import { AnimatedList, ItemRow, OverviewTab, PanelCard, PanelSection, StepIcon, stepLabelStyle } from './Overview'

// The "Context" side panel for a chat. The Overview tab (see ./Overview) shows what the
// current turn is doing and what the chat has used; behind BROWSER_VIEW_ENABLED a Browser
// tab shows the agent's live screen.

type PanelTab = 'overview' | 'browser'

export function ContextPanelContent() {
  if (!BROWSER_VIEW_ENABLED) return <OverviewTab />
  return <TabbedContextPanel />
}

function TabbedContextPanel() {
  const session = useBrowserSession()

  // Until the viewer picks a tab, follow the agent: once it opens a browser, show it.
  // A tab the viewer picks always wins after that.
  const [chosenTab, setChosenTab] = useState<PanelTab | null>(null)
  const tab: PanelTab = chosenTab ?? (session.status === 'idle' ? 'overview' : 'browser')
  const browserActive = session.status === 'live' || session.status === 'connecting'

  return (
    <Tabs value={tab} onValueChange={value => setChosenTab(value as PanelTab)} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <TabsList fluid size="small" aria-label="Context views">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="browser">
          Browser
          {browserActive && (
            <>
              <span
                aria-hidden
                style={{ position: 'absolute', top: 1, right: -6, width: 6, height: 6, borderRadius: 999, backgroundColor: session.status === 'live' ? 'var(--green-500)' : 'var(--blue-500)' }}
              />
              <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' }}>
                {session.status === 'live' ? ', live' : ', connecting'}
              </span>
            </>
          )}
        </TabsTrigger>
      </TabsList>
      {/* Both stay mounted so switching tabs never drops the live view's connection. */}
      <TabsContent value="overview" forceMount hidden={tab !== 'overview'}>
        <OverviewTab />
      </TabsContent>
      <TabsContent value="browser" forceMount hidden={tab !== 'browser'}>
        <BrowserTab session={session} />
      </TabsContent>
    </Tabs>
  )
}

function hostOf(url: string | undefined): string | undefined {
  if (!url) return undefined
  try { return new URL(url).host } catch { return undefined }
}

function BrowserTab({ session }: { session: BrowserSession }) {
  const [expandRequested, setExpanded] = useState(false)
  // Nothing left to watch (e.g. the chat changed under the panel) — stay in the panel.
  const expanded = expandRequested && session.status !== 'idle'
  const [stepsOpen, setStepsOpen] = useState(true)

  const busy = session.status === 'live' || session.status === 'connecting'
  const host = hostOf(session.pageUrl)
  const meta = [host, session.status === 'live' && session.liveView?.viewOnly ? 'View only' : null].filter(Boolean).join(' · ')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <BrowserScreen session={session} expanded={expanded} onExpandedChange={setExpanded} />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, minWidth: 0, padding: '0 8px', textAlign: 'center' }}>
          <p style={{ margin: 0, maxWidth: '100%', fontFamily: 'var(--font-body)', fontSize: 'var(--font-size-body)', lineHeight: 'var(--line-height-body)', color: busy && session.currentAction ? 'var(--neutral-800)' : 'var(--neutral-500)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {busy && session.currentAction ? session.currentAction : 'Agent’s screen'}
          </p>
          {meta && (
            <p style={{ margin: 0, maxWidth: '100%', fontFamily: 'var(--font-body)', fontSize: 'var(--font-size-caption)', lineHeight: 'var(--line-height-caption)', color: 'var(--neutral-500)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {meta}
            </p>
          )}
        </div>
      </div>

      {session.steps.length > 0 && (
        <PanelCard>
          <PanelSection first title="Browser steps" count={session.steps.length} open={stepsOpen} onToggle={() => setStepsOpen(open => !open)}>
            <AnimatedList>
              {session.steps.map(step => (
                <ItemRow key={step.id} wrap icon={<StepIcon status={step.status} />} label={step.label} labelStyle={stepLabelStyle(step.status)} />
              ))}
            </AnimatedList>
          </PanelSection>
        </PanelCard>
      )}

    </div>
  )
}
