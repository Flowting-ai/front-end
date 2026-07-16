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
import { m, useReducedMotion } from "framer-motion"
import {
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  FileText,
  Inbox,
  Paperclip,
  PencilLine,
  Send,
  type LucideIcon,
} from "lucide-react"
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

interface EmailTheme {
  label: string
  eyebrow: string
  icon: LucideIcon
  accent: string
  tint: string
  ring: string
  surface: string
}

const STATUS_THEME: Record<ParsedEmail["status"], EmailTheme> = {
  draft: {
    label: "Draft",
    eyebrow: "Email draft",
    icon: PencilLine,
    accent: "#8F7427",
    tint: "rgba(233, 223, 201, 0.72)",
    ring: "rgba(143, 116, 39, 0.22)",
    surface: "linear-gradient(135deg, #FBF7EC 0%, #FFFEFB 56%, #F3EEE3 100%)",
  },
  sent: {
    label: "Sent",
    eyebrow: "Sent email",
    icon: Send,
    accent: "#287A47",
    tint: "rgba(218, 239, 225, 0.76)",
    ring: "rgba(40, 122, 71, 0.20)",
    surface: "linear-gradient(135deg, #EFF8F2 0%, #FFFFFF 56%, #E9F3EC 100%)",
  },
  received: {
    label: "Received",
    eyebrow: "Inbox message",
    icon: Inbox,
    accent: "#496E8B",
    tint: "rgba(222, 235, 244, 0.78)",
    ring: "rgba(73, 110, 139, 0.20)",
    surface: "linear-gradient(135deg, #F0F6FA 0%, #FFFFFF 56%, #EAF0F4 100%)",
  },
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
    <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
      <span style={{ ...metaStyle, color: "var(--neutral-400)", flexShrink: 0 }}>{label}</span>
      <span
        style={{
          ...metaStyle,
          minWidth: 0,
          padding: "2px 7px",
          borderRadius: 999,
          color: "var(--neutral-700)",
          backgroundColor: "rgba(255, 255, 255, 0.72)",
          border: "1px solid rgba(82, 75, 71, 0.10)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
        title={value}
      >
        {value}
      </span>
    </div>
  )
}

export function XmlEmail({ xml }: { xml: string }) {
  const email = React.useMemo(() => parseEmailXml(xml), [xml])
  const reduceMotion = Boolean(useReducedMotion())
  const [expanded, setExpanded] = useState(false)
  const [overflows, setOverflows] = useState(false)
  const [copied, setCopied] = useState(false)
  const bodyRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const el = bodyRef.current
    if (el) setOverflows(el.scrollHeight > BODY_CLAMP_PX + 24)
  }, [email?.body])

  if (!email) return null
  const theme = STATUS_THEME[email.status]
  const StatusIcon = theme.icon
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
      aria-label={`${theme.eyebrow}: ${email.subject || "No subject"}`}
      initial={reduceMotion ? false : { opacity: 0, y: 12, scale: 0.99 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      whileHover={reduceMotion ? undefined : { y: -2 }}
      transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
      style={{
        position: "relative",
        margin: "14px 0",
        width: "min(680px, 100%)",
        boxSizing: "border-box",
        borderRadius: 18,
        border: `1px solid ${theme.ring}`,
        background: theme.surface,
        boxShadow: "0 12px 30px rgba(82, 75, 71, 0.10), 0 2px 4px rgba(82, 75, 71, 0.08)",
        overflow: "hidden",
      }}
    >
      <m.div
        aria-hidden
        initial={reduceMotion ? false : { scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        style={{
          height: 3,
          background: `linear-gradient(90deg, ${theme.accent}, ${theme.ring}, transparent 88%)`,
          transformOrigin: "left",
        }}
      />

      {/* Mail state + actions */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "13px 16px 8px",
        }}
      >
        <m.span
          aria-hidden
          initial={reduceMotion ? false : { scale: 0.8, rotate: -8 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ delay: reduceMotion ? 0 : 0.08, type: "spring", stiffness: 360, damping: 24 }}
          style={{
            width: 34,
            height: 34,
            borderRadius: 11,
            display: "grid",
            placeItems: "center",
            flexShrink: 0,
            color: theme.accent,
            backgroundColor: theme.tint,
            border: `1px solid ${theme.ring}`,
          }}
        >
          <StatusIcon size={16} strokeWidth={1.8} />
        </m.span>

        <div style={{ display: "flex", flexDirection: "column", gap: 1, flex: "1 1 0", minWidth: 0 }}>
          <span
            style={{
              ...metaStyle,
              color: "var(--neutral-500)",
              fontWeight: "var(--font-weight-medium)",
              letterSpacing: "0.01em",
            }}
          >
            {theme.eyebrow}
          </span>
          <span style={{ ...metaStyle, color: theme.accent, display: "inline-flex", alignItems: "center", gap: 5 }}>
            <m.span
              aria-hidden
              animate={reduceMotion ? undefined : { opacity: [0.5, 1, 0.5] }}
              transition={reduceMotion ? undefined : { duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
              style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: theme.accent }}
            />
            {theme.label}
          </span>
        </div>

        {email.date && <span style={{ ...metaStyle, flexShrink: 0 }}>{email.date}</span>}
        {email.status === "draft" && email.body && (
          <m.button
            type="button"
            onClick={copyBody}
            aria-label={copied ? "Draft copied" : "Copy draft body"}
            title={copied ? "Copied" : "Copy draft"}
            whileHover={reduceMotion ? undefined : { scale: 1.03 }}
            whileTap={reduceMotion ? undefined : { scale: 0.97 }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 9px",
              borderRadius: 8,
              border: `1px solid ${copied ? "rgba(40, 122, 71, 0.22)" : "rgba(82, 75, 71, 0.14)"}`,
              backgroundColor: "rgba(255, 255, 255, 0.78)",
              boxShadow: "0 1px 2px rgba(82, 75, 71, 0.06)",
              color: copied ? "var(--color-tag-Green-text, #287a47)" : "var(--neutral-600)",
              cursor: "pointer",
              flexShrink: 0,
              fontFamily: "var(--font-body)",
              fontSize: "var(--font-size-caption)",
              fontWeight: "var(--font-weight-medium)",
            }}
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
            {copied ? "Copied" : "Copy"}
          </m.button>
        )}
      </div>

      {/* Subject */}
      <div style={{ padding: "5px 18px 14px" }}>
        <h3
          style={{
            margin: 0,
            fontFamily: "var(--font-body)",
            fontSize: 18,
            fontWeight: "var(--font-weight-semibold)",
            lineHeight: "25px",
            letterSpacing: "-0.012em",
            color: "var(--neutral-950)",
            overflowWrap: "anywhere",
          }}
        >
          {email.subject || "(no subject)"}
        </h3>
      </div>

      {/* Sender + recipients */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 11,
          margin: "0 12px 10px",
          padding: "11px 12px",
          borderRadius: 13,
          backgroundColor: "rgba(255, 255, 255, 0.55)",
          border: "1px solid rgba(82, 75, 71, 0.09)",
          backdropFilter: "blur(8px)",
        }}
      >
        <m.span
          aria-hidden
          initial={reduceMotion ? false : { opacity: 0, scale: 0.82 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: reduceMotion ? 0 : 0.12, type: "spring", stiffness: 340, damping: 25 }}
          style={{
            width: 40,
            height: 40,
            borderRadius: 13,
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: `linear-gradient(145deg, ${hue}25, ${hue}12)`,
            border: `1px solid ${hue}25`,
            color: hue,
            fontFamily: "var(--font-body)",
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: "0.02em",
          }}
        >
          {initials(sender.name, sender.address)}
        </m.span>
        <div style={{ flex: "1 1 0", display: "flex", flexDirection: "column", gap: 5, minWidth: 0 }}>
          <span
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "var(--font-size-body)",
              fontWeight: "var(--font-weight-medium)",
              lineHeight: "var(--line-height-body)",
              color: "var(--neutral-800)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {sender.name || sender.address || "Unknown sender"}
          </span>
          {sender.name && sender.address && (
            <span style={{ ...metaStyle, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {sender.address}
            </span>
          )}
          {(email.to || email.cc || email.bcc) && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "5px 10px", minWidth: 0 }}>
              <RecipientRow label="To" value={email.to} />
              <RecipientRow label="Cc" value={email.cc} />
              <RecipientRow label="Bcc" value={email.bcc} />
            </div>
          )}
        </div>
      </div>

      {/* Paper body */}
      {(email.body || email.attachments.length > 0) && (
        <div
          style={{
            margin: "0 12px 12px",
            borderRadius: 13,
            backgroundColor: "rgba(255, 255, 255, 0.92)",
            border: "1px solid rgba(82, 75, 71, 0.11)",
            boxShadow: "0 2px 8px rgba(82, 75, 71, 0.06)",
            overflow: "hidden",
          }}
        >
          {email.body && (
            <div style={{ padding: "15px 17px 13px" }}>
              <m.div
                ref={bodyRef}
                animate={{ height: expanded || !overflows ? "auto" : BODY_CLAMP_PX }}
                transition={reduceMotion ? { duration: 0 } : { duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                style={{ overflow: "hidden" }}
              >
                <MarkdownRenderer content={email.body} />
              </m.div>
              {overflows && (
                <m.button
                  type="button"
                  onClick={() => setExpanded((v) => !v)}
                  whileHover={reduceMotion ? undefined : { x: 2 }}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    marginTop: 8,
                    padding: 0,
                    border: "none",
                    background: "none",
                    cursor: "pointer",
                    fontFamily: "var(--font-body)",
                    fontSize: "var(--font-size-caption)",
                    fontWeight: "var(--font-weight-medium)",
                    color: theme.accent,
                  }}
                >
                  {expanded ? "Show less" : "Show full message"}
                  {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                </m.button>
              )}
            </div>
          )}

          {email.attachments.length > 0 && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 7,
                padding: "10px 12px 12px",
                borderTop: email.body ? "1px solid var(--neutral-100)" : undefined,
              }}
            >
              <span style={{ ...metaStyle, display: "inline-flex", alignItems: "center", gap: 5, color: "var(--neutral-500)" }}>
                <Paperclip size={13} />
                {email.attachments.length} {email.attachments.length === 1 ? "attachment" : "attachments"}
              </span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                {email.attachments.map((att, i) => (
                  <m.span
                    key={`${att.name}-${i}`}
                    initial={reduceMotion ? false : { opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: reduceMotion ? 0 : 0.16 + i * 0.04 }}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      minWidth: 0,
                      padding: "7px 9px",
                      borderRadius: 9,
                      border: "1px solid var(--neutral-100)",
                      backgroundColor: "var(--neutral-50)",
                      fontFamily: "var(--font-body)",
                      fontSize: "var(--font-size-caption)",
                      color: "var(--neutral-700)",
                    }}
                  >
                    <FileText size={14} color={theme.accent} />
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{att.name}</span>
                    {att.size && <span style={{ color: "var(--neutral-400)", flexShrink: 0 }}>{att.size}</span>}
                  </m.span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </m.div>
  )
}
