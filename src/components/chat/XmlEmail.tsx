"use client"

/**
 * XmlEmail.tsx
 *
 * Renders an <email>...</email> XML block from the assistant as an email
 * card — used for fetched inbox messages, drafts awaiting approval, and sent
 * confirmations alike:
 *
 *   <email status="received" from="Kai (kai@acme.com)" to="you@store.com"
 *          cc="ops@store.com" bcc="archive@store.com" date="Jul 15, 2026"
 *          subject="Q3 numbers">
 *     <attachment name="report.pdf" size="1.2 MB"/>
 *     Body **markdown** here.
 *   </email>
 *
 * status: "draft" | "sent" | "received" (default). Reading-pane anatomy:
 * subject + status up top, sender avatar row, labeled To/Cc/Bcc lines, body
 * (clamped with Show more), attachment chips. Drafts get a copy button.
 * See: docs/frontend-rendering.md - Email section.
 */

import React, { useState } from "react"
import { m } from "framer-motion"
import { Copy, Check } from "lucide-react"
import { Badge } from "@/components/Badge"
import { MarkdownRenderer } from "@/lib/markdown-utils"
import { scanTags, unescapeXml } from "@/lib/xml-widgets"

export interface ParsedEmail {
  status: "draft" | "sent" | "received"
  subject: string
  from?: string
  to?: string
  cc?: string
  bcc?: string
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
    bcc:  attrs.bcc,
    date: attrs.date,
    attachments,
    body: unescapeXml(inner.replace(ATTACHMENT_RE, "")).trim(),
  }
}

/** Split "Kai Rivera (kai@acme.com)" / "Kai <kai@acme.com>" / "kai@acme.com"
 *  into display name + address. */
export function splitSender(raw?: string): { name: string; address: string } {
  if (!raw) return { name: "", address: "" }
  const match = raw.match(/^(.*?)\s*[(<]\s*([^()<>\s]+@[^()<>\s]+)\s*[)>]\s*$/)
  if (match) return { name: match[1].trim(), address: match[2] }
  if (raw.includes("@") && !raw.includes(" ")) return { name: "", address: raw.trim() }
  return { name: raw.trim(), address: "" }
}

const STATUS_BADGE: Record<ParsedEmail["status"], { label: string; color: "Yellow" | "Green" | "Neutral" }> = {
  draft:    { label: "Draft",    color: "Yellow" },
  sent:     { label: "Sent",     color: "Green" },
  received: { label: "Received", color: "Neutral" },
}

// Deterministic avatar hues (hex — mirror the chart palette).
const AVATAR_HUES = ["#683D1B", "#0D6EB2", "#1E8A3C", "#A28847", "#524B47", "#B0562C"]

function avatarHue(seed: string): string {
  let hash = 0
  for (const ch of seed) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  return AVATAR_HUES[hash % AVATAR_HUES.length]
}

function initials(name: string, address: string): string {
  const source = name || address
  if (!source) return "?"
  const words = source.replace(/@.*$/, "").split(/[\s._-]+/).filter(Boolean)
  return words.slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "?"
}

const BODY_CLAMP_PX = 260

const metaStyle: React.CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize:   "var(--font-size-caption)",
  lineHeight: "var(--line-height-caption)",
  color:      "var(--neutral-500)",
}

function RecipientRow({ label, value }: { label: string; value?: string }) {
  if (!value) return null
  return (
    <>
      <span style={{ ...metaStyle, color: "var(--neutral-400)" }}>{label}</span>
      <span style={{ ...metaStyle, color: "var(--neutral-600)", minWidth: 0, overflowWrap: "anywhere" }}>{value}</span>
    </>
  )
}

export function XmlEmail({ xml }: { xml: string }) {
  const email = React.useMemo(() => parseEmailXml(xml), [xml])
  const [expanded, setExpanded] = useState(false)
  const [overflows, setOverflows] = useState(false)
  const [copied, setCopied] = useState(false)
  const bodyRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const el = bodyRef.current
    if (el) setOverflows(el.scrollHeight > BODY_CLAMP_PX + 24)
  }, [email?.body])

  if (!email) return null
  const badge = STATUS_BADGE[email.status]
  const sender = splitSender(email.from)
  const hue = avatarHue(sender.address || sender.name || email.subject)

  const copyBody = () => {
    navigator.clipboard?.writeText(email.body).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <m.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
      style={{
        margin:          "12px 0",
        borderRadius:    14,
        border:          "1px solid var(--neutral-100)",
        backgroundColor: "var(--neutral-white)",
        boxShadow:       "var(--shadow-surface-card)",
        overflow:        "hidden",
        maxWidth:        620,
      }}
    >
      {/* Subject + status */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "14px 16px 0" }}>
        <Badge label={badge.label} color={badge.color} />
        <span
          style={{
            flex:       "1 1 0",
            fontFamily: "var(--font-body)",
            fontSize:   15,
            fontWeight: 500,
            lineHeight: "22px",
            color:      "var(--neutral-900)",
            minWidth:   0,
          }}
        >
          {email.subject || "(no subject)"}
        </span>
        {email.status === "draft" && email.body && (
          <button
            type="button"
            onClick={copyBody}
            aria-label="Copy draft body"
            title="Copy draft"
            style={{
              display:         "flex",
              alignItems:      "center",
              padding:         6,
              borderRadius:    6,
              border:          "1px solid var(--neutral-200)",
              backgroundColor: "var(--neutral-white)",
              color:           copied ? "var(--color-tag-Green-text, #1e8a3c)" : "var(--neutral-500)",
              cursor:          "pointer",
              flexShrink:      0,
            }}
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
          </button>
        )}
      </div>

      {/* Sender row */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px 10px" }}>
        <span
          aria-hidden
          style={{
            width:           36,
            height:          36,
            borderRadius:    "50%",
            flexShrink:      0,
            display:         "flex",
            alignItems:      "center",
            justifyContent:  "center",
            backgroundColor: `${hue}22`,
            color:           hue,
            fontFamily:      "var(--font-body)",
            fontSize:        13,
            fontWeight:      600,
            letterSpacing:   "0.02em",
          }}
        >
          {initials(sender.name, sender.address)}
        </span>
        <div style={{ flex: "1 1 0", display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
          <span
            style={{
              fontFamily:   "var(--font-body)",
              fontSize:     "var(--font-size-body)",
              fontWeight:   500,
              lineHeight:   "var(--line-height-body)",
              color:        "var(--neutral-800)",
              overflow:     "hidden",
              textOverflow: "ellipsis",
              whiteSpace:   "nowrap",
            }}
          >
            {sender.name || sender.address || "Unknown sender"}
          </span>
          {sender.name && sender.address && (
            <span style={{ ...metaStyle, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {sender.address}
            </span>
          )}
        </div>
        {email.date && <span style={{ ...metaStyle, flexShrink: 0 }}>{email.date}</span>}
      </div>

      {/* Recipients */}
      {(email.to || email.cc || email.bcc) && (
        <div
          style={{
            display:             "grid",
            gridTemplateColumns: "max-content 1fr",
            columnGap:           10,
            rowGap:              3,
            padding:             "0 16px 10px 62px",
          }}
        >
          <RecipientRow label="To" value={email.to} />
          <RecipientRow label="Cc" value={email.cc} />
          <RecipientRow label="Bcc" value={email.bcc} />
        </div>
      )}

      {/* Body */}
      {email.body && (
        <div style={{ padding: "10px 16px 12px", borderTop: "1px solid var(--neutral-100)" }}>
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
                marginTop:      6,
                padding:        0,
                border:         "none",
                background:     "none",
                cursor:         "pointer",
                fontFamily:     "var(--font-body)",
                fontSize:       "var(--font-size-caption)",
                color:          "var(--neutral-500)",
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
    </m.div>
  )
}
