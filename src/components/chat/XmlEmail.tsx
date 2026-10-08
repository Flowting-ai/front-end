"use client"

import React, { useEffect, useRef, useState } from "react"
import { Check, Copy, FileText, Inbox, Paperclip, PencilLine, Send } from "lucide-react"
import { Button } from "@/components/Button"
import { Badge, type BadgeColor } from "@/components/Badge"
import { MarkdownRenderer } from "@/lib/markdown-utils"
import { parseEmailXml, splitSender } from "./XmlEmail.parse"
import { ChatWidgetShell } from "./ChatWidgetShell"
import styles from "./ChatWidget.module.css"

const STATUS = {
  draft: { label: "Draft", color: "Yellow", icon: PencilLine },
  sent: { label: "Sent", color: "Green", icon: Send },
  received: { label: "Received", color: "Neutral", icon: Inbox },
} satisfies Record<string, { label: string; color: BadgeColor; icon: typeof Inbox }>

// Same height the collapsed body is clipped to in the stylesheet.
const COLLAPSED_HEIGHT = 260

export function XmlEmail({ xml }: { xml: string }) {
  const email = React.useMemo(() => parseEmailXml(xml), [xml])
  const [expanded, setExpanded] = useState(false)
  const [overflowing, setOverflowing] = useState(false)
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState(false)
  const bodyRef = useRef<HTMLDivElement>(null)
  const body = email?.body ?? ""

  // Only offer "Expand" (and fade the bottom edge) when the message really is taller than the clip.
  useEffect(() => {
    const node = bodyRef.current
    if (!node) return
    const measure = () => setOverflowing(node.scrollHeight > COLLAPSED_HEIGHT + 4)
    measure()
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure)
    observer?.observe(node)
    return () => observer?.disconnect()
  }, [body, expanded])

  // The "Copied" confirmation resets itself.
  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 1800)
    return () => clearTimeout(timer)
  }, [copied])

  if (!email) return null
  const status = STATUS[email.status]
  const Icon = status.icon
  const sender = splitSender(email.from)
  const name = sender.name || sender.address || "Unknown sender"
  const initials = name.replace(/@.*$/, "").split(/[\s._-]+/).slice(0, 2).map(word => word[0]).join("").toUpperCase()
  const clipped = !expanded && overflowing

  async function copyBody() {
    try {
      await navigator.clipboard.writeText(email!.body)
      setCopied(true)
      setCopyError(false)
    } catch {
      setCopyError(true)
    }
  }

  return (
    <ChatWidgetShell title={email.subject || "(no subject)"} eyebrow="Email" icon={<Icon size={18} />}
      actions={<><Badge label={status.label} color={status.color} />
        {email.body && <Button type="button" variant="secondary" size="sm" onClick={copyBody} leftIcon={copied ? <Check size={14} /> : <Copy size={14} />}>{copied ? "Copied" : email.status === "draft" ? "Copy draft" : "Copy"}</Button>}</>}>
      <div className={styles.sender}>
        <span className={styles.avatar} aria-hidden="true">{initials}</span>
        <div style={{ minWidth: 0, flex: 1, overflowWrap: "anywhere" }}>
          <div className={styles.title}>{name}</div>
          {sender.name && sender.address && <div className={styles.caption}>{sender.address}</div>}
          <div className={styles.recipients}>
            {([['To', email.to], ['Cc', email.cc], ['Bcc', email.bcc]] as const).map(([label, value]) => value && <span className={styles.recipient} key={label}><span className={styles.recipientLabel}>{label}</span>{value}</span>)}
          </div>
          {email.date && <div className={styles.caption} style={{ marginTop: 8 }}>{email.date}</div>}
        </div>
      </div>
      {email.body && <div className={styles.body}>
        <div ref={bodyRef} className={`kaya-scrollbar ${clipped ? styles.bodyClipped : ""}`}><MarkdownRenderer content={email.body} /></div>
        {(overflowing || expanded) && <div className={styles.bodyToggle}>
          <Button type="button" variant="ghost" size="sm" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>{expanded ? "Collapse message" : "Expand message"}</Button>
        </div>}
        {copyError && <p role="status" className={styles.caption}>Couldn’t copy. Select the message text to copy it manually.</p>}
      </div>}
      {email.attachments.length > 0 && <div className={styles.attachments}>
        <span className={styles.caption}><Paperclip size={14} />{email.attachments.length} {email.attachments.length === 1 ? "attachment" : "attachments"}</span>
        {email.attachments.map((attachment, index) => <span className={styles.attachment} key={`${attachment.name}-${index}`}><span className={styles.attachmentIcon}><FileText size={14} /></span><span>{attachment.name}</span>{attachment.size && <span className={styles.caption}>{attachment.size}</span>}</span>)}
      </div>}
    </ChatWidgetShell>
  )
}
