'use client'

import React from 'react'

// Placeholders for the flat sidebar while its chrome waits to appear all at
// once (`chromeReady` in LeftSidebar). Each one copies the geometry of the row
// it stands in for, so nothing moves at the reveal:
// - destination rows: FlatSidebarRow `default` (32 px, 8 px padding, 20 px icon, 8 px gap)
// - section headers: FlatSidebarRow `header` (24 px, 2 px 8 px padding, label, chevron, 16 px actions)
// - chat rows: FlatSidebarRow `chat-item` (32 px, text only)
// - the profile row: FlatSidebarProfileRow (50 px, 32 px round avatar, two lines, settings icon)
// Bar widths follow the real labels (14 px body text) rather than random lengths.

const bone = (style: React.CSSProperties): React.CSSProperties => ({ flexShrink: 0, ...style })

/** A text bar centred in a 22 px (body) or 16 px (caption) line. */
function TextBar({ width, caption = false }: { width: number | string; caption?: boolean }) {
  return (
    <div style={{ height: caption ? 16 : 22, display: 'flex', alignItems: 'center', minWidth: 0 }}>
      <div className="kaya-skeleton" style={bone({ width, maxWidth: '100%', height: caption ? 8 : 10, borderRadius: 4 })} />
    </div>
  )
}

const ROW: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, height: 32, boxSizing: 'border-box', borderRadius: 10 }

// Widths of the destination labels as rendered: New, Agents, Schedules, Library, Connectors, Souvenir in Slack.
const DESTINATION_WIDTHS = [30, 46, 68, 48, 76]
const SLACK_LABEL_WIDTH = 114

export function SidebarDestinationsSkeleton({ withSlack, collapsed }: { withSlack: boolean; collapsed: boolean }) {
  const widths = withSlack ? [...DESTINATION_WIDTHS, SLACK_LABEL_WIDTH] : DESTINATION_WIDTHS
  return (
    <>
      {widths.map((w, i) => (
        <div key={i} aria-hidden style={{ ...ROW, padding: collapsed ? '0 6px' : '0 8px', width: collapsed ? 32 : '100%' }}>
          <div className="kaya-skeleton" style={bone({ width: 20, height: 20, borderRadius: 6 })} />
          {!collapsed && <TextBar width={w} />}
          {!collapsed && withSlack && i === widths.length - 1 && (
            // The "Add" chip at the end of the Slack row.
            <div style={{ marginLeft: 'auto' }}><TextBar width={20} caption /></div>
          )}
        </div>
      ))}
    </>
  )
}

function SectionHeader({ labelWidth }: { labelWidth: number }) {
  return (
    <div aria-hidden style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 24, padding: '2px 8px', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <TextBar width={labelWidth} />
        <div className="kaya-skeleton" style={bone({ width: 12, height: 12, borderRadius: 3 })} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <div className="kaya-skeleton" style={bone({ width: 16, height: 16, borderRadius: 4 })} />
        <div className="kaya-skeleton" style={bone({ width: 16, height: 16, borderRadius: 4 })} />
      </div>
    </div>
  )
}

/** "Projects" header and one project row (folder icon and name). */
export function SidebarProjectsSkeleton() {
  return (
    <>
      <SectionHeader labelWidth={53} />
      <div aria-hidden style={{ ...ROW, padding: '0 8px' }}>
        <div className="kaya-skeleton" style={bone({ width: 20, height: 20, borderRadius: 6 })} />
        <TextBar width={104} />
      </div>
    </>
  )
}

// Chat titles vary; a fixed pattern keeps server and client output identical.
const CHAT_WIDTHS = [150, 96, 182, 120, 70, 200, 164, 110]

/** Chat rows only (also used by Recent Chats while its list loads after the reveal). */
export function SidebarChatRowsSkeleton({ rows = CHAT_WIDTHS.length }: { rows?: number }) {
  return (
    <>
      {CHAT_WIDTHS.slice(0, rows).map((w, i) => (
        <div key={i} aria-hidden style={{ ...ROW, padding: '0 8px' }}>
          <TextBar width={w} />
        </div>
      ))}
    </>
  )
}

/** "Recent Chats" header and chat rows. */
export function SidebarRecentsSkeleton({ rows }: { rows?: number }) {
  return (
    <>
      <SectionHeader labelWidth={86} />
      <SidebarChatRowsSkeleton rows={rows} />
    </>
  )
}

/** The profile row: round avatar, name and workspace lines, settings icon. */
export function SidebarProfileSkeleton({ collapsed }: { collapsed: boolean }) {
  if (collapsed) {
    return (
      <div aria-hidden style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
        <div className="kaya-skeleton" style={bone({ width: 32, height: 32, borderRadius: 9999 })} />
      </div>
    )
  }
  return (
    <div aria-hidden style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', height: 50, padding: '0 12px', boxSizing: 'border-box' }}>
      <div className="kaya-skeleton" style={bone({ width: 32, height: 32, borderRadius: 9999 })} />
      <div style={{ flex: '1 0 0', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <TextBar width={36} />
        <TextBar width={92} caption />
      </div>
      <div className="kaya-skeleton" style={bone({ width: 16, height: 16, borderRadius: 4 })} />
    </div>
  )
}
