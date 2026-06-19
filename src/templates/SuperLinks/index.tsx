'use client'

import React from 'react'
import { PlusSignIcon } from '@strange-huge/icons'
import { Button } from '@/components/Button'
import { ChartCard } from '@/components/ChartCard'
import { DateRangePill } from '@/components/DateRangePill'
import { Eyebrow } from '@/components/Eyebrow'
import { LinksSidePanel } from '@/components/LinksSidePanel'
import { Sparkline } from '@/components/Sparkline'
import { Tabs, TabsList, TabsTrigger } from '@/components/Tabs'
import { StatCard } from '@/components/StatCard'
import { SuperLinkDrawer, type SuperLinkDrawerLink } from '@/components/SuperLinkDrawer'
import { UsageBarChart, type UsageBarChartSeries } from '@/components/UsageBarChart'
import { cn } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SuperLinksTemplateProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
  /** Eyebrow above the page heading. */
  workspaceLabel?: string
  /** Page heading. */
  heading?:        string
  /** Pre-formatted date range. */
  dateRange?:      string
  /** Summary numbers for the stat-card row. */
  summary?: {
    tokensThisMonth:  number
    conversations:    number
    activeLinks:      number
    estimatedCostUsd: number
    deltaTokens?:     string
    deltaConvos?:     string
    deltaActive?:     string
    deltaCost?:       string
  }
  /** Days for the chart x-axis. */
  days:   string[]
  /** Per-link daily token series. */
  links:  SuperLinkDrawerLink[]
  /** Total sparkline data (top-card overview). */
  totalsDaily?: number[]
  onGenerateLink?:  () => void
  onCopyUrl?:       (id: string) => void
  onLinkStatusChange?: (id: string, status: SuperLinkDrawerLink['status']) => void
  onLinkLimitChange?:  (id: string, limit: number) => void
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtK(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M'
  if (n >= 1_000)     return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K'
  return String(n)
}

// ── Template ──────────────────────────────────────────────────────────────────

export function SuperLinks(
  {
    workspaceLabel = 'Personas · Acme inc.',
    heading        = 'Super Links',
    dateRange      = 'Apr 12 – May 12',
    summary,
    days,
    links: linksProp,
    totalsDaily,
    onGenerateLink,
    onCopyUrl,
    onLinkStatusChange,
    onLinkLimitChange,
    className,
    style,
    ref,
    ...props
  }: SuperLinksTemplateProps & { ref?: React.Ref<HTMLDivElement> },
) {
    const [links, setLinks]           = React.useState<SuperLinkDrawerLink[]>(linksProp)
    const [selectedId, setSelectedId] = React.useState<string | null>(null)
    const [range, setRange]           = React.useState<'7d' | '30d' | '90d'>('30d')
    const [breakdown, setBreakdown]   = React.useState<'all' | 'per-link'>('all')
    const prevLinksPropRef = React.useRef(linksProp)
    if (prevLinksPropRef.current !== linksProp) {
      prevLinksPropRef.current = linksProp
      setLinks(linksProp)
    }

    const selected = links.find(l => l.id === selectedId) ?? null

    const totals = totalsDaily ?? days.map((_, i) =>
      links.reduce((s, l) => s + (l.dailyTokens[i] ?? 0), 0),
    )

    const seriesAll: UsageBarChartSeries[] = links.map(l => ({
      id:    l.id,
      label: l.personaName,
      color: l.avatarColor,
      data:  l.dailyTokens,
    }))

    const summaryDerived = summary ?? {
      tokensThisMonth: links.reduce((s, l) => s + l.tokenUsed, 0),
      conversations:   links.reduce((s, l) => s + l.conversations, 0),
      activeLinks:     links.filter(l => l.status === 'active').length,
      estimatedCostUsd: parseFloat((links.reduce((s, l) => s + l.tokenUsed, 0) / 1_000_000 * 3).toFixed(2)),
    }

    const handleStatusChange = (next: SuperLinkDrawerLink['status']) => {
      if (!selected) return
      setLinks(prev => prev.map(l => l.id === selected.id ? { ...l, status: next } : l))
      onLinkStatusChange?.(selected.id, next)
    }
    const handleLimitChange = (next: number) => {
      if (!selected) return
      setLinks(prev => prev.map(l => l.id === selected.id ? { ...l, tokenLimit: next } : l))
      onLinkLimitChange?.(selected.id, next)
    }

    return (
      <div
        ref={ref}
        className={cn(className)}
        style={{
          display:         'flex',
          flexDirection:   'column',
          minHeight:       '100svh',
          backgroundColor: 'var(--neutral-50)',
          color:           'var(--neutral-900)',
          fontFamily:      'var(--font-body)',
          ...style,
        }}
        {...props}
      >
        {/* ── Top bar ───────────────────────────────────────────────────────── */}
        <header
          style={{
            display:        'flex',
            alignItems:     'flex-end',
            justifyContent: 'space-between',
            gap:            16,
            padding:        '32px 28px 8px',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
            <Eyebrow>{workspaceLabel}</Eyebrow>
            <h1
              style={{
                margin:        0,
                fontFamily:    'var(--font-title)',
                fontSize:      'var(--font-size-heading)',
                lineHeight:    'var(--line-height-heading)',
                fontWeight:    'var(--font-weight-medium)',
                color:         'var(--neutral-900)',
              }}
            >
              {heading}
            </h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <DateRangePill label={dateRange} />
            <Button size="sm" variant="default" onClick={onGenerateLink} leftIcon={<PlusSignIcon />}>
              Generate link
            </Button>
          </div>
        </header>

        {/* ── Body ─────────────────────────────────────────────────────────── */}
        <main
          style={{
            flex:          1,
            display:       'flex',
            flexDirection: 'column',
            gap:           16,
            padding:       '16px 28px 32px',
            minHeight:     0,
          }}
        >
          {/* Stat grid */}
          <section
            style={{
              display:             'grid',
              gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
              gap:                 12,
            }}
          >
            <StatCard
              label="Credits this month"
              value={fmtK(summaryDerived.tokensThisMonth)}
              delta={summaryDerived.deltaTokens ?? '+8.2%'}
              deltaTrend="up"
              sub="across all links"
            />
            <StatCard
              label="Conversations"
              value={summaryDerived.conversations}
              delta={summaryDerived.deltaConvos ?? '+12.4%'}
              deltaTrend="up"
              sub="total sessions"
            />
            <StatCard
              label="Active links"
              value={summaryDerived.activeLinks}
              delta={summaryDerived.deltaActive ?? '+1'}
              deltaTrend="up"
              sub={`of ${links.length} total`}
            />
            <StatCard
              label="Est. cost"
              value={`$${summaryDerived.estimatedCostUsd.toFixed(2)}`}
              delta={summaryDerived.deltaCost ?? '-1.1%'}
              deltaTrend="down"
              sub="creator-pays"
            />
          </section>

          {/* Main grid */}
          <section
            style={{
              display:             'grid',
              gridTemplateColumns: 'minmax(0, 2fr) minmax(320px, 1fr)',
              gap:                 12,
              flex:                1,
              minHeight:           420,
            }}
          >
            <ChartCard
              label="Credit usage · daily"
              value={fmtK(summaryDerived.tokensThisMonth)}
              delta={summaryDerived.deltaTokens ?? '+8.2%'}
              deltaTrend="up"
              rangeOptions={[
                { id: '7d',  label: '7d'  },
                { id: '30d', label: '30d' },
                { id: '90d', label: '90d' },
              ]}
              rangeValue={range}
              onRangeChange={(v: string) => setRange(v as '7d' | '30d' | '90d')}
              toolbarLeft={
                <Tabs value={breakdown} onValueChange={(v: string) => setBreakdown(v as 'all' | 'per-link')}>
                  <TabsList size="small" aria-label="Chart breakdown">
                    <TabsTrigger value="all">All links</TabsTrigger>
                    <TabsTrigger value="per-link">Per link</TabsTrigger>
                  </TabsList>
                </Tabs>
              }
              chart={
                breakdown === 'all'
                  ? <Sparkline data={totals} height={180} />
                  : <UsageBarChart days={days} series={seriesAll} mode="per-link" selectedId={selectedId} height={180} />
              }
            />

            <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <LinksSidePanel
                links={links.map(l => ({
                  id:           l.id,
                  personaName:  l.personaName,
                  avatarColor:  l.avatarColor,
                  url:          l.url,
                  tokenUsed:    l.tokenUsed,
                  tokenLimit:   l.tokenLimit,
                  status:       l.status,
                }))}
                selectedId={selectedId}
                onSelect={(id) => setSelectedId(prev => prev === id ? null : id)}
                onGenerate={onGenerateLink}
                onCopyUrl={onCopyUrl}
                style={{ flex: 1, minHeight: 0 }}
              />
            </div>
          </section>

          {/* Drawer — modal, portal'd to <body> with backdrop */}
          <SuperLinkDrawer
            link={selected}
            onClose={() => setSelectedId(null)}
            onStatusChange={handleStatusChange}
            onLimitChange={handleLimitChange}
          />
        </main>
      </div>
    )
}

SuperLinks.displayName = 'SuperLinks'
export default SuperLinks
