'use client'

// ── Dev-only greetings preview ───────────────────────────────────────────────
// Reachable at /dev/greetings in development only (page.tsx 404s in
// production). Not linked anywhere. Renders every greeting in lib/greetings.ts
// with the real heading (GreetingHeading) at the width each page gives it, and
// flags any that wrap past one line. The lanes narrow with this window, so a
// wide window shows the desktop result.

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useMounted } from '@/hooks/use-mounted'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/Button'
import { InputField } from '@/components/InputField'
import { Slider } from '@/components/Slider'
import { Switch } from '@/components/Switch'
import Tabs from '@/components/Tabs'
import { GreetingHeading } from '@/components/chat/InitialPrompts'
import { useAuth } from '@/context/auth-context'
import {
  DAY_GREETING_CHANCE,
  FALLBACK_GREETING,
  dayGreetings,
  fillGreeting,
  timeGreetings,
} from '@/lib/greetings'

// Where the greeting renders: each page's real lane width, side inset and size.
const SURFACES = {
  landing: { label: 'New chat',     lane: 768, inset: 0,  compact: true,  detail: '768px lane, 28px — /chat' },
  project: { label: 'Project chat', lane: 768, inset: 24, compact: false, detail: '720px lane, 34px — /project/…/chat' },
  phone:   { label: 'Phone',        lane: 343, inset: 0,  compact: true,  detail: '343px lane (375px screen), 28px' },
} as const
type SurfaceId = keyof typeof SURFACES
type Surface = (typeof SURFACES)[SurfaceId]

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const hh = (h: number) => `${String(h).padStart(2, '0')}:00`

interface Group {
  id: string
  title: string
  detail: string
  live: boolean
  messages: string[]
}

function buildGroups(now: Date): Group[] {
  const hour = now.getHours()
  const day = now.getDay()
  const anyTimeLive = timeGreetings.some(s => hour >= s.startHour && hour < s.endHour)
  return [
    ...timeGreetings.map(s => ({
      id: `time-${s.label}`,
      title: s.label,
      detail: `${hh(s.startHour)}–${hh(s.endHour)}`,
      live: hour >= s.startHour && hour < s.endHour,
      messages: s.messages,
    })),
    ...dayGreetings.map(s => ({
      id: `day-${s.label}`,
      title: s.label,
      detail: `${s.days.map(d => WEEKDAYS[d]).join(' & ')} — shown instead of the time greeting ${Math.round(DAY_GREETING_CHANCE * 100)}% of the time`,
      live: s.days.includes(day),
      messages: s.messages,
    })),
    {
      id: 'fallback',
      title: 'Fallback',
      detail: 'Only if no time slot covers the hour (they cover all 24, so never today)',
      live: !anyTimeLive,
      messages: [FALLBACK_GREETING],
    },
  ]
}

// ── Layout bits ───────────────────────────────────────────────────────────────

const captionText: React.CSSProperties = {
  margin: 0, fontFamily: 'var(--font-body)', fontSize: 'var(--font-size-caption)', lineHeight: 'var(--line-height-caption)', color: 'var(--neutral-500)',
}

function Card({ title, description, actions, children }: {
  title: string
  description?: React.ReactNode
  actions?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section
      style={{
        display: 'flex', flexDirection: 'column', gap: 8, padding: 20, borderRadius: 16,
        backgroundColor: 'var(--neutral-white)', boxShadow: '0px 1px 2px 0px var(--neutral-700-12), 0px 0px 0px 1px var(--neutral-100)',
      }}
    >
      <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
          <h2 style={{ margin: 0, fontFamily: 'var(--font-title)', fontWeight: 'var(--font-weight-regular)', fontSize: 18, lineHeight: '24px', color: 'var(--neutral-900)' }}>{title}</h2>
          {description && <p style={captionText}>{description}</p>}
        </div>
        {actions && <div style={{ display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>{actions}</div>}
      </header>
      {children}
    </section>
  )
}

// ── One greeting ──────────────────────────────────────────────────────────────

function GreetingRow({ id, text, surface, lane, showLane, onLines }: {
  id: string
  text: string
  surface: Surface
  lane: number
  showLane: boolean
  onLines: (id: string, lines: number) => void
}) {
  const laneRef = useRef<HTMLDivElement>(null)
  const [lines, setLines] = useState<number | null>(null)

  // Count rendered lines from the heading's height. Re-measures when the lane
  // resizes, the text reflows, or the web font finishes loading.
  useEffect(() => {
    const heading = laneRef.current?.querySelector('h1')
    if (!heading) return
    let active = true
    const measure = () => {
      if (!active) return
      const lineHeight = parseFloat(getComputedStyle(heading).lineHeight)
      const n = Math.max(1, Math.round(heading.getBoundingClientRect().height / lineHeight))
      setLines(n)
      onLines(id, n)
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(heading)
    void document.fonts.ready.then(measure)
    return () => { active = false; ro.disconnect() }
  }, [id, text, surface, onLines])

  const wraps = lines !== null && lines > 1
  return (
    <div
      style={{
        display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 96px', alignItems: 'center', gap: 16,
        padding: '18px 0', borderTop: '1px solid var(--neutral-100)',
      }}
    >
      <div
        ref={laneRef}
        style={{
          width: '100%', maxWidth: lane, margin: '0 auto', boxSizing: 'border-box',
          padding: `0 ${surface.inset}px`, textAlign: 'center', // as InitialPrompts' wrapper
          outline: showLane ? '1px dashed var(--neutral-200)' : 'none', outlineOffset: 4,
        }}
      >
        <GreetingHeading greeting={text} compact={surface.compact} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
        <Badge label={lines === null ? '…' : wraps ? `${lines} lines` : '1 line'} color={wraps ? 'Yellow' : 'Green'} />
        <span style={captionText}>{text.length} chars</span>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function GreetingsPlayground() {
  const mounted = useMounted()
  const { user } = useAuth()
  const signedInName = user?.firstName || user?.name || ''
  const [nameDraft, setNameDraft] = useState<string | null>(null)
  const name = nameDraft ?? signedInName
  const [surfaceId, setSurfaceId] = useState<SurfaceId>('landing')
  // Drag to find where greetings start wrapping; switching page resets it to that page's real width.
  const [laneOverride, setLaneOverride] = useState<number | null>(null)
  const [showLane, setShowLane] = useState(true)
  // Bumping `replay` remounts the showcase heading, which replays the logo's one-time arrival.
  const [replay, setReplay] = useState(0)
  const [orbitSeconds, setOrbitSeconds] = useState(2.8)
  const [lineCounts, setLineCounts] = useState<Record<string, number>>({})

  const reportLines = useCallback((id: string, lines: number) => {
    setLineCounts(prev => (prev[id] === lines ? prev : { ...prev, [id]: lines }))
  }, [])

  // Time-dependent, so only after mount (no server/client mismatch).
  if (!mounted) return null

  const surface = SURFACES[surfaceId]
  const lane = laneOverride ?? surface.lane
  const groups = buildGroups(new Date())
  const total = groups.reduce((n, g) => n + g.messages.length, 0)
  const wrapping = Object.values(lineCounts).filter(n => n > 1).length
  const liveTitles = groups.filter(g => g.live).map(g => g.title)
  const showcase = (groups.find(g => g.live) ?? groups[0]).messages[0]

  return (
    <div style={{ height: '100%', overflowY: 'auto', backgroundColor: 'var(--neutral-50)' }} className="kaya-scrollbar">
      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '32px 24px 64px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h1 style={{ margin: 0, fontFamily: 'var(--font-title)', fontWeight: 'var(--font-weight-regular)', fontSize: 28, lineHeight: '34px', color: 'var(--neutral-900)' }}>
            Greetings
          </h1>
          <Badge label="Dev only" color="Purple" />
        </div>
        <p style={captionText}>
          {total} greetings · {wrapping === 0 ? 'all fit on one line' : `${wrapping} wrap`} on {surface.label} at {lane}px (lanes also narrow with this window).
          {' '}Live now: {liveTitles.join(' + ')}.
        </p>

        <Card title="Preview settings" description={surface.detail}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 24, flexWrap: 'wrap', paddingTop: 8 }}>
            <div style={{ width: 240 }}>
              <InputField label="Name" value={name} onChange={setNameDraft} placeholder="Empty = no name on file" fluid />
            </div>
            <Tabs value={surfaceId} onValueChange={v => { setSurfaceId(v as SurfaceId); setLaneOverride(null) }}>
              <Tabs.List>
                {(Object.keys(SURFACES) as SurfaceId[]).map(id => (
                  <Tabs.Trigger key={id} value={id}>{SURFACES[id].label}</Tabs.Trigger>
                ))}
              </Tabs.List>
            </Tabs>
            <Slider
              label="Lane width"
              value={[lane]}
              onValueChange={([n]) => setLaneOverride(n)}
              min={280}
              max={900}
              step={1}
              showValue
              valueFormat={n => `${n}px`}
            />
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, ...captionText, color: 'var(--neutral-700)' }}>
              <Switch checked={showLane} onCheckedChange={setShowLane} aria-label="Show lane edges" />
              Show lane edges
            </label>
          </div>
        </Card>

        <Card
          title="Logo animation"
          description="The mark's one-time arrival on landing (InitialPrompts.module.css). Off for anyone with reduced motion turned on."
          actions={<Button size="sm" variant="secondary" onClick={() => setReplay(n => n + 1)}>Replay</Button>}
        >
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, paddingTop: 16 }}>
            <div
              key={replay}
              style={{ width: '100%', maxWidth: surface.lane, padding: `0 ${surface.inset}px`, boxSizing: 'border-box', textAlign: 'center', ['--souvenir-orbit-duration' as string]: `${orbitSeconds}s` }}
            >
              <GreetingHeading greeting={fillGreeting(showcase, name)} compact={surface.compact} animateLogo />
            </div>
            <Slider
              label="Turn duration"
              value={[orbitSeconds]}
              onValueChange={([n]) => setOrbitSeconds(n)}
              onValueCommit={() => setReplay(n => n + 1)}
              min={1.2}
              max={5}
              step={0.1}
              showValue
              valueFormat={n => `${n.toFixed(1)}s`}
            />
          </div>
        </Card>

        {groups.map(group => (
          <Card
            key={group.id}
            title={group.title}
            description={group.detail}
            actions={<>
              {group.live && <Badge label="Live now" color="Blue" />}
              <Badge label={`${group.messages.length}`} color="Neutral" />
            </>}
          >
            {group.messages.map((message, i) => (
              <GreetingRow
                key={`${group.id}-${i}`}
                id={`${group.id}-${i}`}
                text={fillGreeting(message, name)}
                surface={surface}
                lane={lane}
                showLane={showLane}
                onLines={reportLines}
              />
            ))}
          </Card>
        ))}
      </div>
    </div>
  )
}
