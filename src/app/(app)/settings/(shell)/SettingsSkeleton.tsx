'use client'

import React from 'react'

// ── Primitive ─────────────────────────────────────────────────────────────────

function Bone({
  w,
  h = 14,
  r = 6,
  style: extra,
}: {
  w?: number | string
  h?: number
  r?: number
  style?: React.CSSProperties
}) {
  return (
    <div
      aria-hidden
      className="kaya-skeleton"
      style={{ width: w, height: h, borderRadius: r, flexShrink: 0, ...extra }}
    />
  )
}

// ── Shared layout constants ───────────────────────────────────────────────────

const OUTER: React.CSSProperties = {
  flex:           '1 0 0',
  minHeight:      0,
  overflowY:      'auto',
  overflowX:      'hidden',
  display:        'flex',
  alignItems:     'flex-start',
  justifyContent: 'center',
  padding:        '64px 24px 48px',
}

const INNER: React.CSSProperties = {
  width:         '100%',
  maxWidth:      860,
  display:       'flex',
  flexDirection: 'column',
  gap:           10,
}

const CARD: React.CSSProperties = {
  border:        '1px solid var(--neutral-200)',
  borderRadius:  16,
  boxShadow:     '0px 2px 2.8px 0px rgba(82,75,71,0.12)',
  display:       'flex',
  flexDirection: 'column',
  overflow:      'hidden',
  paddingTop:    12,
  paddingBottom: 12,
}

// ── Shared skeleton shapes ────────────────────────────────────────────────────

function PageHeader() {
  return (
    <div style={{ paddingLeft: 4, marginBottom: 4, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <Bone w={180} h={28} r={8} />
      <Bone w="60%" h={14} />
    </div>
  )
}

function Section({
  children,
  divider,
  padV = 12,
  padH = 24,
}: {
  children: React.ReactNode
  divider?: boolean
  padV?: number
  padH?: number
}) {
  return (
    <div style={{
      padding:       `${padV}px ${padH}px`,
      borderBottom:  divider ? '1px solid var(--neutral-100)' : undefined,
      display:       'flex',
      flexDirection: 'column',
      gap:           12,
    }}>
      {children}
    </div>
  )
}

function FormRow2Col() {
  return (
    <div style={{ display: 'flex', gap: 16 }}>
      {[0, 1].map(col => (
        <div key={col} style={{ flex: '1 0 0', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Bone w={80} h={12} />
          <Bone w="100%" h={36} r={8} />
        </div>
      ))}
    </div>
  )
}

function ListRow({ iconSize = 20, lines = 2 }: { iconSize?: number; lines?: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <Bone w={iconSize} h={iconSize} r={6} style={{ flexShrink: 0 }} />
      <div style={{ flex: '1 0 0', display: 'flex', flexDirection: 'column', gap: 5 }}>
        <Bone w="55%" h={13} />
        {lines > 1 && <Bone w="35%" h={11} />}
      </div>
    </div>
  )
}

function ToggleRow() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
      <div style={{ flex: '1 0 0', display: 'flex', flexDirection: 'column', gap: 5 }}>
        <Bone w="50%" h={13} />
        <Bone w="35%" h={11} />
      </div>
      <div style={{ display: 'flex', gap: 32 }}>
        <Bone w={36} h={20} r={10} />
        <Bone w={36} h={20} r={10} />
      </div>
    </div>
  )
}

// ── Page skeletons ────────────────────────────────────────────────────────────

export function AccountSkeleton() {
  return (
    <div className="kaya-scrollbar" style={OUTER} aria-busy="true">
      <div style={INNER}>
        <PageHeader />

        <div style={CARD}>
          <Section divider>
            <Bone w={65} h={65} r={32} />
          </Section>
          <Section divider>
            <FormRow2Col />
          </Section>
          <Section divider>
            <FormRow2Col />
          </Section>
          <Section>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Bone w={130} h={34} r={8} />
            </div>
          </Section>
        </div>

        <div style={CARD}>
          <Section divider>
            <Bone w={110} h={16} />
          </Section>
          <Section>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <Bone w={160} h={14} />
                <Bone w={280} h={12} />
              </div>
              <Bone w={140} h={34} r={8} />
            </div>
          </Section>
        </div>
      </div>
    </div>
  )
}

export function FilesSkeleton() {
  return (
    <div className="kaya-scrollbar" style={OUTER} aria-busy="true">
      <div style={INNER}>
        <PageHeader />

        {/* Storage used */}
        <div style={CARD}>
          <Section divider>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Bone w={120} h={16} />
              <Bone w={80} h={22} r={6} />
            </div>
          </Section>
          <Section divider>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Bone w={80} h={12} />
              <Bone w={60} h={12} />
            </div>
            <Bone w="100%" h={4} r={2} />
          </Section>
          <Section>
            {[0, 1, 2].map(i => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Bone w="45%" h={13} />
                <Bone w={50} h={13} />
              </div>
            ))}
          </Section>
        </div>

        {/* File processing */}
        <div style={CARD}>
          <Section divider>
            <Bone w={140} h={16} />
          </Section>
          <Section divider>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Bone w={100} h={13} />
              <Bone w={200} h={36} r={8} />
            </div>
          </Section>
          <Section divider>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Bone w={100} h={13} />
              <Bone w={200} h={36} r={8} />
            </div>
          </Section>
          <Section>
            <Bone w={130} h={13} />
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {[0, 1, 2, 3, 4, 5, 6, 7].map(i => <Bone key={i} w={48} h={22} r={6} />)}
            </div>
          </Section>
        </div>

        {/* Limits by plan */}
        <div style={CARD}>
          <Section divider>
            <Bone w={140} h={16} />
          </Section>
          <Section>
            <div style={{ border: '1px solid var(--neutral-100)', borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[0, 1, 2, 3].map(row => (
                <div key={row} style={{ display: 'flex', gap: 24 }}>
                  {[80, 100, 110, 90].map((w, col) => <Bone key={col} w={w} h={12} />)}
                </div>
              ))}
            </div>
          </Section>
        </div>

        {/* Data management */}
        <div style={CARD}>
          <Section divider>
            <Bone w={155} h={16} />
          </Section>
          {[0, 1].map(i => (
            <Section key={i} divider={i === 0}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <Bone w={120} h={14} />
                  <Bone w={220} h={12} />
                </div>
                <Bone w={120} h={34} r={8} />
              </div>
            </Section>
          ))}
        </div>
      </div>
    </div>
  )
}

export function SecuritySkeleton() {
  return (
    <div className="kaya-scrollbar" style={OUTER} aria-busy="true">
      <div style={INNER}>
        <PageHeader />

        {/* 2FA */}
        <div style={CARD}>
          <Section divider>
            <Bone w={220} h={16} />
            <Bone w="55%" h={12} />
          </Section>
          <Section>
            <div style={{ border: '1px solid var(--neutral-100)', borderRadius: 8, padding: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <Bone w={100} h={20} r={6} />
                <Bone w={160} h={12} />
                <Bone w={260} h={12} />
              </div>
              <Bone w={110} h={34} r={8} />
            </div>
          </Section>
        </div>

        {/* Password */}
        <div style={CARD}>
          <Section divider>
            <Bone w={100} h={16} />
            <Bone w="50%" h={12} />
          </Section>
          <Section>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Bone w={200} h={36} r={8} />
                <Bone w={80} h={22} r={6} />
              </div>
              <Bone w={140} h={34} r={8} />
            </div>
          </Section>
        </div>

        {/* Sessions */}
        <div style={CARD}>
          <Section divider>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Bone w={130} h={16} />
                <Bone w={70} h={22} r={6} />
              </div>
              <Bone w={140} h={34} r={8} />
            </div>
          </Section>
          <Section>
            {[0, 1, 2, 3].map(i => <ListRow key={i} iconSize={20} />)}
          </Section>
        </div>

        {/* Sign-in methods */}
        <div style={CARD}>
          <Section divider>
            <Bone w={140} h={16} />
            <Bone w="50%" h={12} />
          </Section>
          <Section>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Bone w={20} h={20} r={4} style={{ flexShrink: 0 }} />
              <div style={{ flex: '1 0 0', display: 'flex', flexDirection: 'column', gap: 5 }}>
                <Bone w={60} h={14} />
                <Bone w={160} h={12} />
              </div>
              <Bone w={80} h={22} r={6} />
              <Bone w={100} h={34} r={8} />
            </div>
          </Section>
        </div>
      </div>
    </div>
  )
}

export function NotificationsSkeleton() {
  function NotifGroup({ rowCount }: { rowCount: number }) {
    return (
      <div style={CARD}>
        <Section divider>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Bone w={160} h={16} />
            <div style={{ display: 'flex', gap: 8 }}>
              <Bone w={80} h={28} r={8} />
              <Bone w={80} h={28} r={8} />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 32 }}>
            <Bone w={50} h={12} />
            <Bone w={50} h={12} />
          </div>
        </Section>
        <Section>
          {Array.from({ length: rowCount }).map((_, i) => <ToggleRow key={i} />)}
        </Section>
      </div>
    )
  }

  return (
    <div className="kaya-scrollbar" style={OUTER} aria-busy="true">
      <div style={INNER}>
        <PageHeader />
        <NotifGroup rowCount={6} />
        <NotifGroup rowCount={3} />
        <NotifGroup rowCount={2} />
      </div>
    </div>
  )
}

export function PreferencesSkeleton() {
  return (
    <div className="kaya-scrollbar" style={OUTER} aria-busy="true">
      <div style={INNER}>
        <PageHeader />

        {/* Screen mode */}
        <div style={CARD}>
          <Section divider>
            <Bone w={115} h={16} />
            <Bone w="60%" h={12} />
          </Section>
          <Section>
            <div style={{ display: 'flex', gap: 24 }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{ flex: '1 0 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <Bone w="100%" h={64} r={8} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Bone w={16} h={16} r={4} />
                    <Bone w={70} h={12} />
                  </div>
                </div>
              ))}
            </div>
          </Section>
        </div>

        {/* AI tone */}
        <div style={CARD}>
          <Section divider>
            <Bone w={75} h={16} />
            <Bone w="55%" h={12} />
          </Section>
          <Section divider>
            <Bone w="100%" h={34} r={8} />
          </Section>
          <Section divider>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Bone w={160} h={14} />
              <Bone w={55} h={12} />
            </div>
            <Bone w="100%" h={96} r={8} />
            <Bone w="70%" h={12} />
          </Section>
        </div>

        {/* Memory */}
        <div style={CARD}>
          <Section>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <Bone w={170} h={16} />
                <Bone w={240} h={12} />
                <Bone w={130} h={22} r={6} />
              </div>
              <Bone w={140} h={34} r={8} />
            </div>
          </Section>
        </div>
      </div>
    </div>
  )
}

export function HelpSkeleton() {
  return (
    <div className="kaya-scrollbar" style={OUTER} aria-busy="true">
      <div style={INNER}>
        <PageHeader />

        {/* 2-col action cards */}
        <div style={{ display: 'flex', gap: 10 }}>
          {[0, 1].map(i => (
            <div key={i} style={{ ...CARD, flex: '1 0 0' }}>
              <Section divider>
                <Bone w={130} h={16} />
                <Bone w="80%" h={12} />
                <Bone w="65%" h={12} />
              </Section>
              <Section>
                <Bone w={130} h={34} r={8} />
              </Section>
            </div>
          ))}
        </div>

        {/* Help resources */}
        <div style={CARD}>
          <Section divider>
            <Bone w={130} h={16} />
            <Bone w="50%" h={12} />
          </Section>
          <Section>
            {[0, 1, 2, 3].map(i => <ListRow key={i} iconSize={16} lines={1} />)}
          </Section>
        </div>

        {/* Legal */}
        <div style={CARD}>
          <Section divider>
            <Bone w={55} h={16} />
            <Bone w="50%" h={12} />
          </Section>
          <Section>
            {[0, 1, 2, 3].map(i => <ListRow key={i} iconSize={16} lines={1} />)}
          </Section>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 8 }}>
          <Bone w={220} h={12} />
        </div>
      </div>
    </div>
  )
}
