"use client"

/**
 * XmlEmail.tsx
 *
 * Renders an <email>...</email> XML block from the assistant as an email
 * card — used for fetched inbox messages, drafts awaiting approval, and sent
 * confirmations alike:
 *
 *   <email status="received" from="Kai (kai@acme.com)" to="you@store.com"
 *          date="Jul 15, 2026" subject="Q3 numbers">
 *     <attachment name="report.pdf" size="1.2 MB"/>
 *     Body **markdown** here.
 *   </email>
 *
 * status: "draft" | "sent" | "received" (default). Long bodies clamp with a
 * Show more toggle. See: docs/frontend-rendering.md - Email section.
 */

import React, { useState } from "react"
import { Badge } from "@/components/Badge"
import { MarkdownRenderer } from "@/lib/markdown-utils"
import { scanTags, unescapeXml } from "@/lib/xml-widgets"

export interface ParsedEmail {
  status: "draft" | "sent" | "received"
  subject: string
  from?: string
  to?: string
  cc?: string
  date?: string
  attachments: Array<{ name: string; size?: string }>
  body: string
}

const ATTACHMENT_RE = /<attachment\b[^>]*?\/?>(?:<\/attachment>)?/gi

export function parseEmailXml(xml: string): ParsedEmail | null {
  const [email] = scanTags(xml, "email")
  if (!email) return null
  const { attrs, inner } = email
  const subject = attrs.subject ?? ""
  if (!subject && !inner.trim()) return null

  const attachments = scanTags(inner, "attachment")
    .filter((a) => a.attrs.name)
    .map((a) => ({ name: a.attrs.name, size: a.attrs.size }))

  const status =
    attrs.status === "draft" ? "draft" :
    attrs.status === "sent"  ? "sent"  : "received"

  return {
    status,
    subject,
    from: attrs.from,
    to:   attrs.to,
    cc:   attrs.cc,
    date: attrs.date,
    attachments,
    body: unescapeXml(inner.replace(ATTACHMENT_RE, "")).trim(),
  }
}

const STATUS_BADGE: Record<ParsedEmail["status"], { label: string; color: "Yellow" | "Green" | "Neutral" }> = {
  draft:    { label: "Draft",    color: "Yellow" },
  sent:     { label: "Sent",     color: "Green" },
  received: { label: "Received", color: "Neutral" },
}

const BODY_CLAMP_PX = 260

const metaStyle: React.CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize:   "var(--font-size-caption)",
  lineHeight: "var(--line-height-caption)",
  color:      "var(--neutral-500)",
}

export function XmlEmail({ xml }: { xml: string }) {
  const email = React.useMemo(() => parseEmailXml(xml), [xml])
  const [expanded, setExpanded] = useState(false)
  const [overflows, setOverflows] = useState(false)
  const bodyRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const el = bodyRef.current
    if (el) setOverflows(el.scrollHeight > BODY_CLAMP_PX + 24)
  }, [email?.body])

  if (!email) return null
  const badge = STATUS_BADGE[email.status]

  return (
    <div
      style={{
        margin:          "12px 0",
        borderRadius:    12,
        border:          "1px solid var(--neutral-100)",
        backgroundColor: "var(--neutral-white)",
        boxShadow:       "var(--shadow-surface-card)",
        overflow:        "hidden",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "14px 16px 10px", borderBottom: "1px solid var(--neutral-100)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Badge label={badge.label} color={badge.color} />
          <span
            style={{
              flex:       "1 1 0",
              fontFamily: "var(--font-body)",
              fontSize:   "var(--font-size-body)",
              fontWeight: 500,
              lineHeight: "var(--line-height-body)",
              color:      "var(--neutral-900)",
              minWidth:   0,
            }}
          >
            {email.subject || "(no subject)"}
          </span>
          {email.date && <span style={{ ...metaStyle, flexShrink: 0 }}>{email.date}</span>}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", columnGap: 12, rowGap: 2 }}>
          {email.from && <span style={metaStyle}>From&nbsp;&nbsp;{email.from}</span>}
          {email.to && <span style={metaStyle}>To&nbsp;&nbsp;{email.to}</span>}
          {email.cc && <span style={metaStyle}>Cc&nbsp;&nbsp;{email.cc}</span>}
        </div>
      </div>

      {/* Body */}
      {email.body && (
        <div style={{ padding: "10px 16px 12px" }}>
          <div
            ref={bodyRef}
            style={{
              maxHeight: expanded ? undefined : BODY_CLAMP_PX,
              overflow:  "hidden",
            }}
          >
            <MarkdownRenderer content={email.body} />
          </div>
          {overflows && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              style={{
                marginTop:  6,
                padding:    0,
                border:     "none",
                background: "none",
                cursor:     "pointer",
                fontFamily: "var(--font-body)",
                fontSize:   "var(--font-size-caption)",
                color:      "var(--neutral-500)",
                textDecoration: "underline",
              }}
            >
              {expanded ? "Show less" : "Show more"}
            </button>
          )}
        </div>
      )}

      {/* Attachments */}
      {email.attachments.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: "0 16px 12px" }}>
          {email.attachments.map((att, i) => (
            <span
              key={`${att.name}-${i}`}
              style={{
                display:         "inline-flex",
                alignItems:      "center",
                gap:             6,
                padding:         "3px 10px",
                borderRadius:    999,
                border:          "1px solid var(--neutral-200)",
                backgroundColor: "var(--neutral-50)",
                fontFamily:      "var(--font-body)",
                fontSize:        "var(--font-size-caption)",
                color:           "var(--neutral-700)",
              }}
            >
              📎 {att.name}
              {att.size && <span style={{ color: "var(--neutral-400)" }}>{att.size}</span>}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
