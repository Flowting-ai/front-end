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

// Horizontal padding lives on INNER, not OUTER (the scrolling element) — keeps
// the scrollbar flush with the container's edge instead of inset by it.
const OUTER: React.CSSProperties = {
  flex:           '1 0 0',
  minHeight:      0,
  overflowY:      'auto',
  overflowX:      'hidden',
  display:        'flex',
  alignItems:     'flex-start',
  justifyContent: 'center',
  paddingTop:     64,
  paddingBottom:  48,
}

const INNER: React.CSSProperties = {
  width:         '100%',
  maxWidth:      908,
  padding:       '0 24px',
  boxSizing:     'border-box',
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

const DANGER_CARD: React.CSSProperties = { ...CARD, border: '1px solid var(--red-200, #fecaca)' }

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

function CheckboxRow() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <Bone w={16} h={16} r={4} style={{ flexShrink: 0 }} />
      <Bone w="45%" h={13} />
    </div>
  )
}

function SectionLabel() {
  return <Bone w={90} h={11} r={4} />
}

/** Sign-in-session row — icon + 2 lines, "Current" badge, trailing 3-dot menu
 *  button. */
function SessionRowSkeleton({ current = false }: { current?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <Bone w={20} h={20} r={6} style={{ flexShrink: 0 }} />
      <div style={{ flex: '1 0 0', display: 'flex', flexDirection: 'column', gap: 5 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Bone w="40%" h={13} />
          {current && <Bone w={56} h={18} r={6} />}
        </div>
        <Bone w="30%" h={11} />
      </div>
      <Bone w={28} h={28} r={8} style={{ flexShrink: 0 }} />
    </div>
  )
}

/** Help/Legal link row — no leading icon; title+description left, a "View →"
 *  ghost button right. */
function LinkRowSkeleton() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
      <div style={{ flex: '1 0 0', display: 'flex', flexDirection: 'column', gap: 5 }}>
        <Bone w="45%" h={13} />
        <Bone w="65%" h={11} />
      </div>
      <Bone w={64} h={22} r={6} style={{ flexShrink: 0 }} />
    </div>
  )
}

// ── Page skeletons ────────────────────────────────────────────────────────────

// Real page maxWidth is 860, not the shared 908 every other skeleton here uses.
const ACCOUNT_INNER: React.CSSProperties = { ...INNER, maxWidth: 860 }

export function AccountSkeleton() {
  return (
    <div className="kaya-scrollbar" style={OUTER} aria-busy="true">
      <div style={ACCOUNT_INNER}>
        <PageHeader />

        {/* Profile card */}
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

        {/* Personalisation — Style + Default Model rows */}
        <div style={CARD}>
          <Section divider>
            <Bone w={130} h={16} />
          </Section>
          {[0, 1].map(i => (
            <Section key={i} divider={i === 0}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <Bone w={110} h={14} />
                  <Bone w={200} h={12} />
                </div>
                <Bone w={160} h={34} r={8} />
              </div>
            </Section>
          ))}
        </div>

        {/* Danger Zone — Delete account row with "Coming soon" badge */}
        <div style={DANGER_CARD}>
          <Section divider>
            <Bone w={110} h={16} />
            <Bone w="55%" h={12} />
          </Section>
          <Section>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Bone w={140} h={14} />
                <Bone w={90} h={20} r={6} />
              </div>
              <Bone w={120} h={34} r={8} />
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
            <Bone w="60%" h={12} />
          </Section>
          <Section divider>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Bone w={80} h={12} />
              <Bone w={60} h={12} />
            </div>
            <Bone w="100%" h={4} r={2} />
            <Bone w="70%" h={11} />
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
            <Bone w="55%" h={12} />
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
            <Bone w="55%" h={12} />
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
            <Bone w="60%" h={12} />
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

        {/* Password — field stacked above badge, left column beside the button */}
        <div style={CARD}>
          <Section divider>
            <Bone w={100} h={16} />
            <Bone w="50%" h={12} />
          </Section>
          <Section>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <Bone w={327} h={36} r={8} />
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
            {[0, 1, 2, 3].map(i => <SessionRowSkeleton key={i} current={i === 0} />)}
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
  function NotifGroupHeader() {
    return (
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
    )
  }

  return (
    <div className="kaya-scrollbar" style={OUTER} aria-busy="true">
      <div style={INNER}>
        <PageHeader />

        {/* Activity — 3 labelled sub-sections (AUTOMATIONS/CONTENT/USAGE) plus
            the Budget routing checkbox group, not one flat toggle list. */}
        <div style={CARD}>
          <NotifGroupHeader />
          <Section>
            <SectionLabel />
            {[0, 1].map(i => <ToggleRow key={i} />)}
          </Section>
          <Section divider>
            <SectionLabel />
            {[0, 1].map(i => <ToggleRow key={i} />)}
          </Section>
          <Section divider>
            <SectionLabel />
            {[0, 1].map(i => <ToggleRow key={i} />)}
          </Section>
          <Section>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <Bone w="50%" h={13} />
              <Bone w="35%" h={11} />
            </div>
            {[0, 1, 2].map(i => <CheckboxRow key={i} />)}
          </Section>
        </div>

        {/* Team & Collaboration */}
        <div style={CARD}>
          <NotifGroupHeader />
          <Section>
            {[0, 1, 2].map(i => <ToggleRow key={i} />)}
          </Section>
        </div>

        {/* Billing */}
        <div style={CARD}>
          <NotifGroupHeader />
          <Section>
            {[0, 1].map(i => <ToggleRow key={i} />)}
          </Section>
        </div>

        {/* Standalone info card — "Billing email notifications cannot be disabled" */}
        <div style={CARD}>
          <Section>
            <Bone w="75%" h={13} />
          </Section>
        </div>
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
            <SectionLabel />
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

        {/* Help resources — Help Center, Contact Support, Community Slack
            ("What's new" is commented out on the real page) */}
        <div style={CARD}>
          <Section divider>
            <Bone w={130} h={16} />
            <Bone w="50%" h={12} />
          </Section>
          <Section>
            {[0, 1, 2].map(i => <LinkRowSkeleton key={i} />)}
          </Section>
        </div>

        {/* Legal — Terms, Privacy, Cookie ("Data Processing Agreement" is
            commented out on the real page) */}
        <div style={CARD}>
          <Section divider>
            <Bone w={55} h={16} />
            <Bone w="50%" h={12} />
          </Section>
          <Section>
            {[0, 1, 2].map(i => <LinkRowSkeleton key={i} />)}
          </Section>
        </div>

        {/* Footer — left-aligned row, not centered */}
        <div style={{ display: 'flex', alignItems: 'center', paddingTop: 8 }}>
          <Bone w="100%" h={12} />
        </div>
      </div>
    </div>
  )
}
