import React from 'react'

// Loading skeletons for /schedules and /schedules/[id]. Each block mirrors the
// box model of the real element it stands in for (ScheduleListView /
// ScheduleCard / ScheduleDetailView): same paddings, gaps, line-heights and
// control heights, so nothing shifts when the content swaps in.

type Fade = { opacity: number }

/** One text line: a box of the real line-height with a bar of the glyph height centred in it. */
function Line({ lh, h, w, fade, mt = 0 }: { lh: number; h: number; w: number | string; fade?: Fade; mt?: number }) {
  return (
    <div style={{ height: lh, marginTop: mt, display: 'flex', alignItems: 'center', flexShrink: 0, ...fade }}>
      <div className="kaya-skeleton" style={{ width: w, height: h }} />
    </div>
  )
}

function Pill({ w, h = 20, r = 6, fade }: { w: number; h?: number; r?: number; fade?: Fade }) {
  return <div className="kaya-skeleton" style={{ width: w, height: h, borderRadius: r, flexShrink: 0, ...fade }} />
}

const CARD_SHADOW = '0px 1px 3px 0px rgba(82,75,71,0.08), 0px 0px 0px 1px var(--border-default)'
const BORDERED = { borderRadius: 12, border: '1px solid var(--border-default)', backgroundColor: 'var(--card-bg)' } as const

// ── /schedules ────────────────────────────────────────────────────────────────

// ScheduleCard: 240px, padding 20 — top row (20) / title (24) / description
// (18 per line) / spacer / divider / footer (frequency 18 + chips 20).
function ScheduleCardSkeleton({ delay }: { delay: number }) {
  const fade = { opacity: 1 - delay * 0.15 }
  return (
    <div style={{
      display:       'flex',
      flexDirection: 'column',
      height:        240,
      padding:       20,
      boxSizing:     'border-box',
      borderRadius:  12,
      boxShadow:     CARD_SHADOW,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 20, flexShrink: 0 }}>
        <div className="kaya-skeleton" style={{ ...fade, width: 150, height: 12 }} />
        <Pill w={52} r={6} fade={fade} />
      </div>

      <Line lh={24} h={18} w="60%" mt={8} fade={fade} />

      <Line lh={18} h={13} w="100%" mt={10} fade={fade} />
      <Line lh={18} h={13} w="72%" fade={fade} />

      <div style={{ flex: '1 1 auto', minHeight: 12 }} />
      <div style={{ height: 1, width: '100%', backgroundColor: 'var(--divider-color)', flexShrink: 0 }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 4, height: 18, marginTop: 10, flexShrink: 0 }}>
        <div className="kaya-skeleton" style={{ ...fade, width: 14, height: 14, borderRadius: 4 }} />
        <div className="kaya-skeleton" style={{ ...fade, width: 230, height: 13 }} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, height: 20, marginTop: 4, flexShrink: 0 }}>
        <Pill w={52} fade={fade} />
        <Pill w={88} fade={fade} />
      </div>
    </div>
  )
}

// ScheduleListView: header (title 32 + 4 + subtitle 22) with search + "New
// schedule" on the right, a 240px Mine/Organization tab bar, then the 2-col grid.
export function SchedulesLoadingState() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, padding: '32px 0', width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <div style={{ flex: '1 0 0' }}>
          <Line lh={32} h={24} w={112} />
          <Line lh={22} h={14} w={262} mt={4} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Pill w={32} h={32} r={8} />
          <Pill w={128} h={32} r={8} />
        </div>
      </div>

      <div className="kaya-skeleton" style={{ width: 240, height: 32, borderRadius: 8 }} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 24 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <ScheduleCardSkeleton key={i} delay={i} />
        ))}
      </div>
    </div>
  )
}

// ── /schedules/[id] ───────────────────────────────────────────────────────────

function SectionTitle({ w }: { w: number }) {
  return <Line lh={22} h={16} w={w} />
}

// ScheduleDetailView: padding 24/32, gap 24 — back + actions (32) / title block
// (36 + 10 + 20) / next-run tile / [what it does + run history | details 280px].
export function ScheduleDetailLoadingState() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, padding: '24px 0 32px', width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Pill w={104} h={32} r={8} />
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
          <Pill w={32} h={32} r={8} />
          <Pill w={32} h={32} r={8} />
          <Pill w={96} h={32} r={8} />
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Line lh={36} h={28} w={380} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, height: 22 }}>
          <Pill w={52} />
          <Pill w={52} />
          <Pill w={88} />
          <div className="kaya-skeleton" style={{ width: 250, height: 14 }} />
        </div>
      </div>

      {/* Next-run tile: padding 14/16 + label 16 + gap 4 + value 22 */}
      <div style={{ ...BORDERED, height: 72, boxSizing: 'border-box', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 4 }}>
        <Line lh={16} h={11} w={64} />
        <Line lh={22} h={14} w={150} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 280px', gap: 24, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24, minWidth: 0 }}>
          {/* What it does: title + card with 3 body lines (22 each) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <SectionTitle w={104} />
            <div style={{ ...BORDERED, padding: 16, boxSizing: 'border-box' }}>
              <Line lh={22} h={14} w="100%" />
              <Line lh={22} h={14} w="94%" />
              <Line lh={22} h={14} w="58%" />
            </div>
          </div>

          {/* Run history: title + run cards (padding 14/16 around a 22px header) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <SectionTitle w={96} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{
                  height:          50,
                  boxSizing:       'border-box',
                  padding:         '14px 16px',
                  borderRadius:    12,
                  boxShadow:       CARD_SHADOW,
                  backgroundColor: 'var(--card-bg)',
                  display:         'flex',
                  alignItems:      'center',
                  gap:             8,
                  opacity:         1 - i * 0.15,
                }}>
                  <div className="kaya-skeleton" style={{ width: 14, height: 14, borderRadius: '50%' }} />
                  <div className="kaya-skeleton" style={{ width: 76, height: 12 }} />
                  <div className="kaya-skeleton" style={{ width: 120, height: 12, marginLeft: 'auto' }} />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Details: title + card of 4 rows (padding 12 + 22 line, 1px dividers) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
          <SectionTitle w={56} />
          <div style={{ ...BORDERED, padding: '4px 16px', boxSizing: 'border-box' }}>
            {[[56, 70], [64, 150], [52, 100], [76, 84]].map(([label, value], i) => (
              <div key={i} style={{
                display:        'flex',
                justifyContent: 'space-between',
                alignItems:     'center',
                gap:            16,
                height:         i === 0 ? 46 : 47,
                boxSizing:      'border-box',
                borderTop:      i === 0 ? 'none' : '1px solid var(--border-default)',
              }}>
                <div className="kaya-skeleton" style={{ width: label, height: 12 }} />
                <div className="kaya-skeleton" style={{ width: value, height: 14 }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
