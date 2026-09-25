/**
 * XmlEmail.parse.ts
 *
 * Pure parsing for the <email> XML block, split out from XmlEmail.tsx so
 * that file only exports the component (Fast Refresh can't safely preserve
 * component state in a file that also exports non-component values).
 */

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
